/**
 * conformance: the LSP's verdict next to the engine's, per file or per
 * assembled program. The engine (via mangle-oracle) is ground truth.
 */

import { readFileSync } from 'fs';
import { relative, resolve } from 'path';
import { analyzeProgram } from '../../analysis/program';
import { runOracle, projectRootOf, EngineVerdict, VerdictOutput } from '../../oracle/client';

/** How the LSP's verdict relates to the engine's. */
export type Agreement =
    | 'agree-accept'        // both accept
    | 'agree-reject'        // both reject
    | 'lsp-catches-runtime' // engine analysis accepts, evaluation fails, the LSP reports it
    | 'lsp-warns'           // only strict bounds or evaluation fail, and the LSP warns with the reason
    | 'lsp-false-positive'  // the engine accepts everything, the LSP reports an error
    | 'lsp-misses'          // the engine rejects at parse or analysis, the LSP reports no error
    | 'lsp-misses-bounds'   // only strict bounds checking rejects, the LSP reports no error
    | 'lsp-misses-runtime'; // evaluation fails, the LSP reports no error

export interface ConformanceCase {
    files: string[];
    engine: { stage: EngineVerdict['stage']; error?: string };
    lsp: { errors: string[]; warnings: string[] };
    agreement: Agreement;
}

export interface ConformanceReport {
    engine: string;
    /** Set when the engine that ran is not the project's pinned version. */
    engineNote?: string;
    cases: ConformanceCase[];
    summary: Record<Agreement, number> & { total: number; agreeing: number };
}

/** Warnings that name the reason strict bounds checking fails. */
const BOUNDS_WARNINGS = new Set(['E073', 'E082', 'E083', 'E084']);
/** Warnings that name the reason evaluation fails. */
const RUNTIME_WARNINGS = new Set(['E016', 'E017']);

/** Classifies one case from the engine stage and the LSP's error and warning codes. */
export function classify(stage: EngineVerdict['stage'], lspErrors: number, lspWarnings: string[] = []): Agreement {
    const lspRejects = lspErrors > 0;
    switch (stage) {
        case 'ok': return lspRejects ? 'lsp-false-positive' : 'agree-accept';
        case 'parse':
        case 'analyze': return lspRejects ? 'agree-reject' : 'lsp-misses';
        case 'bounds':
            if (lspRejects) return 'agree-reject';
            return lspWarnings.some(c => BOUNDS_WARNINGS.has(c)) ? 'lsp-warns' : 'lsp-misses-bounds';
        case 'eval':
            if (lspRejects) return 'lsp-catches-runtime';
            return lspWarnings.some(c => RUNTIME_WARNINGS.has(c)) ? 'lsp-warns' : 'lsp-misses-runtime';
    }
}

/**
 * LSP verdict on a file group analyzed as one program: errors as
 * "CODE file:line message", and the codes of its warnings.
 */
export function lspVerdictOf(files: string[]): { errors: string[]; warnings: string[] } {
    const analyses = analyzeProgram(files.map(f => ({ path: f, text: readFileSync(f, 'utf-8') })));
    const errors: string[] = [];
    const warnings = new Set<string>();
    for (const a of analyses) {
        const rel = relative(process.cwd(), a.path);
        for (const e of a.parseErrors) errors.push(`P001 ${rel}:${e.line} ${e.message}`);
        for (const d of a.diagnostics) {
            if (d.severity === 'error') errors.push(`${d.code} ${rel}:${d.range.start.line} ${d.message}`);
            else if (d.severity === 'warning') warnings.add(d.code);
        }
    }
    return { errors, warnings: [...warnings].sort() };
}

const AGREEMENTS: Agreement[] = ['agree-accept', 'agree-reject', 'lsp-catches-runtime', 'lsp-warns', 'lsp-false-positive',
    'lsp-misses', 'lsp-misses-bounds', 'lsp-misses-runtime'];

/** True for the outcomes where the LSP tells the truth about the program. */
export function isAgreement(a: Agreement): boolean {
    return a === 'agree-accept' || a === 'agree-reject' || a === 'lsp-catches-runtime' || a === 'lsp-warns';
}

/** Builds a report from engine verdicts (computed now or loaded from a golden file). */
export function compareWithEngine(groups: string[][], engine: VerdictOutput): ConformanceReport {
    const summary = Object.fromEntries(AGREEMENTS.map(a => [a, 0])) as ConformanceReport['summary'];
    summary.total = 0;
    summary.agreeing = 0;
    const cases: ConformanceCase[] = groups.map((files, i) => {
        const v = engine.verdicts[i]!;
        const lsp = lspVerdictOf(files);
        const agreement = classify(v.stage, lsp.errors.length, lsp.warnings);
        summary[agreement]++;
        summary.total++;
        if (isAgreement(agreement)) summary.agreeing++;
        return { files: files.map(f => relative(process.cwd(), f)), engine: { stage: v.stage, error: v.error }, lsp, agreement };
    });
    return { engine: engine.engine, ...(engine.engineNote ? { engineNote: engine.engineNote } : {}), cases, summary };
}

/** Runs the engine and the LSP over files (one case per file, or one program). */
export function runConformance(files: string[], asProgram: boolean): ConformanceReport {
    const abs = files.map(f => resolve(f));
    const groups = asProgram ? [abs] : abs.map(f => [f]);
    const engine = runOracle<VerdictOutput>(['verdict', '--at', '2024-01-01T00:00:00Z', ...(asProgram ? ['--program'] : []), ...abs], projectRootOf(abs[0]!));
    return compareWithEngine(groups, engine);
}

export function formatConformanceText(r: ConformanceReport): string {
    const lines = [`Conformance with ${r.engine}: ${r.summary.agreeing}/${r.summary.total} agree`];
    for (const a of AGREEMENTS) if (r.summary[a]) lines.push(`  ${a.padEnd(20)} ${r.summary[a]}`);
    for (const c of r.cases) {
        if (c.agreement === 'agree-accept' || c.agreement === 'agree-reject') continue;
        lines.push('', `${c.agreement}: ${c.files.join(' + ')}`);
        lines.push(`  engine ${c.engine.stage}${c.engine.error ? `: ${c.engine.error.split('\n')[0]}` : ''}`);
        for (const e of c.lsp.errors.slice(0, 5)) lines.push(`  lsp    ${e}`);
    }
    return lines.join('\n');
}
