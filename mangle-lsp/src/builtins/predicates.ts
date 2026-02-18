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
export const BUILTIN_PREDICATES: BuiltinPredicate[] = [
    // String/Name matching predicates
    {
        name: ':match_prefix',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Matches name constants that have a given prefix. Usage: :match_prefix(Name, Prefix)',
    },
    {
        name: ':string:starts_with',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Matches string constants that have a given prefix. Usage: :string:starts_with(String, Prefix)',
    },
    {
        name: ':string:ends_with',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Matches string constants that have a given suffix. Usage: :string:ends_with(String, Suffix)',
    },
    {
        name: ':string:contains',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Matches string constants that contain the given substring. Usage: :string:contains(String, Substring)',
    },

    // Filter predicate
    {
        name: ':filter',
        arity: 1,
        mode: ['input'],
        doc: 'Turns a boolean function into a predicate. Usage: :filter(BoolExpr)',
    },

    // Comparison predicates
    {
        name: ':lt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than relation on numbers. Usage: :lt(X, Y) means X < Y',
    },
    {
        name: ':le',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than-or-equal relation on numbers. Usage: :le(X, Y) means X <= Y',
    },
    {
        name: ':gt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than relation on numbers. Usage: :gt(X, Y) means X > Y',
    },
    {
        name: ':ge',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than-or-equal relation on numbers. Usage: :ge(X, Y) means X >= Y',
    },

    // List predicates
    {
        name: ':list:member',
        arity: 2,
        mode: ['output', 'input'],
        doc: 'Checks list membership or binds variable to every element. Usage: :list:member(Element, List)',
    },

    // Distance predicate
    {
        name: ':within_distance',
        arity: 3,
        mode: ['input', 'input', 'input'],
        doc: 'Relation on numbers X, Y, Z satisfying |X - Y| < Z. Usage: :within_distance(X, Y, Z)',
    },

    // Pattern matching predicates
    {
        name: ':match_pair',
        arity: 3,
        mode: ['input', 'output', 'output'],
        doc: 'Matches a pair to its elements. Usage: :match_pair(Pair, First, Second)',
    },
    {
        name: ':match_cons',
        arity: 3,
        mode: ['input', 'output', 'output'],
        doc: 'Matches a list to head and tail. Usage: :match_cons(List, Head, Tail)',
    },
    {
        name: ':match_nil',
        arity: 1,
        mode: ['input'],
        doc: 'Matches the empty list. Usage: :match_nil(List)',
    },
    {
        name: ':match_entry',
        arity: 3,
        mode: ['input', 'input', 'output'],
        doc: 'Matches an entry in a map. Usage: :match_entry(Map, Key, Value)',
    },
    {
        name: ':match_field',
        arity: 3,
        mode: ['input', 'input', 'output'],
        doc: 'Matches a field in a struct. Usage: :match_field(Struct, FieldName, Value)',
    },

    // Time comparison predicates
    {
        name: ':time:lt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than relation on time instants. Usage: :time:lt(T1, T2) means T1 < T2',
    },
    {
        name: ':time:le',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than-or-equal relation on time instants. Usage: :time:le(T1, T2) means T1 <= T2',
    },
    {
        name: ':time:gt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than relation on time instants. Usage: :time:gt(T1, T2) means T1 > T2',
    },
    {
        name: ':time:ge',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than-or-equal relation on time instants. Usage: :time:ge(T1, T2) means T1 >= T2',
    },

    // Duration comparison predicates
    {
        name: ':duration:lt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than relation on durations. Usage: :duration:lt(D1, D2) means D1 < D2',
    },
    {
        name: ':duration:le',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Less-than-or-equal relation on durations. Usage: :duration:le(D1, D2) means D1 <= D2',
    },
    {
        name: ':duration:gt',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than relation on durations. Usage: :duration:gt(D1, D2) means D1 > D2',
    },
    {
        name: ':duration:ge',
        arity: 2,
        mode: ['input', 'input'],
        doc: 'Greater-than-or-equal relation on durations. Usage: :duration:ge(D1, D2) means D1 >= D2',
    },
];

/**
 * Map from predicate name to definition for fast lookup.
 */
export const BUILTIN_PREDICATE_MAP = new Map<string, BuiltinPredicate>(
    BUILTIN_PREDICATES.map(p => [p.name, p])
);

/**
 * Check if a predicate name is a built-in predicate.
 */
export function isBuiltinPredicate(name: string): boolean {
    return BUILTIN_PREDICATE_MAP.has(name);
}

/**
 * Get the built-in predicate definition by name.
 */
export function getBuiltinPredicate(name: string): BuiltinPredicate | undefined {
    return BUILTIN_PREDICATE_MAP.get(name);
}

/**
 * Get all built-in predicate names for completion.
 */
export function getBuiltinPredicateNames(): string[] {
    return BUILTIN_PREDICATES.map(p => p.name);
}
