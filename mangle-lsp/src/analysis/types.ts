/**
 * Type expressions for Mangle.
 *
 * Ported from upstream Go implementation (symbols/typeexprs.go and the type
 * handling parts of symbols/symbols.go: WellformedType, CheckFunTypeExpression,
 * CheckTaggedUnionTypeExpression, ExpandTaggedUnionType, StructTypeField).
 *
 * The LSP uses these for:
 * - well-formedness of `bound [...]` declarations (E061),
 * - builtin function/predicate signatures shown in hover and completion,
 * - the conservative bounds checker (analysis/boundscheck.ts).
 *
 * Upstream reference: codeberg.org/TauCeti/mangle-go @ 77780a5 (2026-09-19).
 */

import { BaseTerm, Constant, ApplyFn, Variable, SourceRange } from '../parser/ast';

// ============================================================================
// Type expression representation
// ============================================================================

/** Base types of Mangle (upstream ast.go *Bound constants). */
export type BaseTypeName = 'number' | 'float64' | 'string' | 'bytes' | 'name' | 'time' | 'duration';

/** A field of a struct type. */
export interface StructFieldType {
    readonly name: string;
    readonly type: TypeExpr;
    readonly optional: boolean;
}

/**
 * A type expression.
 *
 * - `namePrefix` is a name constant used as a type: `/person` is the type of
 *   all names strictly below `/person/` (upstream hasBaseType default case).
 * - `singleton` is `fn:Singleton(c)`; name constants in programs are typed as
 *   singletons so that tagged-union tags and name-prefix bounds can be checked.
 * - `struct.exact` marks the type of a struct *literal*: its field set is known
 *   exactly, which lets the checker detect missing required fields.
 * - Tuples are expanded to nested pairs and tagged unions to unions of structs,
 *   exactly as upstream does before checking conformance.
 */
export type TypeExpr =
    | { readonly kind: 'any' }
    | { readonly kind: 'bot' }
    | { readonly kind: 'base'; readonly name: BaseTypeName }
    | { readonly kind: 'namePrefix'; readonly prefix: string }
    | { readonly kind: 'singleton'; readonly constantType: string; readonly value: string }
    | { readonly kind: 'var'; readonly name: string }
    | { readonly kind: 'list'; readonly elem: TypeExpr }
    | { readonly kind: 'option'; readonly elem: TypeExpr }
    | { readonly kind: 'pair'; readonly fst: TypeExpr; readonly snd: TypeExpr }
    | { readonly kind: 'map'; readonly key: TypeExpr; readonly value: TypeExpr }
    | { readonly kind: 'struct'; readonly fields: readonly StructFieldType[]; readonly exact: boolean }
    | { readonly kind: 'union'; readonly alts: readonly TypeExpr[] }
    | { readonly kind: 'fun'; readonly result: TypeExpr; readonly params: readonly TypeExpr[] }
    | { readonly kind: 'rel'; readonly args: readonly TypeExpr[] };

const ANY: TypeExpr = { kind: 'any' };
const BOT: TypeExpr = { kind: 'bot' };

function base(name: BaseTypeName): TypeExpr {
    return { kind: 'base', name };
}

function nameSingleton(value: string): TypeExpr {
    return { kind: 'singleton', constantType: 'name', value };
}

/** Constructors for type expressions. */
export const T = {
    any: ANY,
    bot: BOT,
    number: base('number'),
    float64: base('float64'),
    string: base('string'),
    bytes: base('bytes'),
    name: base('name'),
    time: base('time'),
    duration: base('duration'),
    /** `/number` or `/float64` - what float arithmetic accepts at runtime. */
    numeric: { kind: 'union', alts: [base('number'), base('float64')] } as TypeExpr,
    /** Upstream symbols.BoolType(): fn:Union(fn:Singleton(/true), fn:Singleton(/false)). */
    bool: { kind: 'union', alts: [nameSingleton('/true'), nameSingleton('/false')] } as TypeExpr,
    /** A time interval, represented as a pair of time instants. */
    interval: { kind: 'pair', fst: base('time'), snd: base('time') } as TypeExpr,
    v(name: string): TypeExpr {
        return { kind: 'var', name };
    },
    singleton(value: string): TypeExpr {
        return nameSingleton(value);
    },
    namePrefix(prefix: string): TypeExpr {
        return { kind: 'namePrefix', prefix };
    },
    list(elem: TypeExpr): TypeExpr {
        return { kind: 'list', elem };
    },
    option(elem: TypeExpr): TypeExpr {
        return { kind: 'option', elem };
    },
    pair(fst: TypeExpr, snd: TypeExpr): TypeExpr {
        return { kind: 'pair', fst, snd };
    },
    map(key: TypeExpr, value: TypeExpr): TypeExpr {
        return { kind: 'map', key, value };
    },
    struct(fields: StructFieldType[], exact = false): TypeExpr {
        return { kind: 'struct', fields, exact };
    },
    union(...alts: TypeExpr[]): TypeExpr {
        return { kind: 'union', alts };
    },
    fun(result: TypeExpr, ...params: TypeExpr[]): TypeExpr {
        return { kind: 'fun', result, params };
    },
    rel(...args: TypeExpr[]): TypeExpr {
        return { kind: 'rel', args };
    },
    /** fn:Tuple(T1, ..., Tn) expands to nested pairs (upstream expandTupleType). */
    tuple(...elems: TypeExpr[]): TypeExpr {
        if (elems.length === 0) return ANY;
        if (elems.length === 1) return elems[0]!;
        let res: TypeExpr = { kind: 'pair', fst: elems[elems.length - 2]!, snd: elems[elems.length - 1]! };
        for (let j = elems.length - 3; j >= 0; j--) {
            res = { kind: 'pair', fst: elems[j]!, snd: res };
        }
        return res;
    },
};

/** Map from base-type name constants to base types (upstream ast.go). */
const BASE_TYPE_CONSTANTS: ReadonlyMap<string, TypeExpr> = new Map<string, TypeExpr>([
    ['/any', ANY],
    ['/bot', BOT],
    ['/number', T.number],
    ['/float64', T.float64],
    ['/string', T.string],
    ['/bytes', T.bytes],
    ['/name', T.name],
    ['/time', T.time],
    ['/duration', T.duration],
]);

/**
 * Structured type constructors (upstream symbols.TypeConstructors) with their
 * fixed arity (-1 for variable arity).
 */
export const TYPE_CONSTRUCTOR_ARITY: ReadonlyMap<string, number> = new Map([
    ['fn:Union', -1],
    ['fn:Singleton', 1],
    ['fn:List', 1],
    ['fn:Option', 1],
    ['fn:Pair', 2],
    ['fn:Tuple', -1],
    ['fn:Map', 2],
    ['fn:Struct', -1],
    ['fn:TaggedUnion', -1],
    ['fn:Fun', -1],
    ['fn:Rel', -1],
]);

/** Returns true if `name` is a base type constant such as `/number`. */
export function isBaseTypeConstant(name: string): boolean {
    return BASE_TYPE_CONSTANTS.has(name);
}

// ============================================================================
// Conversion from AST
// ============================================================================

function isNameConstant(term: BaseTerm | undefined): term is Constant {
    return !!term && term.type === 'Constant' && term.constantType === 'name' && term.symbol !== undefined;
}

function isOptField(term: BaseTerm): term is ApplyFn {
    return term.type === 'ApplyFn' && term.function.symbol === 'fn:opt';
}

/** Parses the argument list of a fn:Struct type expression into fields. */
function structFieldsFromArgs(args: readonly BaseTerm[]): StructFieldType[] {
    const fields: StructFieldType[] = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]!;
        if (isOptField(arg)) {
            const key = arg.args[0];
            const tpe = arg.args[1];
            if (isNameConstant(key)) {
                fields.push({ name: key.symbol!, type: tpe ? typeFromBoundTerm(tpe) : ANY, optional: true });
            }
            continue;
        }
        const tpe = args[i + 1];
        if (isNameConstant(arg)) {
            fields.push({ name: arg.symbol!, type: tpe ? typeFromBoundTerm(tpe) : ANY, optional: false });
        }
        i++;
    }
    return fields;
}

/**
 * Expands fn:TaggedUnion(tag_field, tag1, struct1, ...) into a union of
 * structs where the tag field has singleton type (upstream ExpandTaggedUnionType).
 */
function expandTaggedUnion(args: readonly BaseTerm[]): TypeExpr {
    const tagField = args[0];
    if (!isNameConstant(tagField)) return ANY;
    const alts: TypeExpr[] = [];
    for (let i = 1; i + 1 < args.length; i += 2) {
        const tag = args[i];
        const variant = args[i + 1];
        if (!isNameConstant(tag) || !variant || variant.type !== 'ApplyFn') continue;
        const fields: StructFieldType[] = [
            { name: tagField.symbol!, type: nameSingleton(tag.symbol!), optional: false },
            ...structFieldsFromArgs(variant.args),
        ];
        alts.push({ kind: 'struct', fields, exact: false });
    }
    return { kind: 'union', alts };
}

/**
 * Converts a bound/type expression from the AST (e.g. `/number`,
 * `.List</string>`, `fn:Pair(/a, /b)`) into a TypeExpr. Unknown or malformed
 * expressions become `/any` so that checking stays conservative; use
 * {@link checkWellformedBound} to report malformed expressions.
 */
export function typeFromBoundTerm(term: BaseTerm): TypeExpr {
    switch (term.type) {
        case 'Variable':
            return term.symbol === '_' ? ANY : { kind: 'var', name: term.symbol };
        case 'Constant': {
            if (term.constantType !== 'name' || term.symbol === undefined) return ANY;
            return BASE_TYPE_CONSTANTS.get(term.symbol) ?? { kind: 'namePrefix', prefix: term.symbol };
        }
        case 'ApplyFn': {
            const args = term.args;
            const arg = (i: number): TypeExpr => (args[i] ? typeFromBoundTerm(args[i]!) : ANY);
            switch (term.function.symbol) {
                case 'fn:List': return T.list(arg(0));
                case 'fn:Option': return T.option(arg(0));
                case 'fn:Pair': return T.pair(arg(0), arg(1));
                case 'fn:Map': return T.map(arg(0), arg(1));
                case 'fn:Tuple': return T.tuple(...args.map(typeFromBoundTerm));
                case 'fn:Union': return { kind: 'union', alts: args.map(typeFromBoundTerm) };
                case 'fn:Singleton': {
                    const c = args[0];
                    if (c && c.type === 'Constant') {
                        return { kind: 'singleton', constantType: c.constantType, value: constantKey(c) };
                    }
                    return ANY;
                }
                case 'fn:Struct': return { kind: 'struct', fields: structFieldsFromArgs(args), exact: false };
                case 'fn:TaggedUnion': return expandTaggedUnion(args);
                case 'fn:Fun': return { kind: 'fun', result: arg(0), params: args.slice(1).map(typeFromBoundTerm) };
                case 'fn:Rel': return { kind: 'rel', args: args.map(typeFromBoundTerm) };
                default: return ANY;
            }
        }
    }
}

/** A stable key for a scalar constant's value. */
function constantKey(c: Constant): string {
    switch (c.constantType) {
        case 'number': return String(c.numValue);
        case 'float64': return String(c.floatValue);
        default: return c.symbol ?? '';
    }
}

/**
 * The type of a constant appearing in a program (upstream boundOfArg for
 * constants). Name constants get a singleton type so that name-prefix bounds
 * and tagged-union tags can be checked precisely.
 */
export function typeOfConstant(c: Constant): TypeExpr {
    switch (c.constantType) {
        case 'number': return T.number;
        case 'float64': return T.float64;
        case 'string': return T.string;
        case 'bytes': return T.bytes;
        case 'time': return T.time;
        case 'duration': return T.duration;
        case 'name': return c.symbol !== undefined ? nameSingleton(c.symbol) : T.name;
        default: return ANY;
    }
}

// ============================================================================
// Printing
// ============================================================================

/** Renders a type expression in Mangle's dot-type notation, e.g. `.List</string>`. */
export function typeToString(t: TypeExpr): string {
    switch (t.kind) {
        case 'any': return '/any';
        case 'bot': return '/bot';
        case 'base': return `/${t.name}`;
        case 'namePrefix': return t.prefix;
        case 'singleton': return t.constantType === 'string' ? JSON.stringify(t.value) : t.value;
        case 'var': return t.name;
        case 'list': return `.List<${typeToString(t.elem)}>`;
        case 'option': return `.Option<${typeToString(t.elem)}>`;
        case 'pair': return `.Pair<${typeToString(t.fst)}, ${typeToString(t.snd)}>`;
        case 'map': return `.Map<${typeToString(t.key)}, ${typeToString(t.value)}>`;
        case 'struct': {
            const fields = t.fields.map(f => `${f.optional ? 'opt ' : ''}${f.name} : ${typeToString(f.type)}`);
            return `.Struct<${fields.join(', ')}>`;
        }
        case 'union': {
            if (t.alts.length === 0) return '.Union<>';
            return t.alts.map(typeToString).join(' | ');
        }
        case 'fun': return `(${t.params.map(typeToString).join(', ')}) -> ${typeToString(t.result)}`;
        case 'rel': return `(${t.args.map(typeToString).join(', ')})`;
    }
}

// ============================================================================
// Disjointness (the basis of conservative type checking)
// ============================================================================

/** Coarse runtime shape of the values of a type. */
function valueClass(t: TypeExpr): string | null {
    switch (t.kind) {
        case 'base': return t.name;
        case 'namePrefix': return 'name';
        case 'singleton': return t.constantType;
        case 'list':
        case 'pair':
        case 'map':
        case 'struct':
        case 'fun':
        case 'rel':
            return t.kind;
        default:
            return null;
    }
}

/** True if name `n` lies strictly below name prefix `p` (upstream hasBaseType). */
export function isNameBelow(n: string, p: string): boolean {
    return n.startsWith(p + '/');
}

function nameTypesDisjoint(a: TypeExpr, b: TypeExpr): boolean {
    if (a.kind === 'base' || b.kind === 'base') return false; // /name contains everything
    if (a.kind === 'namePrefix' && b.kind === 'namePrefix') {
        return !(a.prefix === b.prefix || isNameBelow(a.prefix, b.prefix) || isNameBelow(b.prefix, a.prefix));
    }
    if (a.kind === 'namePrefix' && b.kind === 'singleton') return !isNameBelow(b.value, a.prefix);
    if (a.kind === 'singleton' && b.kind === 'namePrefix') return !isNameBelow(a.value, b.prefix);
    if (a.kind === 'singleton' && b.kind === 'singleton') return a.value !== b.value;
    return false;
}

function structsDisjoint(
    a: Extract<TypeExpr, { kind: 'struct' }>,
    b: Extract<TypeExpr, { kind: 'struct' }>
): boolean {
    const bFields = new Map(b.fields.map(f => [f.name, f]));
    const aFields = new Map(a.fields.map(f => [f.name, f]));
    for (const [name, fa] of aFields) {
        const fb = bFields.get(name);
        if (fb && isDisjoint(fa.type, fb.type)) return true;
    }
    // A struct literal has exactly its fields: required fields of the other side must be present.
    if (a.exact) {
        for (const fb of b.fields) {
            if (!fb.optional && !aFields.has(fb.name)) return true;
        }
    }
    if (b.exact) {
        for (const fa of a.fields) {
            if (!fa.optional && !bFields.has(fa.name)) return true;
        }
    }
    return false;
}

/**
 * Returns true only if no value can belong to both `a` and `b`.
 *
 * This is deliberately conservative: unknown information (`/any`, type
 * variables, `/bot` produced by failed inference, option types that have no
 * runtime representation, empty unions) never makes types disjoint, and
 * lists/maps are never disjoint from each other because the empty list/map
 * inhabits every list/map type.
 */
export function isDisjoint(a: TypeExpr, b: TypeExpr): boolean {
    if (a.kind === 'any' || b.kind === 'any' || a.kind === 'var' || b.kind === 'var') return false;
    if (a.kind === 'bot' || b.kind === 'bot') return false;
    if (a.kind === 'option' || b.kind === 'option') return false;
    if (a.kind === 'union') return a.alts.length > 0 && a.alts.every(x => isDisjoint(x, b));
    if (b.kind === 'union') return b.alts.length > 0 && b.alts.every(x => isDisjoint(a, x));
    const ca = valueClass(a);
    const cb = valueClass(b);
    if (ca === null || cb === null) return false;
    if (ca !== cb) return true;
    switch (ca) {
        case 'name':
            return nameTypesDisjoint(a, b);
        case 'pair':
            if (a.kind === 'pair' && b.kind === 'pair') {
                return isDisjoint(a.fst, b.fst) || isDisjoint(a.snd, b.snd);
            }
            return false;
        case 'struct':
            if (a.kind === 'struct' && b.kind === 'struct') return structsDisjoint(a, b);
            return false;
        default:
            // Singletons of the same scalar class with different values are disjoint.
            if (a.kind === 'singleton' && b.kind === 'singleton') return a.value !== b.value;
            return false;
    }
}

/** Returns true if `t` carries no information (unknown). */
export function isUnknownType(t: TypeExpr): boolean {
    return t.kind === 'any' || t.kind === 'var' || t.kind === 'bot' ||
        (t.kind === 'union' && t.alts.length === 0);
}

/**
 * Intersects two types for refinement of a variable's type. Returns the more
 * precise of the two when one is unknown; otherwise keeps `a` (the checker only
 * needs an approximation, disjointness is reported separately).
 */
export function refineType(a: TypeExpr, b: TypeExpr): TypeExpr {
    if (isUnknownType(a)) return b;
    if (isUnknownType(b)) return a;
    // Prefer singletons / prefixes over base names.
    if (a.kind === 'base' && a.name === 'name' && valueClass(b) === 'name') return b;
    if (a.kind === 'union' && b.kind !== 'union') {
        const kept = a.alts.filter(x => !isDisjoint(x, b));
        if (kept.length === 1) return refineType(kept[0]!, b);
        return kept.length > 0 ? { kind: 'union', alts: kept } : a;
    }
    return a;
}

/** Upper bound of a set of types (upstream UpperBound, simplified). */
export function upperBound(types: TypeExpr[]): TypeExpr {
    if (types.length === 0) return BOT;
    if (types.some(isUnknownType)) return ANY;
    const reduced: TypeExpr[] = [];
    for (const t of types) {
        if (!reduced.some(r => typeEquals(r, t))) reduced.push(t);
    }
    if (reduced.length === 1) return reduced[0]!;
    // Collapse name singletons/prefixes to /name to keep unions small.
    if (reduced.every(r => valueClass(r) === 'name')) return T.name;
    return { kind: 'union', alts: reduced };
}

/** Structural equality of type expressions. */
export function typeEquals(a: TypeExpr, b: TypeExpr): boolean {
    return typeToString(a) === typeToString(b) && a.kind === b.kind;
}

// ============================================================================
// Type-variable substitution (for polymorphic builtin signatures)
// ============================================================================

export type TypeSubst = Map<string, TypeExpr>;

/**
 * Binds type variables in `pattern` against `actual` (one-way matching, like
 * upstream unionfind.UnifyTypeExpr for the shapes builtins use).
 */
export function matchTypeVars(pattern: TypeExpr, actual: TypeExpr, subst: TypeSubst): void {
    if (isUnknownType(actual) && pattern.kind !== 'var') return;
    switch (pattern.kind) {
        case 'var':
            if (!subst.has(pattern.name) && !isUnknownType(actual)) subst.set(pattern.name, actual);
            return;
        case 'list':
            if (actual.kind === 'list') matchTypeVars(pattern.elem, actual.elem, subst);
            return;
        case 'option':
            if (actual.kind === 'option') matchTypeVars(pattern.elem, actual.elem, subst);
            return;
        case 'pair':
            if (actual.kind === 'pair') {
                matchTypeVars(pattern.fst, actual.fst, subst);
                matchTypeVars(pattern.snd, actual.snd, subst);
            }
            return;
        case 'map':
            if (actual.kind === 'map') {
                matchTypeVars(pattern.key, actual.key, subst);
                matchTypeVars(pattern.value, actual.value, subst);
            }
            return;
        default:
            return;
    }
}

/** Applies a substitution; unbound type variables become `/any`. */
export function applyTypeSubst(t: TypeExpr, subst: TypeSubst): TypeExpr {
    switch (t.kind) {
        case 'var': return subst.get(t.name) ?? ANY;
        case 'list': return T.list(applyTypeSubst(t.elem, subst));
        case 'option': return T.option(applyTypeSubst(t.elem, subst));
        case 'pair': return T.pair(applyTypeSubst(t.fst, subst), applyTypeSubst(t.snd, subst));
        case 'map': return T.map(applyTypeSubst(t.key, subst), applyTypeSubst(t.value, subst));
        case 'union': return { kind: 'union', alts: t.alts.map(x => applyTypeSubst(x, subst)) };
        case 'struct':
            return {
                kind: 'struct',
                exact: t.exact,
                fields: t.fields.map(f => ({ ...f, type: applyTypeSubst(f.type, subst) })),
            };
        default: return t;
    }
}

// ============================================================================
// Struct field projection (upstream StructTypeField)
// ============================================================================

/**
 * Returns the type of `field` in a struct (or union of structs, e.g. an
 * expanded tagged union), `undefined` if no alternative has the field, or
 * `/any` if the scrutinee type is not a known struct type.
 */
export function structFieldType(t: TypeExpr, field: string): TypeExpr | undefined {
    if (t.kind === 'struct') {
        const f = t.fields.find(x => x.name === field);
        return f?.type;
    }
    if (t.kind === 'union' && t.alts.length > 0 && t.alts.every(a => a.kind === 'struct')) {
        const projected = t.alts
            .map(a => structFieldType(a, field))
            .filter((x): x is TypeExpr => x !== undefined);
        if (projected.length === 0) return undefined;
        if (projected.length === 1) return projected[0];
        return upperBound(projected);
    }
    return ANY;
}

// ============================================================================
// Well-formedness (upstream symbols.WellformedBound / WellformedType)
// ============================================================================

/** A well-formedness problem with the offending sub-term. */
export interface TypeExprProblem {
    readonly message: string;
    readonly range: SourceRange;
}

function collectTypeVars(term: BaseTerm, vars: Set<string>): void {
    if (term.type === 'Variable') {
        if (term.symbol !== '_') vars.add(term.symbol);
    } else if (term.type === 'ApplyFn') {
        for (const a of term.args) collectTypeVars(a, vars);
    }
}

function termText(term: BaseTerm): string {
    switch (term.type) {
        case 'Variable': return term.symbol;
        case 'Constant':
            if (term.constantType === 'string') return JSON.stringify(term.symbol ?? '');
            if (term.constantType === 'number') return String(term.numValue);
            if (term.constantType === 'float64') return String(term.floatValue);
            return term.symbol ?? term.constantType;
        case 'ApplyFn': return `${term.function.symbol}(${term.args.map(termText).join(', ')})`;
    }
}

/**
 * Checks that a bound expression is a well-formed type expression.
 *
 * Mirrors upstream WellformedBound: type variables are allowed (they are closed
 * over), name constants are base types or name-prefix types, and structured
 * type expressions must use a known constructor with a valid shape.
 */
export function checkWellformedBound(expr: BaseTerm): TypeExprProblem[] {
    const ctx = new Set<string>();
    collectTypeVars(expr, ctx);
    const problems: TypeExprProblem[] = [];
    checkWellformedType(ctx, expr, problems);
    return problems;
}

function checkWellformedType(ctx: Set<string>, expr: BaseTerm, problems: TypeExprProblem[]): void {
    const report = (message: string, at: BaseTerm = expr): void => {
        problems.push({ message, range: at.range });
    };
    switch (expr.type) {
        case 'Constant':
            if (expr.constantType !== 'name') {
                report(`not a base type expression: ${termText(expr)}`);
            }
            return;
        case 'Variable':
            if (!ctx.has(expr.symbol)) {
                report(`unexpected type variable: ${expr.symbol}`);
            }
            return;
        case 'ApplyFn': {
            const fnName = expr.function.symbol;
            const arity = TYPE_CONSTRUCTOR_ARITY.get(fnName);
            if (arity === undefined) {
                report(fnName === 'fn:opt'
                    ? `'fn:opt' may only appear inside a struct type expression`
                    : `'${fnName}' is not a valid type constructor (not a structured type expression)`);
                return;
            }
            const args = expr.args;
            if (fnName === 'fn:Fun') {
                checkFunTypeExpression(expr, problems);
                return;
            }
            if (arity !== -1 && args.length !== arity) {
                report(`expected ${arity} argument${arity === 1 ? '' : 's'} in type expression ${termText(expr)}, got ${args.length}`);
                return;
            }
            if (fnName === 'fn:Union' && args.length === 0) {
                report(`union type must not be empty: ${termText(expr)}`);
                return;
            }
            if (fnName === 'fn:Tuple' && args.length <= 2) {
                report(`tuple type must have more than 2 arguments (use fn:Pair for 2): ${termText(expr)}`);
                return;
            }
            if (fnName === 'fn:Singleton') {
                // Upstream checks the member like any other type argument: it must be a name.
                checkWellformedType(ctx, args[0]!, problems);
                return;
            }
            if (fnName === 'fn:Struct') {
                checkStructTypeExpression(ctx, expr, problems);
                return;
            }
            if (fnName === 'fn:TaggedUnion') {
                checkTaggedUnionTypeExpression(ctx, expr, problems);
                return;
            }
            for (const arg of args) {
                checkWellformedType(ctx, arg, problems);
            }
            return;
        }
    }
}

function checkStructTypeExpression(ctx: Set<string>, expr: ApplyFn, problems: TypeExprProblem[]): void {
    const required = expr.args.filter(a => !isOptField(a));
    if (required.length % 2 !== 0) {
        problems.push({
            message: `struct type must have an even number of required arguments (field, type pairs): ${termText(expr)}`,
            range: expr.range,
        });
        return;
    }
    for (let i = 0; i < required.length; i += 2) {
        const key = required[i]!;
        if (!isNameConstant(key)) {
            problems.push({
                message: `in a struct type expression, field names must be name constants, got ${termText(key)}`,
                range: key.range,
            });
            continue;
        }
        checkWellformedType(ctx, required[i + 1]!, problems);
    }
    for (const opt of expr.args.filter(isOptField)) {
        if (opt.args.length !== 2 || !isNameConstant(opt.args[0])) {
            problems.push({
                message: `optional struct field must be 'opt /field : Type', got ${termText(opt)}`,
                range: opt.range,
            });
            continue;
        }
        checkWellformedType(ctx, opt.args[1]!, problems);
    }
}

/** Upstream CheckFunTypeExpression. */
function checkFunTypeExpression(expr: ApplyFn, problems: TypeExprProblem[]): void {
    if (expr.args.length === 0) {
        problems.push({ message: `expected at least 1 argument in function type expression ${termText(expr)}`, range: expr.range });
        return;
    }
    const codomain = expr.args[0]!;
    const domain = expr.args.slice(1);
    const domainVars = new Set<string>();
    for (const d of domain) collectTypeVars(d, domainVars);
    const codomainVars = new Set<string>();
    collectTypeVars(codomain, codomainVars);
    for (const v of codomainVars) {
        if (!domainVars.has(v)) {
            problems.push({ message: `type variable ${v} of the result is not in the argument types`, range: codomain.range });
            return;
        }
    }
    for (const d of domain) checkWellformedType(domainVars, d, problems);
    checkWellformedType(domainVars, codomain, problems);
}

/** Upstream CheckTaggedUnionTypeExpression. */
function checkTaggedUnionTypeExpression(ctx: Set<string>, expr: ApplyFn, problems: TypeExprProblem[]): void {
    const args = expr.args;
    if (args.length < 3 || args.length % 2 !== 1) {
        problems.push({
            message: `tagged union type must have an odd number of arguments >= 3 (tag_field, tag1, type1, ...), got ${args.length}`,
            range: expr.range,
        });
        return;
    }
    const tagField = args[0]!;
    if (!isNameConstant(tagField)) {
        problems.push({ message: `tagged union tag field must be a name constant, got ${termText(tagField)}`, range: tagField.range });
        return;
    }
    const seenTags = new Set<string>();
    for (let i = 1; i < args.length; i += 2) {
        const tag = args[i]!;
        const variant = args[i + 1]!;
        if (!isNameConstant(tag)) {
            problems.push({ message: `tagged union variant tag must be a name constant, got ${termText(tag)}`, range: tag.range });
            continue;
        }
        if (seenTags.has(tag.symbol!)) {
            problems.push({ message: `duplicate variant tag ${tag.symbol} in tagged union`, range: tag.range });
            continue;
        }
        seenTags.add(tag.symbol!);
        if (variant.type !== 'ApplyFn' || variant.function.symbol !== 'fn:Struct') {
            problems.push({
                message: `tagged union variant type must be a struct type, got ${termText(variant)}`,
                range: variant.range,
            });
            continue;
        }
        const before = problems.length;
        checkStructTypeExpression(ctx, variant, problems);
        if (problems.length > before) continue;
        for (const f of structFieldsFromArgs(variant.args)) {
            if (f.name === tagField.symbol) {
                problems.push({
                    message: `variant ${tag.symbol} must not contain tag field ${tagField.symbol}`,
                    range: variant.range,
                });
            }
        }
    }
}

/** Returns true if the term is a Variable (helper for callers). */
export function isTypeVariable(term: BaseTerm): term is Variable {
    return term.type === 'Variable';
}
