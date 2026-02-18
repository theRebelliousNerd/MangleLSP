"use strict";
/**
 * Built-in function definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go, builtin/builtin.go).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_FUNCTION_MAP = exports.ALL_BUILTIN_FUNCTIONS = exports.REDUCER_FUNCTIONS = exports.BUILTIN_FUNCTIONS = void 0;
exports.isBuiltinFunction = isBuiltinFunction;
exports.isReducerFunction = isReducerFunction;
exports.getBuiltinFunction = getBuiltinFunction;
exports.getBuiltinFunctionNames = getBuiltinFunctionNames;
exports.getReducerFunctionNames = getReducerFunctionNames;
/**
 * All built-in functions (non-reducer).
 */
exports.BUILTIN_FUNCTIONS = [
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
    // Time functions
    {
        name: 'fn:time:now',
        arity: 0,
        isReducer: false,
        doc: 'Returns the current time as a time instant.',
    },
    {
        name: 'fn:time:add',
        arity: 2,
        isReducer: false,
        doc: 'Adds a duration to a time instant. Usage: fn:time:add(Time, Duration)',
    },
    {
        name: 'fn:time:sub',
        arity: 2,
        isReducer: false,
        doc: 'Subtracts a duration from a time instant, or computes the duration between two time instants. Usage: fn:time:sub(Time, DurationOrTime)',
    },
    {
        name: 'fn:time:format',
        arity: 2,
        isReducer: false,
        doc: 'Formats a time instant as a string with given precision. Usage: fn:time:format(Time, /precision) where precision is /second, /millisecond, /microsecond, or /nanosecond',
    },
    {
        name: 'fn:time:format_civil',
        arity: 3,
        isReducer: false,
        doc: 'Formats a time instant as a civil datetime string with timezone. Usage: fn:time:format_civil(Time, /precision, Timezone)',
    },
    {
        name: 'fn:time:parse_rfc3339',
        arity: 1,
        isReducer: false,
        doc: 'Parses an RFC 3339 timestamp string into a time instant. Usage: fn:time:parse_rfc3339(String)',
    },
    {
        name: 'fn:time:parse_civil',
        arity: 2,
        isReducer: false,
        doc: 'Parses a civil datetime string with timezone into a time instant. Usage: fn:time:parse_civil(String, Timezone)',
    },
    {
        name: 'fn:time:year',
        arity: 1,
        isReducer: false,
        doc: 'Returns the year of a time instant. Usage: fn:time:year(Time)',
    },
    {
        name: 'fn:time:month',
        arity: 1,
        isReducer: false,
        doc: 'Returns the month (1-12) of a time instant. Usage: fn:time:month(Time)',
    },
    {
        name: 'fn:time:day',
        arity: 1,
        isReducer: false,
        doc: 'Returns the day of the month of a time instant. Usage: fn:time:day(Time)',
    },
    {
        name: 'fn:time:hour',
        arity: 1,
        isReducer: false,
        doc: 'Returns the hour (0-23) of a time instant. Usage: fn:time:hour(Time)',
    },
    {
        name: 'fn:time:minute',
        arity: 1,
        isReducer: false,
        doc: 'Returns the minute (0-59) of a time instant. Usage: fn:time:minute(Time)',
    },
    {
        name: 'fn:time:second',
        arity: 1,
        isReducer: false,
        doc: 'Returns the second (0-59) of a time instant. Usage: fn:time:second(Time)',
    },
    {
        name: 'fn:time:from_unix_nanos',
        arity: 1,
        isReducer: false,
        doc: 'Creates a time instant from Unix nanoseconds. Usage: fn:time:from_unix_nanos(Number)',
    },
    {
        name: 'fn:time:to_unix_nanos',
        arity: 1,
        isReducer: false,
        doc: 'Returns the Unix nanoseconds of a time instant. Usage: fn:time:to_unix_nanos(Time)',
    },
    {
        name: 'fn:time:trunc',
        arity: 2,
        isReducer: false,
        doc: 'Truncates a time instant to the given precision. Usage: fn:time:trunc(Time, /precision)',
    },
    // Duration functions
    {
        name: 'fn:duration:add',
        arity: 2,
        isReducer: false,
        doc: 'Adds two durations. Usage: fn:duration:add(Duration1, Duration2)',
    },
    {
        name: 'fn:duration:mult',
        arity: 2,
        isReducer: false,
        doc: 'Multiplies a duration by a number. Usage: fn:duration:mult(Duration, Number)',
    },
    {
        name: 'fn:duration:hours',
        arity: 1,
        isReducer: false,
        doc: 'Returns the number of hours in a duration (as float64). Usage: fn:duration:hours(Duration)',
    },
    {
        name: 'fn:duration:minutes',
        arity: 1,
        isReducer: false,
        doc: 'Returns the number of minutes in a duration (as float64). Usage: fn:duration:minutes(Duration)',
    },
    {
        name: 'fn:duration:seconds',
        arity: 1,
        isReducer: false,
        doc: 'Returns the number of seconds in a duration (as float64). Usage: fn:duration:seconds(Duration)',
    },
    {
        name: 'fn:duration:nanos',
        arity: 1,
        isReducer: false,
        doc: 'Returns the number of nanoseconds in a duration. Usage: fn:duration:nanos(Duration)',
    },
    {
        name: 'fn:duration:from_nanos',
        arity: 1,
        isReducer: false,
        doc: 'Creates a duration from nanoseconds. Usage: fn:duration:from_nanos(Number)',
    },
    {
        name: 'fn:duration:from_hours',
        arity: 1,
        isReducer: false,
        doc: 'Creates a duration from hours. Usage: fn:duration:from_hours(Number)',
    },
    {
        name: 'fn:duration:from_minutes',
        arity: 1,
        isReducer: false,
        doc: 'Creates a duration from minutes. Usage: fn:duration:from_minutes(Number)',
    },
    {
        name: 'fn:duration:from_seconds',
        arity: 1,
        isReducer: false,
        doc: 'Creates a duration from seconds. Usage: fn:duration:from_seconds(Number)',
    },
    {
        name: 'fn:duration:parse',
        arity: 1,
        isReducer: false,
        doc: 'Parses a duration string (e.g., "7d", "24h", "30m", "1s", "500ms") into a duration. Usage: fn:duration:parse(String)',
    },
    // Interval functions (upstream symbols/symbols.go)
    {
        name: 'fn:interval:start',
        arity: 1,
        isReducer: false,
        doc: 'Returns the start time of an interval. Usage: fn:interval:start(Interval)',
    },
    {
        name: 'fn:interval:end',
        arity: 1,
        isReducer: false,
        doc: 'Returns the end time of an interval. Usage: fn:interval:end(Interval)',
    },
    {
        name: 'fn:interval:duration',
        arity: 1,
        isReducer: false,
        doc: 'Returns the duration of an interval (end - start). Usage: fn:interval:duration(Interval)',
    },
];
/**
 * All reducer functions (used in aggregations).
 */
exports.REDUCER_FUNCTIONS = [
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
exports.ALL_BUILTIN_FUNCTIONS = [
    ...exports.BUILTIN_FUNCTIONS,
    ...exports.REDUCER_FUNCTIONS,
];
/**
 * Map from function name to definition for fast lookup.
 */
exports.BUILTIN_FUNCTION_MAP = new Map(exports.ALL_BUILTIN_FUNCTIONS.map(f => [f.name, f]));
/**
 * Check if a function name is a built-in function.
 */
function isBuiltinFunction(name) {
    return exports.BUILTIN_FUNCTION_MAP.has(name);
}
/**
 * Check if a function name is a reducer function.
 */
function isReducerFunction(name) {
    const fn = exports.BUILTIN_FUNCTION_MAP.get(name);
    return fn !== undefined && fn.isReducer;
}
/**
 * Get the built-in function definition by name.
 */
function getBuiltinFunction(name) {
    return exports.BUILTIN_FUNCTION_MAP.get(name);
}
/**
 * Get all built-in function names for completion.
 */
function getBuiltinFunctionNames() {
    return exports.ALL_BUILTIN_FUNCTIONS.map(f => f.name);
}
/**
 * Get reducer function names for completion in do-transforms.
 */
function getReducerFunctionNames() {
    return exports.REDUCER_FUNCTIONS.map(f => f.name);
}
//# sourceMappingURL=functions.js.map