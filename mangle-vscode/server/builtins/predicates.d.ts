/**
 * Built-in predicate definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go, builtin/builtin.go).
 */
/**
 * Argument mode for built-in predicates.
 */
export type ArgMode = 'input' | 'output';
/**
 * Mode pattern for a predicate (sequence of argument modes).
 */
export type Mode = ArgMode[];
/**
 * Built-in predicate definition.
 */
export interface BuiltinPredicate {
    /** Predicate name (e.g., ':lt', ':match_prefix') */
    name: string;
    /** Expected arity */
    arity: number;
    /** Mode pattern for arguments */
    mode: Mode;
    /** Documentation string */
    doc: string;
}
/**
 * All built-in predicates.
 */
export declare const BUILTIN_PREDICATES: BuiltinPredicate[];
/**
 * Map from predicate name to definition for fast lookup.
 */
export declare const BUILTIN_PREDICATE_MAP: Map<string, BuiltinPredicate>;
/**
 * Check if a predicate name is a built-in predicate.
 */
export declare function isBuiltinPredicate(name: string): boolean;
/**
 * Get the built-in predicate definition by name.
 */
export declare function getBuiltinPredicate(name: string): BuiltinPredicate | undefined;
/**
 * Get all built-in predicate names for completion.
 */
export declare function getBuiltinPredicateNames(): string[];
//# sourceMappingURL=predicates.d.ts.map