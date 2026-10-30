/**
 * Program context for one file: what else the host loads together with it.
 *
 * A .mg file is rarely a program of its own. Its predicates are declared in a
 * sibling schema, its comparator rules need the Decl that gives them modes, a
 * lattice needs its merge Decl. Analyzed alone, such a file reports false
 * errors. The context decides which program a file belongs to:
 *
 *  - embed: a Go package `//go:embed`s several .mg files into one variable;
 *    that is the program, and it is analyzed whole (the engine sees all of it).
 *  - directory: no embed pulls the file in together with others, so the
 *    declarations of the .mg files in its directory are visible (Decls carry
 *    modes, bounds, merge, deferred and external; rules do not leak across
 *    files that may be unrelated).
 *  - alone: nothing else to see.
 *
 * Diagnostics are always reported for the file asked about, in its own lines.
 * Everything is cached against file signatures and edited buffers, and one
 * analysis of a program serves every file in it.
 */

import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { parse, ParseError, ParseResult } from '../parser/index';
import type { Decl, SourceUnit } from '../parser/ast';
import { analyzeUnit, AnalysisDiagnostic } from '../analysis/pipeline';
import { assembleProgram, diagnosticsByFile, ProgramFile } from '../analysis/program';
import { embedGroupsAbove, EmbedGroup } from './embed';
import { Dependencies, dependenciesFresh, nodeFs, RecordingFs, WorkspaceFs } from './fs';
import { IgnoreRules } from './ignore';

export type ContextKind = 'embed' | 'directory' | 'alone';

export interface FileReport {
    /** True when the file is excluded from diagnostics (.mangleignore or directive). */
    ignored: boolean;
    kind: ContextKind;
    /** The other files the analysis saw. */
    context: string[];
    parseErrors: ParseError[];
    diagnostics: AnalysisDiagnostic[];
}

export interface ProgramContextOptions {
    fs?: WorkspaceFs;
    /** Text of an edited (unsaved) buffer, by absolute path. */
    overlay?: (path: string) => string | undefined;
    /** Analyze each file alone (no context). */
    isolated?: boolean;
    /** Budget for cached parse trees of context files, in characters of source. */
    parseBudget?: number;
}

interface Cached<T> { deps: Dependencies; value: T }

const sha = (s: string) => createHash('sha1').update(s).digest('hex');

export class ProgramContext {
    readonly ignore: IgnoreRules;
    private readonly fs: WorkspaceFs;
    private readonly overlay: (path: string) => string | undefined;
    private readonly isolated: boolean;
    private readonly parseBudget: number;

    private readonly embeds = new Map<string, Cached<EmbedGroup[]>>();
    private readonly texts = new Map<string, { sig: string; text: string }>();
    private readonly parses = new Map<string, { text: string; parsed: ParseResult }>();
    private parsedChars = 0;
    private readonly programs = new Map<string, { fp: string; byFile: Map<string, AnalysisDiagnostic[]> }>();

    constructor(options: ProgramContextOptions = {}) {
        this.fs = options.fs ?? nodeFs;
        this.overlay = options.overlay ?? (() => undefined);
        this.isolated = !!options.isolated;
        this.parseBudget = options.parseBudget ?? 6_000_000;
        this.ignore = new IgnoreRules(this.fs);
    }

    /** Files that analyses of `path` depend on changed in a way the caches cannot see (rare). */
    reset(): void {
        this.embeds.clear(); this.texts.clear(); this.parses.clear(); this.programs.clear(); this.parsedChars = 0;
    }

    private textOf(path: string): string | undefined {
        const open = this.overlay(path);
        if (open !== undefined) return open;
        const sig = this.fs.signature(path);
        if (sig === undefined) return undefined;
        const hit = this.texts.get(path);
        if (hit && hit.sig === sig) return hit.text;
        const text = this.fs.readFile(path);
        if (text === undefined) return undefined;
        this.texts.set(path, { sig, text });
        return text;
    }

    private parsedOf(path: string, text: string): ParseResult {
        const hit = this.parses.get(path);
        if (hit && hit.text === text) return hit.parsed;
        if (hit) this.parsedChars -= hit.text.length;
        const parsed = parse(text);
        this.parses.delete(path);
        this.parses.set(path, { text, parsed });
        this.parsedChars += text.length;
        for (const [p, e] of this.parses) {
            if (this.parsedChars <= this.parseBudget || p === path) break;
            this.parses.delete(p);
            this.parsedChars -= e.text.length;
        }
        return parsed;
    }

    /** Embed groups that contain at least two files including `path`. */
    private embedGroupsOf(path: string): EmbedGroup[] {
        const dir = dirname(path);
        let hit = this.embeds.get(dir);
        if (!hit || !dependenciesFresh(this.fs, hit.deps)) {
            const rec = new RecordingFs(this.fs);
            hit = { value: embedGroupsAbove(rec, dir), deps: rec.deps };
            this.embeds.set(dir, hit);
        }
        return hit.value.filter(g => g.files.length > 1 && g.files.includes(path));
    }

    /** The files analyzed together with `path` and how they were found. */
    describe(path: string): { kind: ContextKind; groups: string[][] } {
        if (this.isolated) return { kind: 'alone', groups: [] };
        const groups = this.embedGroupsOf(path);
        if (groups.length > 0) return { kind: 'embed', groups: groups.map(g => g.files) };
        const dir = dirname(path);
        const siblings = (this.fs.readDir(dir) ?? []).filter(n => n.endsWith('.mg')).map(n => join(dir, n)).sort();
        return siblings.some(s => s !== path) ? { kind: 'directory', groups: [siblings] } : { kind: 'alone', groups: [] };
    }

    /** Diagnostics of `path` (whose current text is `text`) in its program context. */
    analyze(path: string, text: string, parsed: ParseResult = parse(text)): FileReport {
        if (this.ignore.isIgnored(path, text)) {
            return { ignored: true, kind: 'alone', context: [], parseErrors: [], diagnostics: [] };
        }
        const { kind, groups } = this.describe(path);
        const report: FileReport = { ignored: false, kind, context: [], parseErrors: parsed.errors, diagnostics: [] };
        if (kind === 'alone') {
            if (parsed.unit) report.diagnostics = analyzeUnit(parsed.unit).diagnostics;
            return report;
        }
        const seen = new Set<string>();
        const context = new Set<string>();
        for (const files of groups) {
            const { diagnostics, others } = kind === 'embed'
                ? this.analyzeEmbed(files, path, text, parsed)
                : this.analyzeDirectory(files, path, text, parsed);
            others.forEach(o => context.add(o));
            for (const d of diagnostics) {
                const key = `${d.code}\0${d.range.start.line}\0${d.range.start.column}\0${d.message}`;
                if (!seen.has(key)) { seen.add(key); report.diagnostics.push(d); }
            }
        }
        report.context = [...context];
        report.diagnostics.sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column);
        return report;
    }

    private analyzeEmbed(files: string[], path: string, text: string, parsed: ParseResult) {
        const inputs: ProgramFile[] = [];
        for (const f of files) {
            if (f === path) { inputs.push({ path, text, parsed }); continue; }
            const t = this.textOf(f);
            if (t !== undefined) inputs.push({ path: f, text: t, parsed: this.parsedOf(f, t) });
        }
        const byFile = this.analyzeAssembled(`embed:${files.join('\0')}`, inputs);
        return { diagnostics: byFile.get(path) ?? [], others: inputs.map(i => i.path).filter(p => p !== path) };
    }

    private analyzeDirectory(siblings: string[], path: string, text: string, parsed: ParseResult) {
        const own = new Set((parsed.unit?.decls ?? []).map(declKey));
        const inputs: ProgramFile[] = [];
        const contributing: string[] = [];
        for (const f of siblings) {
            if (f === path) continue;
            const t = this.textOf(f);
            if (t === undefined || this.ignore.isIgnored(f, t)) continue;
            const decls = analyzableDecls(this.parsedOf(f, t).unit).filter(d => {
                const k = declKey(d);
                if (own.has(k)) return false;
                own.add(k);
                return true;
            });
            if (decls.length === 0) continue;
            contributing.push(f);
            inputs.push({ path: f, text: t, parsed: { errors: [], unit: { packageDecl: null, useDecls: [], decls, clauses: [] } } });
        }
        if (inputs.length === 0) {
            return { diagnostics: parsed.unit ? analyzeUnit(parsed.unit).diagnostics : [], others: [] };
        }
        inputs.push({ path, text, parsed });
        const byFile = this.analyzeAssembled(`dir:${path}`, inputs, false);
        return { diagnostics: byFile.get(path) ?? [], others: contributing };
    }

    /** Analyzes the files as one program, once per distinct content. */
    private analyzeAssembled(key: string, inputs: ProgramFile[], shared = true): Map<string, AnalysisDiagnostic[]> {
        const h = createHash('sha1');
        for (const i of inputs) h.update(i.path).update('\0').update(sha(i.text)).update('\0');
        const fp = h.digest('hex');
        const hit = this.programs.get(key);
        if (hit && hit.fp === fp) return hit.byFile;
        const program = assembleProgram(inputs);
        const byFile = diagnosticsByFile(program, analyzeUnit(program.unit));
        this.programs.set(key, { fp, byFile });
        if (!shared) this.trimPrograms();
        return byFile;
    }

    private trimPrograms(): void {
        for (const k of this.programs.keys()) {
            if (this.programs.size <= 512) return;
            if (k.startsWith('dir:')) this.programs.delete(k);
        }
    }
}

const declKey = (d: Decl) => `${d.declaredAtom.predicate.symbol}/${d.declaredAtom.predicate.arity}`;

function analyzableDecls(unit: SourceUnit | null): Decl[] {
    if (!unit) return [];
    const bad = unit.malformed;
    return bad ? unit.decls.filter(d => !bad.has(d)) : unit.decls;
}
