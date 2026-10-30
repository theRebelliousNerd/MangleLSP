/**
 * boundary: where .mg meets Go. mangle-oracle scans the Go module with go/ast
 * and the .mg files with the engine's parser, then a Mangle program on the
 * engine (mangle-oracle/boundary.mg) judges the facts; every finding carries
 * the facts its proof rests on. This module turns findings into diagnostics.
 */

import { resolve } from 'path';
import { getDiagnosticInfo } from '../../analysis/diagnostics';
import { runOracle, BoundaryOutput, BoundaryFinding, OracleLocation } from '../../oracle/client';

export interface BoundaryDiagnostic {
    code: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    predicate: string;
    /** Where to act: the .mg Decl or rule, or the Go line. */
    file: string;
    line: number;
    message: string;
    hint?: string;
    /** Other places involved (the Decl, the Go callback, Go mentions). */
    related: OracleLocation[];
    /** Facts the finding's proof rests on ("not ..." for absent facts). */
    proof: string[];
}

export interface BoundaryReport {
    engine: string;
    engineNote?: string;
    /** Host profile the Go side was read with (generic, codenerd, or a project file). */
    profile: string;
    root: string;
    scanned: { goFiles: number; mgFiles: number; assertSites: number; querySites: number; externalCallbacks: number };
    programs: BoundaryOutput['programs'];
    parseErrors: Record<string, string>;
    diagnostics: BoundaryDiagnostic[];
    summary: Record<string, number>;
}

function messageOf(f: BoundaryFinding): { message: string; hint?: string } {
    const p = `${f.predicate}/${f.arity}`;
    switch (f.code) {
        case 'B001': return { message: `A rule reads ${p}, but nothing produces it: no rule or fact derives it, no Go code asserts it, and Go never mentions the name`, hint: 'assert it from the Go producer with the Decl\'s shape, or delete the rules that wait for it' };
        case 'B002': return { message: `${p} is declared, but nothing produces or reads it in .mg or Go`, hint: 'delete the Decl, or wire it' };
        case 'B003': return { message: `Go asserts ${p}, which no .mg file declares or defines`, hint: `add 'Decl ${f.predicate}(...) bound [...]' to the owning schema, or fix the name` };
        case 'B004': return { message: `Go asserts ${p}, but the program only knows ${f.predicate} at other arities: in Mangle that is a different predicate`, hint: 'make the Go argument list match the Decl' };
        case 'B005': return { message: `Go queries ${f.predicate}, which the program never declares or defines`, hint: 'the query always returns nothing; fix the name or add the rule' };
        case 'B006': return { message: `Go asserts ${p}, and nothing reads it: no rule, no Go query`, hint: 'write the consumer or stop asserting it' };
        case 'B007': {
            const kind = (f.note ?? '').replace(/^\//, '');
            const built = { lit_name: 'a "/..." string literal, which the kernel turns into a name', lit_string: 'a string literal', name: 'a name (MangleAtom)', string: 'a string', float64: 'a float64', number: 'an integer', time: 'a time', duration: 'a duration', bool: 'a bool (/true or /false)' }[kind] ?? kind;
            return { message: `Argument ${f.position} of ${p}: Go builds ${built}, but the Decl allows only ${(f.declared ?? []).join(' or ')}`, hint: 'build the declared representation at the producer (types.MangleAtom for /name, a plain string for /string, int64 for /number, float64 for /float64)' };
        }
        case 'B008': return { message: `${p} is declared external(), but the Go module registers no callback for it` };
        case 'B009': return { message: `Go registers a callback for ${p}, which no Decl marks external()`, hint: `declare it: Decl ${f.predicate}(...) descr [external(), mode(${[...(f.note ?? '')].map(m => `'${m}'`).join(', ')})].` };
        case 'B010': return { message: `The Go callback for ${p} is registered with modes ${f.note}, which differ from the Decl's mode(...)` };
        case 'B011': return { message: `A rule negates the external ${p}: the engine answers negations from stored facts only, so ${f.related?.length ? `the Go callback at ${f.related.map(r => `${r.file}:${r.line}`).join(', ')}` : 'its Go callback'} never runs for it`, hint: `${f.predicate}_holds(...) :- <premises binding the inputs>, ${f.predicate}(...). then negate ${f.predicate}_holds` };
        case 'B012': return { message: `A rule reads ${p}, and no producer the scan recognizes asserts it; Go mentions the name at ${(f.related ?? []).slice(0, 3).map(r => `${r.file}:${r.line}`).join(', ')}${(f.related?.length ?? 0) > 3 ? ', ...' : ''}`, hint: 'check whether those places assert it; if none does, the rule never fires' };
        case 'B013': return {
            message: `${p} is derived by a rule that can never fire: its premise ${f.note} is starved (nothing produces it, or every rule that derives it is itself blocked)`,
            hint: `give ${f.note} a producer (a Go assert, a fact, or a rule that can fire), or delete the rule; the proof lists the absences it rests on`,
        };
        case 'B014': return {
            message: `${p} is derived here, but nothing reads it: no rule premise and no Go query reaches it`,
            hint: 'query it from Go, read it in a rule that is itself used, or delete the rules that derive it',
        };
        default: return { message: `${f.code} on ${p}` };
    }
}

/** Converts oracle findings to diagnostics. */
export function toBoundaryDiagnostics(out: BoundaryOutput): BoundaryDiagnostic[] {
    return out.findings.map(f => {
        const info = getDiagnosticInfo(f.code);
        const { message, hint } = messageOf(f);
        const related = [...(f.decl ? [f.decl] : []), ...(f.related ?? [])];
        return {
            code: f.code,
            severity: info?.severity ?? 'warning',
            title: info?.title ?? f.code,
            predicate: `${f.predicate}/${f.arity}`,
            file: f.at.file,
            line: f.at.line,
            message,
            hint,
            related,
            proof: f.proof,
        };
    });
}

export function runBoundary(root: string, profile?: string): BoundaryReport {
    const abs = resolve(root);
    const out = runOracle<BoundaryOutput>(['boundary', '--root', abs, ...(profile ? ['--profile', profile] : [])], abs);
    const diagnostics = toBoundaryDiagnostics(out);
    const summary: Record<string, number> = {};
    for (const d of diagnostics) summary[d.code] = (summary[d.code] ?? 0) + 1;
    return {
        engine: out.engine,
        ...(out.engineNote ? { engineNote: out.engineNote } : {}),
        profile: out.profile,
        root: abs,
        scanned: { goFiles: out.goFiles, mgFiles: out.mgFiles, assertSites: out.assertSites, querySites: out.querySites, externalCallbacks: out.externalCallbacks },
        programs: out.programs,
        parseErrors: out.parseErrors,
        diagnostics,
        summary,
    };
}

export function formatBoundaryText(r: BoundaryReport): string {
    const lines = [
        `Boundary of ${r.root} (${r.engine}, profile ${r.profile})${r.engineNote ? `\n  note: ${r.engineNote}` : ''}`,
        `  scanned ${r.scanned.goFiles} Go files (${r.scanned.assertSites} assert sites, ${r.scanned.querySites} queries, ${r.scanned.externalCallbacks} external callbacks) and ${r.scanned.mgFiles} .mg files`,
    ];
    for (const p of r.programs) {
        lines.push(`  program ${p.id} (${p.files.length} files): engine ${p.verdict.stage}${p.verdict.error ? ` - ${p.verdict.error.split('\n')[0]}` : ''}`);
    }
    lines.push(`  findings: ${Object.entries(r.summary).sort().map(([c, n]) => `${c}=${n}`).join(' ') || 'none'}`, '');
    for (const d of r.diagnostics) {
        lines.push(`${d.file}:${d.line}: ${d.severity} [${d.code}]: ${d.message}`);
        if (d.hint) lines.push(`  = help: ${d.hint}`);
        for (const rel of d.related.slice(0, 3)) lines.push(`  = see: ${rel.file}:${rel.line}`);
    }
    return lines.join('\n');
}
