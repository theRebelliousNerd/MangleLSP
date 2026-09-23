/**
 * Conservative bounds (type) checking for Mangle.
 *
 * A simplified port of upstream analysis/boundscheck.go and
 * analysis/infercontext.go. Upstream interpreters run bounds checking with
 * ErrorForBoundsMismatch, so type errors found here are real errors in
 * upstream Mangle too.
 *
 * Differences to upstream, all in the direction of reporting *less*:
 * - Types are only inferred from constants, declared `bound [...]`s,
 *   built-in function results and built-in destructuring predicates; the types
 *   of undeclared predicates are not inferred from their facts (their facts may
 *   come from other files or the host program).
 * - A problem is reported only when two types are provably disjoint
 *   (analysis/types.ts isDisjoint); unknown types never cause diagnostics.
 * - Runtime-accurate signatures are used (float arithmetic accepts /number).
 *
 * Diagnostics: E068 (function argument), E069 (predicate argument), E070
 * (fact vs declaration), E071 (rule head vs declaration), E072 (conflicting
 * variable types), E073 (equality between disjoint types).
 */

import {
    SourceUnit,
    SourceRange,
    Clause,
    Atom,
    Term,
    BaseTerm,
    ApplyFn,
    Constant,
    Decl,
    TemporalLiteral,
    TemporalAtom,
    TemporalInterval,
    termToString,
} from '../parser/ast';
import { getBuiltinPredicate } from '../builtins/predicates';
import { getBuiltinFunction, getParamType, formatFunctionSignature } from '../builtins/functions';
import {
    TypeExpr,
    T,
    typeFromBoundTerm,
    typeOfConstant,
    typeToString,
    isDisjoint,
    isUnknownType,
    refineType,
    upperBound,
    matchTypeVars,
    applyTypeSubst,
    structFieldType,
    TypeSubst,
} from './types';
import type { SemanticError } from './validation';

/** A variable's inferred type and where it came from (for messages). */
interface VarType {
    type: TypeExpr;
    source: string;
}

type Env = Map<string, VarType>;

/** Declared relation types: one entry per `bound [...]` alternative. */
type RelTypes = Map<string, TypeExpr[][]>;

const COMPARISON_FAMILIES: ReadonlyMap<string, string> = new Map([
    ['number', ':'],
    ['float64', ':float:'],
    ['time', ':time:'],
    ['duration', ':duration:'],
]);

/**
 * Runs the bounds checker over a unit and appends diagnostics to `errors`.
 */
export function checkBounds(unit: SourceUnit, decls: Map<string, Decl>, errors: SemanticError[]): void {
    const relTypes = collectRelTypes(decls);
    const checker = new BoundsChecker(relTypes, decls, errors);
    for (const clause of unit.clauses) {
        try {
            if (!clause.premises || clause.premises.length === 0) {
                checker.checkFact(clause);
            } else {
                checker.checkRule(clause);
            }
        } catch {
            // Type checking is best-effort; never let it break validation.
        }
    }
}

/** Builds the relation types of declared predicates (upstream RelTypeExprFromDecl). */
function collectRelTypes(decls: Map<string, Decl>): RelTypes {
    const rel: RelTypes = new Map();
    for (const [key, decl] of decls) {
        const arity = decl.declaredAtom.args.length;
        const alternatives: TypeExpr[][] = [];
        for (const bd of decl.bounds ?? []) {
            if (bd.bounds.length !== arity) continue; // E025 reported elsewhere
            alternatives.push(bd.bounds.map(typeFromBoundTerm));
        }
        if (alternatives.length > 0) rel.set(key, alternatives);
    }
    return rel;
}

function predKey(atom: Atom): string {
    return `${atom.predicate.symbol}/${atom.predicate.arity}`;
}

function ordinal(i: number): string {
    return `argument ${i + 1}`;
}

/** Union of the types of alternatives at position i. */
function alternativesAt(alts: TypeExpr[][], i: number): TypeExpr {
    const types = alts.map(a => a[i] ?? T.any);
    if (types.length === 1) return types[0]!;
    if (types.some(isUnknownType)) return T.any;
    return { kind: 'union', alts: types };
}

/**
 * Suggests a conversion or the right builtin variant for a mismatch.
 */
export function conversionHint(actual: TypeExpr, expected: TypeExpr, context?: string): string | undefined {
    const a = actual.kind === 'singleton' ? actual.constantType : actual.kind === 'base' ? actual.name : actual.kind === 'namePrefix' ? 'name' : actual.kind;
    const expectedStr = typeToString(expected);
    const want = (t: string): boolean => expectedStr === `/${t}` || expectedStr.split(' | ').includes(`/${t}`);
    if (want('duration') && a === 'number') return 'convert with fn:duration:from_seconds(N), fn:duration:from_minutes(N), fn:duration:from_hours(N) or fn:duration:from_nanos(N)';
    if (want('duration') && a === 'string') return 'parse it with fn:duration:parse("1h30m")';
    if (want('time') && a === 'string') return 'parse it with fn:time:parse_rfc3339(S) or fn:time:parse_civil(S, TimeZone)';
    if (want('time') && a === 'number') return 'convert Unix nanoseconds with fn:time:from_unix_nanos(N)';
    if (want('string') && a === 'number') return 'convert with fn:number:to_string(N), or use fn:string:concat, which converts its arguments';
    if (want('string') && a === 'float64') return 'convert with fn:float64:to_string(F)';
    if (want('string') && a === 'name') return 'convert with fn:name:to_string(N); note that /foo is a name constant, "foo" is a string';
    if (want('name') && a === 'string') return 'name constants are written /like_this, not as strings; a string cannot be converted to a name';
    if (want('number') && a === 'float64') {
        return context?.startsWith('fn:')
            ? 'use the float variants fn:float:plus, fn:float:mult, fn:float:div for /float64 arithmetic'
            : 'integer comparisons (<, <=, >, >=) only accept /number; use :float:lt, :float:le, :float:gt, :float:ge for /float64';
    }
    if (want('float64') && a === 'number') {
        return context?.startsWith(':float:')
            ? `:float:* comparisons do not coerce /number; write the constant with a decimal point (e.g. 30.0) or use ${context.replace(':float:', ':')} for integers`
            : 'this function only accepts /float64 values here; write the constant with a decimal point (e.g. 2.0)';
    }
    if ((want('number') || want('float64')) && (a === 'time' || a === 'duration')) {
        return `for /${a} values use the ${a === 'time' ? ':time:lt / fn:time:*' : ':duration:lt / fn:duration:*'} built-ins`;
    }
    if (actual.kind !== 'list' && expected.kind === 'list') return 'this position expects a list; wrap a single value as [X]';
    return undefined;
}

class BoundsChecker {
    constructor(
        private readonly relTypes: RelTypes,
        private readonly decls: Map<string, Decl>,
        private readonly errors: SemanticError[],
    ) {}

    private report(e: SemanticError): void {
        this.errors.push(e);
    }

    // ------------------------------------------------------------------ facts

    checkFact(clause: Clause): void {
        const env: Env = new Map();
        const argTypes = clause.head.args.map(arg => this.typeOf(arg, env));
        const alts = this.relTypes.get(predKey(clause.head));
        if (!alts) return;
        const mismatch = this.firstMismatchPerAlternative(argTypes, alts);
        if (mismatch === null) return;
        const { index, expected, actual } = mismatch;
        const arg = clause.head.args[index]!;
        this.report({
            code: 'E070',
            message: `Fact ${termToString(clause.head)} does not match the declared bounds of ${predKey(clause.head)}: ${ordinal(index)} ${termToString(arg)} is not a ${typeToString(expected)}`,
            range: arg.range,
            severity: 'error',
            hint: this.boundMismatchHint(arg, actual, expected, alts.length),
        });
    }

    /**
     * Returns null if some alternative is compatible with `types`, otherwise
     * the first mismatch of the first alternative.
     */
    private firstMismatchPerAlternative(
        types: TypeExpr[],
        alts: TypeExpr[][]
    ): { index: number; expected: TypeExpr; actual: TypeExpr } | null {
        let first: { index: number; expected: TypeExpr; actual: TypeExpr } | null = null;
        for (const alt of alts) {
            const idx = types.findIndex((t, i) => alt[i] !== undefined && isDisjoint(t, alt[i]!));
            if (idx === -1) return null;
            if (!first) first = { index: idx, expected: alt[idx]!, actual: types[idx]! };
        }
        return first;
    }

    private boundMismatchHint(arg: BaseTerm, actual: TypeExpr, expected: TypeExpr, altCount: number): string {
        const suffix = altCount > 1 ? ` (none of the ${altCount} bound alternatives match)` : '';
        if (expected.kind === 'namePrefix' && actual.kind === 'singleton' && actual.constantType === 'name') {
            return `values of type ${expected.prefix} are names below it, e.g. ${expected.prefix}${actual.value}${suffix}`;
        }
        if (arg.type === 'ApplyFn' && arg.function.symbol === 'fn:struct') {
            const detail = describeStructMismatch(actual, expected);
            if (detail) return detail + suffix;
        }
        return (conversionHint(actual, expected) ?? `expected ${typeToString(expected)}, got ${typeToString(actual)}`) + suffix;
    }

    // ------------------------------------------------------------------ rules

    checkRule(clause: Clause): void {
        const env: Env = new Map();
        const headAlts = this.relTypes.get(predKey(clause.head));

        // Upstream inferRelTypesFromClause: input-mode head variables start
        // with the declared bound type.
        const decl = this.decls.get(predKey(clause.head));
        if (decl && headAlts) {
            const modeAtoms = (decl.descr ?? []).filter(d => d.predicate.symbol === 'mode');
            if (modeAtoms.length === 1) {
                modeAtoms[0]!.args.forEach((m, i) => {
                    const arg = clause.head.args[i];
                    if (m.type === 'Constant' && m.symbol === '+' && arg && arg.type === 'Variable' && arg.symbol !== '_') {
                        env.set(arg.symbol, { type: alternativesAt(headAlts, i), source: `the declaration of ${predKey(clause.head)}` });
                    }
                });
            }
        }

        for (const premise of clause.premises ?? []) {
            this.checkPremise(premise, env);
        }
        if (clause.headTime) {
            this.bindInterval(clause.headTime, env);
        }

        // Transform: let-bound variables get the result types of their functions.
        let transform = clause.transform;
        while (transform) {
            for (const stmt of transform.statements) {
                const t = this.typeOfApply(stmt.fn, env, true);
                if (stmt.variable && stmt.variable.symbol !== '_') {
                    env.set(stmt.variable.symbol, { type: t, source: `let ${stmt.variable.symbol} = ${stmt.fn.function.symbol}(...)` });
                }
            }
            transform = transform.next;
        }

        // E071: the head must be able to satisfy the declaration.
        if (headAlts) {
            const headTypes = clause.head.args.map(arg => this.typeOf(arg, env));
            const mismatch = this.firstMismatchPerAlternative(headTypes, headAlts);
            if (mismatch !== null) {
                const arg = clause.head.args[mismatch.index]!;
                const src = arg.type === 'Variable' ? env.get(arg.symbol)?.source : undefined;
                this.report({
                    code: 'E071',
                    message: `Rule for ${predKey(clause.head)} derives ${ordinal(mismatch.index)} of type ${typeToString(mismatch.actual)}${src ? ` (from ${src})` : ''}, but the declaration requires ${typeToString(mismatch.expected)}`,
                    range: arg.range,
                    severity: 'error',
                    hint: conversionHint(mismatch.actual, mismatch.expected) ?? 'check that the head uses the right body variable, or fix the declaration',
                });
            }
        }
    }

    private bindInterval(interval: TemporalInterval | null, env: Env): void {
        if (!interval) return;
        for (const b of [interval.start, interval.end]) {
            if (b.boundType === 'variable' && b.variable && b.variable.symbol !== '_') {
                this.bindVar(b.variable.symbol, T.time, 'a temporal interval', env, b.range);
            }
        }
    }

    /** Assigns/refines a variable's type, reporting E072 on conflicts. */
    private bindVar(v: string, type: TypeExpr, source: string, env: Env, range: SourceRange): void {
        if (v === '_' || isUnknownType(type)) return;
        const existing = env.get(v);
        if (!existing) {
            env.set(v, { type, source });
            return;
        }
        if (isDisjoint(existing.type, type)) {
            this.report({
                code: 'E072',
                message: `Variable '${v}' cannot be both ${typeToString(existing.type)} (from ${existing.source}) and ${typeToString(type)} (from ${source}); this rule can never produce a result`,
                range,
                severity: 'error',
                hint: 'check that the join uses the right columns; use different variables if the values are unrelated',
            });
            return;
        }
        env.set(v, { type: refineType(existing.type, type), source: existing.source });
    }

    private checkPremise(premise: Term, env: Env): void {
        switch (premise.type) {
            case 'Atom':
                this.checkAtom(premise as Atom, env, true);
                return;
            case 'NegAtom':
                this.checkAtom((premise as { atom: Atom }).atom, env, false);
                return;
            case 'Eq':
            case 'Ineq': {
                const eq = premise as { type: 'Eq' | 'Ineq'; left: BaseTerm; right: BaseTerm; range: SourceRange };
                const lt = this.typeOf(eq.left, env);
                const rt = this.typeOf(eq.right, env);
                if (eq.type === 'Eq') {
                    if (eq.left.type === 'Variable' && !env.has(eq.left.symbol)) {
                        this.bindVar(eq.left.symbol, rt, `${termToString(eq.right)}`, env, eq.left.range);
                        return;
                    }
                    if (eq.right.type === 'Variable' && !env.has(eq.right.symbol)) {
                        this.bindVar(eq.right.symbol, lt, `${termToString(eq.left)}`, env, eq.right.range);
                        return;
                    }
                }
                if (isDisjoint(lt, rt)) {
                    const isEq = eq.type === 'Eq';
                    this.report({
                        code: 'E073',
                        message: `${termToString(eq.left)} ${isEq ? '=' : '!='} ${termToString(eq.right)} compares ${typeToString(lt)} with ${typeToString(rt)}; ${isEq ? 'this is never true, so the rule can never fire' : 'this is always true and has no effect'}`,
                        range: eq.range,
                        severity: 'warning',
                        hint: equalityHint(lt, rt),
                    });
                }
                return;
            }
            case 'TemporalLiteral': {
                const tl = premise as TemporalLiteral;
                this.checkPremise(tl.literal, env);
                this.bindInterval(tl.interval, env);
                this.bindInterval(tl.operator?.interval ?? null, env);
                return;
            }
            case 'TemporalAtom': {
                const ta = premise as TemporalAtom;
                this.checkAtom(ta.atom, env, true);
                this.bindInterval(ta.interval, env);
                return;
            }
            default:
                return;
        }
    }

    private checkAtom(atom: Atom, env: Env, positive: boolean): void {
        const sym = atom.predicate.symbol;
        if (sym.startsWith(':')) {
            this.checkBuiltinAtom(atom, env, positive);
            return;
        }
        const argTypes = atom.args.map(a => this.typeOf(a, env));
        const alts = this.relTypes.get(predKey(atom));
        if (!alts) return;

        // Constant (or already-typed) arguments that no alternative admits.
        const mismatch = this.firstMismatchPerAlternative(argTypes, alts);
        if (mismatch !== null) {
            const arg = atom.args[mismatch.index]!;
            if (arg.type === 'Variable') {
                const existing = env.get(arg.symbol);
                this.report({
                    code: 'E072',
                    message: `Variable '${arg.symbol}' has type ${typeToString(mismatch.actual)}${existing ? ` (from ${existing.source})` : ''} but ${ordinal(mismatch.index)} of ${predKey(atom)} is declared ${typeToString(mismatch.expected)}; this ${positive ? 'rule can never produce a result' : 'negation is always true'}`,
                    range: arg.range,
                    severity: 'error',
                    hint: 'check that the join uses the right columns; use different variables if the values are unrelated',
                });
            } else {
                this.report({
                    code: 'E069',
                    message: `${ordinal(mismatch.index)} of ${predKey(atom)} is declared ${typeToString(mismatch.expected)}, so ${termToString(arg)} can never match`,
                    range: arg.range,
                    severity: positive ? 'error' : 'warning',
                    hint: this.boundMismatchHint(arg, mismatch.actual, mismatch.expected, alts.length),
                });
            }
            return;
        }
        if (!positive) return;
        atom.args.forEach((arg, i) => {
            if (arg.type === 'Variable') {
                this.bindVar(arg.symbol, alternativesAt(alts, i), `${ordinal(i)} of ${predKey(atom)}`, env, arg.range);
            }
        });
    }

    private checkBuiltinAtom(atom: Atom, env: Env, positive: boolean): void {
        const sym = atom.predicate.symbol;
        const builtin = getBuiltinPredicate(sym);
        if (!builtin || builtin.arity !== atom.args.length) return;
        const actual = atom.args.map(a => this.typeOf(a, env));

        // Destructuring built-ins bind their outputs from the input's type.
        if (positive) {
            if (sym === ':match_field') {
                this.checkMatchField(atom, actual, env);
                return;
            }
            if (sym === ':match_pair' && actual[0]!.kind === 'pair') {
                const p = actual[0] as Extract<TypeExpr, { kind: 'pair' }>;
                this.bindOutput(atom, 1, p.fst, env);
                this.bindOutput(atom, 2, p.snd, env);
            }
            if (sym === ':match_cons' && actual[0]!.kind === 'list') {
                const l = actual[0] as Extract<TypeExpr, { kind: 'list' }>;
                this.bindOutput(atom, 1, l.elem, env);
                this.bindOutput(atom, 2, l, env);
            }
            if (sym === ':match_entry' && actual[0]!.kind === 'map') {
                const m = actual[0] as Extract<TypeExpr, { kind: 'map' }>;
                this.bindOutput(atom, 2, m.value, env);
            }
        }

        const expected = builtin.argTypes;
        if (!expected) return;
        const subst: TypeSubst = new Map();
        expected.forEach((e, i) => matchTypeVars(e, actual[i]!, subst));
        for (let i = 0; i < expected.length; i++) {
            const exp = applyTypeSubst(expected[i]!, subst);
            const act = actual[i]!;
            if (isDisjoint(act, exp)) {
                const arg = atom.args[i]!;
                this.report({
                    code: 'E069',
                    message: `${ordinal(i)} of ${sym} has type ${typeToString(act)}, but ${typeToString(exp)} is expected`,
                    range: arg.range,
                    severity: 'error',
                    hint: builtinPredicateHint(sym, act, exp),
                });
                return;
            }
        }
        // :list:member(X, L) with L : List<E> gives X the element type.
        if (positive && sym === ':list:member' && actual[1]!.kind === 'list') {
            const elem = (actual[1] as Extract<TypeExpr, { kind: 'list' }>).elem;
            const x = atom.args[0]!;
            if (x.type === 'Variable') this.bindVar(x.symbol, elem, `the elements of ${termToString(atom.args[1]!)}`, env, x.range);
        }
    }

    private bindOutput(atom: Atom, index: number, type: TypeExpr, env: Env): void {
        const arg = atom.args[index];
        if (arg && arg.type === 'Variable') {
            this.bindVar(arg.symbol, type, `${atom.predicate.symbol}(...)`, env, arg.range);
        }
    }

    /** Upstream infercontext: :match_field on a known struct type must name an existing field. */
    private checkMatchField(atom: Atom, actual: TypeExpr[], env: Env): void {
        const scrutinee = actual[0]!;
        const field = atom.args[1];
        if (!field || field.type !== 'Constant' || field.constantType !== 'name' || field.symbol === undefined) return;
        if (isUnknownType(scrutinee)) return;
        if (scrutinee.kind !== 'struct' && !(scrutinee.kind === 'union' && scrutinee.alts.every(a => a.kind === 'struct'))) {
            if (isDisjoint(scrutinee, T.struct([]))) {
                this.report({
                    code: 'E069',
                    message: `argument 1 of :match_field has type ${typeToString(scrutinee)}, which is not a struct`,
                    range: atom.args[0]!.range,
                    severity: 'error',
                    hint: 'only structs ({/field: value}) have fields; for maps use :match_entry(Map, Key, Value)',
                });
            }
            return;
        }
        const ft = structFieldType(scrutinee, field.symbol);
        if (ft === undefined) {
            const fields = collectFieldNames(scrutinee);
            this.report({
                code: 'E069',
                message: `${termToString(atom.args[0]!)} has type ${typeToString(scrutinee)}, which has no field ${field.symbol}`,
                range: field.range,
                severity: 'error',
                hint: fields.length > 0 ? `available fields: ${fields.join(', ')}` : 'this struct type has no fields',
            });
            return;
        }
        this.bindOutput(atom, 2, ft, env);
    }

    // ---------------------------------------------------------------- terms

    /** Type of a term; function applications are checked along the way. */
    private typeOf(term: BaseTerm, env: Env, check = true): TypeExpr {
        switch (term.type) {
            case 'Variable':
                return term.symbol === '_' ? T.any : env.get(term.symbol)?.type ?? T.any;
            case 'Constant':
                return typeOfConstant(term as Constant);
            case 'ApplyFn':
                return this.typeOfApply(term as ApplyFn, env, check);
        }
    }

    private typeOfApply(app: ApplyFn, env: Env, check: boolean): TypeExpr {
        const name = app.function.symbol;
        const argTypes = app.args.map(a => this.typeOf(a, env, check));
        switch (name) {
            case 'fn:list':
                return app.args.length === 0 ? T.list(T.bot) : T.list(upperBound(argTypes));
            case 'fn:map': {
                const keys = argTypes.filter((_, i) => i % 2 === 0);
                const vals = argTypes.filter((_, i) => i % 2 === 1);
                return T.map(upperBound(keys), upperBound(vals));
            }
            case 'fn:struct': {
                const fields = [];
                for (let i = 0; i + 1 < app.args.length; i += 2) {
                    const key = app.args[i]!;
                    if (key.type !== 'Constant' || key.constantType !== 'name' || key.symbol === undefined) {
                        return T.struct([], false);
                    }
                    fields.push({ name: key.symbol, type: argTypes[i + 1]!, optional: false });
                }
                return T.struct(fields, true);
            }
            case 'fn:tuple':
                return T.tuple(...argTypes);
            case 'fn:struct:get': {
                const field = app.args[1];
                if (field && field.type === 'Constant' && field.constantType === 'name' && field.symbol !== undefined) {
                    return structFieldType(argTypes[0]!, field.symbol) ?? T.any;
                }
                return T.any;
            }
            case 'fn:collect':
            case 'fn:collect_distinct':
                if (app.args.length !== 1) return T.list(T.any);
                break;
            default:
                break;
        }
        const f = getBuiltinFunction(name);
        if (!f || !f.signature) return T.any;

        const subst: TypeSubst = new Map();
        argTypes.forEach((t, i) => {
            const p = getParamType(f, i);
            if (p) matchTypeVars(p, t, subst);
        });
        if (check) {
            for (let i = 0; i < argTypes.length; i++) {
                const p = getParamType(f, i);
                if (!p) continue;
                const arg = app.args[i]!;
                // Unit constants are validated with a better message (E067).
                if (f.unitArg && f.unitArg.index === i && arg.type === 'Constant') continue;
                const expected = applyTypeSubst(p, subst);
                if (isDisjoint(argTypes[i]!, expected)) {
                    const names = f.paramNames ?? [];
                    const src = arg.type === 'Variable' ? env.get(arg.symbol)?.source : undefined;
                    this.report({
                        code: 'E068',
                        message: `${ordinal(i)}${names[i] ? ` (${names[i]})` : ''} of ${name} has type ${typeToString(argTypes[i]!)}${src ? ` (from ${src})` : ''}, but ${typeToString(expected)} is expected`,
                        range: arg.range,
                        severity: 'error',
                        hint: conversionHint(argTypes[i]!, expected, name) ?? `signature: ${formatFunctionSignature(f)}`,
                    });
                    break;
                }
            }
        }
        return applyTypeSubst(f.signature.result, subst);
    }
}

function collectFieldNames(t: TypeExpr): string[] {
    const names = new Set<string>();
    const visit = (x: TypeExpr): void => {
        if (x.kind === 'struct') x.fields.forEach(f => names.add(f.name));
        if (x.kind === 'union') x.alts.forEach(visit);
    };
    visit(t);
    return [...names];
}

/** Explains why a struct literal does not fit a struct / tagged-union type. */
function describeStructMismatch(actual: TypeExpr, expected: TypeExpr): string | undefined {
    if (actual.kind !== 'struct') return undefined;
    const alts = expected.kind === 'union' ? expected.alts : [expected];
    const structs = alts.filter((a): a is Extract<TypeExpr, { kind: 'struct' }> => a.kind === 'struct');
    if (structs.length === 0) return undefined;
    // Tagged union: find the tag field (a singleton-typed field shared by all variants).
    const tagField = structs[0]!.fields.find(f => f.type.kind === 'singleton' &&
        structs.every(s => s.fields.some(g => g.name === f.name && g.type.kind === 'singleton')));
    if (tagField && structs.length > 0) {
        const tags = structs.map(s => {
            const f = s.fields.find(g => g.name === tagField.name)!;
            return typeToString(f.type);
        });
        const litTag = actual.fields.find(f => f.name === tagField.name);
        if (!litTag) return `tagged union value must set the tag field ${tagField.name} to one of ${tags.join(', ')}`;
        const tagStr = typeToString(litTag.type);
        const variant = structs.find(s => {
            const f = s.fields.find(g => g.name === tagField.name)!;
            return typeToString(f.type) === tagStr;
        });
        if (!variant) return `unknown tag ${tagStr} for ${tagField.name}; valid tags: ${tags.join(', ')}`;
        return describeStructFields(actual, variant, `variant ${tagStr}`);
    }
    return describeStructFields(actual, structs[0]!, 'the struct type');
}

function describeStructFields(
    literal: Extract<TypeExpr, { kind: 'struct' }>,
    type: Extract<TypeExpr, { kind: 'struct' }>,
    what: string
): string {
    const missing = type.fields.filter(f => !f.optional && !literal.fields.some(g => g.name === f.name)).map(f => f.name);
    if (missing.length > 0) return `${what} requires field${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`;
    for (const f of literal.fields) {
        const tf = type.fields.find(g => g.name === f.name);
        if (tf && isDisjoint(f.type, tf.type)) {
            return `field ${f.name} of ${what} must be ${typeToString(tf.type)}, got ${typeToString(f.type)}`;
        }
    }
    return `expected ${typeToString(type)}`;
}

function builtinPredicateHint(sym: string, actual: TypeExpr, expected: TypeExpr): string | undefined {
    const cls = actual.kind === 'base' ? actual.name : actual.kind === 'singleton' ? actual.constantType : actual.kind === 'namePrefix' ? 'name' : undefined;
    const rel = /^(?::|:float:|:time:|:duration:)(lt|le|gt|ge)$/.exec(sym);
    if (rel && cls && COMPARISON_FAMILIES.has(cls)) {
        const right = `${COMPARISON_FAMILIES.get(cls)}${rel[1]}`;
        if (right !== sym) {
            const extra = sym.startsWith(':float:') && cls === 'number'
                ? ' (:float:* comparisons do not coerce /number; write float constants like 30.0)'
                : '';
            return `use ${right} to compare ${typeToString(T[cls as 'number'])} values${extra}`;
        }
    }
    if (sym === ':match_prefix' && cls === 'string') return 'use :string:starts_with(S, "prefix") for strings; :match_prefix is for name constants';
    if (sym.startsWith(':string:') && cls === 'name') return 'names are not strings; use :match_prefix(N, /prefix) for name prefixes, or convert with fn:name:to_string(N)';
    return conversionHint(actual, expected, sym);
}

function equalityHint(a: TypeExpr, b: TypeExpr): string {
    const classOf = (t: TypeExpr): string | undefined =>
        t.kind === 'base' ? t.name : t.kind === 'singleton' ? t.constantType : t.kind === 'namePrefix' ? 'name' : undefined;
    const ca = classOf(a);
    const cb = classOf(b);
    if ((ca === 'name' && cb === 'string') || (ca === 'string' && cb === 'name')) {
        return '/active is a name constant and "active" is a string; they are never equal - use the same kind on both sides';
    }
    if ((ca === 'number' && cb === 'float64') || (ca === 'float64' && cb === 'number')) {
        return 'equality never converts: 1 and 1.0 are different values; convert explicitly or write the constant in the matching form';
    }
    if ((ca === 'number' && cb === 'string') || (ca === 'string' && cb === 'number')) {
        return 'equality never converts: "1" and 1 are different values; use fn:number:to_string(N) to compare as strings';
    }
    return 'Mangle equality is syntactic and never converts between types';
}
