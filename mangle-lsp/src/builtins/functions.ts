/**
 * Built-in function definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go for names and
 * arities, builtin/builtin.go for type signatures, functional/functional.go for
 * runtime behavior, readthedocs/basictypes.md for documentation).
 *
 * Upstream reference: codeberg.org/TauCeti/mangle-go @ 77780a5 (2026-09-19).
 *
 * Signatures describe what the *runtime* accepts. Where the runtime is more
 * permissive than upstream's static type (e.g. float arithmetic coerces
 * /number, fn:list:get returns the element itself), the runtime behavior is
 * used so that the LSP never reports a program that would run fine.
 */

import { TypeExpr, T, typeToString } from '../analysis/types';

/**
 * Type signature of a built-in function.
 */
export interface FunctionSignature {
    /** Types of the fixed (positional) parameters. */
    readonly params: readonly TypeExpr[];
    /** For variadic functions: the type of every additional argument. */
    readonly rest?: TypeExpr;
    /** Result type (may mention type variables bound by the parameters). */
    readonly result: TypeExpr;
}

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
    /** Parameter names used for snippets and signatures (e.g. ['Time', 'Duration']) */
    paramNames?: readonly string[];
    /** Type signature (absent for type constructors) */
    signature?: FunctionSignature;
    /** A short, runnable usage example */
    example?: string;
    /** Related builtins worth knowing about */
    seeAlso?: readonly string[];
    /** Allowed name constants for a unit/precision argument: [argIndex, units] */
    unitArg?: { readonly index: number; readonly units: readonly string[] };
}

interface Opts {
    rest?: TypeExpr;
    example?: string;
    seeAlso?: string[];
    reducer?: boolean;
    variadic?: boolean;
    unitArg?: { index: number; units: string[] };
}

/** Builds a function definition from named, typed parameters. */
function fn(
    name: string,
    params: Array<[string, TypeExpr]>,
    result: TypeExpr,
    doc: string,
    opts: Opts = {}
): BuiltinFunction {
    const variadic = opts.variadic ?? opts.rest !== undefined;
    return {
        name,
        arity: variadic ? -1 : params.length,
        isReducer: opts.reducer ?? false,
        doc,
        paramNames: params.map(p => p[0]),
        signature: { params: params.map(p => p[1]), rest: opts.rest, result },
        example: opts.example,
        seeAlso: opts.seeAlso,
        unitArg: opts.unitArg,
    };
}

/** Units accepted by fn:time:format / fn:time:format_civil (upstream precisionLayout). */
export const TIME_FORMAT_UNITS = [
    '/year', '/month', '/day', '/hour', '/minute', '/second',
    '/millisecond', '/microsecond', '/nanosecond',
] as const;

/** Fixed-duration units accepted by fn:time:trunc (UTC). */
export const TIME_TRUNC_UNITS = [
    '/day', '/hour', '/minute', '/second', '/millisecond', '/microsecond', '/nanosecond',
] as const;

/** Calendar units accepted by fn:time:trunc_civil and fn:time:add_civil. */
export const TIME_CIVIL_UNITS = ['/year', '/month', '/week', '/day'] as const;

const X = T.v('X');
const Y = T.v('Y');

/**
 * All built-in functions (non-reducer).
 */
export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
    // Integer arithmetic (upstream EvalNumericApplyFn: arguments must be /number)
    fn('fn:plus', [['X', T.number]], T.number,
        'Integer addition. Maps X, Y1, ... to (X + Y1) + Y2 + ... fn:plus(X) returns X. All arguments must be /number; use fn:float:plus for /float64.',
        { rest: T.number, example: 'Next = fn:plus(N, 1)', seeAlso: ['fn:float:plus', 'fn:sum'] }),
    fn('fn:minus', [['X', T.number]], T.number,
        'Integer subtraction. Maps X, Y1, ... to (X - Y1) - Y2 - ... fn:minus(X) returns -X.',
        { rest: T.number, example: 'Diff = fn:minus(A, B)' }),
    fn('fn:mult', [['X', T.number]], T.number,
        'Integer multiplication. Maps X, Y1, ... to (X * Y1) * Y2 * ... fn:mult(X) returns X.',
        { rest: T.number, example: 'Area = fn:mult(W, H)', seeAlso: ['fn:float:mult'] }),
    fn('fn:div', [['X', T.number]], T.number,
        'Integer division (truncating). Maps X, Y1, ... to (X / Y1) / Y2 / ... fn:div(X) returns 1/X. Division by zero is a runtime error.',
        { rest: T.number, example: 'Half = fn:div(N, 2)', seeAlso: ['fn:mod', 'fn:float:div'] }),
    fn('fn:mod', [['X', T.number], ['Y', T.number]], T.number,
        'Integer remainder of X divided by Y. The result has the sign of X (Go semantics). Modulo by zero is a runtime error.',
        { example: 'IsEven = fn:mod(N, 2)', seeAlso: ['fn:div'] }),
    fn('fn:sqrt', [['X', T.numeric]], T.float64,
        'Square root. Accepts /number or /float64 and returns /float64.',
        { example: 'Root = fn:sqrt(2.0)' }),

    // Float arithmetic (runtime valueAsFloat accepts /number and /float64)
    fn('fn:float:plus', [['X', T.numeric]], T.float64,
        'Float addition. Maps X, Y1, ... to (X + Y1) + Y2 + ... Arguments may be /number or /float64; the result is /float64.',
        { rest: T.numeric, example: 'Total = fn:float:plus(Price, Tax)', seeAlso: ['fn:plus', 'fn:float:sum'] }),
    fn('fn:float:mult', [['X', T.numeric]], T.float64,
        'Float multiplication. Maps X, Y1, ... to (X * Y1) * Y2 * ... Arguments may be /number or /float64.',
        { rest: T.numeric, example: 'Scaled = fn:float:mult(X, 1.5)' }),
    fn('fn:float:div', [['X', T.numeric]], T.float64,
        'Float division. Maps X, Y1, ... to (X / Y1) / Y2 / ... Arguments may be /number or /float64.',
        { rest: T.numeric, example: 'Ratio = fn:float:div(A, B)' }),

    // Grouping function (special - used to start a do-transform)
    {
        name: 'fn:group_by',
        arity: -1,
        isReducer: false,
        doc: 'Starts an aggregation: groups all tuples by the values of the key variables. fn:group_by() with no arguments treats the whole relation as one group. Must be the first statement of a do-transform and must be followed by let-statements using reducers.',
        paramNames: ['Key'],
        example: 'count(G, N) :- member(G, _) |> do fn:group_by(G), let N = fn:count().',
        seeAlso: ['fn:count', 'fn:sum', 'fn:collect'],
    },

    // List functions
    fn('fn:list', [], T.list(X),
        'Constructs a list from the arguments. Usually written as a literal: [A, B, C].',
        { rest: X, example: 'L = [1, 2, 3]' }),
    fn('fn:list:append', [['List', T.list(X)], ['Element', X]], T.list(X),
        'Returns List with Element appended at the end.',
        { example: 'NewPath = fn:list:append(Path, Node)', seeAlso: ['fn:list:cons'] }),
    fn('fn:list:get', [['List', T.list(X)], ['Index', T.number]], X,
        'Returns the element at a 0-based index. Out-of-bounds is a runtime error (the rule produces no fact).',
        { example: 'First = fn:list:get(L, 0)', seeAlso: [':match_cons', ':list:member'] }),
    fn('fn:list:contains', [['List', T.list(X)], ['Member', X]], T.bool,
        'Returns /true if Member is in List, /false otherwise. To filter rows, prefer the predicate :list:member(Member, List).',
        { example: ':filter(fn:list:contains(Tags, "urgent"))', seeAlso: [':list:member'] }),
    fn('fn:list:len', [['List', T.list(X)]], T.number,
        'Returns the length of a list.',
        { example: 'N = fn:list:len(L)', seeAlso: ['fn:count'] }),
    fn('fn:list:cons', [['Head', X], ['Tail', T.list(X)]], T.list(X),
        'Constructs a list from a head element and a tail list.',
        { example: 'L = fn:list:cons(H, T)', seeAlso: [':match_cons'] }),

    // Pair and tuple functions
    fn('fn:pair', [['First', X], ['Second', Y]], T.pair(X, Y),
        'Constructs a pair. Destructure with :match_pair(P, First, Second).',
        { example: 'P = fn:pair(A, B)', seeAlso: [':match_pair'] }),
    {
        name: 'fn:tuple',
        arity: -1,
        isReducer: false,
        doc: 'Acts as identity (one argument), fn:pair (two arguments) or nested pairs (more): fn:tuple(A, B, C) = fn:pair(A, fn:pair(B, C)).',
        paramNames: ['X'],
        example: 'Triple = fn:tuple(A, B, C)',
    },
    fn('fn:some', [['Value', X]], T.option(X),
        'Constructs an element of an option type fn:Option(T).',
        { example: 'O = fn:some(X)' }),

    // Map and struct functions
    {
        name: 'fn:map',
        arity: -1,
        isReducer: false,
        doc: 'Constructs a map from alternating key and value arguments. Usually written as a literal: [K1: V1, K2: V2].',
        paramNames: ['Key', 'Value'],
        example: 'M = [/a: 1, /b: 2]',
        seeAlso: ['fn:map:get', ':match_entry'],
    },
    fn('fn:map:get', [['Map', T.map(X, Y)], ['Key', X]], Y,
        'Returns the value stored under Key. A missing key is a runtime error; use :match_entry(Map, Key, V) to test membership instead.',
        { example: 'V = fn:map:get(M, /a)', seeAlso: [':match_entry'] }),
    {
        name: 'fn:struct',
        arity: -1,
        isReducer: false,
        doc: 'Constructs a struct from alternating /field and value arguments. Usually written as a literal: {/field: V, ...}.',
        paramNames: ['Field', 'Value'],
        example: 'S = {/name: "Ada", /age: 36}',
        seeAlso: ['fn:struct:get', ':match_field'],
    },
    fn('fn:struct:get', [['Struct', T.any], ['Field', T.name]], T.any,
        'Returns the value of a field. A missing field is a runtime error; :match_field(S, /field, V) is the pattern-matching alternative.',
        { example: 'Name = fn:struct:get(S, /name)', seeAlso: [':match_field'] }),

    // String functions
    fn('fn:string:concat', [], T.string,
        'Concatenates the arguments into a single string. Non-string arguments are converted to their string form.',
        { rest: T.any, example: 'Label = fn:string:concat("user-", Id)' }),
    fn('fn:string:replace', [['Str', T.string], ['Old', T.string], ['New', T.string], ['N', T.number]], T.string,
        'Replaces the first N occurrences of Old with New (N < 0 replaces all).',
        { example: 'Clean = fn:string:replace(S, " ", "_", -1)' }),

    // Conversion functions
    fn('fn:number:to_string', [['N', T.number]], T.string,
        'Converts a /number to a string.', { example: 'S = fn:number:to_string(42)' }),
    fn('fn:float64:to_string', [['F', T.float64]], T.string,
        'Converts a /float64 to a string.', { example: 'S = fn:float64:to_string(3.14)' }),
    fn('fn:name:to_string', [['Name', T.name]], T.string,
        'Converts a name constant to a string, e.g. /a/b becomes "/a/b".', { example: 'S = fn:name:to_string(/a/b)' }),
    fn('fn:name:root', [['Name', T.name]], T.name,
        'Returns the first name part: fn:name:root(/a/b/c) = /a.', { example: 'Root = fn:name:root(N)' }),
    fn('fn:name:tip', [['Name', T.name]], T.name,
        'Returns the last name part: fn:name:tip(/a/b/c) = /c.', { example: 'Tip = fn:name:tip(N)' }),
    fn('fn:name:list', [['Name', T.name]], T.list(T.name),
        'Turns a name into the list of its parts: fn:name:list(/a/b) = [/a, /b].', { example: 'Parts = fn:name:list(N)' }),

    // Time functions
    fn('fn:time:now', [], T.time,
        'Returns the current time as a /time instant. Non-deterministic: results change between evaluations.',
        { example: 'Now = fn:time:now()' }),
    fn('fn:time:add', [['Time', T.time], ['Duration', T.duration]], T.time,
        'Adds a /duration to a /time instant (absolute time, not calendar-aware).',
        { example: 'Later = fn:time:add(T, fn:duration:from_hours(1))', seeAlso: ['fn:time:add_civil'] }),
    fn('fn:time:add_civil', [['Time', T.time], ['TimeZone', T.string], ['N', T.number], ['Unit', T.name]], T.time,
        'Adds N calendar units (/year, /month, /week, /day) to a time in the given IANA timezone. N may be negative. The civil time of day is preserved across DST, so a day may be 23 or 25 hours; results are normalized (Jan 31 + 1 month = Mar 2 or 3).',
        { example: 'NextMonth = fn:time:add_civil(T, "Europe/Berlin", 1, /month)', seeAlso: ['fn:time:add', 'fn:time:trunc_civil'], unitArg: { index: 3, units: [...TIME_CIVIL_UNITS] } }),
    fn('fn:time:sub', [['Time1', T.time], ['Time2', T.time]], T.duration,
        'Subtracts two time instants and returns the /duration Time1 - Time2.',
        { example: 'Elapsed = fn:time:sub(End, Start)' }),
    fn('fn:time:format', [['Time', T.time], ['Unit', T.name]], T.string,
        'Formats a time as an RFC 3339 string in UTC, truncated to the layout of Unit (/year, /month, /day, /hour, /minute, /second, /millisecond, /microsecond, /nanosecond).',
        { example: 'Day = fn:time:format(T, /day)', seeAlso: ['fn:time:format_civil'], unitArg: { index: 1, units: [...TIME_FORMAT_UNITS] } }),
    fn('fn:time:format_civil', [['Time', T.time], ['TimeZone', T.string], ['Unit', T.name]], T.string,
        'Formats a time in the given IANA timezone (e.g. "America/Los_Angeles") using the layout of Unit.',
        { example: 'Local = fn:time:format_civil(T, "Asia/Tokyo", /minute)', seeAlso: ['fn:time:format'], unitArg: { index: 2, units: [...TIME_FORMAT_UNITS] } }),
    fn('fn:time:parse_rfc3339', [['String', T.string]], T.time,
        'Parses an RFC 3339 timestamp such as "2024-01-15T10:30:00Z" into a /time instant.',
        { example: 'T = fn:time:parse_rfc3339("2024-01-15T10:30:00Z")' }),
    fn('fn:time:parse_civil', [['String', T.string], ['TimeZone', T.string]], T.time,
        'Parses a civil datetime without offset (e.g. "2024-01-15T10:30:00") interpreted in the given IANA timezone.',
        { example: 'T = fn:time:parse_civil("2024-01-15T10:30:00", "America/Los_Angeles")' }),
    fn('fn:time:year', [['Time', T.time]], T.number, 'Returns the year of a time instant (UTC).', { example: 'Y = fn:time:year(T)' }),
    fn('fn:time:month', [['Time', T.time]], T.number, 'Returns the month (1-12) of a time instant (UTC).', { example: 'M = fn:time:month(T)' }),
    fn('fn:time:day', [['Time', T.time]], T.number, 'Returns the day of the month (1-31) of a time instant (UTC).', { example: 'D = fn:time:day(T)' }),
    fn('fn:time:hour', [['Time', T.time]], T.number, 'Returns the hour (0-23) of a time instant (UTC).', { example: 'H = fn:time:hour(T)' }),
    fn('fn:time:minute', [['Time', T.time]], T.number, 'Returns the minute (0-59) of a time instant (UTC).', { example: 'M = fn:time:minute(T)' }),
    fn('fn:time:second', [['Time', T.time]], T.number, 'Returns the second (0-59) of a time instant (UTC).', { example: 'S = fn:time:second(T)' }),
    fn('fn:time:weekday_civil', [['Time', T.time], ['TimeZone', T.string]], T.number,
        'Returns the ISO day of the week in the given IANA timezone: Monday = 1 ... Sunday = 7.',
        { example: 'Dow = fn:time:weekday_civil(T, "UTC"), Dow <= 5', seeAlso: ['fn:time:trunc_civil'] }),
    fn('fn:time:from_unix_nanos', [['Nanos', T.number]], T.time,
        'Creates a time instant from nanoseconds since the Unix epoch.', { example: 'T = fn:time:from_unix_nanos(0)' }),
    fn('fn:time:to_unix_nanos', [['Time', T.time]], T.number,
        'Returns the nanoseconds since the Unix epoch of a time instant.', { example: 'Ns = fn:time:to_unix_nanos(T)' }),
    fn('fn:time:trunc', [['Time', T.time], ['Unit', T.name]], T.time,
        'Truncates a time to a fixed-duration unit in UTC: /day, /hour, /minute, /second, /millisecond, /microsecond, /nanosecond. For calendar units (/week, /month, /year) or timezone-aware days use fn:time:trunc_civil.',
        { example: 'Hour = fn:time:trunc(T, /hour)', seeAlso: ['fn:time:trunc_civil'], unitArg: { index: 1, units: [...TIME_TRUNC_UNITS] } }),
    fn('fn:time:trunc_civil', [['Time', T.time], ['TimeZone', T.string], ['Unit', T.name]], T.time,
        'Truncates a time to the start of a calendar unit (/year, /month, /week, /day) in the given IANA timezone. Correct across DST; /week yields Monday 00:00 local time (ISO week).',
        { example: 'WeekStart = fn:time:trunc_civil(T, "Europe/Paris", /week)', seeAlso: ['fn:time:trunc', 'fn:time:add_civil'], unitArg: { index: 2, units: [...TIME_CIVIL_UNITS] } }),

    // Duration functions
    fn('fn:duration:add', [['D1', T.duration], ['D2', T.duration]], T.duration,
        'Adds two durations.', { example: 'Total = fn:duration:add(A, B)', seeAlso: ['fn:duration:sum'] }),
    fn('fn:duration:mult', [['Duration', T.duration], ['Factor', T.number]], T.duration,
        'Multiplies a duration by an integer factor.', { example: 'Twice = fn:duration:mult(D, 2)' }),
    fn('fn:duration:hours', [['Duration', T.duration]], T.float64,
        'Returns the duration as floating-point hours.', { example: 'H = fn:duration:hours(D)' }),
    fn('fn:duration:minutes', [['Duration', T.duration]], T.float64,
        'Returns the duration as floating-point minutes.', { example: 'M = fn:duration:minutes(D)' }),
    fn('fn:duration:seconds', [['Duration', T.duration]], T.float64,
        'Returns the duration as floating-point seconds.', { example: 'S = fn:duration:seconds(D)' }),
    fn('fn:duration:nanos', [['Duration', T.duration]], T.number,
        'Returns the duration as integer nanoseconds.', { example: 'Ns = fn:duration:nanos(D)' }),
    fn('fn:duration:from_nanos', [['Nanos', T.number]], T.duration,
        'Creates a duration from integer nanoseconds.', { example: 'D = fn:duration:from_nanos(1000)' }),
    fn('fn:duration:from_hours', [['Hours', T.numeric]], T.duration,
        'Creates a duration from hours (/number or /float64).', { example: 'D = fn:duration:from_hours(1.5)' }),
    fn('fn:duration:from_minutes', [['Minutes', T.numeric]], T.duration,
        'Creates a duration from minutes (/number or /float64).', { example: 'D = fn:duration:from_minutes(30)' }),
    fn('fn:duration:from_seconds', [['Seconds', T.numeric]], T.duration,
        'Creates a duration from seconds (/number or /float64).', { example: 'D = fn:duration:from_seconds(90)' }),
    fn('fn:duration:parse', [['String', T.string]], T.duration,
        'Parses a Go-style duration string such as "1h30m", "500ms" or "-2h45m30s". Units: h, m, s, ms, us/µs, ns.',
        { example: 'D = fn:duration:parse("1h30m")' }),

    // Interval functions (intervals are pairs of time instants)
    fn('fn:interval:start', [['Interval', T.interval]], T.time,
        'Returns the start time of an interval.', { example: 'S = fn:interval:start(I)' }),
    fn('fn:interval:end', [['Interval', T.interval]], T.time,
        'Returns the end time of an interval.', { example: 'E = fn:interval:end(I)' }),
    fn('fn:interval:duration', [['Interval', T.interval]], T.duration,
        'Returns the duration of an interval (end - start). Unbounded intervals are a runtime error.',
        { example: 'D = fn:interval:duration(I)' }),
];

/**
 * All reducer functions (used in aggregations after `do fn:group_by(...)`).
 *
 * For reducers, parameter types describe the per-row values of the argument
 * variables; the result is the aggregate over the group.
 */
export const REDUCER_FUNCTIONS: BuiltinFunction[] = [
    fn('fn:collect', [['X', X]], T.list(X),
        'Collects the values (or tuples, for several arguments) of the group into a list [x_1, ..., x_n].',
        { rest: T.any, reducer: true, example: '|> do fn:group_by(K), let Vs = fn:collect(V)', seeAlso: ['fn:collect_distinct', 'fn:count'] }),
    fn('fn:collect_distinct', [['X', X]], T.list(X),
        'Collects the values of the group into a list without duplicates.',
        { rest: T.any, reducer: true, example: '|> do fn:group_by(K), let Vs = fn:collect_distinct(V)', seeAlso: ['fn:count_distinct'] }),
    fn('fn:collect_to_map', [['Key', X], ['Value', Y]], T.map(X, Y),
        'Collects key-value pairs of the group into a map. If a key occurs several times an arbitrary value is kept.',
        { reducer: true, example: '|> do fn:group_by(P), let M = fn:collect_to_map(Lang, /true)' }),
    fn('fn:pick_any', [['X', X]], X,
        'Picks an arbitrary single value from the group.',
        { reducer: true, example: '|> do fn:group_by(K), let Any = fn:pick_any(V)' }),
    fn('fn:max', [['X', T.number]], T.number,
        'Maximum of the /number values in the group. Empty groups yield math.MinInt64.',
        { reducer: true, example: '|> do fn:group_by(K), let M = fn:max(V)', seeAlso: ['fn:float:max', 'fn:duration:max', 'fn:time:max'] }),
    fn('fn:min', [['X', T.number]], T.number,
        'Minimum of the /number values in the group. Empty groups yield math.MaxInt64.',
        { reducer: true, example: '|> do fn:group_by(K), let M = fn:min(V)', seeAlso: ['fn:float:min', 'fn:duration:min', 'fn:time:min'] }),
    fn('fn:sum', [['X', T.number]], T.number,
        'Sum of the /number values in the group.',
        { reducer: true, example: '|> do fn:group_by(K), let S = fn:sum(V)', seeAlso: ['fn:float:sum', 'fn:duration:sum'] }),
    fn('fn:float:max', [['X', T.float64]], T.float64,
        'Maximum of the /float64 values in the group. NaN propagates.',
        { reducer: true, example: '|> do fn:group_by(K), let M = fn:float:max(V)' }),
    fn('fn:float:min', [['X', T.float64]], T.float64,
        'Minimum of the /float64 values in the group. NaN propagates.',
        { reducer: true, example: '|> do fn:group_by(K), let M = fn:float:min(V)' }),
    fn('fn:float:sum', [['X', T.numeric]], T.float64,
        'Sum of the /number or /float64 values in the group, as /float64.',
        { reducer: true, example: '|> do fn:group_by(K), let S = fn:float:sum(V)' }),
    fn('fn:duration:max', [['D', T.duration]], T.duration,
        'Longest /duration in the group.',
        { reducer: true, example: '|> do fn:group_by(Job), let Worst = fn:duration:max(D)' }),
    fn('fn:duration:min', [['D', T.duration]], T.duration,
        'Shortest /duration in the group.',
        { reducer: true, example: '|> do fn:group_by(Job), let Best = fn:duration:min(D)' }),
    fn('fn:duration:sum', [['D', T.duration]], T.duration,
        'Sum of all /duration values in the group.',
        { reducer: true, example: '|> do fn:group_by(User), let Total = fn:duration:sum(D)' }),
    fn('fn:time:max', [['T', T.time]], T.time,
        'Latest /time instant in the group.',
        { reducer: true, example: '|> do fn:group_by(User), let LastSeen = fn:time:max(T)' }),
    fn('fn:time:min', [['T', T.time]], T.time,
        'Earliest /time instant in the group.',
        { reducer: true, example: '|> do fn:group_by(User), let FirstSeen = fn:time:min(T)' }),
    fn('fn:count', [], T.number,
        'Number of rows in the group.',
        { reducer: true, example: '|> do fn:group_by(K), let N = fn:count()', seeAlso: ['fn:count_distinct'] }),
    fn('fn:count_distinct', [], T.number,
        'Number of distinct rows in the group.',
        { reducer: true, example: '|> do fn:group_by(K), let N = fn:count_distinct()' }),
    fn('fn:avg', [['X', T.float64]], T.float64,
        'Average of the /float64 values in the group. /number values are rejected at runtime; convert them or use fn:float:sum / fn:count.',
        { reducer: true, example: '|> do fn:group_by(K), let A = fn:avg(V)' }),
];

/**
 * Type constructor functions (used in bound declarations and type expressions).
 *
 * These are the uppercase type-level constructors from upstream
 * symbols.TypeConstructors. They differ from their lowercase runtime
 * counterparts: fn:pair(X, Y) constructs a pair value, fn:Pair(T1, T2) is the
 * pair *type* used in `bound [...]`.
 */
export const TYPE_CONSTRUCTOR_FUNCTIONS: BuiltinFunction[] = [
    {
        name: 'fn:Fun',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for function types. fn:Fun(Res, Arg1, ..., ArgN) represents Res <= Arg1, ..., ArgN. Type variables of Res must occur in the arguments.',
    },
    {
        name: 'fn:Rel',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for relation types.',
    },
    {
        name: 'fn:Singleton',
        arity: 1,
        isReducer: false,
        doc: 'Type constructor for singleton types. .Singleton</true> contains exactly /true.',
        example: 'bound [.Union<.Singleton</on>, .Singleton</off>>]',
    },
    {
        name: 'fn:Pair',
        arity: 2,
        isReducer: false,
        doc: 'Type constructor for pair types. fn:Pair(T1, T2) is the type of fn:pair(x, y) where x:T1, y:T2.',
        example: 'bound [.Pair</string, /number>]',
    },
    {
        name: 'fn:Tuple',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for tuple types (more than 2 elements; use fn:Pair for 2). Expands to nested pairs.',
    },
    {
        name: 'fn:Option',
        arity: 1,
        isReducer: false,
        doc: 'Type constructor for option types. A value of fn:Option(T) is either fn:some(c) for c:T, or fn:none().',
    },
    {
        name: 'fn:List',
        arity: 1,
        isReducer: false,
        doc: 'Type constructor for list types. fn:List(T) is the type of lists with elements of type T.',
        example: 'bound [.List</string>]',
    },
    {
        name: 'fn:Map',
        arity: 2,
        isReducer: false,
        doc: 'Type constructor for map types. fn:Map(K, V) is the type of maps with keys K and values V.',
        example: 'bound [.Map</name, /number>]',
    },
    {
        name: 'fn:Struct',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for struct types. .Struct</field1 : Type1, opt /field2 : Type2> defines a struct type; `opt` marks optional fields.',
        example: 'bound [.Struct</name : /string, opt /email : /string>]',
    },
    {
        name: 'fn:Union',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for union types. fn:Union(T1, T2, ...) is the union of types T1, T2, ... (must not be empty).',
        example: 'bound [.Union</number, /string>]',
    },
    {
        name: 'fn:TaggedUnion',
        arity: -1,
        isReducer: false,
        doc: 'Type constructor for internally-tagged discriminated unions: .TaggedUnion</tag_field, /variant1 : .Struct<...>, /variant2 : .Struct<...>>. A value is a struct whose tag field holds a variant tag plus that variant\'s fields. Variant structs must not contain the tag field; tags must be distinct.',
        example: 'bound [.TaggedUnion</kind, /move : .Struct</x : /number>, /quit : .Struct<>>]',
    },
    {
        name: 'fn:opt',
        arity: -1,
        isReducer: false,
        doc: 'Marks a field as optional inside a struct type expression: .Struct</a : /number, opt /b : /string>. Not a type by itself.',
    },
];

/**
 * All built-in functions (both regular and reducer).
 */
export const ALL_BUILTIN_FUNCTIONS: BuiltinFunction[] = [
    ...BUILTIN_FUNCTIONS,
    ...REDUCER_FUNCTIONS,
    ...TYPE_CONSTRUCTOR_FUNCTIONS,
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
 * Check if a function name is a type constructor (uppercase, used in bound
 * declarations). fn:opt is included because it is only valid inside type
 * expressions.
 */
export function isTypeConstructor(name: string): boolean {
    return TYPE_CONSTRUCTOR_FUNCTIONS.some(f => f.name === name);
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

/**
 * Renders a human-readable signature such as
 * `fn:time:add(Time: /time, Duration: /duration) -> /time`.
 */
export function formatFunctionSignature(f: BuiltinFunction): string {
    const sig = f.signature;
    if (!sig) {
        return f.arity === -1 ? `${f.name}(...)` : `${f.name}(${(f.paramNames ?? []).join(', ')})`;
    }
    const names = f.paramNames ?? [];
    const params = sig.params.map((p, i) => `${names[i] ?? `Arg${i + 1}`}: ${typeToString(p)}`);
    if (sig.rest) {
        params.push(`...${typeToString(sig.rest)}`);
    }
    return `${f.name}(${params.join(', ')}) -> ${typeToString(sig.result)}`;
}

/**
 * Returns the parameter type expected at argument position `index`, or
 * undefined if there is no signature / the position is out of range.
 */
export function getParamType(f: BuiltinFunction, index: number): TypeExpr | undefined {
    const sig = f.signature;
    if (!sig) return undefined;
    if (index < sig.params.length) return sig.params[index];
    return sig.rest;
}
