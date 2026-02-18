/**
 * Built-in function definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go, builtin/builtin.go).
 */
/**
 * Built-in function definition.
 */
export interface BuiltinFunction {
    /** Function name (e.g., 'fn:plus', 'fn:collect') */
    name: string;
    /** Expected arity (-1 for variable arity) */
    arity: number;
    /** Whether this function is a reducer (used in aggregations) */
    isReducer: boolean;
    /** Documentation string */
    doc: string;
}
/**
 * All built-in functions (non-reducer).
 */
export declare const BUILTIN_FUNCTIONS: BuiltinFunction[];
/**
 * All reducer functions (used in aggregations).
 */
export declare const REDUCER_FUNCTIONS: BuiltinFunction[];
/**
 * Type constructor functions (used in bound declarations and type expressions).
 *
 * These are uppercase type-level constructors from upstream symbols/symbols.go (lines 205-310).
 * They differ from their lowercase runtime counterparts:
 * - fn:pair(X, Y) constructs a runtime pair value
 * - fn:Pair(T1, T2) constructs a pair TYPE (used in bound [...] declarations)
 */
export declare const TYPE_CONSTRUCTOR_FUNCTIONS: BuiltinFunction[];
/**
 * All built-in functions (both regular and reducer).
 */
export declare const ALL_BUILTIN_FUNCTIONS: BuiltinFunction[];
/**
 * Map from function name to definition for fast lookup.
 */
export declare const BUILTIN_FUNCTION_MAP: Map<string, BuiltinFunction>;
/**
 * Check if a function name is a built-in function.
 */
export declare function isBuiltinFunction(name: string): boolean;
/**
 * Check if a function name is a type constructor (uppercase, used in bound declarations).
 */
export declare function isTypeConstructor(name: string): boolean;
/**
 * Check if a function name is a reducer function.
 */
export declare function isReducerFunction(name: string): boolean;
/**
 * Get the built-in function definition by name.
 */
export declare function getBuiltinFunction(name: string): BuiltinFunction | undefined;
/**
 * Get all built-in function names for completion.
 */
export declare function getBuiltinFunctionNames(): string[];
/**
 * Get reducer function names for completion in do-transforms.
 */
export declare function getReducerFunctionNames(): string[];
//# sourceMappingURL=functions.d.ts.map