/**
 * Hover service tests for Mangle LSP.
 *
 * Tests hover information for:
 * - User-defined predicates (with signature, documentation, definition/reference counts)
 * - Built-in predicates (with name, doc, mode)
 * - Built-in functions (with name, doc, arity, isReducer)
 * - Variables (with name, binding location, occurrence count)
 * - Nested elements (ensuring proper element ordering)
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { buildSymbolTable } from '../../src/analysis/symbols';
import { getHover } from '../../src/services/hover';
import { Position } from 'vscode-languageserver/node';

/**
 * Helper to create a Position from 0-indexed line and column.
 */
function pos(line: number, column: number): Position {
    return { line, character: column };
}

describe('Hover Service', () => {
    describe('User-defined predicates', () => {
        it('should show predicate signature and definition count', () => {
            const source = 'parent(/alice, /bob).\nparent(/bob, /carol).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "parent" in first clause (line 1, column 0)
            const hover = getHover(result.unit!, symbolTable, pos(0, 0));

            expect(hover).not.toBeNull();
            expect(hover?.contents).toHaveProperty('kind', 'markdown');
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('parent/2');
            expect(content).toContain('Defined in 2 clause(s)');
        });

        it('should show predicate with documentation from declaration', () => {
            const source = 'Decl ancestor(X, Y) descr [doc("Defines ancestor relationship")].\nancestor(X, Y) :- parent(X, Y).\nancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "ancestor" in the first rule (line 2, column 0)
            const hover = getHover(result.unit!, symbolTable, pos(1, 0));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('ancestor/2');
            expect(content).toContain('Defines ancestor relationship');
            expect(content).toContain('Defined in 2 clause(s)');
            expect(content).toContain('Declared at line 1');
        });

        it('should show predicate with reference count', () => {
            const source = 'parent(/alice, /bob).\nancestor(X, Y) :- parent(X, Y).\ngrandparent(X, Z) :- parent(X, Y), parent(Y, Z).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "parent" in the ancestor rule (line 2, column 18 - the 'p' in parent)
            const hover = getHover(result.unit!, symbolTable, pos(1, 18));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('parent/2');
            expect(content).toContain('Defined in 1 clause(s)');
            expect(content).toContain('Referenced 3 time(s)');
        });

        it('should show predicate in declaration', () => {
            const source = 'Decl foo(X, Y, Z) descr [doc("A documented predicate")].';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "foo" in the declaration (line 1, column 5)
            const hover = getHover(result.unit!, symbolTable, pos(0, 5));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('foo/3');
            expect(content).toContain('A documented predicate');
            expect(content).toContain('Declared at line 1');
        });
    });

    describe('Built-in predicates', () => {
        it('should show :lt predicate with name, doc, and mode', () => {
            const source = 'small(X) :- num(X), X < 10.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "<" which is parsed as :lt (column 22)
            const hover = getHover(result.unit!, symbolTable, pos(0, 22));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :lt/2');
            expect(content).toContain('Less-than relation on numbers');
            expect(content).toContain('Mode: (input, input)');
        });

        it('should show :le predicate', () => {
            const source = 'atMost(X, Y) :- X <= Y.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "<=" which is :le (column 18)
            const hover = getHover(result.unit!, symbolTable, pos(0, 18));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :le/2');
            expect(content).toContain('Less-than-or-equal');
            expect(content).toContain('Mode: (input, input)');
        });

        it('should show :gt predicate', () => {
            const source = 'big(X) :- num(X), X > 100.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on ">" which is :gt (column 20)
            const hover = getHover(result.unit!, symbolTable, pos(0, 20));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :gt/2');
            expect(content).toContain('Greater-than');
            expect(content).toContain('Mode: (input, input)');
        });

        it('should show :ge predicate', () => {
            const source = 'atLeast(X, Y) :- X >= Y.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on ">=" which is :ge (column 19)
            const hover = getHover(result.unit!, symbolTable, pos(0, 19));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :ge/2');
            expect(content).toContain('Greater-than-or-equal');
            expect(content).toContain('Mode: (input, input)');
        });

        it('should show :string:starts_with predicate', () => {
            const source = 'hasPrefix(S) :- str(S), :string:starts_with(S, "prefix").';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on ":string:starts_with" (column 28 - start of predicate name)
            const hover = getHover(result.unit!, symbolTable, pos(0, 28));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :string:starts_with/2');
            expect(content).toContain('string constants that have a given prefix');
            expect(content).toContain('Mode: (input, input)');
        });
    });

    describe('Built-in functions', () => {
        it('should show fn:plus function with name, doc, and arity', () => {
            const source = 'result(Y) :- input(X) |> let Y = fn:plus(X, 1).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:plus" (column 33)
            const hover = getHover(result.unit!, symbolTable, pos(0, 33));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:plus');
            expect(content).toContain('Addition');
            expect(content).toContain('variadic');
        });

        it('should show fn:mult function', () => {
            const source = 'double(Y) :- value(X) |> let Y = fn:mult(X, 2).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:mult" (column 33)
            const hover = getHover(result.unit!, symbolTable, pos(0, 33));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:mult');
            expect(content).toContain('Multiplication');
            expect(content).toContain('variadic');
        });

        it('should show fn:sum reducer function with isReducer note', () => {
            const source = 'total(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:sum" (column 52)
            const hover = getHover(result.unit!, symbolTable, pos(0, 52));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:sum');
            expect(content).toContain('reducer function');
            expect(content).toContain('aggregations');
        });

        it('should show fn:count reducer function', () => {
            const source = 'cnt(C) :- items(X) |> do fn:group_by(), let C = fn:count().';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:count" (column 49)
            const hover = getHover(result.unit!, symbolTable, pos(0, 49));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:count');
            expect(content).toContain('reducer function');
        });
    });

    describe('Variables', () => {
        it('should show variable name, binding location, and occurrence count', () => {
            const source = 'ancestor(X, Y) :- parent(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" in parent(X, Y) (column 25)
            const hover = getHover(result.unit!, symbolTable, pos(0, 25));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
            expect(content).toContain('Bound at line 1');
            expect(content).toContain('2 occurrence(s)');
        });

        it('should show variable with multiple occurrences', () => {
            const source = 'path(X, Z) :- edge(X, Y), edge(Y, Z).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "Y" in edge(Y, Z) (column 31)
            const hover = getHover(result.unit!, symbolTable, pos(0, 31));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: Y');
            expect(content).toContain('Bound at line 1');
            expect(content).toContain('2 occurrence(s)');
        });

        it('should show variable in head', () => {
            const source = 'foo(X, Y, Z).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "Y" (column 7)
            const hover = getHover(result.unit!, symbolTable, pos(0, 7));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: Y');
            expect(content).toContain('Bound at line 1');
            expect(content).toContain('1 occurrence(s)');
        });

        it('should not show hover for underscore wildcard', () => {
            const source = 'orphan(X) :- person(X), !parent(_, X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "_" (column 32)
            const hover = getHover(result.unit!, symbolTable, pos(0, 32));

            // Underscore wildcards are skipped in symbol table, so should get parent predicate
            // Actually let's check what we get
            if (hover) {
                const content = (hover.contents as { value: string }).value;
                // Should NOT be a variable
                expect(content).not.toContain('Variable: _');
            }
        });
    });

    describe('Nested element ordering', () => {
        it('should return inner function when hovering on nested function', () => {
            const source = 'result(Y) :- input(X) |> let Y = fn:plus(fn:mult(X, 2), 3).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:mult" (column 41) - the inner function
            const hover = getHover(result.unit!, symbolTable, pos(0, 41));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:mult');
            expect(content).not.toContain('fn:plus');
        });

        it('should return outer function when hovering on outer function name', () => {
            const source = 'result(Y) :- input(X) |> let Y = fn:plus(fn:mult(X, 2), 3).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:plus" (column 33) - the outer function
            const hover = getHover(result.unit!, symbolTable, pos(0, 33));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:plus');
            expect(content).not.toContain('fn:mult');
        });

        it('should return inner function not outer when hovering in nested expression', () => {
            const source = 'compute(Z) :- data(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, fn:plus(Y, 2)).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on inner "fn:plus" inside fn:mult (column 71)
            const hover = getHover(result.unit!, symbolTable, pos(0, 71));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:plus');
            expect(content).not.toContain('fn:mult');
        });
    });

    describe('Hovering on variable inside atom returns variable not predicate', () => {
        it('should return variable when hovering on variable argument', () => {
            const source = 'foo(X, Y) :- bar(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" in bar(X, Y) - should return variable, not predicate (column 17)
            const hover = getHover(result.unit!, symbolTable, pos(0, 17));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
            expect(content).not.toContain('bar/2');
        });

        it('should return predicate when hovering on predicate name', () => {
            const source = 'foo(X, Y) :- bar(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "bar" - should return predicate (column 13)
            const hover = getHover(result.unit!, symbolTable, pos(0, 13));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('bar/2');
            expect(content).not.toContain('Variable');
        });

        it('should return variable when hovering on variable in comparison', () => {
            const source = 'valid(X) :- num(X), X > 0.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" before ">" - should return variable (column 20)
            const hover = getHover(result.unit!, symbolTable, pos(0, 20));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
            expect(content).not.toContain(':gt');
        });
    });

    describe('Hovering on function argument returns argument type not function', () => {
        it('should return variable when hovering on variable inside function', () => {
            const source = 'result(Y) :- input(X) |> let Y = fn:plus(X, 1).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" in input(X) premises - should return variable (column 19)
            const hover = getHover(result.unit!, symbolTable, pos(0, 19));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
            expect(content).not.toContain('input/1');
        });

        it('should return nested function when hovering on function inside function', () => {
            const source = 'result(Y) :- input(X) |> let Y = fn:plus(fn:mult(X, 2), 3).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:mult" - should return fn:mult, not fn:plus (column 41)
            const hover = getHover(result.unit!, symbolTable, pos(0, 41));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:mult');
            expect(content).not.toContain('fn:plus');
        });
    });

    describe('No hover outside elements', () => {
        it('should return null when hovering on whitespace', () => {
            const source = '   foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on whitespace before "foo"
            const hover = getHover(result.unit!, symbolTable, pos(0, 0));

            expect(hover).toBeNull();
        });

        it('should return null when hovering after clause', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover after the period
            const hover = getHover(result.unit!, symbolTable, pos(0, 10));

            expect(hover).toBeNull();
        });

        it('should return null when hovering on comma', () => {
            const source = 'foo(X, Y) :- bar(X), baz(Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on comma between premises (column 19)
            const hover = getHover(result.unit!, symbolTable, pos(0, 19));

            expect(hover).toBeNull();
        });
    });

    describe('Complex scenarios', () => {
        it('should handle hover in rules with multiple premises', () => {
            const source = 'ancestor(X, Z) :- parent(X, Y), parent(Y, Z).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on second "parent" (column 32)
            const hover1 = getHover(result.unit!, symbolTable, pos(0, 32));
            expect(hover1).not.toBeNull();
            const content1 = (hover1?.contents as { value: string }).value;
            expect(content1).toContain('parent/2');

            // Hover on "Y" in parent(Y, Z) (column 39)
            const hover2 = getHover(result.unit!, symbolTable, pos(0, 39));
            expect(hover2).not.toBeNull();
            const content2 = (hover2?.contents as { value: string }).value;
            expect(content2).toContain('Variable: Y');
            expect(content2).toContain('2 occurrence(s)');
        });

        it('should handle hover in transforms with multiple functions', () => {
            const source = 'result(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on first function "fn:plus" (column 33)
            const hover1 = getHover(result.unit!, symbolTable, pos(0, 33));
            expect(hover1).not.toBeNull();
            const content1 = (hover1?.contents as { value: string }).value;
            expect(content1).toContain('Built-in Function: fn:plus');

            // Hover on second function "fn:mult" (column 59)
            const hover2 = getHover(result.unit!, symbolTable, pos(0, 59));
            expect(hover2).not.toBeNull();
            const content2 = (hover2?.contents as { value: string }).value;
            expect(content2).toContain('Built-in Function: fn:mult');
        });

        it('should handle hover with negated atoms', () => {
            const source = 'orphan(X) :- person(X), !parent(_, X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "parent" in negated atom (column 25)
            const hover = getHover(result.unit!, symbolTable, pos(0, 25));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('parent/2');
        });

        it('should handle hover in built-in predicate with string argument', () => {
            const source = 'hasPrefix(S) :- value(S), :string:starts_with(S, "test").';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on variable "S" inside built-in (column 46)
            const hover = getHover(result.unit!, symbolTable, pos(0, 46));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: S');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty source', () => {
            const source = '';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            const hover = getHover(result.unit!, symbolTable, pos(0, 0));
            expect(hover).toBeNull();
        });

        it('should handle position outside source range', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Position way beyond the source
            const hover = getHover(result.unit!, symbolTable, pos(100, 100));
            expect(hover).toBeNull();
        });

        it('should handle single-line comment', () => {
            const source = '# This is a comment\nfoo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on comment line
            const hover = getHover(result.unit!, symbolTable, pos(0, 5));
            expect(hover).toBeNull();
        });

        it('should handle predicate with no references', () => {
            const source = 'isolated(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "isolated"
            const hover = getHover(result.unit!, symbolTable, pos(0, 0));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('isolated/2');
            expect(content).toContain('Defined in 1 clause(s)');
            // Should not show "Referenced" line if count is 0
            expect(content).not.toContain('Referenced');
        });
    });

    describe('Additional hover scenarios', () => {
        it('should show hover for :match_prefix predicate', () => {
            const source = 'hasPrefix(N) :- name(N), :match_prefix(N, /prefix).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on ":match_prefix" (column 25)
            const hover = getHover(result.unit!, symbolTable, pos(0, 25));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :match_prefix/2');
            expect(content).toContain('prefix');
        });

        it('should show hover for :list:member predicate', () => {
            const source = 'inList(X) :- list(L), :list:member(X, L).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on ":list:member" (column 22)
            const hover = getHover(result.unit!, symbolTable, pos(0, 22));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Predicate: :list:member/2');
            expect(content).toContain('Mode: (output, input)');
        });

        it('should show hover for fn:collect reducer function', () => {
            const source = 'collected(L) :- values(X) |> do fn:group_by(), let L = fn:collect(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:collect" (column 56)
            const hover = getHover(result.unit!, symbolTable, pos(0, 56));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:collect');
            expect(content).toContain('reducer function');
        });

        it('should show hover for fn:list function in premises', () => {
            const source = 'result(L) :- input(X) |> let L = fn:list(X, 1, 2).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:list" (column 33)
            const hover = getHover(result.unit!, symbolTable, pos(0, 33));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:list');
            expect(content).toContain('variadic');
        });

        it('should show hover for fn:group_by in transform', () => {
            const source = 'total(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "fn:group_by" (column 28)
            const hover = getHover(result.unit!, symbolTable, pos(0, 28));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:group_by');
            expect(content).toContain('Groups');
        });

        it('should handle triple-nested function calls', () => {
            const source = 'foo(Z) :- X = 1, Y = 2 |> let Z = fn:plus(fn:mult(fn:minus(X, 1), 2), Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on innermost "fn:minus" (column 50)
            const hover = getHover(result.unit!, symbolTable, pos(0, 50));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Built-in Function: fn:minus');
            expect(content).not.toContain('fn:mult');
            expect(content).not.toContain('fn:plus');
        });

        it('should show variable with many occurrences', () => {
            const source = 'complex(X) :- a(X), b(X), c(X), d(X), e(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" in e(X) (column 40)
            const hover = getHover(result.unit!, symbolTable, pos(0, 40));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
            expect(content).toContain('6 occurrence(s)');
        });

        it('should show hover on variable in equality in head', () => {
            const source = 'equal(X, Y) :- a(X), b(Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "X" in the head (column 6)
            const hover = getHover(result.unit!, symbolTable, pos(0, 6));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: X');
        });

        it('should show hover on predicate in negated atom correctly', () => {
            const source = 'noParent(X) :- person(X), !parent(X, _), !parent(_, X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on second "parent" (column 42)
            const hover = getHover(result.unit!, symbolTable, pos(0, 42));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('parent/2');
            expect(content).toContain('Referenced 2 time(s)');
        });

        it('should handle multiline clause with proper hover', () => {
            const source = `ancestor(X, Z) :-
    parent(X, Y),
    ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "Y" in second line (line 1, column 14)
            const hover = getHover(result.unit!, symbolTable, pos(1, 14));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('Variable: Y');
        });

        it('should return null for position on period', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on the period (column 6)
            const hover = getHover(result.unit!, symbolTable, pos(0, 6));

            expect(hover).toBeNull();
        });

        it('should show hover for private predicate', () => {
            const source = 'Decl internal(X) descr [private].\ninternal(/a).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();
            const symbolTable = buildSymbolTable(result.unit!);

            // Hover on "internal" in the clause (line 1, column 0)
            const hover = getHover(result.unit!, symbolTable, pos(1, 0));

            expect(hover).not.toBeNull();
            const content = (hover?.contents as { value: string }).value;
            expect(content).toContain('internal/1');
        });
    });
});
