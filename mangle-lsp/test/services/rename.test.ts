/**
 * Rename service tests for Mangle LSP.
 *
 * Tests the rename functionality for predicates and variables.
 * These tests are critical as rename had a file corruption bug that was fixed.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { SymbolTable } from '../../src/analysis/symbols';
import { prepareRename, doRename } from '../../src/services/rename';
import { Position } from 'vscode-languageserver/node';

/**
 * Helper to create a Position from 0-indexed line and character.
 */
function pos(line: number, character: number): Position {
    return { line, character };
}

describe('Rename Service', () => {
    describe('prepareRename', () => {
        describe('Predicate names', () => {
            it('should return correct range for predicate name (not full atom) in fact', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on the 'p' in 'parent'
                const range = prepareRename(result.unit!, symbolTable, pos(0, 0));

                expect(range).not.toBeNull();
                expect(range?.start.line).toBe(0);
                expect(range?.start.character).toBe(0);
                expect(range?.end.line).toBe(0);
                expect(range?.end.character).toBe(6); // Length of 'parent'
            });

            it('should return correct range for predicate name in rule head', () => {
                const source = 'ancestor(X, Y) :- parent(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on 'ancestor' in head
                const range = prepareRename(result.unit!, symbolTable, pos(0, 2));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(0);
                expect(range?.end.character).toBe(8); // Length of 'ancestor'
            });

            it('should return correct range for predicate name in rule body', () => {
                const source = 'ancestor(X, Y) :- parent(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on 'parent' in body
                const range = prepareRename(result.unit!, symbolTable, pos(0, 20));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(18); // Start of 'parent' in body
                expect(range?.end.character).toBe(24); // End of 'parent' in body
            });

            it('should return correct range for predicate name in declaration', () => {
                const source = 'Decl parent(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on 'parent' in declaration
                const range = prepareRename(result.unit!, symbolTable, pos(0, 7));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(5); // Start of 'parent' after 'Decl '
                expect(range?.end.character).toBe(11); // End of 'parent'
            });

            it('should return correct range when positioned at end of predicate name', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position at the 't' (last char) in 'parent'
                const range = prepareRename(result.unit!, symbolTable, pos(0, 5));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(0);
                expect(range?.end.character).toBe(6);
            });
        });

        describe('Built-in predicates', () => {
            it('should return null for built-in predicates (:lt)', () => {
                const source = 'foo(X) :- bar(X), X < 10.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on the '<' which is parsed as :lt
                const range = prepareRename(result.unit!, symbolTable, pos(0, 20));

                expect(range).toBeNull();
            });

            it('should return null for built-in predicates (:le)', () => {
                const source = 'foo(X) :- bar(X), X <= 10.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const range = prepareRename(result.unit!, symbolTable, pos(0, 20));
                expect(range).toBeNull();
            });

            it('should return null for built-in predicates (:gt)', () => {
                const source = 'foo(X) :- bar(X), X > 10.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const range = prepareRename(result.unit!, symbolTable, pos(0, 20));
                expect(range).toBeNull();
            });

            it('should return null for built-in predicates (:ge)', () => {
                const source = 'foo(X) :- bar(X), X >= 10.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const range = prepareRename(result.unit!, symbolTable, pos(0, 20));
                expect(range).toBeNull();
            });

            it('should return null for :match predicate', () => {
                const source = 'foo(X) :- bar(X), :match(X, "pattern").';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on :match
                const range = prepareRename(result.unit!, symbolTable, pos(0, 18));
                expect(range).toBeNull();
            });
        });

        describe('Variable names', () => {
            it('should return correct range for variable occurrence', () => {
                const source = 'parent(X, Y) :- person(X), person(Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on first X in head
                const range = prepareRename(result.unit!, symbolTable, pos(0, 7));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(7);
                expect(range?.end.character).toBe(8); // Length of 'X'
            });

            it('should return correct range for second variable occurrence', () => {
                const source = 'parent(X, Y) :- person(X), person(Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on X in body
                const range = prepareRename(result.unit!, symbolTable, pos(0, 23));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(23);
                expect(range?.end.character).toBe(24);
            });

            it('should return correct range for multi-character variable', () => {
                const source = 'parent(Parent, Child).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on 'Parent'
                const range = prepareRename(result.unit!, symbolTable, pos(0, 8));

                expect(range).not.toBeNull();
                expect(range?.start.character).toBe(7);
                expect(range?.end.character).toBe(13); // Length of 'Parent'
            });
        });

        describe('Wildcard variable', () => {
            it('should return null for wildcard variable (_)', () => {
                const source = 'parent(_, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on underscore
                const range = prepareRename(result.unit!, symbolTable, pos(0, 7));

                expect(range).toBeNull();
            });

            it('should return null for wildcard in body', () => {
                const source = 'orphan(X) :- person(X), !parent(_, X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on underscore in body
                const range = prepareRename(result.unit!, symbolTable, pos(0, 32));

                expect(range).toBeNull();
            });
        });

        describe('Edge cases', () => {
            it('should return null when position is not on any symbol', () => {
                const source = 'parent(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on the comma
                const range = prepareRename(result.unit!, symbolTable, pos(0, 8));

                expect(range).toBeNull();
            });

            it('should return null when position is on whitespace', () => {
                const source = 'parent(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on space after comma
                const range = prepareRename(result.unit!, symbolTable, pos(0, 9));

                expect(range).toBeNull();
            });

            it('should handle multi-line source', () => {
                const source = `parent(/alice, /bob).
ancestor(X, Y) :- parent(X, Y).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on 'parent' in second line
                const range = prepareRename(result.unit!, symbolTable, pos(1, 20));

                expect(range).not.toBeNull();
                expect(range?.start.line).toBe(1);
                expect(range?.start.character).toBe(18);
                expect(range?.end.character).toBe(24);
            });
        });
    });

    describe('doRename', () => {
        const uri = 'file:///test.mg';

        describe('Predicate renaming', () => {
            it('should update all predicate occurrences (declaration, definitions, references)', () => {
                const source = `Decl parent(X, Y).
parent(/alice, /bob).
parent(/bob, /carol).
ancestor(X, Y) :- parent(X, Y).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename 'parent' to 'parentOf' from the declaration
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 6), 'parentOf');

                expect(edit).not.toBeNull();
                expect(edit?.changes).toBeDefined();
                expect(edit?.changes?.[uri]).toBeDefined();

                const edits = edit!.changes![uri];
                // Should have 4 edits: 1 declaration + 2 facts + 1 reference in rule
                expect(edits.length).toBe(4);

                // Check that all edits replace with 'parentOf'
                edits.forEach(e => {
                    expect(e.newText).toBe('parentOf');
                });

                // Check that edits target the correct ranges (just the name, not the full atom)
                // Declaration: line 0, columns 5-11
                expect(edits.some(e =>
                    e.range.start.line === 0 &&
                    e.range.start.character === 5 &&
                    e.range.end.character === 11
                )).toBe(true);

                // First fact: line 1, columns 0-6
                expect(edits.some(e =>
                    e.range.start.line === 1 &&
                    e.range.start.character === 0 &&
                    e.range.end.character === 6
                )).toBe(true);

                // Second fact: line 2, columns 0-6
                expect(edits.some(e =>
                    e.range.start.line === 2 &&
                    e.range.start.character === 0 &&
                    e.range.end.character === 6
                )).toBe(true);

                // Reference in rule: line 3, columns 18-24
                expect(edits.some(e =>
                    e.range.start.line === 3 &&
                    e.range.start.character === 18 &&
                    e.range.end.character === 24
                )).toBe(true);
            });

            it('should update all occurrences when renamed from body reference', () => {
                const source = `foo(/a).
bar(X) :- foo(X).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename 'foo' to 'baz' from the body reference
                const edit = doRename(uri, result.unit!, symbolTable, pos(1, 11), 'baz');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 2 edits: 1 fact + 1 reference
                expect(edits.length).toBe(2);
                edits.forEach(e => expect(e.newText).toBe('baz'));
            });

            it('should update only the head when renaming from head', () => {
                const source = `foo(X) :- bar(X).
baz(Y) :- foo(Y).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename 'foo' from head
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), 'qux');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 2 edits: 1 head + 1 reference
                expect(edits.length).toBe(2);
            });

            it('should not affect predicates with same name but different arity', () => {
                const source = `foo(X).
foo(X, Y).
bar(Z) :- foo(Z).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename foo/1 to baz
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), 'baz');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should only rename foo/1 occurrences (2 edits: fact + reference)
                expect(edits.length).toBe(2);

                // Check that foo/2 is not renamed
                // First edit should be line 0 (foo/1)
                // Second edit should be line 2 (reference to foo/1)
                const lines = edits.map(e => e.range.start.line);
                expect(lines).toContain(0);
                expect(lines).toContain(2);
                expect(lines).not.toContain(1); // foo/2 should not be renamed
            });
        });

        describe('Variable renaming', () => {
            it('should update all variable occurrences within clause', () => {
                const source = 'foo(X, Y) :- bar(X), baz(Y), qux(X, Y).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename X to Z
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'Z');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 3 edits: X in head, X in bar(X), X in qux(X, Y)
                expect(edits.length).toBe(3);
                edits.forEach(e => expect(e.newText).toBe('Z'));

                // Check positions
                const positions = edits.map(e => e.range.start.character);
                expect(positions).toContain(4);  // X in head
                expect(positions).toContain(17); // X in bar(X)
                expect(positions).toContain(33); // X in qux(X, Y)
            });

            it('should not affect variables in other clauses', () => {
                const source = `foo(X).
bar(X).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename X in first clause
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'Y');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should only rename X in first clause (1 edit)
                expect(edits.length).toBe(1);
                expect(edits[0].range.start.line).toBe(0);
            });

            it('should update multi-character variable', () => {
                const source = 'ancestor(Ancestor, Descendant) :- parent(Ancestor, Child), ancestor(Child, Descendant).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename 'Ancestor' to 'Anc'
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 10), 'Anc');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 2 edits: Ancestor in head and in parent(Ancestor, Child)
                expect(edits.length).toBe(2);
                edits.forEach(e => expect(e.newText).toBe('Anc'));
            });

            it('should handle variable in negated atom', () => {
                const source = 'orphan(X) :- person(X), !parent(_, X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename X to Child
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 7), 'Child');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 3 edits: X in head, X in person(X), X in !parent(_, X)
                expect(edits.length).toBe(3);
                edits.forEach(e => expect(e.newText).toBe('Child'));
            });

            it('should handle variable in comparison', () => {
                const source = 'positive(X) :- number(X), X > 0.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Rename X to N
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 9), 'N');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 3 edits: X in head, X in number(X), X in X > 0
                expect(edits.length).toBe(3);
                edits.forEach(e => expect(e.newText).toBe('N'));
            });
        });

        describe('Validation', () => {
            it('should reject invalid predicate names (must start with lowercase)', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Try to rename to invalid name starting with uppercase
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), 'Parent');

                expect(edit).toBeNull();
            });

            it('should reject empty predicate names', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), '');

                expect(edit).toBeNull();
            });

            it('should allow predicate names starting with lowercase', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), 'parentOf');

                expect(edit).not.toBeNull();
            });

            it('should reject invalid variable names (must start with uppercase)', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Try to rename to invalid name starting with lowercase
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'x');

                expect(edit).toBeNull();
            });

            it('should reject variable names with invalid characters', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'X-Invalid');

                expect(edit).toBeNull();
            });

            it('should allow variable names starting with uppercase', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'NewName');

                expect(edit).not.toBeNull();
            });

            it('should allow variable names with underscores and numbers', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'Var_123');

                expect(edit).not.toBeNull();
            });

            it('should allow variable name starting with underscore', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), '_temp');

                expect(edit).not.toBeNull();
            });
        });

        describe('Built-in predicates', () => {
            it('should return null when trying to rename built-in predicates', () => {
                const source = 'foo(X) :- bar(X), X < 10.';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Try to rename :lt (which is <)
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 20), 'lessThan');

                expect(edit).toBeNull();
            });
        });

        describe('Wildcard variable', () => {
            it('should return null when trying to rename wildcard', () => {
                const source = 'foo(_).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'X');

                expect(edit).toBeNull();
            });
        });

        describe('No symbol at position', () => {
            it('should return null when position is not on any symbol', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                // Position on the period
                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 6), 'newName');

                expect(edit).toBeNull();
            });
        });

        describe('Critical: Name range correctness', () => {
            it('should only rename predicate name, not entire atom', () => {
                const source = 'parent(/alice, /bob).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 1), 'parentOf');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                expect(edits.length).toBe(1);

                // Critical: Should only replace 'parent', not 'parent(/alice, /bob)'
                expect(edits[0].range.start.character).toBe(0);
                expect(edits[0].range.end.character).toBe(6); // Length of 'parent'
                expect(edits[0].newText).toBe('parentOf');

                // Verify it doesn't extend to the parenthesis
                expect(edits[0].range.end.character).toBeLessThan(7); // '(' is at position 6
            });

            it('should only rename variable, not surrounding text', () => {
                const source = 'foo(X).';
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 4), 'NewVar');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                expect(edits.length).toBe(1);

                // Critical: Should only replace 'X', not 'X)' or surrounding characters
                expect(edits[0].range.start.character).toBe(4);
                expect(edits[0].range.end.character).toBe(5); // Length of 'X'
                expect(edits[0].newText).toBe('NewVar');
            });

            it('should handle complex multi-occurrence rename correctly', () => {
                const source = `Decl grandparent(X, Y).
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
hasGrandparent(P) :- grandparent(_, P).`;
                const result = parse(source);
                expect(result.unit).not.toBeNull();
                const symbolTable = SymbolTable.build(result.unit!);

                const edit = doRename(uri, result.unit!, symbolTable, pos(0, 7), 'ancestor');

                expect(edit).not.toBeNull();
                const edits = edit!.changes![uri];
                // Should have 3 edits: declaration, definition head, reference
                expect(edits.length).toBe(3);

                // All edits should only replace the predicate name
                edits.forEach(e => {
                    expect(e.newText).toBe('ancestor');
                    // Each range should be exactly the length of 'grandparent' (11 chars)
                    const length = e.range.end.character - e.range.start.character;
                    expect(length).toBe(11);
                });

                // Verify positions are correct for each occurrence
                // Declaration: after 'Decl '
                expect(edits.some(e =>
                    e.range.start.line === 0 &&
                    e.range.start.character === 5 &&
                    e.range.end.character === 16
                )).toBe(true);

                // Definition: start of line 1
                expect(edits.some(e =>
                    e.range.start.line === 1 &&
                    e.range.start.character === 0 &&
                    e.range.end.character === 11
                )).toBe(true);

                // Reference: in rule body
                expect(edits.some(e =>
                    e.range.start.line === 2 &&
                    e.range.start.character === 21 &&
                    e.range.end.character === 32
                )).toBe(true);
            });
        });
    });
});
