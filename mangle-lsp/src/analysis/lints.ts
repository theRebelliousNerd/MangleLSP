/**
 * Advice lints for Mangle.
 *
 * These checks go beyond upstream validation: they flag code that is legal
 * but almost certainly not what the author meant, or that is needlessly slow.
 * They are written for authors (human or agent) who do not know Mangle's
 * idioms yet, so every diagnostic carries a concrete suggestion.
 *
 * - E074: a named variable that occurs only once in a clause (likely a typo)
 * - E076: `fn:collect` followed by `fn:list:len` instead of `fn:count()`
 * - E077: the same premise twice in one rule body
 */

import {
    SourceUnit,
    SourceRange,
    Clause,
    Term,
    BaseTerm,
    Atom,
    TemporalInterval,
    TemporalLiteral,
    TemporalAtom,
    termToString,
} from '../parser/ast';
import type { SemanticError } from './validation';
import { suggestSimilar } from './diagnostics';

/** Where a variable occurs, for singleton detection. */
type OccurrenceKind = 'head' | 'positive' | 'other' | 'letDef';

interface Occurrence {
    range: SourceRange;
    kind: OccurrenceKind;
}

/**
 * Runs all advice lints over a unit.
 */
export function checkClauseLints(unit: SourceUnit, errors: SemanticError[]): void {
    for (const clause of unit.clauses) {
        if (!clause.premises || clause.premises.length === 0) continue;
        checkSingletonVariables(clause, errors);
        checkDuplicatePremises(clause, errors);
        checkCollectThenLen(clause, errors);
    }
}

function addOcc(map: Map<string, Occurrence[]>, name: string, range: SourceRange, kind: OccurrenceKind): void {
    if (name === '_') return;
    const list = map.get(name) ?? [];
    list.push({ range, kind });
    map.set(name, list);
}

function visitTerm(term: BaseTerm, kind: OccurrenceKind, map: Map<string, Occurrence[]>): void {
    if (term.type === 'Variable') {
        addOcc(map, term.symbol, term.range, kind);
    } else if (term.type === 'ApplyFn') {
        for (const arg of term.args) visitTerm(arg, kind, map);
    }
}

function visitInterval(interval: TemporalInterval | null | undefined, kind: OccurrenceKind, map: Map<string, Occurrence[]>): void {
    if (!interval) return;
    for (const b of [interval.start, interval.end]) {
        if (b.boundType === 'variable' && b.variable) addOcc(map, b.variable.symbol, b.variable.range, kind);
    }
}

function visitPremise(premise: Term, map: Map<string, Occurrence[]>): void {
    switch (premise.type) {
        case 'Atom': {
            const atom = premise as Atom;
            // Positions in positive user atoms are where typos go unnoticed.
            const kind: OccurrenceKind = atom.predicate.symbol.startsWith(':') ? 'other' : 'positive';
            for (const arg of atom.args) {
                visitTerm(arg, arg.type === 'Variable' ? kind : 'other', map);
            }
            return;
        }
        case 'NegAtom':
            for (const arg of (premise as { atom: Atom }).atom.args) visitTerm(arg, 'other', map);
            return;
        case 'Eq':
        case 'Ineq': {
            const eq = premise as { left: BaseTerm; right: BaseTerm };
            visitTerm(eq.left, 'other', map);
            visitTerm(eq.right, 'other', map);
            return;
        }
        case 'TemporalLiteral': {
            const tl = premise as TemporalLiteral;
            visitPremise(tl.literal, map);
            visitInterval(tl.interval, 'positive', map);
            visitInterval(tl.operator?.interval, 'positive', map);
            return;
        }
        case 'TemporalAtom': {
            const ta = premise as TemporalAtom;
            visitPremise(ta.atom, map);
            visitInterval(ta.interval, 'positive', map);
            return;
        }
        default:
            return;
    }
}

/**
 * E074: a named variable used exactly once. Only occurrences in positive body
 * atoms and unused `let` results are reported - other single occurrences
 * (head, negation, comparisons, function arguments) are already errors.
 */
function checkSingletonVariables(clause: Clause, errors: SemanticError[]): void {
    const occ = new Map<string, Occurrence[]>();
    for (const arg of clause.head.args) visitTerm(arg, 'head', occ);
    visitInterval(clause.headTime, 'head', occ);
    for (const p of clause.premises ?? []) visitPremise(p, occ);
    let transform = clause.transform;
    while (transform) {
        for (const stmt of transform.statements) {
            if (stmt.variable) addOcc(occ, stmt.variable.symbol, stmt.variable.range, 'letDef');
            visitTerm(stmt.fn, 'other', occ);
        }
        transform = transform.next;
    }

    const multi = [...occ.entries()].filter(([, list]) => list.length > 1).map(([name]) => name);
    for (const [name, list] of occ) {
        if (list.length !== 1) continue;
        const only = list[0]!;
        if (only.kind === 'positive') {
            const similar = suggestSimilar(name, multi, 1);
            errors.push({
                code: 'E074',
                message: `Variable '${name}' is used only once in this rule`,
                range: only.range,
                severity: 'warning',
                hint: similar.length > 0
                    ? `is it a typo of '${similar[0]}'? If the value is irrelevant, write '_' instead`
                    : `if the value is irrelevant write '_'; otherwise it is probably meant to join with another premise or appear in the head`,
                fixes: [
                    ...(similar.length > 0 ? [{ title: `Rename to '${similar[0]}'`, range: only.range, newText: similar[0]! }] : []),
                    { title: `Replace '${name}' with '_'`, range: only.range, newText: '_' },
                ],
            });
        } else if (only.kind === 'letDef') {
            errors.push({
                code: 'E074',
                message: `Transform result '${name}' is computed but never used`,
                range: only.range,
                severity: 'warning',
                hint: `add '${name}' to the head of the rule, or remove the let-statement`,
            });
        }
    }
}

/**
 * E077: the same premise appears twice in one body.
 */
function checkDuplicatePremises(clause: Clause, errors: SemanticError[]): void {
    const seen = new Set<string>();
    for (const p of clause.premises ?? []) {
        const key = termToString(p);
        if (seen.has(key)) {
            errors.push({
                code: 'E077',
                message: `Premise '${key}' appears more than once in this rule`,
                range: p.range,
                severity: 'warning',
                hint: 'the repetition never changes the result; remove it',
            });
        }
        seen.add(key);
    }
}

/**
 * E076: `let L = fn:collect(X), let N = fn:list:len(L)` where L is otherwise
 * unused - fn:count() computes N without materializing the list.
 */
function checkCollectThenLen(clause: Clause, errors: SemanticError[]): void {
    const transform = clause.transform;
    if (!transform) return;
    const headVars = new Set<string>();
    for (const arg of clause.head.args) {
        const occ = new Map<string, Occurrence[]>();
        visitTerm(arg, 'head', occ);
        for (const v of occ.keys()) headVars.add(v);
    }
    const collected = new Map<string, string>(); // list var -> reducer name
    for (const stmt of transform.statements) {
        const fnName = stmt.fn.function.symbol;
        // fn:collect keeps one entry per row, so its length is the row count.
        // (fn:collect_distinct(X) deduplicates X only, which fn:count_distinct() does not match.)
        if (stmt.variable && fnName === 'fn:collect') {
            collected.set(stmt.variable.symbol, fnName);
            continue;
        }
        if (fnName === 'fn:list:len' && stmt.fn.args.length === 1) {
            const arg = stmt.fn.args[0]!;
            if (arg.type !== 'Variable') continue;
            const reducer = collected.get(arg.symbol);
            if (!reducer || headVars.has(arg.symbol)) continue;
            // The list must not be used by any other statement.
            const usedElsewhere = transform.statements.some(s => s !== stmt && s.fn.args.some(a => termUsesVar(a, arg.symbol)) &&
                !(s.variable?.symbol === arg.symbol));
            if (usedElsewhere) continue;
            const replacement = 'fn:count()';
            errors.push({
                code: 'E076',
                message: `'${arg.symbol}' is collected only to take its length; use ${replacement} instead`,
                range: stmt.fn.range,
                severity: 'info',
                hint: `replace 'let ${arg.symbol} = ${reducer}(...)' and '${stmt.variable ? `let ${stmt.variable.symbol} = ` : ''}fn:list:len(${arg.symbol})' with '${stmt.variable ? `let ${stmt.variable.symbol} = ` : ''}${replacement}'`,
                fixes: [{ title: `Use ${replacement}`, range: stmt.fn.range, newText: replacement }],
            });
        }
    }
}

function termUsesVar(term: BaseTerm, name: string): boolean {
    if (term.type === 'Variable') return term.symbol === name;
    if (term.type === 'ApplyFn') return term.args.some(a => termUsesVar(a, name));
    return false;
}
