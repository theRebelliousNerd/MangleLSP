/**
 * Clause rewriting for Mangle.
 *
 * Performs premise reordering so that negated atoms are delayed until all their
 * variables are bound by positive atoms. This is called BEFORE validation
 * (CheckRule) to ensure negation-as-failure semantics work correctly.
 *
 * Ported from upstream Go implementation (analysis/rewriteclause.go).
 */
import { Clause } from '../parser/ast';
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
export declare function rewriteClause(clause: Clause): Clause;
//# sourceMappingURL=rewrite.d.ts.map