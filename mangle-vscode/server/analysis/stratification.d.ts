/**
 * Stratification analysis for Mangle.
 *
 * Detects negation cycles that would make the program unstratifiable.
 * Ported from upstream Go implementation (analysis/stratification.go).
 */
import { SourceUnit, SourceRange } from '../parser/ast';
/**
 * Stratification error.
 */
export interface StratificationError {
    code: string;
    message: string;
    range: SourceRange;
    severity: 'error' | 'warning';
    /** Predicates involved in the cycle */
    cycle: string[];
}
/**
 * Check stratification of a source unit.
 * Returns errors for any negation cycles detected.
 */
export declare function checkStratification(unit: SourceUnit): StratificationError[];
/**
 * Check for potentially unbounded recursion.
 * Returns warnings for recursive rules that may not terminate.
 */
export declare function checkUnboundedRecursion(unit: SourceUnit): StratificationError[];
/**
 * Check for potential Cartesian explosion patterns.
 * Returns warnings when multiple body predicates don't share variables.
 */
export declare function checkCartesianExplosion(unit: SourceUnit): StratificationError[];
/**
 * Check for late filtering anti-pattern.
 * Detects when comparisons appear after multiple predicates that don't share variables.
 */
export declare function checkLateFiltering(unit: SourceUnit): StratificationError[];
/**
 * Check for late negation anti-pattern.
 * Detects when negation appears after multiple predicates when it could filter earlier.
 */
export declare function checkLateNegation(unit: SourceUnit): StratificationError[];
/**
 * Check for multiple independent variables anti-pattern.
 * Detects when 3+ predicates have no shared variables, creating huge Cartesian products.
 */
export declare function checkMultipleIndependentVars(unit: SourceUnit): StratificationError[];
/**
 * Check for problematic temporal recursion patterns.
 * Matches upstream CheckTemporalRecursion from analysis/temporal.go.
 *
 * Returns warnings about:
 * - Self-recursive temporal predicates (interval explosion risk)
 * - Mutual recursion through temporal predicates (non-termination risk)
 * - Future operators in recursive temporal rules (unbounded fact generation)
 */
export declare function checkTemporalRecursion(unit: SourceUnit): StratificationError[];
//# sourceMappingURL=stratification.d.ts.map