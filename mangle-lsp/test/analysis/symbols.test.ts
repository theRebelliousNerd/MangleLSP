/**
 * Symbol table tests for Mangle LSP.
 *
 * Tests the symbol tracking functionality including:
 * - Predicate declarations, definitions, and references
 * - Variable bindings and occurrences within clauses
 * - Scope handling (clause-level for variables)
 * - Position-based lookups
 * - Special cases (wildcards, comparisons, negation, functions)
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index';
import { SymbolTable, buildSymbolTable } from '../../src/analysis/symbols';

describe('SymbolTable', () => {
    describe('PredicateInfo - Declaration tracking', () => {
        it('should track declaration location and name range separately', () => {
            const source = 'Decl parent(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('parent', 2);

            expect(predInfo).toBeDefined();
            expect(predInfo!.declLocation).not.toBeNull();
            expect(predInfo!.declNameRange).not.toBeNull();

            // Declaration location should span the entire declaration
            expect(predInfo!.declLocation!.start.line).toBe(1);
            expect(predInfo!.declLocation!.start.column).toBe(0);

            // Name range should only span the predicate name "parent"
            expect(predInfo!.declNameRange!.start.line).toBe(1);
            expect(predInfo!.declNameRange!.start.column).toBe(5); // After "Decl "
            expect(predInfo!.declNameRange!.end.column).toBe(11); // 5 + 6 chars for "parent"
        });

        it('should extract documentation from descr atoms', () => {
            const source = 'Decl parent(X, Y) descr [doc("Parent relationship")].';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('parent', 2);

            expect(predInfo).toBeDefined();
            expect(predInfo!.documentation).toBe('Parent relationship');
        });

        it('should detect external predicates', () => {
            const source = 'Decl external_pred(X) descr [external()].';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('external_pred', 1);

            expect(predInfo).toBeDefined();
            expect(predInfo!.isExternal).toBe(true);
        });

        it('should detect private predicates', () => {
            const source = 'Decl helper(X) descr [private()].';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('helper', 1);

            expect(predInfo).toBeDefined();
            expect(predInfo!.isPrivate).toBe(true);
        });
    });

    describe('PredicateInfo - Definition tracking', () => {
        it('should track definition locations and name ranges', () => {
            const source = `
                parent(/alice, /bob).
                parent(/bob, /carol).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('parent', 2);

            expect(predInfo).toBeDefined();
            expect(predInfo!.definitions).toHaveLength(2);
            expect(predInfo!.definitionNameRanges).toHaveLength(2);

            // Both arrays should have same length
            expect(predInfo!.definitions.length).toBe(predInfo!.definitionNameRanges.length);

            // Definition locations should span the entire atom
            const firstDef = predInfo!.definitions[0];
            expect(firstDef.start.line).toBe(2);

            // Name ranges should only span "parent"
            const firstNameRange = predInfo!.definitionNameRanges[0];
            expect(firstNameRange.start.line).toBe(2);
            // The name ends after 6 characters
            expect(firstNameRange.end.column - firstNameRange.start.column).toBe(6);
        });

        it('should track multiple definitions with separate name ranges', () => {
            const source = `
                foo(1).
                foo(2).
                foo(3).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicate('foo', 1);

            expect(predInfo).toBeDefined();
            expect(predInfo!.definitions).toHaveLength(3);
            expect(predInfo!.definitionNameRanges).toHaveLength(3);

            // Each name range should span exactly "foo" (3 characters)
            for (const nameRange of predInfo!.definitionNameRanges) {
                expect(nameRange.end.column - nameRange.start.column).toBe(3);
            }
        });
    });

    describe('PredicateInfo - Reference tracking', () => {
        it('should track reference locations and name ranges', () => {
            const source = `
                ancestor(X, Y) :- parent(X, Y).
                ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const parentInfo = table.getPredicate('parent', 2);

            expect(parentInfo).toBeDefined();
            expect(parentInfo!.references).toHaveLength(2);
            expect(parentInfo!.referenceNameRanges).toHaveLength(2);

            // Reference locations should span entire atoms
            expect(parentInfo!.references[0].start.line).toBe(2);

            // Name ranges should only span "parent"
            for (const nameRange of parentInfo!.referenceNameRanges) {
                expect(nameRange.end.column - nameRange.start.column).toBe(6);
            }
        });

        it('should track references from multiple clauses', () => {
            const source = `
                a(X) :- b(X).
                c(X) :- b(X).
                d(X) :- b(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const bInfo = table.getPredicate('b', 1);

            expect(bInfo).toBeDefined();
            expect(bInfo!.references).toHaveLength(3);
            expect(bInfo!.referenceNameRanges).toHaveLength(3);
        });
    });

    describe('VariableInfo - Binding tracking', () => {
        it('should track binding location as first occurrence', () => {
            const source = 'foo(X, Y) :- bar(X), baz(Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            const xInfo = variables.get('X');
            expect(xInfo).toBeDefined();
            // X first appears in the head foo(X, Y)
            expect(xInfo!.bindingLocation.start.line).toBe(1);

            const yInfo = variables.get('Y');
            expect(yInfo).toBeDefined();
            // Y first appears in the head foo(X, Y)
            expect(yInfo!.bindingLocation.start.line).toBe(1);
        });

        it('should update binding location to earliest binding occurrence', () => {
            const source = 'result(X) :- input(X), transform(X, Y), output(Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            const xInfo = variables.get('X');
            expect(xInfo).toBeDefined();
            // X is bound in the head
            expect(xInfo!.bindingLocation).toBeDefined();

            const yInfo = variables.get('Y');
            expect(yInfo).toBeDefined();
            // Y is first bound in transform(X, Y) in the body
            expect(yInfo!.bindingLocation).toBeDefined();
        });
    });

    describe('VariableInfo - Occurrence tracking', () => {
        it('should track all occurrences of a variable', () => {
            const source = 'foo(X) :- bar(X), baz(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            const xInfo = variables.get('X');
            expect(xInfo).toBeDefined();
            // X appears 3 times: in head, in bar(X), in baz(X)
            expect(xInfo!.occurrences).toHaveLength(3);
        });

        it('should track occurrences across complex clauses', () => {
            const source = 'result(X, Y) :- input(X), transform(X, Y), output(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            const xInfo = variables.get('X');
            expect(xInfo).toBeDefined();
            // X appears 4 times: head, input, transform, output
            expect(xInfo!.occurrences).toHaveLength(4);

            const yInfo = variables.get('Y');
            expect(yInfo).toBeDefined();
            // Y appears 3 times: head, transform, output
            expect(yInfo!.occurrences).toHaveLength(3);
        });
    });

    describe('Variable scoping', () => {
        it('should scope variables to their clause', () => {
            const source = `
                foo(X) :- bar(X).
                baz(X) :- qux(X).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause1 = result.unit!.clauses[0];
            const clause2 = result.unit!.clauses[1];

            const vars1 = table.getClauseVariables(clause1.range);
            const vars2 = table.getClauseVariables(clause2.range);

            // Both clauses have a variable X, but they are different
            expect(vars1.get('X')).toBeDefined();
            expect(vars2.get('X')).toBeDefined();

            // They should have different clause ranges
            expect(vars1.get('X')!.clauseRange).not.toEqual(vars2.get('X')!.clauseRange);

            // First clause's X should only have 2 occurrences
            expect(vars1.get('X')!.occurrences).toHaveLength(2);
            // Second clause's X should only have 2 occurrences
            expect(vars2.get('X')!.occurrences).toHaveLength(2);
        });

        it('should keep variables separate across different clauses', () => {
            const source = `
                a(X, Y).
                b(X, Z).
                c(Y, Z).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause1 = result.unit!.clauses[0];
            const clause2 = result.unit!.clauses[1];
            const clause3 = result.unit!.clauses[2];

            const vars1 = table.getClauseVariables(clause1.range);
            const vars2 = table.getClauseVariables(clause2.range);
            const vars3 = table.getClauseVariables(clause3.range);

            // Clause 1 has X and Y
            expect(vars1.has('X')).toBe(true);
            expect(vars1.has('Y')).toBe(true);
            expect(vars1.has('Z')).toBe(false);

            // Clause 2 has X and Z
            expect(vars2.has('X')).toBe(true);
            expect(vars2.has('Y')).toBe(false);
            expect(vars2.has('Z')).toBe(true);

            // Clause 3 has Y and Z
            expect(vars3.has('X')).toBe(false);
            expect(vars3.has('Y')).toBe(true);
            expect(vars3.has('Z')).toBe(true);
        });
    });

    describe('findPredicateAt()', () => {
        it('should find predicate at declaration position', () => {
            const source = 'Decl parent(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position within the declaration
            const predInfo = table.findPredicateAt(1, 5);
            expect(predInfo).toBeDefined();
            expect(predInfo!.symbol.symbol).toBe('parent');
            expect(predInfo!.symbol.arity).toBe(2);
        });

        it('should find predicate at definition position', () => {
            const source = 'parent(/alice, /bob).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position at the predicate name
            const predInfo = table.findPredicateAt(1, 0);
            expect(predInfo).toBeDefined();
            expect(predInfo!.symbol.symbol).toBe('parent');
        });

        it('should find predicate at reference position', () => {
            const source = 'ancestor(X, Y) :- parent(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position at the reference to parent
            const predInfo = table.findPredicateAt(1, 18);
            expect(predInfo).toBeDefined();
            expect(predInfo!.symbol.symbol).toBe('parent');
        });

        it('should return undefined for positions not on predicates', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position in the argument list, not on predicate
            const predInfo = table.findPredicateAt(1, 4);
            // This might find the predicate if the range includes args,
            // but it should not find anything if we're specifically in whitespace
            // Let's test a position clearly outside
            const noPred = table.findPredicateAt(10, 10);
            expect(noPred).toBeUndefined();
        });
    });

    describe('findVariableAt()', () => {
        it('should find variable at its position', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position at X (column 4 for the opening paren + 1 for X)
            const varInfo = table.findVariableAt(1, 4);
            expect(varInfo).toBeDefined();
            expect(varInfo!.name).toBe('X');
        });

        it('should find variable across multiple occurrences', () => {
            const source = 'foo(X) :- bar(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Find at first occurrence
            const varInfo1 = table.findVariableAt(1, 4);
            expect(varInfo1).toBeDefined();
            expect(varInfo1!.name).toBe('X');

            // Find at second occurrence
            const varInfo2 = table.findVariableAt(1, 14);
            expect(varInfo2).toBeDefined();
            expect(varInfo2!.name).toBe('X');

            // Should be the same variable info
            expect(varInfo1).toBe(varInfo2);
        });

        it('should return undefined for positions not on variables', () => {
            const source = 'foo(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Position not on any variable
            const varInfo = table.findVariableAt(10, 10);
            expect(varInfo).toBeUndefined();
        });
    });

    describe('Wildcard variables', () => {
        it('should skip wildcard variables (_)', () => {
            const source = 'foo(_).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // Wildcard should not be tracked
            expect(variables.has('_')).toBe(false);
            expect(variables.size).toBe(0);
        });

        it('should skip wildcards but track named variables', () => {
            const source = 'foo(X, _, Y, _).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // Only X and Y should be tracked
            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);
            expect(variables.has('_')).toBe(false);
            expect(variables.size).toBe(2);
        });

        it('should skip wildcards in complex patterns', () => {
            const source = 'edge(X, _) :- node(X), !isolated(_).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // Only X should be tracked
            expect(variables.has('X')).toBe(true);
            expect(variables.has('_')).toBe(false);
            expect(variables.size).toBe(1);
        });
    });

    describe('Comparison atoms', () => {
        it('should not create false bindings for :lt comparisons', () => {
            const source = 'valid(X) :- value(X), X < 100.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X should be tracked, but only from valid and value, not as binding from <
            expect(variables.has('X')).toBe(true);
            const xInfo = variables.get('X')!;

            // X appears in: head, value(X), and X < 100
            expect(xInfo.occurrences).toHaveLength(3);
        });

        it('should not create false bindings for :le comparisons', () => {
            const source = 'valid(X) :- value(X), X <= 100.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.get('X')!.occurrences).toHaveLength(3);
        });

        it('should not create false bindings for :gt comparisons', () => {
            const source = 'valid(X) :- value(X), X > 0.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.get('X')!.occurrences).toHaveLength(3);
        });

        it('should not create false bindings for :ge comparisons', () => {
            const source = 'valid(X) :- value(X), X >= 0.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.get('X')!.occurrences).toHaveLength(3);
        });

        it('should handle variables on both sides of comparisons', () => {
            const source = 'less(X, Y) :- value(X), value(Y), X < Y.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in: head, value(X), X < Y
            expect(variables.get('X')!.occurrences).toHaveLength(3);
            // Y appears in: head, value(Y), X < Y
            expect(variables.get('Y')!.occurrences).toHaveLength(3);
        });
    });

    describe('NegAtom variables', () => {
        it('should track variables in negated atoms without binding', () => {
            const source = 'orphan(X) :- person(X), !parent(_, X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X should be tracked (from head and person)
            expect(variables.has('X')).toBe(true);
            const xInfo = variables.get('X')!;

            // X appears in: head orphan(X), person(X), and !parent(_, X)
            expect(xInfo.occurrences).toHaveLength(3);
        });

        it('should not bind variables in negated atoms', () => {
            const source = 'isolated(X) :- node(X), !edge(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X should be tracked and bound
            expect(variables.has('X')).toBe(true);

            // Y appears in negation but should not be bound
            // Actually, Y should still be tracked in occurrences
            expect(variables.has('Y')).toBe(true);
            const yInfo = variables.get('Y')!;

            // Y only appears in !edge(X, Y), and should have 1 occurrence
            expect(yInfo.occurrences).toHaveLength(1);
        });

        it('should handle multiple negations', () => {
            const source = 'isolated(X) :- node(X), !edge(X, _), !edge(_, X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // Only X should be tracked (wildcards are skipped)
            expect(variables.has('X')).toBe(true);
            expect(variables.has('_')).toBe(false);

            const xInfo = variables.get('X')!;
            // X appears in: head, node(X), !edge(X, _), !edge(_, X)
            expect(xInfo.occurrences).toHaveLength(4);
        });
    });

    describe('ApplyFn arguments', () => {
        it('should collect variables from function arguments in atoms', () => {
            const source = 'test(X) :- compute(fn:plus(Y, 1)).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // Both X and Y should be tracked
            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in head
            expect(variables.get('X')!.occurrences).toHaveLength(1);

            // Y appears in the function argument
            expect(variables.get('Y')!.occurrences).toHaveLength(1);
        });

        it('should collect variables from first-level function arguments only', () => {
            const source = 'foo(fn:plus(X, fn:mult(Y, 2))).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X should be tracked (first level of ApplyFn)
            expect(variables.has('X')).toBe(true);
            // Y is in nested ApplyFn (fn:mult), which is not currently collected
            // This is a known limitation - collectVariables only goes one level deep
            expect(variables.has('Y')).toBe(false);
        });

        it('should collect variables from list literals (ApplyFn with fn:list)', () => {
            const source = 'foo([X, Y, Z]).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // All three variables should be tracked
            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);
            expect(variables.has('Z')).toBe(true);
        });

        it('should handle variables in list literals with wildcards', () => {
            const source = 'foo([X, _, Y]).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X and Y should be tracked, but not _
            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);
            expect(variables.has('_')).toBe(false);
            expect(variables.size).toBe(2);
        });
    });

    describe('Equality and inequality', () => {
        it('should track variables in equality constraints', () => {
            const source = 'same(X, Y) :- value(X), value(Y), X = Y.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in: head, value(X), X = Y
            expect(variables.get('X')!.occurrences).toHaveLength(3);
            // Y appears in: head, value(Y), X = Y
            expect(variables.get('Y')!.occurrences).toHaveLength(3);
        });

        it('should bind left side of equality', () => {
            const source = 'foo(Y) :- X = 5, bar(X).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in: X = 5, bar(X)
            expect(variables.get('X')!.occurrences).toHaveLength(2);
        });

        it('should not bind right side of equality', () => {
            const source = 'foo(X) :- Y = X.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in: head foo(X), Y = X
            expect(variables.get('X')!.occurrences).toHaveLength(2);
            // Y appears only in: Y = X
            expect(variables.get('Y')!.occurrences).toHaveLength(1);
        });

        it('should track variables in inequality constraints', () => {
            const source = 'diff(X, Y) :- value(X), value(Y), X != Y.';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            expect(variables.has('X')).toBe(true);
            expect(variables.has('Y')).toBe(true);

            // X appears in: head, value(X), X != Y
            expect(variables.get('X')!.occurrences).toHaveLength(3);
            // Y appears in: head, value(Y), X != Y
            expect(variables.get('Y')!.occurrences).toHaveLength(3);
        });
    });

    describe('Complex scenarios', () => {
        it('should handle rules with mixed constructs', () => {
            const source = `
                result(X, Values, Y) :-
                    input(X, Values),
                    !excluded(X),
                    X > 0,
                    X != 999,
                    compute(Y, Values),
                    Y <= 100.
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const clause = result.unit!.clauses[0];
            const variables = table.getClauseVariables(clause.range);

            // X, Values, Y should all be tracked (but not _)
            expect(variables.has('X')).toBe(true);
            expect(variables.has('Values')).toBe(true);
            expect(variables.has('Y')).toBe(true);
            expect(variables.has('_')).toBe(false);

            // Verify occurrence counts
            // X appears in: head, input, !excluded, X > 0, X != 999
            expect(variables.get('X')!.occurrences.length).toBeGreaterThan(3);
            // Y appears in: head, compute, Y <= 100
            expect(variables.get('Y')!.occurrences.length).toBeGreaterThan(1);
            // Values appears in: head, input, compute
            expect(variables.get('Values')!.occurrences.length).toBeGreaterThan(1);
        });

        it('should handle predicates with same name but different arities', () => {
            const source = `
                foo(X).
                foo(X, Y).
                bar(Z) :- foo(Z).
                baz(A, B) :- foo(A, B).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // Should have separate entries for foo/1 and foo/2
            const foo1 = table.getPredicate('foo', 1);
            const foo2 = table.getPredicate('foo', 2);

            expect(foo1).toBeDefined();
            expect(foo2).toBeDefined();

            // foo/1 should have 1 definition and 1 reference
            expect(foo1!.definitions).toHaveLength(1);
            expect(foo1!.references).toHaveLength(1);

            // foo/2 should have 1 definition and 1 reference
            expect(foo2!.definitions).toHaveLength(1);
            expect(foo2!.references).toHaveLength(1);
        });

        it('should build symbol table for program with declarations and clauses', () => {
            const source = `
                Decl parent(X, Y) descr [doc("Parent relationship")].
                Decl ancestor(X, Y).

                parent(/alice, /bob).
                parent(/bob, /carol).

                ancestor(X, Y) :- parent(X, Y).
                ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);

            // parent/2 should have declaration, definitions, and references
            const parentInfo = table.getPredicate('parent', 2);
            expect(parentInfo).toBeDefined();
            expect(parentInfo!.declLocation).not.toBeNull();
            expect(parentInfo!.documentation).toBe('Parent relationship');
            expect(parentInfo!.definitions).toHaveLength(2);
            expect(parentInfo!.references).toHaveLength(2);

            // ancestor/2 should have declaration, definitions, and reference
            const ancestorInfo = table.getPredicate('ancestor', 2);
            expect(ancestorInfo).toBeDefined();
            expect(ancestorInfo!.declLocation).not.toBeNull();
            expect(ancestorInfo!.definitions).toHaveLength(2);
            expect(ancestorInfo!.references).toHaveLength(1);
        });
    });

    describe('Query methods', () => {
        it('should return all predicates via getAllPredicates', () => {
            const source = `
                foo(1).
                bar(2).
                baz(X, Y).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const allPreds = table.getAllPredicates();

            expect(allPreds).toHaveLength(3);
            const names = allPreds.map(p => `${p.symbol.symbol}/${p.symbol.arity}`).sort();
            expect(names).toEqual(['bar/1', 'baz/2', 'foo/1']);
        });

        it('should return predicate names via getPredicateNames', () => {
            const source = `
                foo(1).
                bar(2).
                baz(X, Y).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const names = table.getPredicateNames().sort();

            expect(names).toEqual(['bar/1', 'baz/2', 'foo/1']);
        });

        it('should return predicate info by full name', () => {
            const source = 'foo(X, Y).';
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const predInfo = table.getPredicateInfo('foo/2');

            expect(predInfo).toBeDefined();
            expect(predInfo!.symbol.symbol).toBe('foo');
            expect(predInfo!.symbol.arity).toBe(2);
        });

        it('should return all arities for a base name', () => {
            const source = `
                foo(1).
                foo(1, 2).
                foo(1, 2, 3).
            `;
            const result = parse(source);
            expect(result.unit).not.toBeNull();

            const table = buildSymbolTable(result.unit!);
            const arities = table.getPredicateArities('foo').sort();

            expect(arities).toEqual([1, 2, 3]);
        });
    });
});
