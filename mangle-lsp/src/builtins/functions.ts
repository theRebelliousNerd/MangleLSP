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
export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
    // Arithmetic functions
    {
        name: 'fn:plus',
        arity: -1,
        isReducer: false,
        doc: 'Addition. Maps X, Y1, ... to (X + Y1) + Y2 + ... fn:plus(X) returns X.',
    },
    {
        name: 'fn:minus',
        arity: -1,
        isReducer: false,
        doc: 'Subtraction. Maps X, Y1, ... to (X - Y1) - Y2 - ... fn:minus(X) returns -X.',
    },
    {
        name: 'fn:mult',
        arity: -1,
        isReducer: false,
        doc: 'Multiplication. Maps X, Y1, ... to (X * Y1) * Y2 * ... fn:mult(X) returns X.',
    },
    {
        name: 'fn:div',
        arity: -1,
        isReducer: false,
        doc: 'Integer division. Maps X, Y1, ... to (X / Y1) / Y2 / ... fn:div(X) returns 1/X.',
    },
    {
        name: 'fn:sqrt',
        arity: 1,
        isReducer: false,
        doc: 'Square root of a numeric argument.',
    },

    // Float arithmetic functions
    {
        name: 'fn:float:plus',
        arity: -1,
        isReducer: false,
        doc: 'Float addition. Maps X, Y1, ... to (X + Y1) + Y2 + ...',
    },
    {
        name: 'fn:float:mult',
        arity: -1,
        isReducer: false,
        doc: 'Float multiplication. Maps X, Y1, ... to (X * Y1) * Y2 * ...',
    },
    {
        name: 'fn:float:div',
        arity: -1,
        isReducer: false,
        doc: 'Float division. Maps X, Y1, ... to (X / Y1) / Y2 / ...',
    },

    // Grouping function (special - used to start a do-transform)
    {
        name: 'fn:group_by',
        arity: -1,
        isReducer: false,
        doc: 'Groups all tuples by the values of key variables. Empty group_by() treats the whole relation as a group.',
    },

    // List functions
    {
        name: 'fn:list',
        arity: -1,
        isReducer: false,
        doc: 'Constructs a list from the arguments.',
    },
    {
        name: 'fn:list:append',
        arity: 2,
        isReducer: false,
        doc: 'Appends an element to a list. Usage: fn:list:append(List, Element)',
    },
    {
        name: 'fn:list:get',
        arity: 2,
        isReducer: false,
        doc: 'Returns element at index. Usage: fn:list:get(List, Index)',
    },
    {
        name: 'fn:list:contains',
        arity: 2,
        isReducer: false,
        doc: 'Returns /true if member is in list. Usage: fn:list:contains(List, Member)',
    },
    {
        name: 'fn:list:len',
        arity: 1,
        isReducer: false,
        doc: 'Returns the length of a list.',
    },
    {
        name: 'fn:list:cons',
        arity: 2,
        isReducer: false,
        doc: 'Constructs a list from head and tail. Usage: fn:list:cons(Head, Tail)',
    },

    // Pair and tuple functions
    {
        name: 'fn:pair',
        arity: 2,
        isReducer: false,
        doc: 'Constructs a pair from two elements.',
    },
    {
        name: 'fn:tuple',
        arity: -1,
        isReducer: false,
        doc: 'Acts as identity (one arg), pair (two args), or nested pair (more).',
    },
    {
        name: 'fn:some',
        arity: 1,
        isReducer: false,
        doc: 'Constructs an element of an option type.',
    },

    // Map and struct functions
    {
        name: 'fn:map',
        arity: -1,
        isReducer: false,
        doc: 'Constructs a map from key-value pairs.',
    },
    {
        name: 'fn:map:get',
        arity: 2,
        isReducer: false,
        doc: 'Returns element at key. Usage: fn:map:get(Map, Key)',
    },
    {
        name: 'fn:struct',
        arity: -1,
        isReducer: false,
        doc: 'Constructs a struct from field-value pairs.',
    },
    {
        name: 'fn:struct:get',
        arity: 2,
        isReducer: false,
        doc: 'Returns the value of a field. Usage: fn:struct:get(Struct, FieldName)',
    },

    // String functions
    {
        name: 'fn:string:concat',
        arity: -1,
        isReducer: false,
        doc: 'Concatenates arguments into a single string.',
    },
    {
        name: 'fn:string:replace',
        arity: 4,
        isReducer: false,
        doc: 'Replaces old with new in first n occurrences. Usage: fn:string:replace(Str, Old, New, N)',
    },

    // Conversion functions
    {
        name: 'fn:number:to_string',
        arity: 1,
        isReducer: false,
        doc: 'Converts a number to a string.',
    },
    {
        name: 'fn:float64:to_string',
        arity: 1,
        isReducer: false,
        doc: 'Converts a float64 to a string.',
    },
    {
        name: 'fn:name:to_string',
        arity: 1,
        isReducer: false,
        doc: 'Converts a name constant to a string.',
    },
    {
        name: 'fn:name:root',
        arity: 1,
        isReducer: false,
        doc: 'Returns the first name part of a name.',
    },
    {
        name: 'fn:name:tip',
        arity: 1,
        isReducer: false,
        doc: 'Returns the last name part of a name.',
    },
    {
        name: 'fn:name:list',
        arity: 1,
        isReducer: false,
        doc: 'Turns a name into a list of name parts.',
    },
];

/**
 * All reducer functions (used in aggregations).
 */
export const REDUCER_FUNCTIONS: BuiltinFunction[] = [
    {
        name: 'fn:collect',
        arity: -1,
        isReducer: true,
        doc: 'Collects tuples into a list [tuple_1, ..., tuple_n].',
    },
    {
        name: 'fn:collect_distinct',
        arity: -1,
        isReducer: true,
        doc: 'Collects tuples into a list with distinct elements.',
    },
    {
        name: 'fn:collect_to_map',
        arity: 2,
        isReducer: true,
        doc: 'Collects key-value pairs into a map. Usage: fn:collect_to_map(Key, Value)',
    },
    {
        name: 'fn:pick_any',
        arity: 1,
        isReducer: true,
        doc: 'Reduces a set {x_1, ..., x_n} to a single {x_i}.',
    },
    {
        name: 'fn:max',
        arity: 1,
        isReducer: true,
        doc: 'Returns the maximum value from a set of numbers.',
    },
    {
        name: 'fn:min',
        arity: 1,
        isReducer: true,
        doc: 'Returns the minimum value from a set of numbers.',
    },
    {
        name: 'fn:sum',
        arity: 1,
        isReducer: true,
        doc: 'Returns the sum of a set of numbers.',
    },
    {
        name: 'fn:float:max',
        arity: 1,
        isReducer: true,
        doc: 'Returns the maximum value from a set of float64.',
    },
    {
        name: 'fn:float:min',
        arity: 1,
        isReducer: true,
        doc: 'Returns the minimum value from a set of float64.',
    },
    {
        name: 'fn:float:sum',
        arity: 1,
        isReducer: true,
        doc: 'Returns the sum of a set of float64.',
    },
    {
        name: 'fn:count',
        arity: 0,
        isReducer: true,
        doc: 'Returns the count of elements in a set.',
    },
    {
        name: 'fn:count_distinct',
        arity: 0,
        isReducer: true,
        doc: 'Returns the count of unique elements in a set.',
    },
    {
        name: 'fn:avg',
        arity: 1,
        isReducer: true,
        doc: 'Returns the average of a set of numbers.',
    },
];

/**
 * All built-in functions (both regular and reducer).
 */
export const ALL_BUILTIN_FUNCTIONS: BuiltinFunction[] = [
    ...BUILTIN_FUNCTIONS,
    ...REDUCER_FUNCTIONS,
];

/**
 * Map from function name to definition for fast lookup.
 */
export const BUILTIN_FUNCTION_MAP = new Map<string, BuiltinFunction>(
    ALL_BUILTIN_FUNCTIONS.map(f => [f.name, f])
);

/**
 * Check if a function name is a built-in function.
 */
export function isBuiltinFunction(name: string): boolean {
    return BUILTIN_FUNCTION_MAP.has(name);
}

/**
 * Check if a function name is a reducer function.
 */
export function isReducerFunction(name: string): boolean {
    const fn = BUILTIN_FUNCTION_MAP.get(name);
    return fn !== undefined && fn.isReducer;
}

/**
 * Get the built-in function definition by name.
 */
export function getBuiltinFunction(name: string): BuiltinFunction | undefined {
    return BUILTIN_FUNCTION_MAP.get(name);
}

/**
 * Get all built-in function names for completion.
 */
export function getBuiltinFunctionNames(): string[] {
    return ALL_BUILTIN_FUNCTIONS.map(f => f.name);
}

/**
 * Get reducer function names for completion in do-transforms.
 */
export function getReducerFunctionNames(): string[] {
    return REDUCER_FUNCTIONS.map(f => f.name);
}
