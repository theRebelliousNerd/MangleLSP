"use strict";
/**
 * Built-in predicate definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go, builtin/builtin.go).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_PREDICATE_MAP = exports.BUILTIN_PREDICATES = void 0;
exports.isBuiltinPredicate = isBuiltinPredicate;
exports.getBuiltinPredicate = getBuiltinPredicate;
exports.getBuiltinPredicateNames = getBuiltinPredicateNames;
/**
 * All built-in predicates.
 */
exports.BUILTIN_PREDICATES = [
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
];
/**
 * Map from predicate name to definition for fast lookup.
 */
exports.BUILTIN_PREDICATE_MAP = new Map(exports.BUILTIN_PREDICATES.map(p => [p.name, p]));
/**
 * Check if a predicate name is a built-in predicate.
 */
function isBuiltinPredicate(name) {
    return exports.BUILTIN_PREDICATE_MAP.has(name);
}
/**
 * Get the built-in predicate definition by name.
 */
function getBuiltinPredicate(name) {
    return exports.BUILTIN_PREDICATE_MAP.get(name);
}
/**
 * Get all built-in predicate names for completion.
 */
function getBuiltinPredicateNames() {
    return exports.BUILTIN_PREDICATES.map(p => p.name);
}
//# sourceMappingURL=predicates.js.map