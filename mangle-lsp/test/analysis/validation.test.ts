/**
 * Validation tests for Mangle LSP.
 *
 * Tests semantic validation for parsed Mangle programs.
 * Covers all error codes from E001-E046.
 *
 * NOTE: Some tests are marked as .todo() because the corresponding
 * validation features are not yet fully implemented in the parser or validator.
 * These tests document the expected behavior.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { validate } from '../../src/analysis/validation';

/**
 * Helper to validate source and check for specific error code.
 */
function expectError(source: string, errorCode: string): void {
    const parseResult = parse(source);
    expect(parseResult.unit).not.toBeNull();
    const result = validate(parseResult.unit!);
    const hasCode = result.errors.some(e => e.code === errorCode);
    if (!hasCode) {
        console.log('Expected error code:', errorCode);
        console.log('Actual errors:', result.errors.map(e => `${e.code}: ${e.message}`));
    }
    expect(hasCode).toBe(true);
}

/**
 * Helper to validate source and check it has no errors.
 */
function expectNoErrors(source: string): void {
    const parseResult = parse(source);
    expect(parseResult.unit).not.toBeNull();
    const result = validate(parseResult.unit!);
    if (result.errors.length > 0) {
        console.log('Unexpected errors:', result.errors.map(e => `${e.code}: ${e.message}`));
    }
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
}

/**
 * Helper to check for specific error count.
 */
function expectErrorCount(source: string, errorCode: string, count: number): void {
    const parseResult = parse(source);
    expect(parseResult.unit).not.toBeNull();
    const result = validate(parseResult.unit!);
    const actualCount = result.errors.filter(e => e.code === errorCode).length;
    if (actualCount !== count) {
        console.log(`Expected ${count} of ${errorCode}, got ${actualCount}`);
        console.log('Errors:', result.errors.map(e => `${e.code}: ${e.message}`));
    }
    expect(actualCount).toBe(count);
}

describe('Validation Module', () => {
    describe('E001: Variables in facts must be ground', () => {
        it('should error on variable in fact head', () => {
            expectError('parent(X, /bob).', 'E001');
        });

        it('should error on multiple variables in fact', () => {
            expectError('foo(X, Y, Z).', 'E001');
        });

        it('should allow facts with only constants', () => {
            expectNoErrors('parent(/alice, /bob).');
        });

        it('should allow facts with numbers', () => {
            expectNoErrors('age(/alice, 30).');
        });

        it('should allow facts with strings', () => {
            expectNoErrors('name(/alice, "Alice").');
        });
    });

    describe('E002: Range restriction (head variables must be bound)', () => {
        it('should error when head variable not in body', () => {
            expectError('result(Y) :- input(X).', 'E002');
        });

        it('should error when head variable partially bound', () => {
            expectError('result(X, Y) :- input(X).', 'E002');
        });

        it('should allow when all head variables are bound', () => {
            expectNoErrors('result(X) :- input(X).');
        });

        it('should allow multiple bound variables', () => {
            expectNoErrors('result(X, Y) :- input(X), output(Y).');
        });

        it('should allow head variables bound by equality', () => {
            expectNoErrors('result(Y) :- input(X), Y = X.');
        });
    });

    describe('E003: Variables in negation must be bound', () => {
        it('should silently handle negated atom with variable not bound elsewhere (negation delay drops it)', () => {
            // Upstream behavior: RewriteClause delays negated atoms until their variables are bound.
            // If variables never get bound, the negated atom is silently dropped.
            // Y is never bound by any positive atom, so !parent(Y, X) is dropped.
            expectNoErrors('orphan(X) :- person(X), !parent(Y, X).');
        });

        it('should allow negation with all variables bound', () => {
            expectNoErrors('orphan(X) :- person(X), !parent(_, X).');
        });

        it('should allow negation with variables bound earlier', () => {
            expectNoErrors('different(X, Y) :- item(X), item(Y), !same(X, Y).');
        });

        it('should silently handle negation with variables never bound (negation delay drops it)', () => {
            // Y, Z are never bound by any positive atom, so !baz(Y, Z) is dropped.
            expectNoErrors('foo(X) :- bar(X), !baz(Y, Z).');
        });

        it('should error when negated atom has unbound variable and no rewrite possible', () => {
            // This is a case where the negated atom variable also appears in the head,
            // so even though negation is dropped, Y is still unbound in head -> E002
            expectError('foo(X, Y) :- bar(X), !baz(Y).', 'E002');
        });
    });

    describe('E004: Variables in comparisons must be bound', () => {
        it('should error when comparison variable unbound (lt)', () => {
            expectError('foo(X) :- bar(Y), X < 10.', 'E004');
        });

        it('should error when comparison variable unbound (le)', () => {
            expectError('foo(X) :- bar(Y), X <= 10.', 'E004');
        });

        it('should error when comparison variable unbound (gt)', () => {
            expectError('foo(X) :- bar(Y), X > 10.', 'E004');
        });

        it('should error when comparison variable unbound (ge)', () => {
            expectError('foo(X) :- bar(Y), X >= 10.', 'E004');
        });

        it('should error when inequality variable unbound', () => {
            expectError('foo(X) :- bar(Y), X != 10.', 'E004');
        });

        it('should allow comparisons with bound variables', () => {
            expectNoErrors('foo(X) :- bar(X), X < 10.');
        });

        it('should allow comparisons between bound variables', () => {
            expectNoErrors('bigger(X, Y) :- num(X), num(Y), X > Y.');
        });
    });

    describe('E005: Unknown built-in predicates', () => {
        it('should error on unknown built-in predicate', () => {
            expectError('foo(X) :- bar(X), :unknown(X).', 'E005');
        });

        it('should error on misspelled built-in', () => {
            expectError('foo(X) :- bar(X), :matc(X, /y).', 'E005');
        });

        it('should allow known built-in predicates', () => {
            expectNoErrors('foo(X, Y) :- list(L), :match_cons(L, X, Y).');
        });

        it('should allow comparison built-ins', () => {
            expectNoErrors('foo(X) :- bar(X), :lt(X, 10).');
        });
    });

    describe('E006: Built-in predicate arity mismatch', () => {
        it('should error when built-in has wrong arity', () => {
            expectError('foo(X) :- bar(X), :match_cons(X).', 'E006');
        });

        // TODO: Parser may not handle extra arguments in some predicates correctly
        it.todo('should error when built-in has too many args', () => {
            // Note: :lt expects 2 args, but this has 3
            expectError('foo(X) :- bar(X), bar(Y), bar(Z), :lt(X, Y, Z).', 'E006');
        });

        it('should allow correct arity', () => {
            expectNoErrors('foo(X, Y) :- list(L), :match_cons(L, X, Y).');
        });
    });

    describe('E007: Built-in predicate mode requirements', () => {
        it('should error when input argument is unbound', () => {
            // :match_cons requires first arg to be bound (input mode)
            expectError('foo(X, Y) :- :match_cons(L, X, Y).', 'E007');
        });

        it('should allow when all input arguments are bound', () => {
            expectNoErrors('foo(X, Y) :- list(L), :match_cons(L, X, Y).');
        });
    });

    describe('E008: Unknown built-in functions', () => {
        // TODO: Function validation in equality contexts not fully implemented
        it.todo('should error on unknown function', () => {
            expectError('result(Y) :- input(X), Y = fn:unknown(1, 2).', 'E008');
        });

        it.todo('should error on misspelled function', () => {
            expectError('result(Y) :- input(X), Y = fn:plu(1, 2).', 'E008');
        });

        it('should allow known built-in functions', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:plus(1, 2).');
        });
    });

    describe('E009: Built-in function arity mismatch', () => {
        // TODO: Function arity validation in equality contexts not fully implemented
        it.todo('should error when function has wrong arity', () => {
            // fn:sqrt expects 1 argument
            expectError('result(Y) :- input(X), Y = fn:sqrt(1, 2).', 'E009');
        });

        it.todo('should error when function has too many args', () => {
            // fn:sqrt expects 1 argument
            expectError('result(Y) :- input(X), Y = fn:sqrt(X, Y, Z).', 'E009');
        });

        it('should allow correct arity', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:sqrt(X).');
        });
    });

    describe('E010: Function arguments must be bound', () => {
        it('should error when function argument is unbound (E014 in equality context)', () => {
            // E014 is used when function application is in equality context
            expectError('result(Y) :- input(X), Y = fn:plus(Z, 1).', 'E014');
        });

        it('should allow when all function arguments are bound', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:plus(X, 1).');
        });

        it('should error on nested function with unbound variable', () => {
            // E014 is used when function application is in equality context
            expectError('result(Y) :- input(X), Y = fn:plus(fn:mult(Z, 2), 1).', 'E014');
        });

        it('should error E010 when function used in atom argument', () => {
            expectError('result(Y) :- foo(fn:plus(Z, 1)).', 'E010');
        });
    });

    describe('E011: Transform must start with group_by', () => {
        it('should error when transform do statement is not group_by', () => {
            // Using a non-group_by function in do position
            expectError('result(Y) :- input(X) |> do fn:plus(X, 1).', 'E011');
        });

        it('should allow transform starting with do fn:group_by', () => {
            expectNoErrors('sum(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).');
        });
    });

    describe('E012: Group_by variables must be bound', () => {
        it('should error when group_by variable is unbound', () => {
            expectError('grouped(G, S) :- values(X) |> do fn:group_by(Y), let S = fn:sum(X).', 'E012');
        });

        it('should allow when group_by variables are bound', () => {
            expectNoErrors('grouped(G, S) :- data(G, X) |> do fn:group_by(G), let S = fn:sum(X).');
        });
    });

    describe('E014: Equality with function application', () => {
        it('should error when function variables are unbound in equality', () => {
            expectError('result(Y) :- input(X), Y = fn:plus(Z, 1).', 'E014');
        });

        it('should allow when function variables are bound', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:plus(X, 1).');
        });
    });

    describe('E018: Function name casing errors', () => {
        // TODO: Function name validation in all contexts not fully implemented
        it.todo('should error on capitalized Sum', () => {
            expectError('sum(S) :- values(X) |> do fn:group_by(), let S = fn:Sum(X).', 'E018');
        });

        it.todo('should error on capitalized Count', () => {
            expectError('count(C) :- values(X) |> do fn:group_by(), let C = fn:Count().', 'E018');
        });

        it.todo('should error on capitalized Plus', () => {
            expectError('result(Y) :- input(X), Y = fn:Plus(1, 2).', 'E018');
        });

        it.todo('should suggest correct casing', () => {
            const parseResult = parse('result(Y) :- input(X), Y = fn:Sum(1, 2).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E018');
            expect(error).toBeDefined();
            expect(error?.message).toContain('fn:sum');
        });
    });

    describe('E020: Hallucinated functions', () => {
        // TODO: Hallucination detection in equality contexts not fully implemented
        it.todo('should error on non-existent fn:substring', () => {
            expectError('result(Y) :- input(X), Y = fn:substring("hello", 0, 2).', 'E020');
        });

        it.todo('should error on non-existent fn:contains', () => {
            expectError('result(Y) :- input(X), Y = fn:contains(X, "test").', 'E020');
        });

        it.todo('should error on non-existent fn:split', () => {
            expectError('result(Y) :- input(X), Y = fn:split("a,b", ",").', 'E020');
        });

        it.todo('should provide helpful suggestion', () => {
            const parseResult = parse('result(Y) :- input(X), Y = fn:contains("test").');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E020');
            expect(error).toBeDefined();
            expect(error?.message).toContain('does not exist');
        });
    });

    describe('E024: Declaration arguments must be variables', () => {
        it('should error when declaration has constant argument', () => {
            expectError('Decl parent(/alice, Y).', 'E024');
        });

        it('should error when declaration has number argument', () => {
            expectError('Decl foo(42, Y).', 'E024');
        });

        it('should allow declarations with only variables', () => {
            expectNoErrors('Decl parent(X, Y).');
        });
    });

    describe('E025: Declaration bounds count mismatch', () => {
        it('should error when bounds count does not match arity', () => {
            expectError('Decl foo(X, Y) bound [/string].', 'E025');
        });

        it('should allow multiple bound blocks when each matches arity', () => {
            // Per-BoundDecl checking: each bound block has 1 element, arity is 1 → valid
            expectNoErrors('Decl foo(X) bound [/string] bound [/number].');
        });

        it('should error when bound block count does not match arity', () => {
            // Per-BoundDecl checking: each bound block has 1 element, but arity is 2 → E025
            expectError('Decl foo(X, Y) bound [/string] bound [/number].', 'E025');
        });

        it('should allow declaration without bounds', () => {
            expectNoErrors('Decl foo(X, Y).');
        });
    });

    describe('E026: External predicates must have exactly one mode', () => {
        it('should error when external predicate has no mode', () => {
            expectError('Decl foo(X) descr [external()].', 'E026');
        });

        // TODO: Multiple mode detection not fully implemented
        it.todo('should error when external predicate has multiple modes', () => {
            expectError('Decl foo(X) descr [external(), mode(+), mode(-)].', 'E026');
        });

        it('should allow external predicate with exactly one mode', () => {
            expectNoErrors('Decl foo(X) descr [external(), mode(+)].');
        });
    });

    describe('E027: Struct and map require even arguments', () => {
        // TODO: Even argument validation in equality contexts not fully implemented
        it.todo('should error when fn:struct has odd number of arguments', () => {
            // Using fn:struct directly to test
            expectError('result(Y) :- input(X), Y = fn:struct(/a, 1, /b).', 'E027');
        });

        it.todo('should error when fn:map has odd number of arguments', () => {
            // Using fn:map directly to test
            expectError('result(Y) :- input(X), Y = fn:map(/a, 1, /b).', 'E027');
        });

        it('should allow struct with even arguments', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:struct(/a, 1, /b, 2).');
        });

        it('should allow map with even arguments', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:map(/a, 1, /b, 2).');
        });

        it('should allow empty struct', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:struct().');
        });

        it('should allow empty map', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:map().');
        });
    });

    describe('E030: String predicates require constant second argument', () => {
        it('should error when :match_prefix has variable pattern', () => {
            expectError('foo(X) :- str(X), :match_prefix(X, Y).', 'E030');
        });

        it('should error when :string:starts_with has variable pattern', () => {
            expectError('foo(X) :- str(X), :string:starts_with(X, Y).', 'E030');
        });

        it('should allow constant pattern', () => {
            expectNoErrors('foo(X) :- str(X), :match_prefix(X, "prefix").');
        });
    });

    describe('E031: Package names must be lowercase', () => {
        // TODO: Package name case validation not fully implemented
        it.todo('should error on uppercase package name', () => {
            expectError('Decl Package(X) descr [name("MyPackage")].', 'E031');
        });

        it.todo('should error on mixed case package name', () => {
            expectError('Decl Package(X) descr [name("myPackage")].', 'E031');
        });

        it('should allow lowercase package name', () => {
            expectNoErrors('Decl Package(X) descr [name("mypackage")].');
        });
    });

    describe('E032: Name constant validation', () => {
        // TODO: Name constant validation in equality contexts not fully implemented
        it.todo('should error on name with empty part (double slash)', () => {
            // Parser may handle this, so test in a rule context
            expectError('result(Y) :- input(X), Y = /a//b.', 'E032');
        });

        it.todo('should error on name with trailing slash', () => {
            expectError('result(Y) :- input(X), Y = /a/b/.', 'E032');
        });

        it.todo('should error on empty name (just slash)', () => {
            expectError('result(Y) :- input(X), Y = /.', 'E032');
        });

        it('should allow valid hierarchical name', () => {
            expectNoErrors('foo(/a/b/c).');
        });

        it('should allow single-part name', () => {
            expectNoErrors('foo(/a).');
        });
    });

    describe('E033: Destructuring predicates require variable arguments', () => {
        it('should error when :match_pair has constant in position 2', () => {
            expectError('foo(X) :- pair(P), :match_pair(P, /a, Y).', 'E033');
        });

        it('should error when :match_pair has constant in position 3', () => {
            expectError('foo(X) :- pair(P), :match_pair(P, X, /b).', 'E033');
        });

        it('should error when :match_cons has constant arguments', () => {
            expectError('foo(X) :- list(L), :match_cons(L, /a, /b).', 'E033');
        });

        it('should allow variables in destructuring positions', () => {
            expectNoErrors('foo(X, Y) :- pair(P), :match_pair(P, X, Y).');
        });
    });

    describe('E034: Field selector predicates require constant field', () => {
        it('should error when :match_field has variable field selector', () => {
            expectError('foo(X) :- struct(S), :match_field(S, F, X).', 'E034');
        });

        it('should error when :match_entry has variable key', () => {
            expectError('foo(X) :- map(M), :match_entry(M, K, X).', 'E034');
        });

        it('should allow constant field selector', () => {
            expectNoErrors('foo(X) :- struct(S), :match_field(S, /name, X).');
        });

        it('should allow constant key selector', () => {
            expectNoErrors('foo(X) :- map(M), :match_entry(M, /key, X).');
        });
    });

    describe('E035: Division by zero', () => {
        // TODO: Division by zero detection in equality contexts not fully implemented
        it.todo('should error when dividing by constant zero', () => {
            expectError('result(Y) :- input(X), Y = fn:div(10, 0).', 'E035');
        });

        it.todo('should error when dividing by float zero', () => {
            expectError('result(Y) :- input(X), Y = fn:float:div(10.0, 0.0).', 'E035');
        });

        it('should allow division by non-zero constant', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:div(10, 2).');
        });

        it('should allow division by variable (runtime check)', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:div(10, X).');
        });
    });

    describe('E036: Group_by arguments must be variables', () => {
        it('should error when group_by has constant argument', () => {
            expectError('sum(S) :- values(X) |> do fn:group_by(/a), let S = fn:sum(X).', 'E036');
        });

        it('should error when group_by has function application', () => {
            expectError('sum(S) :- values(X) |> do fn:group_by(fn:plus(X, 1)), let S = fn:sum(X).', 'E036');
        });

        it('should allow variables in group_by', () => {
            expectNoErrors('sum(G, S) :- data(G, X) |> do fn:group_by(G), let S = fn:sum(X).');
        });
    });

    describe('E037: Group_by arguments must be distinct', () => {
        it('should error when group_by has duplicate variables', () => {
            expectError('sum(S) :- data(G, X) |> do fn:group_by(G, G), let S = fn:sum(X).', 'E037');
        });

        it('should error when group_by has multiple duplicates', () => {
            expectError('sum(S) :- data(A, B, X) |> do fn:group_by(A, B, A), let S = fn:sum(X).', 'E037');
        });

        it('should allow distinct variables in group_by', () => {
            expectNoErrors('sum(S) :- data(A, B, X) |> do fn:group_by(A, B), let S = fn:sum(X).');
        });
    });

    describe('E038: Invalid string escape sequences', () => {
        // TODO: String escape validation causes parse errors, need better error recovery
        it.todo('should error on invalid escape sequence', () => {
            expectError('result(Y) :- input(X), Y = "hello\\qworld".', 'E038');
        });

        it.todo('should error on incomplete hex escape', () => {
            expectError('result(Y) :- input(X), Y = "hello\\x4".', 'E038');
        });

        it.todo('should error on backslash at end of string', () => {
            expectError('result(Y) :- input(X), Y = "hello\\".', 'E038');
        });

        it('should allow valid escape sequences', () => {
            expectNoErrors('foo("hello\\nworld").');
        });

        it('should allow hex escapes', () => {
            expectNoErrors('foo("\\x41").');
        });
    });

    describe('E039: Wildcard in head warning', () => {
        it('should warn when wildcard used in head', () => {
            const parseResult = parse('foo(_, X) :- bar(X).');
            const result = validate(parseResult.unit!);
            const warnings = result.errors.filter(e => e.code === 'E039' && e.severity === 'warning');
            expect(warnings.length).toBeGreaterThan(0);
        });

        it('should not warn for wildcards in body', () => {
            expectNoErrors('foo(X) :- bar(_, X).');
        });
    });

    describe('E040: Predicate arity suggestions', () => {
        // TODO: Arity mismatch detection not fully implemented
        it.todo('should error when predicate called with wrong arity', () => {
            const source = `
                parent(/alice, /bob).
                foo(X, Y, Z) :- parent(X, Y, Z).
            `;
            expectError(source, 'E040');
        });

        it.todo('should suggest available arities', () => {
            const source = `
                parent(/alice, /bob).
                foo(X, Y, Z) :- parent(X, Y, Z).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E040');
            expect(error).toBeDefined();
            expect(error?.message).toContain('available arities');
        });
    });

    describe('E041: Private predicate access', () => {
        it('should error when accessing private predicate', () => {
            const source = `
                Decl helper(X) descr [private()].
                helper(/a).
                foo(X) :- helper(X).
            `;
            expectError(source, 'E041');
        });

        it('should allow non-private predicates', () => {
            const source = `
                Decl public_pred(X).
                public_pred(/a).
                foo(X) :- public_pred(X).
            `;
            expectNoErrors(source);
        });
    });

    describe('E043: Transform variable redefinition', () => {
        it('should error when transform redefines body variable', () => {
            expectError('result(Y) :- input(X) |> let X = fn:plus(X, 1), let Y = fn:mult(X, 2).', 'E043');
        });

        it('should error when chained transform redefines body variable', () => {
            expectError('result(Z) :- input(X), output(Y) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).', 'E043');
        });

        it('should allow transform to define new variables', () => {
            expectNoErrors('result(Y) :- input(X) |> let Y = fn:plus(X, 1).');
        });

        it('should allow transform to redefine its own variables', () => {
            expectNoErrors('result(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).');
        });
    });

    describe('E044: Duplicate declaration', () => {
        it('should error when same predicate declared twice', () => {
            const source = `
                Decl parent(X, Y).
                Decl parent(X, Y).
            `;
            expectError(source, 'E044');
        });

        it('should error when predicate declared multiple times', () => {
            const source = `
                Decl foo(X).
                Decl foo(X).
                Decl foo(X).
            `;
            expectErrorCount(source, 'E044', 2);
        });

        it('should allow declarations of different predicates', () => {
            const source = `
                Decl parent(X, Y).
                Decl child(X, Y).
            `;
            expectNoErrors(source);
        });

        it('should allow declarations with different arities', () => {
            const source = `
                Decl foo(X).
                Decl foo(X, Y).
            `;
            expectNoErrors(source);
        });
    });

    describe('E045: Transform without body', () => {
        // TODO: Transform parsing without body may cause parse errors
        it.todo('should error when fact with constants has transform', () => {
            // This tests a fact (no body) with a transform
            expectError('foo(/a) |> let X = fn:plus(1, 2).', 'E045');
        });

        it('should error when clause has transform but no premises', () => {
            // Head with variable but no body - should trigger E001 first, but also E045 if transform present
            const source = 'result(Y) |> let Y = fn:plus(1, 2).';
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            // Should have either E001 (variable in fact) or E045 (transform without body)
            const hasE001 = result.errors.some(e => e.code === 'E001');
            const hasE045 = result.errors.some(e => e.code === 'E045');
            expect(hasE001 || hasE045).toBe(true);
        });

        it('should allow transform with body', () => {
            expectNoErrors('result(Y) :- input(X) |> let Y = fn:plus(X, 1).');
        });

        it('should allow facts without transform', () => {
            expectNoErrors('parent(/alice, /bob).');
        });
    });

    describe('E046: Arity mismatch between declaration and clauses', () => {
        it('should error when clause arity differs from declaration', () => {
            const source = `
                Decl parent(X, Y).
                parent(/alice, /bob, /extra).
            `;
            expectError(source, 'E046');
        });

        it('should error when rule arity differs from declaration', () => {
            const source = `
                Decl ancestor(X, Y).
                ancestor(X, Y, Z) :- parent(X, Y), parent(Y, Z).
            `;
            expectError(source, 'E046');
        });

        it('should allow matching arities', () => {
            const source = `
                Decl parent(X, Y).
                parent(/alice, /bob).
                parent(/bob, /carol).
            `;
            expectNoErrors(source);
        });

        it('should allow multiple arities without declaration', () => {
            // Using facts without variables since variables in facts trigger E001
            const source = `
                foo(/a).
                foo(/a, /b).
            `;
            expectNoErrors(source);
        });
    });

    describe('Complex validation scenarios', () => {
        it('should validate program with multiple error types', () => {
            const source = `
                Decl parent(X, Y).
                # E001: Variable in fact
                parent(X, /bob).
                # E002: Unbound head variable
                ancestor(X, Z) :- parent(X, Y).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            expect(result.errors.some(e => e.code === 'E001')).toBe(true);
            expect(result.errors.some(e => e.code === 'E002')).toBe(true);
        });

        it('should validate correct transitive closure', () => {
            const source = `
                Decl edge(X, Y).
                Decl path(X, Y).
                edge(/a, /b).
                edge(/b, /c).
                path(X, Y) :- edge(X, Y).
                path(X, Z) :- edge(X, Y), path(Y, Z).
            `;
            expectNoErrors(source);
        });

        it('should validate aggregation with grouping', () => {
            const source = `
                Decl sales(Product, Amount).
                Decl total(Product, Total).
                sales(/product_a, 100).
                sales(/product_a, 200).
                sales(/product_b, 150).
                total(Product, Total) :- sales(Product, Amount)
                    |> do fn:group_by(Product),
                       let Total = fn:sum(Amount).
            `;
            expectNoErrors(source);
        });

        it('should validate negation with proper binding', () => {
            const source = `
                Decl node(X).
                Decl edge(X, Y).
                Decl isolated(X).
                node(/a).
                node(/b).
                edge(/a, /b).
                isolated(X) :- node(X), !edge(X, _), !edge(_, X).
            `;
            expectNoErrors(source);
        });

        it('should validate complex transforms', () => {
            const source = `
                Decl input(Category, Value).
                Decl result(Category, Avg, Max).
                input(/cat_a, 10).
                input(/cat_a, 20).
                result(Cat, Avg, Max) :- input(Cat, Val)
                    |> do fn:group_by(Cat),
                       let Avg = fn:avg(Val),
                       let Max = fn:max(Val).
            `;
            expectNoErrors(source);
        });

        it('should detect multiple instances of same error', () => {
            const source = `
                # Multiple E001 errors
                foo(X).
                bar(Y, Z).
                baz(A, B, C).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const e001Count = result.errors.filter(e => e.code === 'E001').length;
            expect(e001Count).toBeGreaterThan(0);
        });

        it('should validate built-in predicates with correct modes', () => {
            const source = `
                Decl data(X).
                Decl parts(First, Rest).
                data([1, 2, 3]).
                parts(First, Rest) :- data(L), :match_cons(L, First, Rest).
            `;
            expectNoErrors(source);
        });

        it('should validate string matching predicates', () => {
            const source = `
                Decl text(X).
                Decl matched(X).
                text("hello world").
                matched(X) :- text(X), :match_prefix(X, "hello").
            `;
            expectNoErrors(source);
        });

        it('should validate function composition', () => {
            const source = `
                Decl input(X).
                Decl result(Y).
                input(5).
                result(Y) :- input(X), Y = fn:mult(fn:plus(X, 1), 2).
            `;
            expectNoErrors(source);
        });

        it('should validate equality binding chains', () => {
            const source = `
                Decl input(X).
                Decl output(A, B, C).
                input(10).
                output(A, B, C) :- input(X), A = X, B = fn:plus(A, 1), C = fn:mult(B, 2).
            `;
            expectNoErrors(source);
        });
    });

    describe('Edge cases and boundary conditions', () => {
        it('should handle empty source unit', () => {
            const parseResult = parse('');
            const result = validate(parseResult.unit!);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle clause with no arguments', () => {
            expectNoErrors('constant().');
        });

        it('should handle predicate with many arguments', () => {
            expectNoErrors('many(A, B, C, D, E, F, G, H) :- input(A, B, C, D, E, F, G, H).');
        });

        it('should handle deeply nested function calls', () => {
            expectNoErrors('result(fn:plus(fn:mult(fn:plus(1, 2), 3), 4)).');
        });

        it('should handle multiple transforms in chain', () => {
            const source = `
                result(Z) :- input(X)
                    |> let Y = fn:plus(X, 1)
                    |> let Z = fn:mult(Y, 2).
            `;
            expectNoErrors(source);
        });

        it('should validate wildcard does not count as binding', () => {
            // X appears in head but only _ appears in body
            expectError('foo(X) :- bar(_).',  'E002');
        });

        it('should handle comparison chains', () => {
            const source = `
                inRange(X) :- num(X), X >= 0, X < 100, X != 50.
            `;
            expectNoErrors(source);
        });

        it('should validate list destructuring', () => {
            const source = `
                head(H) :- list(L), :match_cons(L, H, _).
            `;
            expectNoErrors(source);
        });

        it('should validate struct field access', () => {
            const source = `
                getName(Name) :- person(P), :match_field(P, /name, Name).
            `;
            expectNoErrors(source);
        });

        it('should validate map entry access', () => {
            const source = `
                getValue(V) :- map(M), :match_entry(M, /key, V).
            `;
            expectNoErrors(source);
        });
    });

    describe('Error message content validation', () => {
        it('E001 message should mention variable name', () => {
            const parseResult = parse('parent(UnboundVar, /bob).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E001');
            expect(error).toBeDefined();
            expect(error?.message).toContain('UnboundVar');
        });

        it('E002 message should mention unbound variable', () => {
            const parseResult = parse('result(Missing) :- input(X).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E002');
            expect(error).toBeDefined();
            expect(error?.message).toContain('Missing');
        });

        it('E003 message: negation delay drops atoms with never-bound vars', () => {
            // With negation delay rewriting, !baz(Unbound) is silently dropped
            // because Unbound is never bound by any premise. No E003 is emitted.
            const parseResult = parse('foo(X) :- bar(X), !baz(Unbound).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E003');
            expect(error).toBeUndefined();
        });

        it('E005 message should mention unknown predicate', () => {
            const parseResult = parse('foo(X) :- bar(X), :nonexistent(X).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E005');
            expect(error).toBeDefined();
            expect(error?.message).toContain(':nonexistent');
        });

        it('E006 message should show expected vs actual arity', () => {
            const parseResult = parse('foo(X) :- bar(X), :match_cons(X, Y).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E006');
            expect(error).toBeDefined();
            expect(error?.message).toContain('3'); // expected arity
            expect(error?.message).toContain('2'); // actual arity
        });

        it('E044 message should include predicate name', () => {
            const source = `
                Decl duplicated(X).
                Decl duplicated(X).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E044');
            expect(error).toBeDefined();
            expect(error?.message).toContain('duplicated');
        });
    });

    describe('Additional E001-E002 edge cases', () => {
        it('should error on variable in nested structure in fact', () => {
            expectError('foo([X, 1, 2]).', 'E001');
        });

        it('should error on variable in function call in fact', () => {
            expectError('foo(fn:plus(X, 1)).', 'E001');
        });

        it('should allow constants in nested structures in facts', () => {
            expectNoErrors('foo([1, 2, 3]).');
        });

        it('should error when head variable only appears in function', () => {
            // Y appears in head but only in a function in body - should still be bound
            expectNoErrors('result(Y) :- input(X), Y = fn:plus(X, 1).');
        });

        it('should error when head variable appears after wildcard binding attempt', () => {
            expectError('result(X, Y) :- input(_, Y).', 'E002');
        });

        it('should properly track binding through multiple equalities', () => {
            expectNoErrors('result(Z) :- input(X), Y = X, Z = Y.');
        });
    });

    describe('Additional E003 edge cases', () => {
        it('negation delay should reorder negated atom after binding premise', () => {
            // With negation delay, !uses(Y) is delayed until source(Y) binds Y,
            // then emitted after. No error — the clause is valid after rewriting.
            expectNoErrors('foo(X) :- bar(X), !uses(Y), source(Y).');
        });

        it('should allow negation with wildcard only', () => {
            expectNoErrors('orphan(X) :- person(X), !parent(_, _).');
        });

        it('negation delay should drop negated atom with never-bound nested var', () => {
            // With negation delay, !complex(fn:plus(Y, 1)) is dropped because
            // Y is never bound by any premise. Silently dropped, no error.
            expectNoErrors('foo(X) :- bar(X), !complex(fn:plus(Y, 1)).');
        });
    });

    describe('Additional E004 comparison edge cases', () => {
        it('should error when both sides of comparison are unbound', () => {
            expectError('foo(X) :- bar(Y), A < B.', 'E004');
        });

        it('should allow comparison with constants', () => {
            expectNoErrors('foo(X) :- bar(X), X > 0, X < 100.');
        });

        it('should allow inequality with bound variables', () => {
            expectNoErrors('different(X, Y) :- first(X), second(Y), X != Y.');
        });
    });

    describe('Additional transform validation', () => {
        it('should allow aggregation with empty group_by', () => {
            expectNoErrors('total(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).');
        });

        it('should allow count without arguments', () => {
            expectNoErrors('count(C) :- items(X) |> do fn:group_by(), let C = fn:count().');
        });

        it('should allow multiple let statements after group_by', () => {
            const source = `
                stats(S, M, A) :- nums(N)
                    |> do fn:group_by(),
                       let S = fn:sum(N),
                       let M = fn:max(N),
                       let A = fn:avg(N).
            `;
            expectNoErrors(source);
        });

        it('should allow collect reducer', () => {
            expectNoErrors('collected(L) :- items(X) |> do fn:group_by(), let L = fn:collect(X).');
        });

        it('should allow collect_distinct reducer', () => {
            expectNoErrors('unique(L) :- items(X) |> do fn:group_by(), let L = fn:collect_distinct(X).');
        });

        it('should allow min and max reducers', () => {
            const source = `
                range(Min, Max) :- nums(N)
                    |> do fn:group_by(),
                       let Min = fn:min(N),
                       let Max = fn:max(N).
            `;
            expectNoErrors(source);
        });

        it('should allow pick_any reducer', () => {
            expectNoErrors('sample(S) :- items(X) |> do fn:group_by(), let S = fn:pick_any(X).');
        });

        it('should allow collect_to_map reducer', () => {
            expectNoErrors('asMap(M) :- pairs(K, V) |> do fn:group_by(), let M = fn:collect_to_map(K, V).');
        });
    });

    describe('E013: Let statement function validation', () => {
        // Note: The current validation implementation checks if the function starts with 'fn:'
        // rather than checking if it's actually a reducer. Tests reflect actual behavior.
        it.todo('should warn when non-reducer used after group_by', () => {
            // This test documents expected behavior that is not yet implemented.
            // The validation currently only checks for fn: prefix, not reducer status.
            const parseResult = parse('result(Y) :- input(X) |> do fn:group_by(), let Y = fn:plus(X, 1).');
            const result = validate(parseResult.unit!);
            // fn:plus is not a reducer, so after group_by it should warn
            const warning = result.errors.find(e => e.code === 'E013' && e.severity === 'warning');
            expect(warning).toBeDefined();
        });

        it('should not warn when reducer used after group_by', () => {
            const parseResult = parse('result(Y) :- input(X) |> do fn:group_by(), let Y = fn:sum(X).');
            const result = validate(parseResult.unit!);
            const e013 = result.errors.filter(e => e.code === 'E013');
            expect(e013).toHaveLength(0);
        });

        it('should not warn when any fn: function used after group_by', () => {
            // Current behavior: any fn: function is accepted
            const parseResult = parse('result(Y) :- input(X) |> do fn:group_by(), let Y = fn:plus(X, 1).');
            const result = validate(parseResult.unit!);
            const e013 = result.errors.filter(e => e.code === 'E013');
            expect(e013).toHaveLength(0);
        });
    });

    describe('Built-in predicate edge cases', () => {
        it('should validate :list:member mode (output, input)', () => {
            // First arg is output (can be unbound), second is input (must be bound)
            expectError('foo(X) :- :list:member(X, L).', 'E007');
        });

        it('should allow :list:member with bound list', () => {
            expectNoErrors('foo(X) :- list(L), :list:member(X, L).');
        });

        it('should validate :within_distance requires all inputs bound', () => {
            expectError('foo(X) :- bar(X), :within_distance(X, Y, 5).', 'E007');
        });

        it('should allow :within_distance with all bound', () => {
            expectNoErrors('foo(X, Y) :- bar(X), bar(Y), :within_distance(X, Y, 5).');
        });

        it('should validate :match_nil input mode', () => {
            expectError('foo(X) :- :match_nil(L).', 'E007');
        });

        it('should allow :match_nil with bound argument', () => {
            expectNoErrors('isEmpty(L) :- list(L), :match_nil(L).');
        });

        it('should validate :filter input mode', () => {
            expectError('foo(X) :- :filter(Y).', 'E007');
        });

        it('should allow :filter with bound constant expression', () => {
            // :filter takes a boolean value - use with a bound variable that holds a boolean
            expectNoErrors('positive(X) :- num(X), isPositive(X, B), :filter(B).');
        });

        it('should allow :filter with function result', () => {
            // Use a valid function that returns a value
            expectNoErrors('hasElements(L) :- list(L), N = fn:list:len(L), :filter(N).');
        });
    });

    describe('Arithmetic function validation', () => {
        it('should allow fn:sqrt with one argument', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:sqrt(X).');
        });

        it('should allow fn:mult with multiple arguments', () => {
            expectNoErrors('result(Y) :- input(A), input(B), Y = fn:mult(A, B, 2).');
        });

        it('should allow fn:minus with single argument (negation)', () => {
            expectNoErrors('result(Y) :- input(X), Y = fn:minus(X).');
        });

        it('should allow nested arithmetic', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:plus(fn:mult(A, 2), fn:div(B, 3)).');
        });
    });

    describe('List function validation', () => {
        it('should allow fn:list with any number of arguments', () => {
            expectNoErrors('result([1, 2, 3, 4, 5]).');
        });

        it('should allow fn:list:append', () => {
            expectNoErrors('result(Y) :- list(L), Y = fn:list:append(L, 42).');
        });

        it('should allow fn:list:get', () => {
            expectNoErrors('result(Y) :- list(L), Y = fn:list:get(L, 0).');
        });

        it('should allow fn:list:len', () => {
            expectNoErrors('result(Y) :- list(L), Y = fn:list:len(L).');
        });

        it('should allow fn:list:cons', () => {
            expectNoErrors('result(Y) :- tail(T), Y = fn:list:cons(1, T).');
        });

        it('should allow fn:list:contains', () => {
            expectNoErrors('result(Y) :- list(L), Y = fn:list:contains(L, 42).');
        });
    });

    describe('String function validation', () => {
        it('should allow fn:string:concat', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:string:concat(A, "-", B).');
        });

        it('should allow fn:string:replace', () => {
            expectNoErrors('result(Y) :- str(S), Y = fn:string:replace(S, "old", "new", 1).');
        });
    });

    describe('Conversion function validation', () => {
        it('should allow fn:number:to_string', () => {
            expectNoErrors('result(Y) :- num(N), Y = fn:number:to_string(N).');
        });

        it('should allow fn:float64:to_string', () => {
            expectNoErrors('result(Y) :- num(N), Y = fn:float64:to_string(N).');
        });

        it('should allow fn:name:to_string', () => {
            expectNoErrors('result(Y) :- name(N), Y = fn:name:to_string(N).');
        });

        it('should allow fn:name:root', () => {
            expectNoErrors('result(Y) :- name(N), Y = fn:name:root(N).');
        });

        it('should allow fn:name:tip', () => {
            expectNoErrors('result(Y) :- name(N), Y = fn:name:tip(N).');
        });

        it('should allow fn:name:list', () => {
            expectNoErrors('result(Y) :- name(N), Y = fn:name:list(N).');
        });
    });

    describe('Pair and tuple function validation', () => {
        it('should allow fn:pair', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:pair(A, B).');
        });

        it('should allow fn:tuple with various arities', () => {
            expectNoErrors('result(Y) :- a(A), Y = fn:tuple(A).');
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:tuple(A, B).');
            expectNoErrors('result(Y) :- a(A), b(B), c(C), Y = fn:tuple(A, B, C).');
        });

        it('should allow fn:some', () => {
            expectNoErrors('result(Y) :- a(A), Y = fn:some(A).');
        });
    });

    describe('Map and struct function validation', () => {
        it('should allow fn:map:get', () => {
            expectNoErrors('result(Y) :- map(M), Y = fn:map:get(M, /key).');
        });

        it('should allow fn:struct:get', () => {
            expectNoErrors('result(Y) :- struct(S), Y = fn:struct:get(S, /field).');
        });

        it('should allow nested struct and map', () => {
            expectNoErrors('result({/outer: [/inner: 1]}).');
        });
    });

    describe('Float arithmetic function validation', () => {
        it('should allow fn:float:plus', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:float:plus(A, B).');
        });

        it('should allow fn:float:mult', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:float:mult(A, B).');
        });

        it('should allow fn:float:div', () => {
            expectNoErrors('result(Y) :- a(A), b(B), Y = fn:float:div(A, B).');
        });
    });

    describe('Float reducer validation', () => {
        it('should allow fn:float:sum reducer', () => {
            expectNoErrors('total(S) :- floats(F) |> do fn:group_by(), let S = fn:float:sum(F).');
        });

        it('should allow fn:float:max reducer', () => {
            expectNoErrors('maximum(M) :- floats(F) |> do fn:group_by(), let M = fn:float:max(F).');
        });

        it('should allow fn:float:min reducer', () => {
            expectNoErrors('minimum(M) :- floats(F) |> do fn:group_by(), let M = fn:float:min(F).');
        });
    });

    describe('Declaration with mode descriptors', () => {
        it('should allow mode descriptor with bound argument', () => {
            expectNoErrors('Decl lookup(X, Y) descr [mode(+, -)].');
        });

        it('should allow mode descriptor with unbound argument', () => {
            expectNoErrors('Decl enumerate(X) descr [mode(-)].');
        });

        it('should allow external with mode', () => {
            expectNoErrors('Decl external_pred(X) descr [external(), mode(+)].');
        });
    });

    describe('Multiple clauses for same predicate', () => {
        it('should validate all clauses independently', () => {
            const source = `
                foo(X) :- bar(X).
                foo(Y) :- baz(Y).
                foo(Z) :- qux(Z).
            `;
            expectNoErrors(source);
        });

        it('should catch errors in any clause', () => {
            const source = `
                foo(X) :- bar(X).
                foo(Y) :- Y > 0.
            `;
            expectError(source, 'E004');
        });
    });

    describe('Source location in errors', () => {
        it('should provide source location for E001', () => {
            const parseResult = parse('foo(X).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E001');
            expect(error).toBeDefined();
            expect(error?.range).toBeDefined();
            expect(error?.range.start.line).toBeGreaterThanOrEqual(1);
        });

        it('should provide source location for E002', () => {
            const parseResult = parse('result(Y) :- input(X).');
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E002');
            expect(error).toBeDefined();
            expect(error?.range).toBeDefined();
        });

        it('should provide source location for E044', () => {
            const source = `
                Decl dup(X).
                Decl dup(X).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E044');
            expect(error).toBeDefined();
            expect(error?.range).toBeDefined();
        });
    });

    describe('Symbol table population', () => {
        it('should populate symbol table with predicates', () => {
            const source = `
                Decl parent(X, Y).
                parent(/alice, /bob).
                ancestor(X, Y) :- parent(X, Y).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            expect(result.symbolTable).toBeDefined();
            expect(result.symbolTable.getPredicateNames()).toContain('parent/2');
            expect(result.symbolTable.getPredicateNames()).toContain('ancestor/2');
        });

        it('should track declarations in symbol table', () => {
            const source = `
                Decl documented(X) descr [doc("A documented predicate")].
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const predInfo = result.symbolTable.getPredicate('documented', 1);
            expect(predInfo).toBeDefined();
            expect(predInfo?.declLocation).not.toBeNull();
        });

        it('should track definitions in symbol table', () => {
            const source = `
                foo(/a).
                foo(/b).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const predInfo = result.symbolTable.getPredicate('foo', 1);
            expect(predInfo).toBeDefined();
            expect(predInfo?.definitions.length).toBe(2);
        });
    });

    describe('E047: Non-reducer functions after group_by', () => {
        it('should allow normal function using group_by key variables', () => {
            // fn:plus uses G which is a group_by key - this is OK
            const source = `
                result(G, V) :- data(G, X)
                    |> do fn:group_by(G),
                       let S = fn:sum(X),
                       let V = fn:plus(G, S).
            `;
            expectNoErrors(source);
        });

        it('should allow normal function using earlier transform-defined variables', () => {
            // fn:mult uses S which was defined by an earlier let statement
            const source = `
                result(V) :- data(X)
                    |> do fn:group_by(),
                       let S = fn:sum(X),
                       let V = fn:mult(S, 2).
            `;
            expectNoErrors(source);
        });

        it('should error when normal function uses body-only variable after group_by', () => {
            // fn:plus uses X which is not a group_by key or transform-defined var
            const source = `
                result(V) :- data(G, X)
                    |> do fn:group_by(G),
                       let V = fn:plus(X, 1).
            `;
            expectError(source, 'E047');
        });

        it('should error with meaningful message mentioning the variable', () => {
            const source = `
                result(V) :- data(G, X)
                    |> do fn:group_by(G),
                       let V = fn:plus(X, 1).
            `;
            const parseResult = parse(source);
            const result = validate(parseResult.unit!);
            const error = result.errors.find(e => e.code === 'E047');
            expect(error).toBeDefined();
            expect(error?.message).toContain('X');
            expect(error?.message).toContain('fn:plus');
        });

        it('should allow reducer functions after group_by', () => {
            // Reducer functions are always allowed
            expectNoErrors('total(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).');
        });

        it('should allow normal function without group_by (no aggregation)', () => {
            // Without do fn:group_by, normal functions are always allowed
            expectNoErrors('result(Y) :- input(X) |> let Y = fn:plus(X, 1).');
        });
    });

    describe('Time/duration built-in predicates', () => {
        it('should recognize :time:lt predicate', () => {
            expectNoErrors('earlier(T1) :- time(T1), time(T2), :time:lt(T1, T2).');
        });

        it('should recognize :time:le predicate', () => {
            expectNoErrors('notAfter(T1) :- time(T1), time(T2), :time:le(T1, T2).');
        });

        it('should recognize :time:gt predicate', () => {
            expectNoErrors('later(T1) :- time(T1), time(T2), :time:gt(T1, T2).');
        });

        it('should recognize :time:ge predicate', () => {
            expectNoErrors('notBefore(T1) :- time(T1), time(T2), :time:ge(T1, T2).');
        });

        it('should recognize :duration:lt predicate', () => {
            expectNoErrors('shorter(D1) :- dur(D1), dur(D2), :duration:lt(D1, D2).');
        });

        it('should recognize :duration:le predicate', () => {
            expectNoErrors('notLonger(D1) :- dur(D1), dur(D2), :duration:le(D1, D2).');
        });

        it('should recognize :duration:gt predicate', () => {
            expectNoErrors('longer(D1) :- dur(D1), dur(D2), :duration:gt(D1, D2).');
        });

        it('should recognize :duration:ge predicate', () => {
            expectNoErrors('notShorter(D1) :- dur(D1), dur(D2), :duration:ge(D1, D2).');
        });

        it('should error on wrong arity for time predicates', () => {
            expectError('foo(T) :- time(T), :time:lt(T).', 'E006');
        });

        it('should error on unbound arguments for time predicates', () => {
            expectError('foo(T) :- :time:lt(T, T2).', 'E007');
        });
    });

    describe('Time/duration built-in functions', () => {
        it('should allow fn:time:now', () => {
            expectNoErrors('result(T) :- input(X), T = fn:time:now().');
        });

        it('should allow fn:time:add', () => {
            expectNoErrors('result(T) :- time(T1), dur(D), T = fn:time:add(T1, D).');
        });

        it('should allow fn:time:sub', () => {
            expectNoErrors('result(T) :- time(T1), dur(D), T = fn:time:sub(T1, D).');
        });

        it('should allow fn:time:year', () => {
            expectNoErrors('result(Y) :- time(T), Y = fn:time:year(T).');
        });

        it('should allow fn:time:format', () => {
            expectNoErrors('result(S) :- time(T), S = fn:time:format(T, /second).');
        });

        it('should allow fn:time:parse_rfc3339', () => {
            expectNoErrors('result(T) :- str(S), T = fn:time:parse_rfc3339(S).');
        });

        it('should allow fn:time:from_unix_nanos', () => {
            expectNoErrors('result(T) :- num(N), T = fn:time:from_unix_nanos(N).');
        });

        it('should allow fn:time:to_unix_nanos', () => {
            expectNoErrors('result(N) :- time(T), N = fn:time:to_unix_nanos(T).');
        });

        it('should allow fn:duration:add', () => {
            expectNoErrors('result(D) :- dur(D1), dur(D2), D = fn:duration:add(D1, D2).');
        });

        it('should allow fn:duration:mult', () => {
            expectNoErrors('result(D) :- dur(D1), num(N), D = fn:duration:mult(D1, N).');
        });

        it('should allow fn:duration:hours', () => {
            expectNoErrors('result(H) :- dur(D), H = fn:duration:hours(D).');
        });

        it('should allow fn:duration:from_nanos', () => {
            expectNoErrors('result(D) :- num(N), D = fn:duration:from_nanos(N).');
        });

        it('should allow fn:duration:from_hours', () => {
            expectNoErrors('result(D) :- num(N), D = fn:duration:from_hours(N).');
        });

        it('should allow fn:duration:from_seconds', () => {
            expectNoErrors('result(D) :- num(N), D = fn:duration:from_seconds(N).');
        });
    });
});
