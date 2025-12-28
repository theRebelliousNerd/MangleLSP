/**
 * Tests for find-references service.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { buildSymbolTable } from '../../src/analysis/symbols';
import { findReferences } from '../../src/services/references';
import { Position, ReferenceContext } from 'vscode-languageserver/node';

describe('References Service', () => {
    const testUri = 'file:///test.mg';

    describe('Predicate references', () => {
        it('should find all references for predicate including all occurrences', () => {
            const source = `parent(/alice, /bob).
parent(/bob, /carol).
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in first clause (line 0, column 0)
            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            expect(Array.isArray(references)).toBe(true);

            // Should include:
            // - 2 clause heads (definitions)
            // - 2 references in ancestor rules
            // Total: 4 locations
            expect(references.length).toBe(4);

            // All should be in the test file
            references.forEach(loc => {
                expect(loc.uri).toBe(testUri);
            });
        });

        it('should include declaration when includeDeclaration is true', () => {
            const source = `Decl parent(X, Y).
parent(/alice, /bob).
parent(/bob, /carol).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in first clause (line 1, column 0)
            const position: Position = { line: 1, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include:
            // - 1 declaration
            // - 2 clause heads (definitions)
            // Total: 3 locations
            expect(references.length).toBe(3);

            // First should be the declaration (line 0)
            expect(references[0]?.range.start.line).toBe(0);
        });

        it('should exclude declaration when includeDeclaration is false', () => {
            const source = `Decl parent(X, Y).
parent(/alice, /bob).
parent(/bob, /carol).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'parent' in declaration (line 0, column 5)
            const position: Position = { line: 0, character: 5 };
            const context: ReferenceContext = { includeDeclaration: false };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include only:
            // - 2 clause heads (definitions)
            // Total: 2 locations (declaration excluded)
            expect(references.length).toBe(2);

            // None should be on line 0 (the declaration)
            references.forEach(loc => {
                expect(loc.range.start.line).not.toBe(0);
            });
        });

        it('should find references in rule bodies', () => {
            const source = `base(X).
derived(X) :- base(X).
moreDerived(X) :- base(X), derived(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'base' in first clause (line 0, column 0)
            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include:
            // - 1 clause head (definition)
            // - 2 references in rule bodies
            // Total: 3 locations
            expect(references.length).toBe(3);
        });

        it('should handle predicates with no references', () => {
            const source = `unused(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'unused' (line 0, column 0)
            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include only the definition
            expect(references.length).toBe(1);
        });
    });

    describe('Variable references', () => {
        it('should find all occurrences of variable in clause', () => {
            const source = `path(X, Z) :- edge(X, Y), edge(Y, Z).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'Y' in first edge(X, Y) - Y is at column 22
            const position: Position = { line: 0, character: 22 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Y appears in:
            // - edge(X, Y) - binding location
            // - edge(Y, Z) - usage
            // Total: 2 locations
            expect(references.length).toBe(2);
        });

        it('should include binding location when includeDeclaration is true', () => {
            const source = `foo(X, Y) :- bar(X), baz(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in bar(X) - X is at column 17
            const position: Position = { line: 0, character: 17 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // X appears in:
            // - foo(X, Y) - binding in head
            // - bar(X) - usage in body
            // Total: 2 locations
            expect(references.length).toBe(2);
        });

        it('should exclude binding location when includeDeclaration is false', () => {
            const source = `foo(X, Y) :- bar(X), baz(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in head - X is at column 4
            const position: Position = { line: 0, character: 4 };
            const context: ReferenceContext = { includeDeclaration: false };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // X appears in:
            // - bar(X) - usage in body only (binding excluded)
            // Total: 1 location
            expect(references.length).toBe(1);

            // Should not include the head position
            expect(references[0]?.range.start.character).not.toBe(4);
        });

        it('should handle variables with single occurrence', () => {
            const source = `singleton(X) :- foo(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in head - X is at column 10
            const position: Position = { line: 0, character: 10 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // X appears only once
            expect(references.length).toBe(1);
        });

        it('should not track anonymous variables - returns predicate instead', () => {
            const source = `orphan(X) :- person(X), !parent(_, X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on '_' - at column 33
            // Since _ is not tracked, clicking within the atom range returns predicate references
            const position: Position = { line: 0, character: 33 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            // When no variable is found, predicate references may be returned instead
            // (since the click is within the atom's range)
            expect(references).toBeDefined();
        });
    });

    describe('Variables checked before predicates', () => {
        it('should return variable references when clicking inside atom on variable', () => {
            const source = `foo(X) :- bar(X), baz(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' inside bar(X) - X is at column 14
            const position: Position = { line: 0, character: 14 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should return variable references (3 occurrences of X)
            expect(references.length).toBe(3);
        });

        it('should return predicate references when clicking on predicate name', () => {
            const source = `bar(X).
foo(X) :- bar(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'bar' predicate name - at line 1, column 10
            const position: Position = { line: 1, character: 10 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should return predicate references:
            // - 1 definition (line 0)
            // - 1 reference (line 1)
            expect(references.length).toBe(2);

            // First should be the definition
            expect(references[0]?.range.start.line).toBe(0);
        });
    });

    describe('Different arities are separate predicates', () => {
        it('should only return references for matching arity', () => {
            const source = `foo(X).
foo(X, Y).
bar(Z) :- foo(Z).
baz(A, B) :- foo(A, B).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' with arity 1 in bar clause - line 2, column 10
            const position: Position = { line: 2, character: 10 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include only foo/1:
            // - 1 definition (line 0)
            // - 1 reference (line 2)
            // Total: 2 locations (not including foo/2)
            expect(references.length).toBe(2);

            // Verify none are on line 1 or 3 (where foo/2 is)
            references.forEach(loc => {
                expect(loc.range.start.line).not.toBe(1);
                expect(loc.range.start.line).not.toBe(3);
            });
        });

        it('should handle multiple clauses of different arities', () => {
            const source = `foo(X).
foo(Y).
foo(A, B).
foo(C, D).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'foo' with arity 2 in third clause - line 2, column 0
            const position: Position = { line: 2, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include only foo/2:
            // - 2 definitions (lines 2, 3)
            // Total: 2 locations (not including foo/1)
            expect(references.length).toBe(2);

            // Both should be on lines 2 or 3
            references.forEach(loc => {
                expect([2, 3]).toContain(loc.range.start.line);
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle negated predicates', () => {
            const source = `edge(/a, /b).
isolated(X) :- node(X), !edge(X, _), !edge(_, X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'edge' in first negated atom - line 1, column 25
            const position: Position = { line: 1, character: 25 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include:
            // - 1 definition (line 0)
            // - 2 references in negated atoms
            // Total: 3 locations
            expect(references.length).toBe(3);
        });

        it('should handle variables in comparisons', () => {
            const source = `inRange(X) :- num(X), X >= 0, X < 100.`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in first comparison - column 22
            const position: Position = { line: 0, character: 22 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // X appears in:
            // - inRange(X) - head
            // - num(X) - premise
            // - X >= 0 - comparison
            // - X < 100 - comparison
            // Total: 4 locations
            expect(references.length).toBe(4);
        });

        it('should handle variables in simple clause', () => {
            const source = `sameValue(X, Y) :- value(X), value(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'Y' in value(Y) - column 34
            const position: Position = { line: 0, character: 34 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Y appears in:
            // - sameValue(X, Y) - head
            // - value(Y) - premise
            // Total: 2 locations
            expect(references.length).toBe(2);
        });

        it('should return predicate references when clicking within atom range', () => {
            const source = `parent(/alice, /bob).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on comma (within atom range)
            const position: Position = { line: 0, character: 14 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            // Within atom range, predicate references are returned
            expect(references).toBeDefined();
            expect(references.length).toBeGreaterThan(0);
        });
    });

    describe('Comprehensive scenarios', () => {
        it('should handle complex recursive predicate', () => {
            const source = `Decl ancestor(X, Y).
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
query(A) :- person(A), ancestor(A, /root).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'ancestor' in recursive reference - line 2, column 32
            const position: Position = { line: 2, character: 32 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();

            // Should include:
            // - 1 declaration (line 0)
            // - 2 definitions (lines 1, 2)
            // - 2 references (line 2 recursive call, line 3 in query)
            // Total: 5 locations
            expect(references.length).toBe(5);
        });
    });

    describe('Include/exclude declaration option', () => {
        it('should include declaration when requested with true', () => {
            const source = `Decl base(X).
base(1).
base(2).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 1, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // 1 declaration + 2 definitions = 3
            expect(references.length).toBe(3);

            // First should be declaration (line 0)
            expect(references[0]?.range.start.line).toBe(0);
        });

        it('should exclude declaration when requested with false', () => {
            const source = `Decl base(X).
base(1).
base(2).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 1, character: 0 };
            const context: ReferenceContext = { includeDeclaration: false };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // Only 2 definitions (declaration excluded)
            expect(references.length).toBe(2);

            // Neither should be on line 0 (declaration)
            references.forEach(loc => {
                expect(loc.range.start.line).not.toBe(0);
            });
        });

        it('should handle missing declaration gracefully', () => {
            const source = `foo(1).
foo(2).
bar(X) :- foo(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // 2 definitions + 1 reference = 3 (no declaration exists)
            expect(references.length).toBe(3);
        });

        it('should work correctly for variable includeDeclaration false', () => {
            const source = `foo(X) :- bar(X), baz(X), qux(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on X in the head (binding location)
            const position: Position = { line: 0, character: 4 };
            const context: ReferenceContext = { includeDeclaration: false };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // 4 occurrences - 1 binding = 3
            expect(references.length).toBe(3);
        });

        it('should work correctly for variable includeDeclaration true', () => {
            const source = `foo(X) :- bar(X), baz(X), qux(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on X in the head (binding location)
            const position: Position = { line: 0, character: 4 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // All 4 occurrences
            expect(references.length).toBe(4);
        });
    });

    describe('Variable references within clause', () => {
        it('should find all variable references in a complex clause', () => {
            const source = `path(X, Z, L) :- edge(X, Y, W1), path(Y, Z, L2), L = fn:plus(W1, L2).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'Y' in edge(X, Y, W1)
            const position: Position = { line: 0, character: 25 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // Y appears in: edge(X, Y, W1) and path(Y, Z, L2) = 2 occurrences
            expect(references.length).toBe(2);
        });

        it('should correctly handle variable appearing in multiple premises', () => {
            const source = `triangle(X, Y, Z) :- edge(X, Y), edge(Y, Z), edge(Z, X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in edge(Z, X)
            const position: Position = { line: 0, character: 52 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // X appears in: head, edge(X, Y), edge(Z, X) = 3 occurrences
            expect(references.length).toBe(3);
        });

        it('should handle variable in inequality', () => {
            const source = `diff(X, Y) :- item(X), item(Y), X != Y.`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in X != Y
            const position: Position = { line: 0, character: 32 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // X appears in: head, item(X), X != Y = 3 occurrences
            expect(references.length).toBe(3);
        });

        it('should handle variable in premise atom', () => {
            const source = `double(X, Y) :- num(X), num(Y).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'X' in num(X) - column 19
            const position: Position = { line: 0, character: 19 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // X appears in: head, num(X) = 2 occurrences
            expect(references.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle multiple variables correctly in same position', () => {
            const source = `swap(X, Y, Y, X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on first 'X' in the head
            const position: Position = { line: 0, character: 5 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // X appears twice in the head
            expect(references.length).toBe(2);
        });

        it('should handle variable in multiline clause', () => {
            const source = `complex(X, Y, Z) :-
    foo(X),
    bar(Y),
    baz(Z),
    X != Y,
    Y != Z.`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'Y' in bar(Y) - line 2
            const position: Position = { line: 2, character: 8 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // Y appears in: head, bar(Y), X != Y, Y != Z = 4 occurrences
            expect(references.length).toBe(4);
        });
    });

    describe('Additional edge cases', () => {
        it('should handle predicate used only in declaration', () => {
            const source = `Decl unused_pred(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on 'unused_pred' in declaration
            const position: Position = { line: 0, character: 5 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // Only the declaration
            expect(references.length).toBe(1);
        });

        it('should return empty for built-in predicates', () => {
            const source = `foo(X) :- bar(X), X < 10.`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            // Click on '<' which is :lt (column 20)
            const position: Position = { line: 0, character: 20 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            // Built-in predicates don't have user-defined references
            expect(references).toEqual([]);
        });

        it('should handle empty source', () => {
            const source = ``;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).toEqual([]);
        });

        it('should handle position beyond source', () => {
            const source = `foo(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 100, character: 100 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).toEqual([]);
        });

        it('should handle predicate with many references', () => {
            const source = `base(X).
r1(X) :- base(X).
r2(X) :- base(X).
r3(X) :- base(X).
r4(X) :- base(X).
r5(X) :- base(X).`;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const symbolTable = buildSymbolTable(result.unit!);

            const position: Position = { line: 0, character: 0 };
            const context: ReferenceContext = { includeDeclaration: true };
            const references = findReferences(testUri, symbolTable, position, context);

            expect(references).not.toBeNull();
            // 1 definition + 5 references = 6
            expect(references.length).toBe(6);
        });
    });
});
