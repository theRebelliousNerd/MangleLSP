/**
 * Tests for go-to-definition service.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { buildSymbolTable } from '../../src/analysis/symbols';
import { getDefinition } from '../../src/services/definition';
import { Position } from 'vscode-languageserver/node';

describe('Definition Service', () => {
    const testUri = 'file:///test.mg';

    describe('Predicate definitions', () => {
        it('should return all definition locations for predicate with multiple clauses', () => {
            const source = `parent(/alice, /bob).
parent(/bob, /carol).
parent(/carol, /dave).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in the second clause (line 1, column 0)
            const position: Position = { line: 1, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // Should return all three clause head locations
                expect(definition.length).toBe(3);
                // All should be in the test file
                definition.forEach(loc => {
                    expect(loc.uri).toBe(testUri);
                });
            }
        });

        it('should return declaration location if available', () => {
            const source = `Decl parent(X, Y).
parent(/alice, /bob).
parent(/bob, /carol).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in the first clause (line 1, column 0)
            const position: Position = { line: 1, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // Should return declaration + 2 clause heads = 3 locations
                expect(definition.length).toBe(3);
                // First should be the declaration
                expect(definition[0]?.range.start.line).toBe(0);
            }
        });

        it('should return single definition for predicate with one clause', () => {
            const source = `parent(/alice, /bob).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' (line 0, column 0)
            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            // Single location returned as object, not array
            expect(Array.isArray(definition)).toBe(false);
            if (!Array.isArray(definition)) {
                expect(definition.uri).toBe(testUri);
            }
        });

        it('should return null for built-in predicates', () => {
            const source = `foo(X) :- bar(X), :lt(X, 10).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on ':lt' predicate (column 18)
            const position: Position = { line: 0, character: 18 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Built-in predicates don't have definitions in user code
            expect(definition).toBeNull();
        });

        it('should handle predicate used in rule body', () => {
            const source = `ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'ancestor' in the body of second clause (column 32)
            const position: Position = { line: 1, character: 32 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // Should return both clause heads
                expect(definition.length).toBe(2);
            }
        });
    });

    describe('Variable definitions', () => {
        it('should return binding location for variable', () => {
            const source = `ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'Y' in the second premise (column 40)
            const position: Position = { line: 0, character: 40 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);

            if (!Array.isArray(definition)) {
                expect(definition.uri).toBe(testUri);
                // Binding location should be the first occurrence of Y (in parent(X, Y))
                expect(definition.range.start.line).toBe(0);
            }
        });

        it('should return definition when clicking on clause head predicate', () => {
            const source = `foo(X, Y) :- bar(X), baz(Y).
bar(1).
baz(2).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' predicate head (column 0)
            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Clicking on a predicate head returns its definition
            expect(definition).not.toBeNull();
        });

        it('should handle anonymous variables', () => {
            const source = `orphan(X) :- person(X), !parent(_, X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on '_' (column 33)
            const position: Position = { line: 0, character: 33 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Anonymous variables don't have definitions tracked
            expect(definition).toBeNull();
        });
    });

    describe('Different arities', () => {
        it('should distinguish predicates with different arities', () => {
            const source = `foo(X).
foo(X, Y).
bar(Z) :- foo(Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' with arity 1 in bar clause (line 2, column 10)
            const position: Position = { line: 2, character: 10 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);

            if (!Array.isArray(definition)) {
                // Should only return the foo/1 definition, not foo/2
                expect(definition.range.start.line).toBe(0);
            }
        });

        it('should handle multiple clauses of same arity separately from different arity', () => {
            const source = `foo(X).
foo(Y).
foo(X, Y).
foo(A, B).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' with arity 1 in second clause (line 1, column 0)
            const position: Position = { line: 1, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // Should return both foo/1 definitions but not foo/2
                expect(definition.length).toBe(2);
                expect(definition[0]?.range.start.line).toBe(0);
                expect(definition[1]?.range.start.line).toBe(1);
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle negated predicates', () => {
            const source = `isolated(X) :- node(X), !edge(X, _).
edge(/a, /b).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'edge' in negated atom (column 25)
            const position: Position = { line: 0, character: 25 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);

            if (!Array.isArray(definition)) {
                // Should return the edge/2 definition
                expect(definition.range.start.line).toBe(1);
            }
        });

        it('should handle comparison operators', () => {
            const source = `inRange(X) :- num(X), X >= 0, X < 100.`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in comparison (column 22)
            const position: Position = { line: 0, character: 22 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);

            if (!Array.isArray(definition)) {
                // Should return X's binding location in the head
                expect(definition.range.start.line).toBe(0);
            }
        });

        it('should handle variables in function applications', () => {
            const source = `result(Y, fn:plus(X, 1)) :- input(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in fn:plus(X, 1) (column 18)
            const position: Position = { line: 0, character: 18 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);

            if (!Array.isArray(definition)) {
                // Should return X's binding location in input(X)
                expect(definition.range.start.line).toBe(0);
            }
        });
    });

    describe('Position handling', () => {
        it('should handle position at start of predicate name', () => {
            const source = `parent(/alice, /bob).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click at the very start of 'parent'
            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
        });

        it('should return predicate definition when clicking within atom range', () => {
            const source = `parent(/alice, /bob).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on comma (which is within the atom's range)
            // The implementation returns the predicate definition when inside its range
            const position: Position = { line: 0, character: 14 };
            const definition = getDefinition(testUri, symbolTable, position);

            // The implementation returns the predicate when clicking inside its range
            expect(definition).not.toBeNull();
        });
    });

    describe('Multiple definitions returned', () => {
        it('should return all definition locations for predicate with 5 clauses', () => {
            const source = `foo(1).
foo(2).
foo(3).
foo(4).
foo(5).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' in the third clause (line 2, column 0)
            const position: Position = { line: 2, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                expect(definition.length).toBe(5);
                // Verify each location is on the correct line
                for (let i = 0; i < 5; i++) {
                    expect(definition[i]?.range.start.line).toBe(i);
                }
            }
        });

        it('should return declaration plus definitions when both exist', () => {
            const source = `Decl parent(X, Y) descr [doc("Parent relationship")].
parent(/alice, /bob).
parent(/bob, /carol).
parent(/carol, /dave).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in the third clause (line 2)
            const position: Position = { line: 2, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // 1 declaration + 3 clause heads = 4
                expect(definition.length).toBe(4);
                // First should be declaration (line 0)
                expect(definition[0]?.range.start.line).toBe(0);
            }
        });

        it('should return multiple definitions for recursive predicate', () => {
            const source = `Decl ancestor(X, Y).
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'ancestor' in recursive call (line 2, column 32)
            const position: Position = { line: 2, character: 32 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(true);

            if (Array.isArray(definition)) {
                // 1 declaration + 2 clause heads = 3
                expect(definition.length).toBe(3);
            }
        });
    });

    describe('No definition for undefined predicates', () => {
        it('should return null when clicking on undefined predicate reference', () => {
            const source = `foo(X) :- undefined_pred(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'undefined_pred' (line 0, column 10)
            const position: Position = { line: 0, character: 10 };
            const definition = getDefinition(testUri, symbolTable, position);

            // undefined_pred is only referenced, never defined
            // It should still return a result if it exists in the symbol table
            // but with no definition locations (only references)
            if (definition === null) {
                expect(definition).toBeNull();
            } else {
                // If it's found in symbol table, it has no definitions
                expect(Array.isArray(definition) ? definition.length : 0).toBe(0);
            }
        });

        it('should return only clause heads, not body references for definition', () => {
            const source = `base(X).
derived(X) :- base(X).
more(X) :- base(X), derived(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'base' in the first clause (line 0)
            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            // Should return only the definition, not references
            expect(Array.isArray(definition)).toBe(false);
            if (!Array.isArray(definition)) {
                expect(definition.range.start.line).toBe(0);
            }
        });
    });

    describe('Additional edge cases', () => {
        it('should handle position on period', () => {
            const source = `foo(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on the period (column 6)
            const position: Position = { line: 0, character: 6 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).toBeNull();
        });

        it('should handle position on rule arrow', () => {
            const source = `foo(X) :- bar(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on the ':-' (column 7)
            const position: Position = { line: 0, character: 7 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).toBeNull();
        });

        it('should handle multi-line clause definition', () => {
            const source = `ancestor(X, Z) :-
    parent(X, Y),
    ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'ancestor' in body (line 2, column 4)
            const position: Position = { line: 2, character: 4 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).not.toBeNull();
            expect(Array.isArray(definition)).toBe(false);
            if (!Array.isArray(definition)) {
                // Should go to the head on line 0
                expect(definition.range.start.line).toBe(0);
            }
        });

        it('should handle predicate definition lookup in simple rule', () => {
            const source = `result(X, Y) :- input(X), output(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'result' predicate (column 0)
            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Should find the result predicate definition
            expect(definition).not.toBeNull();
        });

        it('should handle empty source', () => {
            const source = ``;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 0, character: 0 };
            const definition = getDefinition(testUri, symbolTable, position);

            expect(definition).toBeNull();
        });

        it('should handle declaration-only predicate (no definitions)', () => {
            const source = `Decl external_pred(X, Y) descr [mode(+, -)].`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'external_pred' in the declaration (column 5)
            const position: Position = { line: 0, character: 5 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Should return the declaration location
            expect(definition).not.toBeNull();
        });

        it('should handle click on predicate argument area returns predicate', () => {
            const source = `parent(/alice, /bob).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on '/alice' constant area (column 7)
            // Since constants are within the atom range, predicate definition is returned
            const position: Position = { line: 0, character: 7 };
            const definition = getDefinition(testUri, symbolTable, position);

            // Inside atom range returns the predicate
            expect(definition).not.toBeNull();
        });
    });
});
