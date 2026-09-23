/**
 * Tests for the upstream Mangle 77780a5 sync and the agent-grade diagnostics:
 * new builtins, modes, type expressions, bounds checking, advice lints, hints
 * and quick fixes.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { validate, SemanticError } from '../../src/analysis/validation';
import { analyzeUnit } from '../../src/analysis/pipeline';
import {
    getBuiltinFunction,
    formatFunctionSignature,
    isReducerFunction,
} from '../../src/builtins/functions';
import { getBuiltinPredicate, formatPredicateSignature } from '../../src/builtins/predicates';
import { checkWellformedBound, typeFromBoundTerm, typeToString, isDisjoint, T } from '../../src/analysis/types';
import { checkCartesianExplosion, checkLateFiltering, checkLateNegation } from '../../src/analysis/stratification';

function diagnostics(source: string): SemanticError[] {
    const result = parse(source);
    expect(result.errors).toEqual([]);
    return validate(result.unit!).errors;
}

function codes(source: string): string[] {
    return diagnostics(source).map(e => e.code);
}

function find(source: string, code: string): SemanticError | undefined {
    return diagnostics(source).find(e => e.code === code);
}

function errorCodes(source: string): string[] {
    return diagnostics(source).filter(e => e.severity === 'error').map(e => e.code);
}

function boundOf(source: string) {
    const unit = parse(source).unit!;
    return unit.decls[0]!.bounds![0]!.bounds[0]!;
}

// ============================================================================
// Builtin catalog parity
// ============================================================================

describe('Builtins added upstream since Feb 2026', () => {
    it.each([
        ['fn:mod', 2],
        ['fn:time:add_civil', 4],
        ['fn:time:trunc_civil', 3],
        ['fn:time:weekday_civil', 2],
    ])('%s exists with arity %d', (name, arity) => {
        expect(getBuiltinFunction(name)?.arity).toBe(arity);
    });

    it.each(['fn:duration:max', 'fn:duration:min', 'fn:duration:sum', 'fn:time:max', 'fn:time:min'])(
        '%s is a reducer', name => {
            expect(isReducerFunction(name)).toBe(true);
        });

    it.each([':float:lt', ':float:le', ':float:gt', ':float:ge'])('%s exists', name => {
        expect(getBuiltinPredicate(name)?.arity).toBe(2);
    });

    it(':list:member is mode (?, +) (upstream 77780a5)', () => {
        expect(getBuiltinPredicate(':list:member')?.mode).toEqual(['input_output', 'input']);
    });

    it('fn:time:format_civil takes (Time, TimeZone, Unit)', () => {
        expect(formatFunctionSignature(getBuiltinFunction('fn:time:format_civil')!))
            .toBe('fn:time:format_civil(Time: /time, TimeZone: /string, Unit: /name) -> /string');
    });

    it('renders predicate signatures with modes and types', () => {
        expect(formatPredicateSignature(getBuiltinPredicate(':match_pair')!))
            .toBe(':match_pair(+Pair: .Pair<X, Y>, -First: X, -Second: Y)');
    });

    it('accepts the new builtins in programs', () => {
        const source = `
            ev(T) :- raw(S), T = fn:time:parse_rfc3339(S).
            weekly(W, D) :- ev(T), W = fn:time:trunc_civil(T, "Europe/Berlin", /week), D = fn:time:weekday_civil(T, "UTC").
            next(N) :- ev(T), N = fn:time:add_civil(T, "UTC", 1, /month).
            odd(X) :- num(X), M = fn:mod(X, 2), M = 1.
            longest(K, D2) :- job(K, D) |> do fn:group_by(K), let D2 = fn:duration:max(D).
            late(K, T2) :- seen(K, T) |> do fn:group_by(K), let T2 = fn:time:max(T).
            hot(X) :- temp(X, C), :float:gt(C, 30.5).
        `;
        const errors = diagnostics(source).filter(e => e.severity === 'error');
        expect(errors.map(e => `${e.code}: ${e.message}`)).toEqual([]);
    });

    it('rejects a per-row variable in the head of an aggregation (E049)', () => {
        expect(errorCodes('longest(K, D) :- job(K, D) |> do fn:group_by(K), let D2 = fn:duration:max(D).')).toContain('E049');
    });
});

// ============================================================================
// Modes
// ============================================================================

describe('Mode-aware rule checking (upstream rulecheck.go)', () => {
    it("treats '+' head arguments as bound", () => {
        const source = `
            Decl shorter(P1, P2, S) descr [mode('+', '+', '-')].
            shorter(P1, P2, S) :- fn:list:len(P1) < fn:list:len(P2), S = P1.
        `;
        expect(errorCodes(source)).toEqual([]);
    });

    it("reports E065 when an output argument is already bound", () => {
        const e = find('p(A) :- q(P, A), :match_pair(P, A, B).', 'E065');
        expect(e?.message).toContain("'A' is already bound");
        expect(e?.hint).toContain('A2');
    });

    it('allows a bound first argument of :list:member (mode ?)', () => {
        expect(errorCodes('approved(X) :- seen(X), :list:member(X, [/a, /b]).')).toEqual([]);
    });

    it("reports E066 for variables only used in '+' positions", () => {
        const source = `
            Decl lookup(K, V) descr [mode('+', '-')].
            lookup(K, V) :- table(K, V).
            p(V) :- lookup(K, V).
        `;
        const e = find(source, 'E066');
        expect(e?.message).toContain("'K'");
    });

    it('reports malformed mode declarations (E079)', () => {
        expect(codes("Decl p(X, Y) descr [mode('+')].")).toContain('E079');
        expect(codes('Decl p(X, Y) descr [mode("in", "out")].')).toContain('E079');
        expect(codes("Decl p(X, Y) descr [mode('+', '-')].")).not.toContain('E079');
    });

    it('reports unknown descriptors (E078) with a suggestion', () => {
        const e = find('Decl p(X) descr [extensinal()].', 'E078');
        expect(e?.hint).toContain('extensional');
    });
});

// ============================================================================
// Type expressions
// ============================================================================

describe('Type expression well-formedness (E061)', () => {
    it.each([
        ['Decl p(X) bound [.List</string, /number>].', 'expected 1 argument'],
        ['Decl p(X) bound [.Union<>].', 'union type must not be empty'],
        ['Decl p(X) bound [.Tuple</a, /b>].', 'more than 2'],
        ['Decl p(X) bound [.Struct</a>].', 'even number'],
        ['Decl p(X) bound [.Struct<"a" : /number>].', 'field names must be name constants'],
        ['Decl p(X) bound [.TaggedUnion</kind, /a>].', 'odd number of arguments'],
        ['Decl p(X) bound [.TaggedUnion</kind, /a : .Struct<>, /a : .Struct<>>].', 'duplicate variant tag'],
        ['Decl p(X) bound [.TaggedUnion</kind, /a : /number>].', 'must be a struct type'],
        ['Decl p(X) bound [.TaggedUnion</kind, /a : .Struct</kind : /name>>].', 'must not contain tag field'],
        ['Decl p(X) bound [fn:Lst(/string)].', 'not a valid type constructor'],
        ['Decl p(X) bound [fn:Fun(Y, /number)].', 'not in the argument types'],
        ['Decl p(X) bound [5].', 'not a base type expression'],
    ])('%s', (source, message) => {
        const e = find(source, 'E061');
        expect(e?.message).toContain(message);
    });

    it('suggests the right constructor name', () => {
        expect(find('Decl p(X) bound [fn:Lst(/string)].', 'E061')?.hint).toContain('fn:List');
    });

    it.each([
        'Decl p(X) bound [.List</string>].',
        'Decl p(X) bound [.Map</name, .List</number>>].',
        'Decl p(X) bound [.Struct</name : /string, opt /age : /number>].',
        'Decl p(X) bound [.TaggedUnion</kind, /move : .Struct</x : /number>, /quit : .Struct<>>].',
        'Decl p(X) bound [.Union<.Singleton</on>, .Singleton</off>>].',
        'Decl p(X, Y) bound [X, .List<X>].',
        'Decl p(X) bound [/person].',
    ])('accepts %s', source => {
        expect(codes(source)).not.toContain('E061');
    });

    it('converts and prints type expressions', () => {
        expect(typeToString(typeFromBoundTerm(boundOf('Decl p(X) bound [.Map</name, .List</string>>].'))))
            .toBe('.Map</name, .List</string>>');
        expect(checkWellformedBound(boundOf('Decl p(X) bound [.Pair</a, /b>].'))).toEqual([]);
    });

    it('decides disjointness conservatively', () => {
        expect(isDisjoint(T.number, T.string)).toBe(true);
        expect(isDisjoint(T.singleton('/person/ada'), T.namePrefix('/person'))).toBe(false);
        expect(isDisjoint(T.singleton('/acme'), T.namePrefix('/company'))).toBe(true);
        expect(isDisjoint(T.list(T.number), T.list(T.string))).toBe(false); // [] is in both
        expect(isDisjoint(T.any, T.number)).toBe(false);
        expect(isDisjoint(T.numeric, T.float64)).toBe(false);
    });
});

// ============================================================================
// Bounds checking
// ============================================================================

describe('Bounds checking (upstream boundscheck.go)', () => {
    it('E068: function argument type mismatch with a conversion hint', () => {
        const e = find('later(T2) :- ev(T), T2 = fn:time:add(T, 60).', 'E068');
        expect(e?.message).toContain('/duration');
        expect(e?.hint).toContain('fn:duration:from_seconds');
    });

    it('E068: fn:plus on a string (upstream neg_plusarg)', () => {
        expect(codes('p(X) :- Y = "A", X = fn:plus(1, Y).')).toContain('E068');
    });

    it('accepts float arithmetic on numbers (runtime coerces)', () => {
        expect(errorCodes('p(X) :- q(N), X = fn:float:plus(N, 1.5).')).toEqual([]);
    });

    it('E069: :lt on floats suggests :float:lt', () => {
        const e = find('hot(X) :- temp(X, C), C > 30.5.', 'E069');
        expect(e?.hint).toContain(':float:gt');
    });

    it('E069: :float:lt on integers explains the lack of coercion', () => {
        const e = find('p(X) :- q(X), :float:lt(X, 3).', 'E069');
        expect(e?.hint).toContain('do not coerce');
    });

    it('E069: :match_prefix needs a name, not a string', () => {
        expect(find('p(X) :- q(X), :match_prefix(X, "a").', 'E069')?.hint).toContain(':string:starts_with');
    });

    it('E069: :match_field on a declared struct without that field', () => {
        const source = `
            Decl person(P) bound [.Struct</name : /string>].
            p(A) :- person(P), :match_field(P, /age, A).
        `;
        const e = find(source, 'E069');
        expect(e?.message).toContain('no field /age');
        expect(e?.hint).toContain('/name');
    });

    it('E070: fact outside a name-prefix bound suggests the prefix', () => {
        const source = `
            Decl works_at(P, C) bound [/person, /company].
            works_at(/person/ada, /acme).
        `;
        const e = find(source, 'E070');
        expect(e?.hint).toContain('/company/acme');
    });

    it('E070: tagged union facts must use a valid tag and required fields', () => {
        const decl = 'Decl ev(E) bound [.TaggedUnion</kind, /move : .Struct</x : /number>, /quit : .Struct<>>].';
        expect(codes(`${decl}\nev({/kind: /move, /x: 1}).\nev({/kind: /quit}).`)).not.toContain('E070');
        expect(find(`${decl}\nev({/kind: /jump}).`, 'E070')?.hint).toContain('valid tags');
        expect(find(`${decl}\nev({/kind: /move}).`, 'E070')?.hint).toContain('requires field /x');
    });

    it('E071: rule head incompatible with the declaration', () => {
        const source = `
            Decl age(P, A) bound [/name, /number].
            Decl label(P, L) bound [/name, /string].
            label(P, L) :- age(P, L).
        `;
        expect(codes(source)).toContain('E071');
    });

    it('E072: variable joined across incompatible columns', () => {
        const source = `
            Decl age(P, A) bound [/name, /number].
            Decl email(P, E) bound [/name, /string].
            bad(P) :- age(P, X), email(P, X).
        `;
        const e = find(source, 'E072');
        expect(e?.message).toContain("'X'");
    });

    it('E073: equality between a name and a string', () => {
        const source = `
            Decl status(U, S) bound [/name, /name].
            active(U) :- status(U, S), S = "active".
        `;
        const e = find(source, 'E073');
        expect(e?.severity).toBe('warning');
        expect(e?.hint).toContain('name constant');
    });

    it('uses :list:member element types', () => {
        const source = `
            Decl tags(T) bound [.List</string>].
            p(X) :- tags(L), :list:member(X, L), Y = fn:plus(X, 1).
        `;
        expect(codes(source)).toContain('E068');
    });

    it('never reports on undeclared predicates', () => {
        expect(errorCodes('p(X) :- q(X), r(X), Y = fn:plus(X, 1), s(Y).')).toEqual([]);
    });
});

// ============================================================================
// Builtin misuse with actionable hints
// ============================================================================

describe('Actionable builtin diagnostics', () => {
    it('E067: calendar unit for fn:time:trunc points to trunc_civil', () => {
        const e = find('w(W) :- ev(T), W = fn:time:trunc(T, /week).', 'E067');
        expect(e?.hint).toContain('fn:time:trunc_civil');
    });

    it('E067: string unit gets a quick fix to the name constant', () => {
        const e = find('w(W) :- ev(T), W = fn:time:trunc(T, "hour").', 'E067');
        expect(e?.fixes?.[0]?.newText).toBe('/hour');
    });

    it('E035: modulo by zero', () => {
        expect(find('p(X) :- q(Y), X = fn:mod(Y, 0).', 'E035')?.message).toContain('Modulo');
    });

    it('E018: miscased function gets a replace quick fix', () => {
        const e = find('p(X) :- q(Y), X = fn:Plus(Y, 1).', 'E018');
        expect(e?.fixes?.[0]).toMatchObject({ newText: 'fn:plus' });
    });

    it('E008: unknown function suggests the closest builtin', () => {
        const e = find('p(X) :- q(T), X = fn:time:truncate(T, /day).', 'E008');
        expect(e?.hint).toContain('fn:time:trunc');
        expect(e?.fixes?.[0]?.newText).toBe('fn:time:trunc');
    });

    it('E005: unknown builtin predicate suggests the right name', () => {
        const e = find('p(S) :- q(S), :string:startswith(S, "a").', 'E005');
        expect(e?.hint).toContain(':string:starts_with');
    });

    it('E020: stale hallucination hints now point at existing builtins', () => {
        expect(find('p(X) :- q(S), X = fn:contains(S, "a").', 'E020')?.message).toContain(':string:contains');
        expect(find('p(X) :- q(A, B), X = fn:modulo(A, B).', 'E020')?.message).toContain('fn:mod');
    });

    it('E009: arity errors show the signature', () => {
        expect(find('p(X) :- q(A), X = fn:mod(A).', 'E009')?.hint).toContain('fn:mod(X: /number, Y: /number)');
    });

    it('does not double-report unbound variables (E004 only)', () => {
        const all = codes('p(X) :- X < 10, q(X).');
        expect(all.filter(c => c === 'E004')).toHaveLength(1);
        expect(all).not.toContain('E007');
        expect(all).not.toContain('E010');
    });

    it('does not report E047 for miscased reducers (E018 covers it)', () => {
        const all = codes('t(S) :- s(X) |> do fn:group_by(), let S = fn:Sum(X).');
        expect(all).toContain('E018');
        expect(all).not.toContain('E047');
    });
});

// ============================================================================
// Negation and visibility
// ============================================================================

describe('Negation and visibility', () => {
    it('E003: never-bound negation variables are reported with a hint', () => {
        const e = find('orphan(X) :- person(X), !parent(Y, X).', 'E003');
        expect(e?.hint).toContain("'_'");
    });

    it('E003 is not reported for input-mode head variables used in negation', () => {
        const source = `
            Decl not_member(X) descr [mode('+')].
            not_member(X) :- !member(X).
            member(/a).
        `;
        expect(codes(source)).not.toContain('E003');
    });

    it('E041 only across packages', () => {
        expect(codes('Decl h(X) descr [private()].\nh(/a).\nf(X) :- h(X).')).not.toContain('E041');
        expect(codes('Decl a.h(X) descr [private()].\na.h(/a).\nb.f(X) :- a.h(X).')).toContain('E041');
    });
});

// ============================================================================
// Advice lints
// ============================================================================

describe('Advice lints', () => {
    it('E074: singleton variable with typo suggestion', () => {
        const e = find('owns(P, Car) :- person(P), car(Car), owner(Carr, P).', 'E074');
        expect(e?.message).toContain("'Carr'");
        expect(e?.hint).toContain("'Car'");
        expect(e?.fixes?.map(f => f.newText)).toEqual(['Car', '_']);
    });

    it('E074: unused let result in a let-transform', () => {
        const e074 = diagnostics('p(K) :- q(K) |> let N = fn:plus(K, 1).').filter(e => e.code === 'E074');
        expect(e074).toHaveLength(1);
        expect(e074[0]!.message).toContain("'N'");
    });

    it('E074 is not reported in aggregations, where single-use variables keep rows apart', () => {
        expect(codes('total(S) :- sale(Id, Amount) |> do fn:group_by(), let S = fn:sum(Amount).')).not.toContain('E074');
    });

    it('E080: wildcards in a multi-premise aggregation body merge rows', () => {
        const e = find('total(S) :- sale(_, A), valid(A) |> do fn:group_by(), let S = fn:sum(A).', 'E080');
        expect(e?.severity).toBe('warning');
        expect(e?.message).toContain('fn:sum');
        // Single-atom bodies are aggregated fact by fact; duplicate-insensitive reducers are fine.
        expect(codes('total(S) :- sale(_, A) |> do fn:group_by(), let S = fn:sum(A).')).not.toContain('E080');
        expect(codes('m(M) :- sale(_, A), valid(A) |> do fn:group_by(), let M = fn:max(A).')).not.toContain('E080');
    });

    it('E074 is not reported for wildcards or joined variables', () => {
        expect(codes('p(X) :- q(X, _), r(X).')).not.toContain('E074');
    });

    it('E075: undefined predicate, once per predicate, with typo suggestion', () => {
        const source = `
            parent(/a, /b).
            anc(X, Y) :- parnet(X, Y).
            anc(X, Z) :- parnet(X, Y), anc(Y, Z).
        `;
        const e075 = diagnostics(source).filter(e => e.code === 'E075');
        expect(e075).toHaveLength(1);
        expect(e075[0]!.severity).toBe('warning');
        expect(e075[0]!.fixes?.[0]?.newText).toBe('parent');
    });

    it('E075 is informational when there is no likely typo', () => {
        expect(find('p(X) :- q(X).', 'E075')?.severity).toBe('info');
    });

    it('E076: fn:collect + fn:list:len suggests fn:count()', () => {
        const e = find('n(K, N) :- q(K, V) |> do fn:group_by(K), let L = fn:collect(V), let N = fn:list:len(L).', 'E076');
        expect(e?.fixes?.[0]?.newText).toBe('fn:count()');
    });

    it('E077: duplicate premise', () => {
        expect(codes('p(X) :- q(X), r(X), q(X).')).toContain('E077');
    });
});

// ============================================================================
// Performance checks
// ============================================================================

describe('Binding-aware performance checks', () => {
    const run = (fn: typeof checkCartesianExplosion, src: string) => fn(parse(src).unit!);

    it('E019 names a premise that can be moved earlier', () => {
        const w = run(checkCartesianExplosion, 'p(X, Z) :- a(X), b(Z), link(X, Z).');
        expect(w[0]?.hint).toContain("move 'link(X, Z)' before 'b(Z)'");
    });

    it('E019 counts variables bound by builtins and equalities', () => {
        const src = 'p(V) :- instr(P, I), :match_field(I, /var, V), var_type(V, /box).';
        expect(run(checkCartesianExplosion, src)).toHaveLength(0);
    });

    it('E021 ignores filters placed right after their binding premise', () => {
        const src = 'p(P) :- a(P, I), b(P), :match_field(I, /op, Op), Op != "move".';
        expect(run(checkLateFiltering, src)).toHaveLength(0);
    });

    it('E021 says where to move the filter', () => {
        const w = run(checkLateFiltering, 'result(X, Y) :- foo(X), bar(Y), baz(X, Y), X < 10.');
        expect(w[0]?.hint).toContain("right after 'foo(X)'");
    });

    it('E022 says where to move the negation', () => {
        const w = run(checkLateNegation, 'r(X) :- foo(X), bar(Y), baz(Z), !excluded(X).');
        expect(w[0]?.hint).toContain("right after 'foo(X)'");
    });
});

// ============================================================================
// Pipeline
// ============================================================================

describe('Analysis pipeline', () => {
    it('combines semantic and stratification diagnostics in source order', () => {
        const unit = parse('p(X) :- q(X), !p(X).\nr(X, Y) :- a(X), b(Y).').unit!;
        const diags = analyzeUnit(unit).diagnostics;
        expect(diags.some(d => d.code === 'E015')).toBe(true);
        expect(diags.some(d => d.code === 'E019')).toBe(true);
        const lines = diags.map(d => d.range.start.line);
        expect([...lines].sort((a, b) => a - b)).toEqual(lines);
    });
});
