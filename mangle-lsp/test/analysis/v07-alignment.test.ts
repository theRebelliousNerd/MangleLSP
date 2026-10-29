/**
 * Upstream v0.7 alignment and Mangle-feature advice. Every behaviour pinned
 * here was checked on codeberg.org/TauCeti/mangle-go v0.7.0 (the probe
 * programs in test/fixtures/conformance/probes carry the engine verdicts).
 * Each code has a positive case and a near miss.
 */

import { describe, it, expect } from 'vitest';
import { parse, analyzableUnit } from '../../src/parser/index';
import { analyzeUnit, AnalysisDiagnostic } from '../../src/analysis/pipeline';
import { analyzeProgram } from '../../src/analysis/program';
import { classify } from '../../src/cli/commands/conformance';

function diags(source: string): AnalysisDiagnostic[] {
    const r = parse(source);
    expect(r.unit).not.toBeNull();
    return analyzeUnit(r.unit!).diagnostics;
}
const codes = (source: string) => diags(source).map(d => d.code);
const find = (source: string, code: string) => diags(source).find(d => d.code === code);

describe('v0.7 premise order', () => {
    it("'!=' waits for its variables, like a negation", () => {
        expect(codes('p(1, /x).\nq(X) :- R != /y, p(X, R).')).not.toContain('E004');
    });
    it("'!=' over a variable nothing binds is E004", () => {
        expect(codes('p(1).\nq(X) :- p(X), R != 2.')).toContain('E004');
    });
    it("'<' still needs an earlier binder", () => {
        expect(codes('p(1).\nq(X) :- X < 2, p(X).')).toContain('E004');
    });
});

describe('E003 wildcards in negation', () => {
    it('rejects !r(X, _)', () => {
        expect(find('p(1). r(2, 3).\nq(X) :- p(X), !r(X, _).', 'E003')?.message).toContain('X0');
    });
    it('accepts a fully bound negation', () => {
        expect(codes('p(1). r(2, 3).\nq(X) :- p(X), !r(X, X).')).not.toContain('E003');
    });
});

describe('E081 negated external', () => {
    const decl = "Decl ext(X, Y) descr [external(), mode('+', '-')].\nitem(1).\n";
    it('warns and offers the positive projection', () => {
        const d = find(`${decl}neg(X) :- item(X), !ext(X, "hit").`, 'E081');
        expect(d?.severity).toBe('warning');
        expect(d?.fixes?.[0]?.newText).toBe('!ext_holds(X)');
        expect(d?.fixes?.[0]?.additionalEdits?.[0]?.newText).toBe('\next_holds(X) :- item(X), ext(X, "hit").');
    });
    it('is silent for a positive external premise', () => {
        expect(codes(`${decl}pos(X) :- item(X), ext(X, "hit").`)).not.toContain('E081');
    });
    it('is silent for a negated ordinary predicate', () => {
        expect(codes('item(1). hit(2).\nneg(X) :- item(X), !hit(X).')).not.toContain('E081');
    });
    it('sees an external declared in another file of the program', () => {
        const [schema, policy] = analyzeProgram([
            { path: 'schema.mg', text: "Decl ext(X, Y) descr [external(), mode('+', '-')].\n" },
            { path: 'policy.mg', text: '# policy\nitem(1).\nneg(X) :- item(X), !ext(X, "hit").\n' },
        ]);
        expect(schema!.diagnostics.map(d => d.code)).not.toContain('E081');
        const d = policy!.diagnostics.find(x => x.code === 'E081');
        expect(d?.range.start.line).toBe(3);
        expect(d?.fixes?.[0]?.additionalEdits?.[0]?.range.start.line).toBe(3);
    });
});

describe('E082 bounds strict checking never satisfies', () => {
    it('warns on a union of singletons', () => {
        expect(codes('Decl sev(I, S) bound [/name, fn:Union(fn:Singleton(/low), fn:Singleton(/high))].')).toContain('E082');
    });
    it('warns on /bool and offers /name', () => {
        const d = find('Decl b(X) bound [/bool].', 'E082');
        expect(d?.fixes?.[0]?.newText).toBe('/name');
    });
    it('is silent for a union with a base type', () => {
        expect(codes('Decl s(X) bound [fn:Union(/name, fn:Singleton(/a))].')).not.toContain('E082');
    });
    it('is silent for a tagged union (its tags are typed /name)', () => {
        expect(codes('Decl s(X) bound [fn:TaggedUnion(/kind, /a, fn:Struct(/x, /number), /b, fn:Struct(/y, /string))].')).not.toContain('E082');
    });
});

describe('E083 zero-arity Decl', () => {
    it('warns without a bound list and offers bound []', () => {
        const d = find('Decl ok().\nok().', 'E083');
        expect(d?.fixes?.[0]?.newText).toBe(' bound []');
        expect(d?.fixes?.[0]?.range.start.column).toBe(9);
    });
    it('is silent with bound []', () => {
        expect(codes('Decl ok() bound [].\nok().')).not.toContain('E083');
    });
    it('is silent for a zero-arity predicate without a Decl', () => {
        expect(codes('ok().\nq(/x) :- ok().')).not.toContain('E083');
    });
});

describe('E084 :string:matches under strict bounds', () => {
    it('warns on :string:matches', () => {
        expect(codes('n("abc").\nok(N) :- n(N), :string:matches(N, "^a").')).toContain('E084');
    });
    it('is silent for :string:contains', () => {
        expect(codes('n("abc").\nok(N) :- n(N), :string:contains(N, "a").')).not.toContain('E084');
    });
});

describe('Parser recovery', () => {
    it("names the cause when a name constant swallows the clause's '.'", () => {
        const r = parse('p(/a).\nq(X) :- p(X), X = /a.\nr(1).\n');
        expect(r.errors.some(e => e.message.includes("swallowed the '.'") && e.line === 2)).toBe(true);
    });
    it("is silent when the name is followed by ' .'", () => {
        expect(parse('p(/a).\nq(X) :- p(X), X = /a .\n').errors).toEqual([]);
    });
    it('drops clauses with holes so analysis never chases them', () => {
        const r = parse('h(1).\nq(H) :- h(C), H = C./host.\nr(X) :- h(X).\n');
        expect(r.errors.length).toBeGreaterThan(0);
        expect(() => analyzeUnit(r.unit!)).not.toThrow();
        const analyzed = analyzableUnit(r.unit!).clauses.map(c => c.head.predicate.symbol);
        expect(analyzed).toContain('h');
        expect(analyzed).not.toContain('q');
        // Editor services (formatting, symbols) still see the partial clause.
        expect(r.unit!.clauses.map(c => c.head.predicate.symbol)).toContain('q');
    });
});

describe('A001 arg-max join-back', () => {
    const src = 'obs(/f1, 10, "old"). obs(/f1, 30, "new").\n'
        + 'latest_t(F, M) :- obs(F, T, _) |> do fn:group_by(F), let M = fn:max(T).\n';
    it('advises a merge lattice with the rewrite', () => {
        const d = find(`${src}latest(F, V) :- latest_t(F, M), obs(F, M, V).`, 'A001');
        expect(d?.fixes?.[0]?.newText).toContain('best_obs(F, fn:pair(T, V)) :- obs(F, T, V).');
        expect(d?.fixes?.[0]?.newText).toContain('fundep([F], [P]), merge([P], "obs_later")');
    });
    it('is silent without a join back', () => {
        expect(codes(src)).not.toContain('A001');
    });
    it('is silent for a global maximum (no key for a fundep)', () => {
        expect(codes('obs(1). obs(2).\nm(M) :- obs(T) |> do fn:group_by(), let M = fn:max(T).\nw(T) :- m(T), obs(T).')).not.toContain('A001');
    });
});

describe('A002 variant families', () => {
    it('advises a tagged union for three *_event predicates', () => {
        expect(codes('tool_started_event(1). tool_failed_event(1). tool_done_event(1).')).toContain('A002');
    });
    it('is silent for two', () => {
        expect(codes('tool_started_event(1). tool_failed_event(1).')).not.toContain('A002');
    });
});

describe('A003 never-written constant', () => {
    it('warns and suggests the closest written value', () => {
        const d = find('sev(/a, /high). sev(/b, /low).\nurgent(I) :- sev(I, /hihg).', 'A003');
        expect(d?.fixes?.[0]?.newText).toBe('/high');
    });
    it('is silent for a written value', () => {
        expect(codes('sev(/a, /high).\nurgent(I) :- sev(I, /high).')).not.toContain('A003');
    });
    it('is silent when a writer puts a variable there', () => {
        expect(codes('src(/a, /x).\nsev(I, S) :- src(I, S).\nsev(/b, /high).\nurgent(I) :- sev(I, /hihg).')).not.toContain('A003');
    });
    it('is silent for an extensional Decl (the host may assert other values)', () => {
        expect(codes('Decl sev(I, S) descr [extensional()].\nsev(/a, /high).\nurgent(I) :- sev(I, /hihg).')).not.toContain('A003');
    });
});

describe('A004 clock comparisons', () => {
    it('advises temporal facts', () => {
        expect(codes('seen(/a, 5). current_time(9).\nrecent(X) :- seen(X, T), current_time(Now), Age = fn:minus(Now, T), Age < 10.')).toContain('A004');
    });
    it('is silent without a clock fact', () => {
        expect(codes('seen(/a, 5).\nrecent(X) :- seen(X, T), T < 10.')).not.toContain('A004');
    });
});

describe('A005 collect pairs', () => {
    it('replaces fn:collect(fn:pair(K, V)) with fn:collect_to_map', () => {
        const d = find('kv(/u, /a, 1).\nm(U, L) :- kv(U, K, V) |> do fn:group_by(U), let L = fn:collect(fn:pair(K, V)).', 'A005');
        expect(d?.fixes?.[0]?.newText).toBe('fn:collect_to_map(K, V)');
    });
    it('is silent for fn:collect of one value', () => {
        expect(codes('kv(/u, /a, 1).\nm(U, L) :- kv(U, K, _) |> do fn:group_by(U), let L = fn:collect(K).')).not.toContain('A005');
    });
});

describe('A006 all paths then pick', () => {
    const paths = 'edge(/a, /b).\npath(X, Y, [X, Y]) :- edge(X, Y).\n'
        + 'path(X, Z, P2) :- path(X, Y, P), edge(Y, Z) |> let P2 = fn:list:append(P, Z).\n';
    it('advises a merge lattice', () => {
        expect(codes(`${paths}best(X, Y, N) :- path(X, Y, P), L = fn:list:len(P) |> do fn:group_by(X, Y), let N = fn:min(L).`)).toContain('A006');
    });
    it('is silent when the recursive relation already has a merge lattice', () => {
        const decl = 'Decl path(S, T, P) descr [fundep([S, T], [P]), merge([P], "shorter")].\n';
        expect(codes(`${decl}${paths}best(X, Y, N) :- path(X, Y, P), L = fn:list:len(P) |> do fn:group_by(X, Y), let N = fn:min(L).`)).not.toContain('A006');
    });
});

describe('Conformance classification', () => {
    it('separates agreement from each kind of disagreement', () => {
        expect(classify('ok', 0)).toBe('agree-accept');
        expect(classify('ok', 1)).toBe('lsp-false-positive');
        expect(classify('analyze', 1)).toBe('agree-reject');
        expect(classify('analyze', 0)).toBe('lsp-misses');
        expect(classify('bounds', 0, ['E082'])).toBe('lsp-warns');
        expect(classify('bounds', 0, ['E074'])).toBe('lsp-misses-bounds');
        expect(classify('eval', 1)).toBe('lsp-catches-runtime');
        expect(classify('eval', 0, ['E017'])).toBe('lsp-warns');
        expect(classify('eval', 0)).toBe('lsp-misses-runtime');
    });
});
