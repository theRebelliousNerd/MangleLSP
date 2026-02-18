/**
 * Stratification analysis tests.
 *
 * Tests the stratification checker that detects negation cycles (violations of
 * stratification) and other recursive patterns.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import {
    checkStratification,
    checkUnboundedRecursion,
    checkCartesianExplosion,
    checkLateFiltering,
    checkLateNegation,
    checkMultipleIndependentVars,
    checkTemporalRecursion,
} from '../../src/analysis/stratification';

describe('Stratification Analysis', () => {
    describe('Simple positive recursion', () => {
        it('should allow simple positive recursion', () => {
            const source = `
                ancestor(X, Y) :- parent(X, Y).
                ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should allow mutual positive recursion', () => {
            const source = `
                even(0).
                even(N) :- N > 0, odd(fn:minus(N, 1)).
                odd(N) :- N > 0, even(fn:minus(N, 1)).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('Simple negation (stratifiable)', () => {
        it('should allow negation without recursion', () => {
            const source = `
                parent(/alice, /bob).
                parent(/bob, /carol).
                orphan(X) :- person(X), !parent(_, X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should allow negation in acyclic dependency', () => {
            const source = `
                base(X) :- input(X).
                derived(X) :- base(X), !excluded(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should allow negation of predicate not in same SCC', () => {
            // foo depends on bar (negatively), but no cycle
            const source = `
                foo(X) :- input(X), !bar(X).
                bar(X) :- other(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('Negation cycles (unstratifiable)', () => {
        it('should detect simple negation cycle', () => {
            // foo depends on !bar, bar depends on !foo -> cycle
            const source = `
                foo(X) :- input(X), !bar(X).
                bar(X) :- input(X), !foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.message).toContain('negation cycle');
            expect(errors[0]?.cycle).toContain('foo/1');
            expect(errors[0]?.cycle).toContain('bar/1');
        });

        it('should detect self-loop through negation', () => {
            // foo depends on !foo -> self-negation cycle
            const source = `
                foo(X) :- input(X), !foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.message).toContain('negation cycle');
            expect(errors[0]?.cycle).toContain('foo/1');
        });

        it('should detect indirect negation cycle through multiple predicates', () => {
            // foo -> bar -> baz -> !foo (3-predicate cycle)
            const source = `
                foo(X) :- bar(X).
                bar(X) :- baz(X).
                baz(X) :- input(X), !foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.message).toContain('negation cycle');
            // All three predicates should be in the cycle
            expect(errors[0]?.cycle).toContain('foo/1');
            expect(errors[0]?.cycle).toContain('bar/1');
            expect(errors[0]?.cycle).toContain('baz/1');
        });

        it('should detect longer negation cycle', () => {
            // p1 -> p2 -> p3 -> p4 -> !p1 (4-predicate cycle)
            const source = `
                p1(X) :- p2(X).
                p2(X) :- p3(X).
                p3(X) :- p4(X).
                p4(X) :- input(X), !p1(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
        });
    });

    describe('do-transform creates negative edge', () => {
        it('should treat do-transform as negative edge (stratification violation)', () => {
            // Critical test: do-transform should create negative edge
            // foo uses bar in do-transform, baz negates foo -> cycle
            const source = `
                foo(X) :- bar(X) |> do fn:group_by().
                bar(Y) :- baz(Y).
                baz(X) :- !foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.message).toContain('negation cycle');
        });

        it('should detect do-transform self-recursion as negative cycle', () => {
            // foo uses foo in do-transform -> self-loop with negative edge
            const source = `
                foo(X) :- foo(Y) |> do fn:group_by().
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.message).toContain('negation cycle');
        });

        it('should allow positive recursion in do-transform without negation', () => {
            // do-transform creates negative edge, but if there's no actual negation,
            // the cycle is still detected (negative edge from do-transform)
            const source = `
                count(N) :- items(X) |> do fn:group_by(), let N = fn:count().
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            // No cycle here, so no error
            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('let-transform does NOT create negative edge', () => {
        it('should allow let-transform in positive recursion', () => {
            // let-transform does NOT create negative edge
            // This is regular positive recursion and should be allowed
            const source = `
                successor(Y) :- number(X) |> let Y = fn:plus(X, 1).
                number(0).
                number(N) :- successor(N).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should distinguish let-transform from do-transform', () => {
            // let-transform (positive edge) should not cause stratification violation
            const source = `
                foo(Y) :- bar(X) |> let Y = fn:plus(X, 1).
                bar(X) :- baz(X).
                baz(X) :- foo(X).  # Positive cycle with let-transform is OK
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should allow let-transform with negation in different SCC', () => {
            // let-transform with negation of unrelated predicate
            const source = `
                foo(Y) :- bar(X) |> let Y = fn:plus(X, 1), !excluded(Y).
                bar(X) :- input(X).
                excluded(5).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('Multiple connected components', () => {
        it('should analyze independent components separately', () => {
            // Two independent groups:
            // Group 1: foo <-> bar (positive cycle, OK)
            // Group 2: baz -> qux (no cycle, OK)
            const source = `
                foo(X) :- bar(X).
                bar(X) :- foo(X).
                baz(X) :- qux(X).
                qux(X) :- input(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should detect cycle in one component but not affect others', () => {
            // Group 1: p1 -> !p1 (negation cycle, ERROR)
            // Group 2: p2 -> p3 (no cycle, OK)
            const source = `
                p1(X) :- input(X), !p1(X).
                p2(X) :- p3(X).
                p3(X) :- other(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
            expect(errors[0]?.cycle).toContain('p1/1');
            // Should not include p2 or p3 in error
            expect(errors[0]?.cycle).not.toContain('p2/1');
            expect(errors[0]?.cycle).not.toContain('p3/1');
        });

        it('should handle multiple independent negation cycles', () => {
            // Two separate negation cycles
            const source = `
                p1(X) :- !p1(X).
                p2(X) :- !p2(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThanOrEqual(2);
            expect(errors.every(e => e.code === 'E015')).toBe(true);
        });
    });

    describe('Mixed positive and negative paths', () => {
        it('should ignore positive edges when negative cycle exists', () => {
            // foo -> bar (positive)
            // foo -> !bar (negative)
            // bar -> foo (positive)
            // Creates SCC with negative edge
            const source = `
                foo(X) :- bar(X).
                foo(X) :- input(X), !bar(X).
                bar(X) :- foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
        });

        it('should allow positive cycle with unrelated negative edge', () => {
            // foo -> bar -> foo (positive cycle, OK)
            // baz -> !qux (negative edge, but no cycle)
            const source = `
                foo(X) :- bar(X).
                bar(X) :- foo(X).
                baz(X) :- input(X), !qux(X).
                qux(X) :- other(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should detect cycle only when negative path completes the cycle', () => {
            // Complex case: multiple paths, only one creates negative cycle
            // p1 -> p2 -> p3 (positive)
            // p3 -> p4 (positive)
            // p4 -> !p1 (negative, completes cycle)
            const source = `
                p1(X) :- p2(X).
                p2(X) :- p3(X).
                p3(X) :- p4(X).
                p4(X) :- input(X), !p1(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
        });
    });

    describe('Built-in predicates', () => {
        it('should ignore built-in predicates in stratification', () => {
            // Built-ins (starting with :) should not create edges
            const source = `
                foo(X) :- input(X), :lt(X, 10).
                bar(X) :- foo(X), :match(X, "pattern").
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should not count negated built-ins as negative edges', () => {
            const source = `
                foo(X) :- input(X), !:lt(X, 0).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('Different arities are different predicates', () => {
        it('should treat foo/1 and foo/2 as different predicates', () => {
            // foo/1 and foo/2 are different, so no cycle
            const source = `
                foo(X) :- !foo(X, X).
                foo(X, Y) :- bar(X, Y).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should detect cycle with same arity', () => {
            // foo/1 -> !foo/1 is a cycle
            const source = `
                foo(X) :- bar(X), !foo(Y).
                bar(X) :- foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty program', () => {
            const source = ``;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should handle program with only facts', () => {
            const source = `
                parent(/alice, /bob).
                parent(/bob, /carol).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should handle program with only declarations', () => {
            const source = `
                Decl parent(X, Y).
                Decl child(X, Y).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should handle single clause with negation (no cycle)', () => {
            const source = `
                result(X) :- input(X), !excluded(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });

    describe('Chained transforms', () => {
        it('should handle chained let-transforms (positive edges)', () => {
            const source = `
                result(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });

        it('should treat do-transform in chain as negative edge', () => {
            // First transform is do (negative edge)
            const source = `
                foo(Z) :- bar(X) |> do fn:group_by(), let Z = fn:sum(X).
                bar(Y) :- baz(Y).
                baz(X) :- !foo(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]?.code).toBe('E015');
        });

        it('should allow let-transform followed by do-transform', () => {
            // Mixed let/do transforms - first let is positive, second do is negative
            // But no cycle here
            const source = `
                result(S) :- input(X) |> let Y = fn:plus(X, 1) |> do fn:group_by(), let S = fn:sum(Y).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const errors = checkStratification(result.unit!);
            expect(errors).toHaveLength(0);
        });
    });
});

describe('Unbounded Recursion Detection', () => {
    describe('Missing base case', () => {
        it('should warn when recursive rule has no base case', () => {
            const source = `
                loop(X) :- loop(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const warnings = checkUnboundedRecursion(result.unit!);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]?.code).toBe('E016');
            expect(warnings[0]?.message).toContain('no base case');
        });

        it('should not warn when base case exists', () => {
            const source = `
                ancestor(X, Y) :- parent(X, Y).
                ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const warnings = checkUnboundedRecursion(result.unit!);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Unbounded value generation', () => {
        it('should warn for counter pattern without termination', () => {
            // count(N) generates N+1 without limit
            const source = `
                count(0).
                count(N) :- count(M), N = fn:plus(M, 1).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const warnings = checkUnboundedRecursion(result.unit!);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]?.code).toBe('E017');
            expect(warnings[0]?.message).toContain('unbounded');
        });

        it('should not warn when termination condition exists', () => {
            // count(N) with N < 10 termination
            const source = `
                count(0).
                count(N) :- count(M), N = fn:plus(M, 1), N < 10.
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const warnings = checkUnboundedRecursion(result.unit!);
            // Should not have E017 warning
            const unboundedWarnings = warnings.filter(w => w.code === 'E017');
            expect(unboundedWarnings).toHaveLength(0);
        });

        it('should allow non-recursive arithmetic', () => {
            const source = `
                successor(Y) :- number(X), Y = fn:plus(X, 1).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const warnings = checkUnboundedRecursion(result.unit!);
            expect(warnings).toHaveLength(0);
        });
    });
});

describe('Cartesian Explosion Detection', () => {
    it('should warn when consecutive predicates share no variables', () => {
        const source = `
            result(X, Y) :- foo(X), bar(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkCartesianExplosion(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E019');
        expect(warnings[0]?.message).toContain('Cartesian explosion');
    });

    it('should not warn when predicates share variables', () => {
        const source = `
            result(X, Y) :- foo(X), bar(X, Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkCartesianExplosion(result.unit!);
        expect(warnings).toHaveLength(0);
    });

    it('should ignore built-in predicates in consecutive check', () => {
        const source = `
            result(X) :- foo(X), :lt(X, 10), bar(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkCartesianExplosion(result.unit!);
        // Built-in predicates are skipped, but foo and bar share X, so no warning
        expect(warnings).toHaveLength(0);
    });

    it('should ignore wildcard variables', () => {
        const source = `
            result() :- foo(_), bar(_).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkCartesianExplosion(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E019');
    });
});

describe('Late Filtering Detection', () => {
    it('should warn when comparison appears late', () => {
        const source = `
            result(X, Y) :- foo(X), bar(Y), baz(X, Y), X < 10.
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateFiltering(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E021');
        expect(warnings[0]?.message).toContain('Late filtering');
    });

    it('should not warn for early comparison', () => {
        const source = `
            result(X, Y) :- foo(X), X < 10, bar(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateFiltering(result.unit!);
        expect(warnings).toHaveLength(0);
    });

    it('should detect inequality as late filter', () => {
        const source = `
            result(X, Y) :- foo(X), bar(Y), baz(X, Y), X != 0.
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateFiltering(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E021');
    });
});

describe('Late Negation Detection', () => {
    it('should warn when negation appears late with early-bound variables', () => {
        const source = `
            result(X) :- foo(X), bar(Y), baz(Z), !excluded(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateNegation(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E022');
        expect(warnings[0]?.message).toContain('Late negation');
    });

    it('should not warn when negation appears early', () => {
        const source = `
            result(X) :- foo(X), !excluded(X), bar(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateNegation(result.unit!);
        expect(warnings).toHaveLength(0);
    });

    it('should not warn when negation variables not bound by first predicate', () => {
        const source = `
            result(X, Y) :- foo(X), bar(Y), baz(X, Y), !excluded(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkLateNegation(result.unit!);
        // Y is not bound by first predicate (foo), so no warning
        expect(warnings).toHaveLength(0);
    });
});

describe('Multiple Independent Variables Detection', () => {
    it('should warn when 3+ predicates have no shared variables', () => {
        const source = `
            result(X, Y, Z) :- foo(X), bar(Y), baz(Z).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkMultipleIndependentVars(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E023');
        expect(warnings[0]?.message).toContain('Massive Cartesian product');
    });

    it('should not warn when predicates share variables', () => {
        const source = `
            result(X, Y, Z) :- foo(X), bar(X, Y), baz(Y, Z).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkMultipleIndependentVars(result.unit!);
        expect(warnings).toHaveLength(0);
    });

    it('should warn even with partial sharing', () => {
        // foo(X) and bar(Y) share nothing, baz(Z) shares nothing with either
        const source = `
            result(X, Y, Z) :- foo(X), bar(Y), baz(Z), qux(X, Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkMultipleIndependentVars(result.unit!);
        // First three predicates have no shared variables
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E023');
    });

    it('should ignore wildcard variables in sharing check', () => {
        const source = `
            result() :- foo(_), bar(_), baz(_).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkMultipleIndependentVars(result.unit!);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]?.code).toBe('E023');
    });
});

// =============================================================================
// Additional Comprehensive Tests for Stratification Edge Cases
// =============================================================================

describe('Stratification - Multiple Strata', () => {
    it('should allow program requiring multiple strata', () => {
        // This program requires 3 strata:
        // Stratum 0: base
        // Stratum 1: level1 (depends on !base)
        // Stratum 2: level2 (depends on !level1)
        const source = `
            base(X) :- input(X).
            level1(X) :- input(X), !base(X).
            level2(X) :- input(X), !level1(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should allow layered negation without cycles', () => {
        // layer3 -> !layer2 -> !layer1 -> base (no cycle)
        const source = `
            base(X) :- input(X).
            layer1(X) :- base(X), !excluded1(X).
            layer2(X) :- layer1(X), !excluded2(X).
            layer3(X) :- layer2(X), !excluded3(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should allow diamond-shaped dependency with negation', () => {
        // Diamond: base -> a, base -> b, a -> result, b -> !result
        // No cycle because a and b are in same stratum, result depends on them
        const source = `
            base(X) :- input(X).
            path_a(X) :- base(X), valid(X).
            path_b(X) :- base(X), invalid(X).
            result(X) :- path_a(X), !path_b(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });
});

describe('Stratification - Aggregation Combined with Negation', () => {
    it('should allow aggregation with negation of unrelated predicate', () => {
        const source = `
            total(S) :- values(X), !excluded(X) |> do fn:group_by(), let S = fn:sum(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should detect negation cycle with aggregation', () => {
        // foo aggregates over bar, baz negates foo, bar depends on baz
        const source = `
            foo(S) :- bar(X) |> do fn:group_by(), let S = fn:sum(X).
            bar(X) :- baz(X).
            baz(X) :- input(X), !foo(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should allow aggregation result used in negation without cycle', () => {
        // count aggregates, then other predicate negates based on count result
        const source = `
            count(N) :- items(X) |> do fn:group_by(), let N = fn:count().
            has_items() :- count(N), N > 0.
            empty() :- !has_items().
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should detect do-transform creating cycle even with aggregation', () => {
        // Self-referential aggregation through do-transform
        const source = `
            running_sum(S) :- running_sum(X), value(V) |> do fn:group_by(), let S = fn:sum(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });
});

describe('Stratification - External/EDB Predicates', () => {
    it('should not create cycle through external predicate negation', () => {
        // If external_data is external (no definition), negating it is fine
        const source = `
            result(X) :- input(X), !external_data(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should handle undefined predicate in negation gracefully', () => {
        // undefined_pred has no rules, so it's treated as EDB
        const source = `
            foo(X) :- bar(X), !undefined_pred(X).
            bar(X) :- foo(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // foo and bar form a positive cycle, undefined_pred is external
        // This should be OK (positive recursion)
        expect(errors).toHaveLength(0);
    });

    it('should allow negation of fact-only predicate', () => {
        // excluded is only defined by facts, not rules - acts like EDB
        const source = `
            excluded(1).
            excluded(2).
            result(X) :- input(X), !excluded(X).
            input(X) :- result(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // result and input form positive cycle, excluded is fact-only (no body)
        expect(errors).toHaveLength(0);
    });
});

describe('Stratification - Multiple Independent Cycles', () => {
    it('should detect multiple independent negation cycles', () => {
        // Three separate negation cycles
        const source = `
            p1(X) :- input(X), !p1(X).
            p2(X) :- other(X), !p2(X).
            p3(X) :- third(X), !p3(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThanOrEqual(3);
        // All should be E015
        expect(errors.every(e => e.code === 'E015')).toBe(true);
    });

    it('should detect some cycles while allowing others', () => {
        // Cycle 1: a -> !a (error)
        // Cycle 2: b -> c -> b (positive, OK)
        // Cycle 3: d -> !e, e -> !d (mutual negation, error)
        const source = `
            a(X) :- input(X), !a(X).
            b(X) :- c(X).
            c(X) :- b(X).
            d(X) :- input(X), !e(X).
            e(X) :- input(X), !d(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // Should have errors for a cycle and d/e cycle, but not b/c
        expect(errors.length).toBeGreaterThanOrEqual(2);
        const cycles = errors.flatMap(e => e.cycle);
        expect(cycles).toContain('a/1');
        // d/e should be detected
        const hasDE = errors.some(e => e.cycle.includes('d/1') || e.cycle.includes('e/1'));
        expect(hasDE).toBe(true);
    });

    it('should handle interleaved cycles correctly', () => {
        // Complex case: two cycles share a common predicate
        // shared -> p1 -> !shared (cycle 1)
        // shared -> p2 -> !shared (cycle 2)
        const source = `
            shared(X) :- p1(X).
            shared(X) :- p2(X).
            p1(X) :- input(X), !shared(X).
            p2(X) :- other(X), !shared(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });
});

describe('Stratification - Complex Dependency Graphs', () => {
    it('should handle long chain with negation at end', () => {
        // p1 -> p2 -> p3 -> p4 -> p5 -> !p1
        const source = `
            p1(X) :- p2(X).
            p2(X) :- p3(X).
            p3(X) :- p4(X).
            p4(X) :- p5(X).
            p5(X) :- input(X), !p1(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
        expect(errors[0]?.cycle.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle tree-shaped dependencies', () => {
        // root -> branch1 -> leaf1, leaf2
        // root -> branch2 -> leaf3, leaf4
        // No cycles, all positive
        const source = `
            root(X) :- branch1(X).
            root(X) :- branch2(X).
            branch1(X) :- leaf1(X).
            branch1(X) :- leaf2(X).
            branch2(X) :- leaf3(X).
            branch2(X) :- leaf4(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should handle graph with multiple paths between same nodes', () => {
        // a -> b (path 1: direct)
        // a -> c -> b (path 2: through c)
        // b -> !a (creates cycle through both paths)
        const source = `
            a(X) :- b(X).
            a(X) :- c(X).
            c(X) :- b(X).
            b(X) :- input(X), !a(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should handle graph with positive and negative edges between same predicates', () => {
        // a -> b (positive, first rule)
        // a -> !b (negative, second rule)
        // b -> a (positive, completing cycle with negative edge)
        const source = `
            a(X) :- b(X).
            a(X) :- input(X), !b(X).
            b(X) :- a(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });
});

describe('Stratification - Negation with Transforms', () => {
    it('should allow let-transform followed by negation', () => {
        const source = `
            result(Y) :- input(X) |> let Y = fn:plus(X, 1), !excluded(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should detect cycle through negation after do-transform', () => {
        // Complex: do-transform + negation in cycle
        const source = `
            foo(S) :- bar(X) |> do fn:group_by(), let S = fn:sum(X).
            bar(X) :- !foo(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should handle multiple transforms with mixed types', () => {
        // let -> let -> do (first transforms are positive, last creates negative edge)
        const source = `
            result(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).
            input(X) :- result(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // All let-transforms -> positive cycle -> OK
        expect(errors).toHaveLength(0);
    });
});

describe('Stratification - Predicate Arity Edge Cases', () => {
    it('should correctly distinguish predicates with different arities in cycle detection', () => {
        // foo/1 depends on foo/2 (different predicates)
        // foo/2 depends on !bar/1
        // bar/1 depends on foo/1
        // This creates: foo/1 -> bar/1 -> foo/1 (positive cycle via bar)
        // and foo/1 -> foo/2 -> !bar/1 (no cycle, foo/2 is different)
        const source = `
            foo(X) :- bar(X).
            bar(X) :- foo(X).
            foo(X, Y) :- input(X, Y), !bar(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // foo/1 and bar/1 form positive cycle - OK
        // foo/2 negates bar/1 but is not in the cycle - OK
        expect(errors).toHaveLength(0);
    });

    it('should detect cycle with matching arity predicates only', () => {
        // foo/2 -> !foo/2 (self-loop with same arity)
        // bar/2 -> bar/3 (different arities, no cycle)
        const source = `
            foo(X, Y) :- input(X, Y), !foo(X, Y).
            bar(X, Y) :- baz(X, Y, Z).
            baz(X, Y, Z) :- bar(X, Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // foo/2 has negation cycle
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.cycle).toContain('foo/2');
        // bar/2 and baz/3 are different arities but form positive cycle - OK
    });
});

describe('Stratification - Error Message Quality', () => {
    it('should include all predicates in cycle in error message', () => {
        const source = `
            a(X) :- b(X).
            b(X) :- c(X).
            c(X) :- !a(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.cycle).toContain('a/1');
        expect(errors[0]?.cycle).toContain('b/1');
        expect(errors[0]?.cycle).toContain('c/1');
    });

    it('should provide meaningful source range for error', () => {
        const source = `foo(X) :- input(X), !foo(X).`;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        // Error should have a valid source range
        expect(errors[0]?.range).toBeDefined();
        expect(errors[0]?.range.start.line).toBeGreaterThanOrEqual(1);
    });
});

describe('Stratification - Special Constructs', () => {
    it('should handle rules with equality constraints', () => {
        const source = `
            foo(X) :- bar(Y), X = Y, !foo(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should handle rules with function applications', () => {
        const source = `
            foo(Y) :- bar(X), Y = fn:plus(X, 1), !foo(Y).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should handle rules with multiple negations', () => {
        // foo depends negatively on both bar and baz
        const source = `
            foo(X) :- input(X), !bar(X), !baz(X).
            bar(X) :- foo(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // foo -> !bar, bar -> foo creates cycle
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should handle deeply nested function applications', () => {
        const source = `
            foo(Z) :- bar(X), Z = fn:plus(fn:mult(X, 2), fn:minus(X, 1)), !foo(Z).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });
});

describe('Stratification - Real-world Patterns', () => {
    it('should allow default value pattern', () => {
        // Common pattern: use X if defined, else use default
        const source = `
            config_value(K, V) :- user_config(K, V).
            config_value(K, V) :- default_config(K, V), !user_config(K, _).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should allow set difference pattern', () => {
        // A \ B = A AND NOT B
        const source = `
            difference(X) :- set_a(X), !set_b(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should allow transitive closure with filtering', () => {
        // Transitive closure with negation filter on each step
        const source = `
            reachable(X, Y) :- edge(X, Y), !blocked(X, Y).
            reachable(X, Z) :- reachable(X, Y), edge(Y, Z), !blocked(Y, Z).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        expect(errors).toHaveLength(0);
    });

    it('should detect bad recursive counting pattern', () => {
        // Trying to count by self-reference with negation - not stratifiable
        const source = `
            counted(X, 1) :- item(X), !counted(X, _).
            counted(X, N) :- counted(X, M), next_item(X), N = fn:plus(M, 1).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // First rule creates: counted -> !counted cycle
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });

    it('should allow well-founded negation in deductive database', () => {
        // Classic wins/loses game theory example
        const source = `
            wins(X) :- move(X, Y), loses(Y).
            loses(X) :- move(X, _), !wins(X).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const errors = checkStratification(result.unit!);
        // This creates wins <-> loses cycle with negation - should error
        // wins -> loses (positive), loses -> !wins (negative)
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.code).toBe('E015');
    });
});

describe('Temporal Recursion Detection (E048, E049, E050)', () => {
    // NOTE: These tests require temporal syntax parsing support in the parser,
    // which is not yet implemented. The checkTemporalRecursion function works at
    // the AST level by looking for temporal() descriptors and headTime annotations.
    // Until the parser supports temporal syntax, these tests are marked as todo.

    it('should return no warnings when no temporal predicates exist', () => {
        const source = `
            ancestor(X, Y) :- parent(X, Y).
            ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
        `;
        const result = parse(source);
        expect(result.unit).not.toBeNull();

        const warnings = checkTemporalRecursion(result.unit!);
        expect(warnings).toHaveLength(0);
    });

    it.todo('E048: should warn on self-recursive temporal predicate');

    it.todo('E049: should error on mutual recursion through temporal predicates');

    it.todo('E050: should error on future operator in recursive temporal rule');
});

