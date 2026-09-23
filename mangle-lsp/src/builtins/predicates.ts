/**
 * Built-in predicate definitions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/symbols.go for names and
 * relation types (BuiltinRelations), builtin/builtin.go for modes).
 *
 * Upstream reference: codeberg.org/TauCeti/mangle-go @ 77780a5 (2026-09-19).
 */

import { TypeExpr, T, typeToString } from '../analysis/types';

/**
 * Argument mode for built-in predicates.
 *
 * - `input`: must be a constant or an already-bound variable ("+").
 * - `output`: must be a fresh (not yet bound) variable; the predicate binds it ("-").
 * - `input_output`: may be either; if unbound the predicate binds it ("?").
 */
export type ArgMode = 'input' | 'output' | 'input_output';

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
    /** Argument names used for snippets and signatures */
    paramNames?: readonly string[];
    /** Argument types (upstream symbols.BuiltinRelations); absent if untyped */
    argTypes?: readonly TypeExpr[];
    /** A short usage example */
    example?: string;
    /** Related builtins worth knowing about */
    seeAlso?: readonly string[];
}

const X = T.v('X');
const Y = T.v('Y');
const I = 'input' as const;
const O = 'output' as const;
const IO = 'input_output' as const;

function pred(
    name: string,
    params: Array<[string, ArgMode, TypeExpr | undefined]>,
    doc: string,
    extra: { example?: string; seeAlso?: string[] } = {}
): BuiltinPredicate {
    const typed = params.every(p => p[2] !== undefined);
    return {
        name,
        arity: params.length,
        mode: params.map(p => p[1]),
        doc,
        paramNames: params.map(p => p[0]),
        argTypes: typed ? params.map(p => p[2]!) : undefined,
        example: extra.example,
        seeAlso: extra.seeAlso,
    };
}

function comparison(prefix: string, type: TypeExpr, typeName: string, seeAlso: string[]): BuiltinPredicate[] {
    const rel = [
        ['lt', '<', 'Less-than'],
        ['le', '<=', 'Less-than-or-equal'],
        ['gt', '>', 'Greater-than'],
        ['ge', '>=', 'Greater-than-or-equal'],
    ] as const;
    return rel.map(([suffix, op, label]) => pred(
        `${prefix}${suffix}`,
        [['A', I, type], ['B', I, type]],
        `${label} relation on ${typeName}. Usage: ${prefix}${suffix}(A, B) means A ${op} B. Both arguments must be bound.`,
        { example: `${prefix}${suffix}(A, B)`, seeAlso },
    ));
}

/**
 * All built-in predicates.
 */
export const BUILTIN_PREDICATES: BuiltinPredicate[] = [
    // String/Name matching predicates
    pred(':match_prefix', [['Name', I, T.name], ['Prefix', I, T.name]],
        'Matches name constants that have a given name prefix. Usage: :match_prefix(Name, /prefix). The prefix must be a name constant; for strings use :string:starts_with.',
        { example: ':match_prefix(Id, /users)', seeAlso: [':string:starts_with'] }),
    pred(':string:starts_with', [['String', I, T.string], ['Prefix', I, T.string]],
        'Matches strings that start with a given prefix. The prefix must be a string constant.',
        { example: ':string:starts_with(Path, "/tmp/")', seeAlso: [':match_prefix'] }),
    pred(':string:ends_with', [['String', I, T.string], ['Suffix', I, T.string]],
        'Matches strings that end with a given suffix. The suffix must be a string constant.',
        { example: ':string:ends_with(File, ".mg")' }),
    pred(':string:contains', [['String', I, T.string], ['Substring', I, T.string]],
        'Matches strings that contain a given substring. The substring must be a string constant.',
        { example: ':string:contains(Msg, "error")' }),

    // Filter predicate
    pred(':filter', [['BoolExpr', I, T.bool]],
        'Turns a boolean-valued function into a filter: succeeds if the expression evaluates to /true.',
        { example: ':filter(fn:list:contains(Tags, "urgent"))', seeAlso: [':list:member'] }),

    // Comparison predicates (the parser maps <, <=, >, >= on /number to these)
    ...comparison(':', T.number, '/number (int64). The operators <, <=, >, >= desugar to these', [':float:lt', ':time:lt', ':duration:lt']),

    // List predicates
    pred(':list:member', [['Element', IO, X], ['List', I, T.list(X)]],
        'List membership. If Element is unbound, binds it to every element of List; if bound, checks membership (mode ?, +).',
        { example: 'tag(T) :- item(Tags), :list:member(T, Tags).', seeAlso: ['fn:list:contains'] }),

    // Distance predicate
    pred(':within_distance', [['X', I, T.number], ['Y', I, T.number], ['Z', I, T.number]],
        'Relation on numbers X, Y, Z satisfying |X - Y| < Z.',
        { example: ':within_distance(A, B, 10)' }),

    // Pattern matching predicates
    pred(':match_pair', [['Pair', I, T.pair(X, Y)], ['First', O, X], ['Second', O, Y]],
        'Destructures a pair into its elements. First and Second must be fresh variables.',
        { example: ':match_pair(P, A, B)', seeAlso: ['fn:pair'] }),
    pred(':match_cons', [['List', I, T.list(X)], ['Head', O, X], ['Tail', O, T.list(X)]],
        'Destructures a non-empty list into head and tail. Head and Tail must be fresh variables.',
        { example: ':match_cons(L, H, Rest)', seeAlso: [':match_nil', 'fn:list:cons'] }),
    pred(':match_nil', [['List', I, T.list(X)]],
        'Matches the empty list.',
        { example: ':match_nil(L)', seeAlso: [':match_cons'] }),
    pred(':match_entry', [['Map', I, T.map(T.any, T.any)], ['Key', I, T.any], ['Value', O, T.any]],
        'Looks up Key in Map and binds Value. Fails (no error) if the key is absent.',
        { example: ':match_entry(M, /a, V)', seeAlso: ['fn:map:get'] }),
    pred(':match_field', [['Struct', I, T.any], ['Field', I, T.name], ['Value', O, T.any]],
        'Looks up a /field in a struct and binds Value. Fails (no error) if the field is absent. With a declared struct or tagged-union bound, the field must exist in the type.',
        { example: ':match_field(S, /name, N)', seeAlso: ['fn:struct:get'] }),

    // Time comparison predicates
    ...comparison(':time:', T.time, '/time instants', [':lt', ':duration:lt']),

    // Duration comparison predicates
    ...comparison(':duration:', T.duration, '/duration values', [':lt', ':time:lt']),

    // Float64 comparison predicates (upstream 8edad8d)
    ...comparison(':float:', T.float64, '/float64 values (no coercion from /number; any comparison with NaN is false)', [':lt']),

    // Allen's interval algebra predicates (upstream symbols/symbols.go, builtin/temporal.go)
    pred(':interval:before', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A ends before interval B starts. Usage: :interval:before(A, B)"),
    pred(':interval:after', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A starts after interval B ends. Usage: :interval:after(A, B)"),
    pred(':interval:meets', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A ends exactly when interval B starts. Usage: :interval:meets(A, B)"),
    pred(':interval:overlaps', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A overlaps with interval B. Usage: :interval:overlaps(A, B)"),
    pred(':interval:during', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A is contained within interval B. Usage: :interval:during(A, B)"),
    pred(':interval:contains', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A contains interval B. Usage: :interval:contains(A, B)"),
    pred(':interval:starts', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A starts at the same time as B. Usage: :interval:starts(A, B)"),
    pred(':interval:finishes', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A finishes at the same time as B. Usage: :interval:finishes(A, B)"),
    pred(':interval:equals', [['A', I, T.interval], ['B', I, T.interval]],
        "Allen's interval relation: interval A equals interval B. Usage: :interval:equals(A, B)"),
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

/** Mode symbol as written in `mode(...)` declarations: +, - or ?. */
export function modeSymbol(mode: ArgMode): string {
    return mode === 'input' ? '+' : mode === 'output' ? '-' : '?';
}

/**
 * Renders a human-readable signature such as
 * `:match_pair(+Pair: .Pair<X, Y>, -First: X, -Second: Y)`.
 */
export function formatPredicateSignature(p: BuiltinPredicate): string {
    const names = p.paramNames ?? [];
    const args = p.mode.map((m, i) => {
        const type = p.argTypes?.[i];
        const name = names[i] ?? `Arg${i + 1}`;
        return `${modeSymbol(m)}${name}${type ? `: ${typeToString(type)}` : ''}`;
    });
    return `${p.name}(${args.join(', ')})`;
}
