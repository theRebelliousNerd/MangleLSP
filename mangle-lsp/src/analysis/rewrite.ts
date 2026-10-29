/**
 * Clause rewriting for Mangle.
 *
 * Performs premise reordering so that negated atoms are delayed until all their
 * variables are bound by positive atoms. This is called BEFORE validation
 * (CheckRule) to ensure negation-as-failure semantics work correctly.
 *
 * Ported from upstream Go implementation (analysis/rewriteclause.go).
 */

import {
    Clause,
    Term,
    Atom,
    NegAtom,
    Variable,
    TemporalLiteral,
    TemporalAtom,
    TemporalInterval,
} from '../parser/ast';

/**
 * Result of rewriting a clause.
 */
export interface RewriteResult {
    /**
     * The rewritten clause. Negations and inequalities wait until their
     * variables are bound; any that no premise ever binds are kept at the end
     * (as upstream v0.7 does) so checking reports the unbound variable.
     */
    clause: Clause;
    /**
     * The delayed premises (negated atoms and `!=`) that no premise of the
     * rule ever binds. Upstream v0.7 keeps them at the end of the body and
     * CheckRule rejects the rule ("variable X is not bound"); the LSP reports
     * them as E003 / E004 with a v0.7-specific message.
     */
    unresolved: Term[];
}

function collectIntervalVars(interval: TemporalInterval | null | undefined, vars: Set<string>): void {
    if (!interval) return;
    if (interval.start.variable && interval.start.variable.symbol !== '_') vars.add(interval.start.variable.symbol);
    if (interval.end.variable && interval.end.variable.symbol !== '_') vars.add(interval.end.variable.symbol);
}

/**
 * Collect all non-wildcard variable names from a term.
 */
function collectVars(term: Term, vars: Set<string>): void {
    switch (term.type) {
        case 'Variable': {
            const v = term as Variable;
            if (v.symbol !== '_') {
                vars.add(v.symbol);
            }
            break;
        }
        case 'Atom': {
            const atom = term as Atom;
            for (const arg of atom.args) {
                collectVars(arg, vars);
            }
            break;
        }
        case 'NegAtom': {
            const negAtom = term as NegAtom;
            collectVars(negAtom.atom, vars);
            break;
        }
        case 'Eq':
        case 'Ineq': {
            const eq = term as { left: Term; right: Term };
            collectVars(eq.left, vars);
            collectVars(eq.right, vars);
            break;
        }
        case 'ApplyFn': {
            const applyFn = term as { args: Term[] };
            for (const arg of applyFn.args) {
                collectVars(arg, vars);
            }
            break;
        }
        case 'TemporalLiteral': {
            const t = term as TemporalLiteral;
            collectVars(t.literal, vars);
            collectIntervalVars(t.interval, vars);
            collectIntervalVars(t.operator?.interval, vars);
            break;
        }
        case 'TemporalAtom': {
            const t = term as TemporalAtom;
            collectVars(t.atom, vars);
            collectIntervalVars(t.interval, vars);
            break;
        }
    }
}

/**
 * Rewrite a clause the way upstream v0.7 `analysis.RewriteClause` does.
 *
 * 1. Track bound variables as premises are processed left to right.
 * 2. Positive atoms and equalities bind their variables.
 * 3. A negated atom or an inequality (`!=`) whose variables are not all bound
 *    yet is delayed, and placed right after the premise that binds the last
 *    of them. Premise order is therefore irrelevant for `!` and `!=`.
 * 4. A delayed premise that nothing binds is kept at the end of the body.
 *    (Up to 77780a5 upstream dropped such negations silently; v0.7 keeps them
 *    and rejects the rule.)
 *
 * Comparisons such as `<` and `:float:lt` are not delayed: they need their
 * inputs bound by an earlier premise.
 */
export function rewriteClause(clause: Clause, preBoundVars?: Iterable<string>): Clause {
    return rewriteClauseWithInfo(clause, preBoundVars).clause;
}

/**
 * Like {@link rewriteClause}, but also returns the delayed premises that no
 * premise ever binds.
 *
 * @param preBoundVars head variables that are bound on entry because the
 *   head predicate declares them as input ('+' or '?') via mode(...)
 *   (upstream: variablesForArgMode(clause.Head, mode, Input|InputOutput)).
 */
export function rewriteClauseWithInfo(clause: Clause, preBoundVars?: Iterable<string>): RewriteResult {
    if (!clause.premises || clause.premises.length === 0) {
        return { clause, unresolved: [] };
    }

    const boundVars = new Set<string>(preBoundVars ?? []);
    const premises: Term[] = [];
    let delayed: { premise: Term; vars: Set<string> }[] = [];

    const bindAll = (p: Term): void => {
        const defVars = new Set<string>();
        collectVars(p, defVars);
        for (const v of defVars) boundVars.add(v);
    };

    for (const p of clause.premises) {
        let needsDelay = false;
        switch (p.type) {
            case 'Atom':
            case 'Eq':
                bindAll(p);
                break;
            case 'TemporalLiteral':
            case 'TemporalAtom':
                // Temporal literals bind the variables of their inner atom and
                // interval (upstream CheckRule binds them the same way).
                if (p.type === 'TemporalLiteral' && (p as TemporalLiteral).literal.type === 'NegAtom') break;
                bindAll(p);
                break;
            case 'NegAtom':
            case 'Ineq': {
                const vars = new Set<string>();
                collectVars(p, vars);
                const unbound = new Set([...vars].filter(v => !boundVars.has(v)));
                if (unbound.size > 0) {
                    needsDelay = true;
                    delayed.push({ premise: p, vars: unbound });
                }
                break;
            }
        }
        if (needsDelay) continue;
        premises.push(p);
        // Place each waiting premise whose variables are now all bound.
        const waiting: typeof delayed = [];
        for (const d of delayed) {
            if ([...d.vars].every(v => boundVars.has(v))) premises.push(d.premise);
            else waiting.push(d);
        }
        delayed = waiting;
    }

    const unresolved = delayed.map(d => d.premise);
    return { clause: { ...clause, premises: [...premises, ...unresolved] }, unresolved };
}
