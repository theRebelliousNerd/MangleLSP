/**
 * Analysis of an assembled program: several .mg files that a host loads as
 * one program (e.g. every file one `//go:embed` pulls in). Cross-file checks
 * (undefined predicates, arity, duplicate Decls, bounds through other files'
 * Decls, negation cycles, negated externals) then see what the engine sees.
 *
 * Each file is parsed on its own (so a syntax error in one file never
 * swallows the first statement of the next), its AST is moved to the file's
 * line range of the assembled program, and the units are merged and analyzed
 * once. Every diagnostic is mapped back to its file and line.
 */

import { parse, ParseError, ParseResult } from '../parser/index';
import { analyzeUnit, AnalysisDiagnostic, AnalysisResult } from './pipeline';
import type { SourceRange, SourceUnit, Clause, Decl } from '../parser/ast';
import type { QuickFix } from './validation';

export interface ProgramFile {
    path: string;
    text: string;
    /** The parse of `text`, when the caller already has it. */
    parsed?: ParseResult;
}

export interface FileAnalysis {
    path: string;
    parseErrors: ParseError[];
    diagnostics: AnalysisDiagnostic[];
}

export interface Segment {
    path: string;
    /** First line of the file in the assembled program (1-based). */
    start: number;
    lines: number;
}

function lineCount(text: string): number {
    return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

function segmentAt(segments: Segment[], line: number): Segment {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segments[mid]!.start <= line) lo = mid;
        else hi = mid - 1;
    }
    return segments[lo]!;
}

function shiftRange(r: SourceRange, by: number): SourceRange {
    return {
        start: { ...r.start, line: r.start.line - by },
        end: { ...r.end, line: r.end.line - by },
    };
}

function shiftFix(f: QuickFix, by: number): QuickFix {
    return {
        ...f,
        range: shiftRange(f.range, by),
        additionalEdits: f.additionalEdits?.map(e => ({ ...e, range: shiftRange(e.range, by) })),
    };
}

/**
 * Copy of an AST with every position moved `lines` lines down. Nodes are
 * plain objects; the copy keeps shared nodes shared (the `malformed` set
 * refers to clauses and declarations by identity).
 */
function relocate<T>(root: T, lines: number): T {
    if (lines === 0) return root;
    const copies = new Map<object, unknown>();
    const copy = (v: unknown): unknown => {
        if (v === null || typeof v !== 'object') return v;
        const seen = copies.get(v);
        if (seen) return seen;
        if (Array.isArray(v)) {
            const out: unknown[] = [];
            copies.set(v, out);
            for (const item of v) out.push(copy(item));
            return out;
        }
        if (v instanceof Set) {
            const out = new Set<unknown>();
            copies.set(v, out);
            for (const item of v) out.add(copy(item));
            return out;
        }
        const src = v as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        copies.set(v, out);
        for (const key of Object.keys(src)) out[key] = copy(src[key]);
        if (typeof src['line'] === 'number' && typeof src['column'] === 'number') out['line'] = (src['line'] as number) + lines;
        return out;
    };
    return copy(root) as T;
}

/** The units of several files as one program; positions already in program lines. */
function mergeUnits(units: SourceUnit[]): SourceUnit {
    const malformed = new Set<Clause | Decl>();
    for (const u of units) for (const m of u.malformed ?? []) malformed.add(m);
    const packages = new Set(units.map(u => u.packageDecl?.name ?? ''));
    return {
        packageDecl: packages.size === 1 ? units.find(u => u.packageDecl)?.packageDecl ?? null : null,
        useDecls: units.flatMap(u => u.useDecls),
        decls: units.flatMap(u => u.decls),
        clauses: units.flatMap(u => u.clauses),
        malformed: malformed.size > 0 ? malformed : undefined,
    };
}

/** A program's merged unit, with the segment of each file in its line numbering. */
export interface AssembledProgram {
    unit: SourceUnit;
    segments: Segment[];
    parseErrors: Map<string, ParseError[]>;
}

export function assembleProgram(files: ProgramFile[]): AssembledProgram {
    const segments: Segment[] = [];
    const units: SourceUnit[] = [];
    const parseErrors = new Map<string, ParseError[]>();
    let line = 1;
    for (const f of files) {
        const parsed = f.parsed ?? parse(f.text);
        const lines = lineCount(f.text);
        segments.push({ path: f.path, start: line, lines });
        parseErrors.set(f.path, parsed.errors);
        if (parsed.unit) units.push(relocate(parsed.unit, line - 1));
        line += lines;
    }
    return { unit: mergeUnits(units), segments, parseErrors };
}

/** The diagnostics of a merged program's analysis, per file and in file lines. */
export function diagnosticsByFile(program: AssembledProgram, result: AnalysisResult): Map<string, AnalysisDiagnostic[]> {
    const out = new Map<string, AnalysisDiagnostic[]>(program.segments.map(s => [s.path, []]));
    for (const d of result.diagnostics) {
        const seg = segmentAt(program.segments, d.range.start.line);
        const by = seg.start - 1;
        out.get(seg.path)!.push({
            ...d,
            range: shiftRange(d.range, by),
            fixes: d.fixes?.map(f => shiftFix(f, by)),
        });
    }
    return out;
}

/** Analyzes files as one program and returns diagnostics per file. */
export function analyzeProgram(files: ProgramFile[]): FileAnalysis[] {
    const program = assembleProgram(files);
    const diagnostics = diagnosticsByFile(program, analyzeUnit(program.unit));
    return files.map(f => ({
        path: f.path,
        parseErrors: program.parseErrors.get(f.path) ?? [],
        diagnostics: diagnostics.get(f.path) ?? [],
    }));
}
