/**
 * review: everything an agent needs about the Mangle in a repository, as one
 * machine-readable plan.
 *
 * 1. Programs: the .mg files each Go host load assembles (from the boundary
 *    scan), with unused embed groups as fallback contexts. Analyze programs
 *    whole; every remaining .mg file is analyzed on its own.
 * 2. The engine's verdict on each assembled program (parse, loose analysis,
 *    strict bounds, evaluation).
 * 3. The boundary findings (Go <-> .mg).
 * 4. A plan: one action per finding, most severe first, with the edits that
 *    fix it when they are unambiguous and the command that verifies it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { analyzeProgram, FileAnalysis } from '../../analysis/program';
import { ProgramContext } from '../../workspace/context';
import { AnalysisDiagnostic } from '../../analysis/pipeline';
import { getDiagnosticInfo } from '../../analysis/diagnostics';
import { OracleUnavailableError } from '../../oracle/client';
import { runBoundary, BoundaryReport } from './boundary';

export interface PlanEdit {
    file: string;
    range: { start: { line: number; column: number }; end: { line: number; column: number } };
    newText: string;
}

export interface PlanAction {
    id: number;
    code: string;
    severity: 'error' | 'warning' | 'info';
    category: string;
    title: string;
    file: string;
    line: number;
    message: string;
    hint?: string;
    /** Why the rule exists, in v0.7 terms (the catalog explanation). */
    why?: string;
    /** Edits that fix it; absent when the fix needs judgment. */
    edits?: PlanEdit[];
    /** Places involved besides `file:line`. */
    related?: { file: string; line: number }[];
    /** Facts the boundary proof rests on. */
    proof?: string[];
    /** Command that shows the action is done. */
    verify: string;
}

export interface ReviewOptions {
    /** Skip the Go boundary scan. */
    noBoundary?: boolean;
    /** Minimum severity of plan actions. */
    severity?: 'error' | 'warning' | 'info';
    /** Host profile for the boundary scan (built-in name or JSON path). */
    profile?: string;
    /** Analyze files alone, without the program context. */
    isolated?: boolean;
}

export interface ReviewReport {
    root: string;
    programs: { id: string; files: string[]; engine?: { stage: string; error?: string } }[];
    boundary?: { engine: string; engineNote?: string; profile: string; scanned: BoundaryReport['scanned']; summary: Record<string, number> } | { unavailable: string };
    summary: { actions: number; bySeverity: Record<string, number>; byCode: Record<string, number> };
    plan: PlanAction[];
}

const SKIP = (name: string) => name.startsWith('.') || name.startsWith('_') || name === 'node_modules' || name === 'vendor' || name === 'testdata';

/** .mg files under root, skipping what `go build ./...` skips. */
export function findMangleFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            const st = statSync(full);
            if (st.isDirectory()) {
                if (!SKIP(name)) walk(full);
            } else if (name.endsWith('.mg')) {
                out.push(full);
            }
        }
    };
    walk(root);
    return out.sort();
}

/**
 * A program of several files is analyzed whole; a file alone is analyzed in
 * the context the editor gives it (the declarations beside it).
 */
function analyzeFiles(context: ProgramContext, files: string[]): FileAnalysis[] {
    const texts = files.map(f => ({ path: f, text: readFileSync(f, 'utf-8') }));
    if (texts.length > 1) return analyzeProgram(texts);
    return texts.map(t => {
        const report = context.analyze(t.path, t.text);
        return { path: t.path, parseErrors: report.parseErrors, diagnostics: report.diagnostics };
    });
}

const RANK = { error: 0, warning: 1, info: 2 } as const;

function verifyFor(code: string, file: string, root: string): string {
    if (code.startsWith('B')) return `mangle-cli boundary --root ${root}`;
    return `mangle-cli check ${file}`;
}

export function runReview(rootArg: string, options: ReviewOptions = {}): ReviewReport {
    const root = resolve(rootArg);
    const context = new ProgramContext({ isolated: options.isolated });
    const files = findMangleFiles(root).filter(f => !context.ignore.isIgnored(f));
    let boundary: BoundaryReport | undefined;
    let boundaryNote: string | undefined;
    const hasGo = existsSync(join(root, 'go.mod'));
    if (!options.noBoundary && hasGo) {
        try {
            boundary = runBoundary(root, options.profile);
        } catch (e) {
            boundaryNote = e instanceof OracleUnavailableError ? e.message : String(e);
        }
    } else if (!hasGo) {
        boundaryNote = 'no go.mod at the root: no Go boundary to scan';
    }

    // Programs: host load contexts and unused embed groups, then remaining files.
    const programs: ReviewReport['programs'] = [];
    const grouped = new Set<string>();
    for (const p of boundary?.programs ?? []) {
        const abs = p.files.map(f => join(root, f)).filter(f => !context.ignore.isIgnored(f));
        if (abs.length === 0) continue;
        abs.forEach(f => grouped.add(f));
        programs.push({ id: p.id, files: abs.map(f => relative(root, f)), engine: { stage: p.verdict.stage, error: p.verdict.error } });
    }
    for (const f of files) {
        if (!grouped.has(f)) programs.push({ id: relative(root, f), files: [relative(root, f)] });
    }

    const actions: Omit<PlanAction, 'id'>[] = [];
    const push = (d: AnalysisDiagnostic, file: string) => {
        const info = getDiagnosticInfo(d.code);
        const rel = relative(root, file);
        actions.push({
            code: d.code, severity: d.severity, category: info?.category ?? 'other', title: info?.title ?? d.code,
            file: rel, line: d.range.start.line, message: d.message, hint: d.hint, why: info?.explanation,
            edits: d.fixes?.[0] ? [d.fixes[0], ...(d.fixes[0].additionalEdits ?? [])].map(e => ({
                file: rel,
                range: { start: { line: e.range.start.line, column: e.range.start.column }, end: { line: e.range.end.line, column: e.range.end.column } },
                newText: e.newText,
            })) : undefined,
            verify: verifyFor(d.code, rel, root),
        });
    };
    for (const p of programs) {
        const abs = p.files.map(f => join(root, f));
        for (const fa of analyzeFiles(context, abs)) {
            for (const e of fa.parseErrors) {
                push({ code: 'P001', message: e.message, severity: 'error', source: 'mangle-semantic',
                    range: { start: { line: e.line, column: e.column, offset: e.offset }, end: { line: e.line, column: e.column + e.length, offset: e.offset } } }, fa.path);
            }
            for (const d of fa.diagnostics) push(d, fa.path);
        }
        if (p.engine && p.engine.stage !== 'ok') {
            actions.push({
                code: 'ENGINE', severity: p.engine.stage === 'bounds' ? 'warning' : 'error', category: 'engine',
                title: `Engine rejects program ${p.id} at ${p.engine.stage}`, file: p.files[0] ?? p.id, line: 1,
                message: p.engine.error ?? p.engine.stage,
                why: p.engine.stage === 'bounds'
                    ? 'The program passes the analysis hosts usually run (no bounds checking) but fails strict bounds checking: some fact or rule writes a type its Decl does not allow.'
                    : 'The engine rejects the assembled program; the host fails to load it.',
                verify: `mangle-cli conformance --program ${p.files.map(f => join(root, f)).join(' ')}`,
            });
        }
    }
    for (const d of boundary?.diagnostics ?? []) {
        const info = getDiagnosticInfo(d.code);
        actions.push({
            code: d.code, severity: d.severity, category: 'boundary', title: d.title, file: d.file, line: d.line,
            message: d.message, hint: d.hint, why: info?.explanation, related: d.related, proof: d.proof,
            verify: verifyFor(d.code, d.file, root),
        });
    }

    const min = RANK[options.severity ?? 'info'];
    const plan = actions
        .filter(a => RANK[a.severity] <= min)
        .sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.code.localeCompare(b.code) || a.file.localeCompare(b.file) || a.line - b.line)
        .map((a, i) => ({ id: i + 1, ...a }));
    const bySeverity: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    for (const a of plan) {
        bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
        byCode[a.code] = (byCode[a.code] ?? 0) + 1;
    }
    return {
        root,
        programs,
        boundary: boundary
            ? { engine: boundary.engine, engineNote: boundary.engineNote, profile: boundary.profile, scanned: boundary.scanned, summary: boundary.summary }
            : boundaryNote ? { unavailable: boundaryNote } : undefined,
        summary: { actions: plan.length, bySeverity, byCode },
        plan,
    };
}

export function formatReviewText(r: ReviewReport): string {
    const lines = [`Review of ${r.root}: ${r.summary.actions} actions (${Object.entries(r.summary.bySeverity).map(([s, n]) => `${n} ${s}`).join(', ')})`];
    for (const p of r.programs.filter(p => p.files.length > 1 || p.engine)) {
        lines.push(`  program ${p.id}: ${p.files.length} files${p.engine ? `, engine ${p.engine.stage}` : ''}`);
    }
    if (r.boundary && 'unavailable' in r.boundary) lines.push(`  boundary: skipped (${r.boundary.unavailable})`);
    lines.push(`  by code: ${Object.entries(r.summary.byCode).sort().map(([c, n]) => `${c}=${n}`).join(' ')}`, '');
    for (const a of r.plan) {
        lines.push(`${a.id}. ${a.file}:${a.line}: ${a.severity} [${a.code}] ${a.message}`);
        if (a.hint) lines.push(`   help: ${a.hint.split('\n')[0]}`);
        if (a.edits) lines.push(`   fix: ${a.edits.length} edit(s) in the JSON plan`);
    }
    return lines.join('\n');
}
