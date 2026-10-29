/**
 * Negation checks that follow upstream v0.7 semantics, with the "project
 * positively, then negate the projection" rewrite as a quick fix.
 *
 * - `!r(X, _)`: v0.7 CheckRule replaces `_` with a fresh variable that nothing
 *   binds, so the rule is rejected ("variable X0 is not bound") (E003).
 * - `!ext(...)` on a predicate declared `external()`: engine/premise.go
 *   premiseNegAtom answers a negation from the fact store only and never calls
 *   the Go callback, so the negation is true whenever nothing stored the row
 *   (E081).
 */

import { Atom, Clause, Decl, NegAtom, Term, Variable, Constant, SourceRange } from '../parser/ast';
import type { QuickFix, SemanticError } from './validation';

/** Text of a simple term, or undefined when it cannot be printed faithfully. */
function simpleTermText(term: Term): string | undefined {
    if (term.type === 'Variable') return (term as Variable).symbol;
    if (term.type !== 'Constant') return undefined;
    const c = term as Constant;
    switch (c.constantType) {
        case 'name': return c.symbol;
        case 'string': return JSON.stringify(c.symbol ?? '');
        case 'number': return String(c.numValue ?? 0);
        case 'float64': return String(c.floatValue ?? 0);
        default: return undefined;
    }
}

function atomText(atom: Atom): string | undefined {
    const args = atom.args.map(simpleTermText);
    if (args.some(a => a === undefined)) return undefined;
    return `${atom.predicate.symbol}(${args.join(', ')})`;
}

/** Text of a premise for a helper rule body, or undefined if not printable. */
function premiseText(p: Term): string | undefined {
    switch (p.type) {
        case 'Atom': return atomText(p as Atom);
        case 'Eq':
        case 'Ineq': {
            const e = p as unknown as { left: Term; right: Term };
            const l = simpleTermText(e.left);
            const r = simpleTermText(e.right);
            if (l === undefined || r === undefined) return undefined;
            return `${l} ${p.type === 'Eq' ? '=' : '!='} ${r}`;
        }
        default: return undefined;
    }
}

function freshName(base: string, taken: (name: string) => boolean): string {
    if (!taken(base)) return base;
    for (let i = 2; ; i++) {
        if (!taken(`${base}_${i}`)) return `${base}_${i}`;
    }
}

function endOf(range: SourceRange): SourceRange {
    return { start: range.end, end: range.end };
}

/**
 * Builds the two-edit quick fix: replace the negation with `!helper(Vars)` and
 * add `helper(Vars) :- body.` after the clause.
 */
function projectionFix(
    title: string, neg: NegAtom, clause: Clause, helper: string, headVars: string[], body: string,
): QuickFix {
    const call = `!${helper}(${headVars.join(', ')})`;
    return {
        title,
        range: neg.range,
        newText: call,
        additionalEdits: [{ range: endOf(clause.range), newText: `\n${helper}(${headVars.join(', ')}) :- ${body}.` }],
    };
}

/** Variables of the negated atom in order, without wildcards and duplicates. */
function keptVariables(atom: Atom): string[] {
    const out: string[] = [];
    for (const a of atom.args) {
        if (a.type === 'Variable') {
            const v = (a as Variable).symbol;
            if (v !== '_' && !out.includes(v)) out.push(v);
        }
    }
    return out;
}

/** E003 for a wildcard inside a negated atom. */
export function negatedWildcardError(
    neg: NegAtom, clause: Clause, isTaken: (name: string) => boolean,
): SemanticError {
    const pred = neg.atom.predicate.symbol;
    const vars = keptVariables(neg.atom);
    const text = atomText(neg.atom);
    const helper = freshName(`has_${pred.replace(/[.:]/g, '_')}`, isTaken);
    const fix = text && vars.length > 0
        ? [projectionFix(`Negate a projection '${helper}(${vars.join(', ')})'`, neg, clause, helper, vars, text)]
        : undefined;
    return {
        code: 'E003',
        message: `'_' in the negated atom '!${pred}(...)' is a variable nothing binds; upstream v0.7 rejects the rule ("variable X0 is not bound")`,
        range: neg.range,
        severity: 'error',
        hint: `Mangle negation is not "there is no row with any value here". Project the columns you test first: ${helper}(${vars.join(', ')}) :- ${text ?? `${pred}(...)`}. then negate !${helper}(${vars.join(', ')})`,
        fixes: fix,
    };
}

/** True when a Decl carries `external()` in its descr. */
export function isExternalDecl(decl: Decl | undefined): boolean {
    return !!decl?.descr?.some(d => d.predicate.symbol === 'external');
}

/** E081 for a negated external predicate. */
export function negatedExternalError(
    neg: NegAtom, clause: Clause, isTaken: (name: string) => boolean,
): SemanticError {
    const pred = neg.atom.predicate.symbol;
    const vars = keptVariables(neg.atom);
    const helper = freshName(`${pred.replace(/[.:]/g, '_')}_holds`, isTaken);
    const positives = (clause.premises ?? []).filter(p => p !== neg && p.type !== 'NegAtom');
    const parts = positives.map(premiseText);
    const ext = atomText(neg.atom);
    const printable = ext !== undefined && parts.every(p => p !== undefined);
    const body = printable ? [...(parts as string[]), ext].join(', ') : undefined;
    return {
        code: 'E081',
        message: `'!${pred}(...)' negates an external predicate: the engine answers a negation from stored facts only and never calls the Go callback, so this is true whenever nothing stored the row`,
        range: neg.range,
        severity: 'warning',
        hint: `call the external positively in a helper rule whose body binds its inputs, then negate the helper: ${helper}(${vars.join(', ')}) :- ${body ?? `<premises binding the inputs>, ${pred}(...)`}. and !${helper}(${vars.join(', ')})`,
        fixes: body && vars.length > 0
            ? [projectionFix(`Call '${pred}' positively in '${helper}' and negate that`, neg, clause, helper, vars, body)]
            : undefined,
    };
}
