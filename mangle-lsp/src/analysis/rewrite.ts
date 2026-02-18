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
} from '../parser/ast';

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
    }
}

/**
 * Rewrite a clause by delaying negated atoms until their variables are bound.
 *
 * This implements the negation delay transformation from upstream
 * (analysis/rewriteclause.go). The algorithm:
 *
 * 1. Track bound variables as we process premises left-to-right.
 * 2. For each positive atom, bind all its variables.
 * 3. For each Eq premise, bind its variables.
 * 4. For each negated atom, check if all its variables are bound.
 *    - If yes, emit it immediately.
 *    - If no, delay it and record which variables need binding.
 * 5. After emitting each non-delayed premise, check if any delayed negated
 *    atoms can now be emitted (all their unbound variables are now bound).
 *
 * Upstream Go equivalent: analysis.RewriteClause()
 */
export function rewriteClause(clause: Clause): Clause {
    if (!clause.premises || clause.premises.length === 0) {
        return clause;
    }

    const boundVars = new Set<string>();
    // Head variables are initially considered bound for the purpose of
    // negation delay (they might be input-mode variables).
    // Note: The upstream version checks modes from declarations here.
    // We don't have declaration access in this simplified version,
    // so we DON'T pre-bind head variables. This is the conservative approach.

    const premises: Term[] = [];
    const delayNegAtom: Term[] = [];
    const delayVars: Set<string>[] = [];

    for (const p of clause.premises) {
        let needsDelay = false;

        switch (p.type) {
            case 'Atom': {
                // Positive atoms bind all their variables
                const defVars = new Set<string>();
                collectVars(p, defVars);
                for (const v of defVars) {
                    boundVars.add(v);
                }
                break;
            }
            case 'Eq': {
                // Equality binds variables from both sides
                const eqVars = new Set<string>();
                collectVars(p, eqVars);
                for (const v of eqVars) {
                    boundVars.add(v);
                }
                break;
            }
            case 'NegAtom': {
                // Check if all variables in the negated atom are already bound
                const negVars = new Set<string>();
                collectVars(p, negVars);
                const unboundVars = new Set<string>();
                for (const v of negVars) {
                    if (!boundVars.has(v)) {
                        unboundVars.add(v);
                    }
                }
                if (unboundVars.size > 0) {
                    needsDelay = true;
                    delayNegAtom.push(p);
                    delayVars.push(unboundVars);
                }
                break;
            }
        }

        if (!needsDelay) {
            premises.push(p);

            // Check if any delayed negated atoms can now be emitted
            const toRemove: number[] = [];
            for (let i = 0; i < delayVars.length; i++) {
                const vars = delayVars[i];
                let allBound = true;
                for (const v of vars) {
                    if (!boundVars.has(v)) {
                        allBound = false;
                        break;
                    }
                }
                if (allBound) {
                    premises.push(delayNegAtom[i]);
                    toRemove.unshift(i); // prepend so we remove from end first
                }
            }
            // Remove emitted delayed atoms (in reverse order)
            for (const i of toRemove) {
                delayNegAtom.splice(i, 1);
                delayVars.splice(i, 1);
            }
        }
    }

    // Any remaining delayed negated atoms that never got their variables bound
    // are silently dropped (same as upstream behavior).

    return {
        ...clause,
        premises,
    };
}
