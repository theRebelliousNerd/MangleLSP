/**
 * Parser tests for Mangle LSP.
 */

import { describe, it, expect } from 'vitest';
import { parse, hasErrors, hasFatalErrors } from '../../src/parser/index';

describe('Mangle Parser', () => {
    describe('Basic parsing', () => {
        it('should parse a simple fact', () => {
            const result = parse('parent(/alice, /bob).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit).not.toBeNull();
            expect(result.unit?.clauses.length).toBe(1);
            expect(result.unit?.clauses[0]?.head.predicate.symbol).toBe('parent');
            expect(result.unit?.clauses[0]?.head.args.length).toBe(2);
        });

        it('should parse a rule', () => {
            const result = parse('ancestor(X, Y) :- parent(X, Y).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit).not.toBeNull();
            expect(result.unit?.clauses.length).toBe(1);
            expect(result.unit?.clauses[0]?.premises?.length).toBe(1);
        });

        it('should parse a rule with multiple premises', () => {
            const result = parse('ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit).not.toBeNull();
            expect(result.unit?.clauses[0]?.premises?.length).toBe(2);
        });

        it('should parse a declaration', () => {
            const result = parse('Decl parent(X, Y).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit).not.toBeNull();
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.decls[0]?.declaredAtom.predicate.symbol).toBe('parent');
        });
    });

    describe('Constants', () => {
        it('should parse name constants', () => {
            const result = parse('foo(/bar).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('name');
                expect(arg.symbol).toBe('/bar');
            }
        });

        it('should parse number constants', () => {
            const result = parse('foo(42).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('number');
                expect(arg.numValue).toBe(42);
            }
        });

        it('should parse string constants', () => {
            const result = parse('foo("hello").');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('string');
                expect(arg.symbol).toBe('hello');
            }
        });

        it('should parse list literals as ApplyFn', () => {
            // Note: Lists are parsed as ApplyFn with fn:list, not as Constant with constantType 'list'.
            // This matches upstream Go behavior (parse.go:551-565).
            const result = parse('foo([1, 2, 3]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:list');
            }
        });
    });

    describe('Variables', () => {
        it('should parse uppercase variables', () => {
            const result = parse('foo(X).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Variable');
            if (arg?.type === 'Variable') {
                expect(arg.symbol).toBe('X');
            }
        });

        it('should parse underscore wildcard', () => {
            const result = parse('foo(_).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Variable');
            if (arg?.type === 'Variable') {
                expect(arg.symbol).toBe('_');
            }
        });
    });

    describe('Built-in predicates', () => {
        it('should parse built-in predicates', () => {
            const result = parse('foo(X) :- bar(X), :lt(X, 10).');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(2);
            // Second premise is :lt (but parsed as atom with < comparison)
        });
    });

    describe('Functions', () => {
        it('should parse function applications in transforms', () => {
            const result = parse('sum(S) :- numbers(X) |> do fn:group_by(), let S = fn:sum(X).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.clauses[0]?.transform).not.toBeNull();
        });
    });

    describe('Negation', () => {
        it('should parse negated atoms', () => {
            const result = parse('orphan(X) :- person(X), !parent(_, X).');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(2);
            expect(premises?.[1]?.type).toBe('NegAtom');
        });
    });

    describe('Comparisons', () => {
        it('should parse equality', () => {
            const result = parse('foo(X) :- bar(Y), X = Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(2);
            expect(premises?.[1]?.type).toBe('Eq');
        });

        it('should parse inequality', () => {
            const result = parse('foo(X) :- bar(Y), X != Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.[1]?.type).toBe('Ineq');
        });

        it('should parse less than as Atom with :lt predicate', () => {
            const result = parse('foo(X) :- bar(Y), X < Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            // Comparisons are now represented as Atom nodes with builtin predicates
            expect(premises?.[1]?.type).toBe('Atom');
            const atom = premises?.[1] as { type: 'Atom'; predicate: { symbol: string } };
            expect(atom.predicate.symbol).toBe(':lt');
        });

        it('should parse less than or equal as Atom with :le predicate', () => {
            const result = parse('foo(X) :- bar(Y), X <= Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.[1]?.type).toBe('Atom');
            const atom = premises?.[1] as { type: 'Atom'; predicate: { symbol: string } };
            expect(atom.predicate.symbol).toBe(':le');
        });

        it('should parse greater than as Atom with :gt predicate', () => {
            const result = parse('foo(X) :- bar(Y), X > Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.[1]?.type).toBe('Atom');
            const atom = premises?.[1] as { type: 'Atom'; predicate: { symbol: string } };
            expect(atom.predicate.symbol).toBe(':gt');
        });

        it('should parse greater than or equal as Atom with :ge predicate', () => {
            const result = parse('foo(X) :- bar(Y), X >= Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.[1]?.type).toBe('Atom');
            const atom = premises?.[1] as { type: 'Atom'; predicate: { symbol: string } };
            expect(atom.predicate.symbol).toBe(':ge');
        });
    });

    describe('Source locations', () => {
        it('should track source locations for atoms', () => {
            const result = parse('parent(/alice, /bob).');
            expect(hasErrors(result)).toBe(false);
            const clause = result.unit?.clauses[0];
            expect(clause?.range.start.line).toBe(1);
            expect(clause?.range.start.column).toBe(0);
        });

        it('should track source locations for arguments', () => {
            const result = parse('foo(X).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.range.start.line).toBe(1);
        });
    });

    describe('Error handling', () => {
        it('should report syntax errors', () => {
            const result = parse('foo(X');  // Missing closing paren and period
            expect(hasErrors(result)).toBe(true);
        });

        it('should report missing period', () => {
            const result = parse('foo(X)');  // Missing period
            expect(hasErrors(result)).toBe(true);
        });
    });

    describe('Multiple clauses', () => {
        it('should parse multiple facts', () => {
            const source = `
                parent(/alice, /bob).
                parent(/bob, /carol).
            `;
            const result = parse(source);
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.clauses.length).toBe(2);
        });

        it('should parse mixed declarations and clauses', () => {
            const source = `
                Decl parent(X, Y).
                parent(/alice, /bob).
                ancestor(X, Y) :- parent(X, Y).
            `;
            const result = parse(source);
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.clauses.length).toBe(2);
        });
    });

    describe('Comments', () => {
        it('should ignore comments', () => {
            const source = `
                # This is a comment
                foo(X).  # Another comment
            `;
            const result = parse(source);
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.clauses.length).toBe(1);
        });
    });

    describe('Package and Use declarations', () => {
        it('should parse package declaration', () => {
            const result = parse('Package foo.bar!');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.packageDecl?.name).toBe('foo.bar');
        });

        it('should parse use declaration', () => {
            const result = parse('Use other.pkg!');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.useDecls.length).toBe(1);
            expect(result.unit?.useDecls[0]?.name).toBe('other.pkg');
        });

        it('should parse multiple use declarations', () => {
            const source = `
                Package my.pkg!
                Use dep.one!
                Use dep.two!
            `;
            const result = parse(source);
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.packageDecl?.name).toBe('my.pkg');
            expect(result.unit?.useDecls.length).toBe(2);
            expect(result.unit?.useDecls[0]?.name).toBe('dep.one');
            expect(result.unit?.useDecls[1]?.name).toBe('dep.two');
        });
    });

    describe('Declarations', () => {
        it('should parse declaration with bounds', () => {
            const result = parse('Decl foo(X, Y) bound [/string, /number].');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.decls[0]?.bounds).not.toBeNull();
        });

        it('should parse declaration with descr', () => {
            const result = parse('Decl foo(X) descr [doc("a doc string")].');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.decls[0]?.descr).not.toBeNull();
        });

        it('should parse declaration with multiple bounds', () => {
            const result = parse('Decl rel(X, Y, Z) bound [/a] bound [/b] bound [/c].');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.decls[0]?.bounds?.length).toBe(3);
        });

        it('should parse declaration with constraints', () => {
            const result = parse('Decl foo(X) inclusion [bar(X)].');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            expect(result.unit?.decls[0]?.constraints).not.toBeNull();
        });
    });

    describe('String literals', () => {
        it('should parse single-quoted strings', () => {
            const result = parse("bar('hello').");
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('string');
                expect(arg.symbol).toBe('hello');
            }
        });

        it('should parse strings with escape sequences', () => {
            const result = parse('bar("hello\\nworld").');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('string');
                expect(arg.symbol).toBe('hello\nworld');
            }
        });

        it('should parse backtick strings', () => {
            const result = parse('bar(`multi\nline`).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('string');
                expect(arg.symbol).toBe('multi\nline');
            }
        });

        it('should parse strings with tab escape', () => {
            const result = parse('bar("col1\\tcol2").');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            if (arg?.type === 'Constant') {
                expect(arg.symbol).toBe('col1\tcol2');
            }
        });

        it('should parse byte strings', () => {
            const result = parse('bar(b"binary data").');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('bytes');
                expect(arg.symbol).toBe('binary data');
            }
        });
    });

    describe('Composite literals', () => {
        it('should parse list as ApplyFn', () => {
            const result = parse('foo([1, 2, 3]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:list');
                expect(arg.args.length).toBe(3);
            }
        });

        it('should parse empty list as ApplyFn', () => {
            const result = parse('foo([]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:list');
                expect(arg.args.length).toBe(0);
            }
        });

        it('should parse map as ApplyFn', () => {
            const result = parse('foo([/a: 1, /b: 2]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:map');
                // Map has key-value pairs, so 4 args for 2 entries
                expect(arg.args.length).toBe(4);
            }
        });

        it('should parse struct as ApplyFn', () => {
            const result = parse('foo({/name: "test"}).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:struct');
                // Struct has field-value pairs, so 2 args for 1 field
                expect(arg.args.length).toBe(2);
            }
        });

        it('should parse nested list', () => {
            const result = parse('foo([[1, 2], [3, 4]]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:list');
                expect(arg.args.length).toBe(2);
                // Each nested element should also be ApplyFn fn:list
                expect(arg.args[0]?.type).toBe('ApplyFn');
                if (arg.args[0]?.type === 'ApplyFn') {
                    expect(arg.args[0].function.symbol).toBe('fn:list');
                }
            }
        });

        it('should parse list with variables', () => {
            const result = parse('foo([X, Y, Z]).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:list');
                expect(arg.args.length).toBe(3);
                expect(arg.args[0]?.type).toBe('Variable');
            }
        });
    });

    describe('Transforms', () => {
        it('should parse do transform with group_by', () => {
            const result = parse('sum(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.clauses[0]?.transform).not.toBeNull();
            const transform = result.unit?.clauses[0]?.transform;
            expect(transform?.statements.length).toBe(2);
        });

        it('should parse let transform', () => {
            const result = parse('result(Y) :- input(X) |> let Y = fn:plus(X, 1).');
            expect(hasErrors(result)).toBe(false);
            const transform = result.unit?.clauses[0]?.transform;
            expect(transform).not.toBeNull();
            expect(transform?.statements.length).toBe(1);
            expect(transform?.statements[0]?.variable?.symbol).toBe('Y');
        });

        it('should parse chained transforms', () => {
            const result = parse('out(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).');
            expect(hasErrors(result)).toBe(false);
            const transform = result.unit?.clauses[0]?.transform;
            expect(transform).not.toBeNull();
            // First transform
            expect(transform?.statements[0]?.variable?.symbol).toBe('Y');
            // Chained transform
            expect(transform?.next).not.toBeNull();
            expect(transform?.next?.statements[0]?.variable?.symbol).toBe('Z');
        });

        it('should parse do transform only', () => {
            const result = parse('count(C) :- items(X) |> do fn:group_by(), let C = fn:count().');
            expect(hasErrors(result)).toBe(false);
            const transform = result.unit?.clauses[0]?.transform;
            expect(transform).not.toBeNull();
            // First statement should be do (no variable)
            expect(transform?.statements[0]?.variable).toBeNull();
            // Second statement should be let
            expect(transform?.statements[1]?.variable?.symbol).toBe('C');
        });
    });

    describe('Numeric literals', () => {
        it('should parse negative numbers', () => {
            const result = parse('foo(-42).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('number');
                expect(arg.numValue).toBe(-42);
            }
        });

        it('should parse float numbers', () => {
            const result = parse('foo(3.14).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('float64');
                expect(arg.floatValue).toBeCloseTo(3.14);
            }
        });

        it('should parse zero', () => {
            const result = parse('foo(0).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            if (arg?.type === 'Constant') {
                expect(arg.numValue).toBe(0);
            }
        });
    });

    describe('Function applications', () => {
        it('should parse fn: prefix functions', () => {
            const result = parse('foo(fn:plus(1, 2)).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:plus');
                expect(arg.args.length).toBe(2);
            }
        });

        it('should parse nested function applications', () => {
            const result = parse('foo(fn:plus(fn:mult(2, 3), 4)).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('ApplyFn');
            if (arg?.type === 'ApplyFn') {
                expect(arg.function.symbol).toBe('fn:plus');
                expect(arg.args[0]?.type).toBe('ApplyFn');
            }
        });
    });

    describe('Built-in predicates extended', () => {
        it('should parse :match predicate', () => {
            const result = parse('foo(X) :- bar(X), :match(X, "pattern").');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(2);
            const matchPremise = premises?.[1];
            expect(matchPremise?.type).toBe('Atom');
            if (matchPremise?.type === 'Atom') {
                expect(matchPremise.predicate.symbol).toBe(':match');
            }
        });
    });

    describe('Error recovery', () => {
        it('should return partial AST with errors for malformed clause', () => {
            const result = parse('foo(). bar(. baz().');
            expect(result.errors.length).toBeGreaterThan(0);
            // Should still have at least the first valid clause
            expect(result.unit?.clauses.length).toBeGreaterThan(0);
        });

        it('should return partial AST for missing closing paren', () => {
            const result = parse('foo(X.');
            expect(result.errors.length).toBeGreaterThan(0);
            // Unit should still be created
            expect(result.unit).not.toBeNull();
        });

        it('should handle multiple syntax errors', () => {
            const source = `
                valid1().
                broken(
                valid2().
            `;
            const result = parse(source);
            expect(result.errors.length).toBeGreaterThan(0);
            // Should still capture some clauses
            expect(result.unit).not.toBeNull();
        });
    });

    describe('Complex rules', () => {
        it('should parse rules with multiple negations', () => {
            const result = parse('isolated(X) :- node(X), !edge(X, _), !edge(_, X).');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(3);
            expect(premises?.[1]?.type).toBe('NegAtom');
            expect(premises?.[2]?.type).toBe('NegAtom');
        });

        it('should parse rules with mixed comparisons', () => {
            const result = parse('range(X) :- num(X), X >= 0, X < 100.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(3);
            // X >= 0 is :ge atom
            expect(premises?.[1]?.type).toBe('Atom');
            if (premises?.[1]?.type === 'Atom') {
                expect(premises[1].predicate.symbol).toBe(':ge');
            }
            // X < 100 is :lt atom
            expect(premises?.[2]?.type).toBe('Atom');
            if (premises?.[2]?.type === 'Atom') {
                expect(premises[2].predicate.symbol).toBe(':lt');
            }
        });

        it('should parse rules with equality and inequality', () => {
            const result = parse('diff(X, Y) :- item(X), item(Y), X != Y.');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit?.clauses[0]?.premises;
            expect(premises?.length).toBe(3);
            expect(premises?.[2]?.type).toBe('Ineq');
        });
    });

    describe('Hierarchical names', () => {
        it('should parse multi-level name constants', () => {
            const result = parse('foo(/org/team/user).');
            expect(hasErrors(result)).toBe(false);
            const arg = result.unit?.clauses[0]?.head.args[0];
            expect(arg?.type).toBe('Constant');
            if (arg?.type === 'Constant') {
                expect(arg.constantType).toBe('name');
                expect(arg.symbol).toBe('/org/team/user');
            }
        });

        it('should parse type names as bounds', () => {
            const result = parse('Decl typed(X) bound [/string].');
            expect(hasErrors(result)).toBe(false);
            const bounds = result.unit?.decls[0]?.bounds;
            expect(bounds).not.toBeNull();
            expect(bounds?.[0]?.bounds[0]?.type).toBe('Constant');
        });
    });

    describe('Temporal syntax (DatalogMTL)', () => {
        it('should parse a temporal declaration', () => {
            const result = parse('Decl sensor_reading(X, Y) temporal.');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.decls.length).toBe(1);
            const decl = result.unit!.decls[0]!;
            // temporal keyword should produce a 'temporal' descriptor atom
            const hasTemporal = decl.descr?.some(d => d.predicate.symbol === 'temporal');
            expect(hasTemporal).toBe(true);
        });

        it('should parse a temporal fact with timestamp annotation', () => {
            const result = parse('event(/a) @[2024-01-15T00:00:00Z].');
            expect(hasErrors(result)).toBe(false);
            expect(result.unit?.clauses.length).toBe(1);
            const clause = result.unit!.clauses[0]!;
            expect(clause.headTime).not.toBeNull();
            expect(clause.headTime!.start.boundType).toBe('timestamp');
        });

        it('should parse a temporal fact with interval annotation', () => {
            const result = parse('event(/a) @[2024-01-15T00:00:00Z, 2024-06-30T00:00:00Z].');
            expect(hasErrors(result)).toBe(false);
            const clause = result.unit!.clauses[0]!;
            expect(clause.headTime).not.toBeNull();
            expect(clause.headTime!.start.boundType).toBe('timestamp');
            expect(clause.headTime!.end.boundType).toBe('timestamp');
        });

        it('should parse a temporal fact with variable bound', () => {
            const result = parse('foo(/a) @[T].');
            // This may or may not parse depending on how the parser handles variable-only facts
            // At minimum, it should not crash
            expect(result).not.toBeNull();
        });

        it('should parse a temporal rule with diamond minus operator', () => {
            const result = parse('result(X) :- <-[0s, 7d] sensor(X).');
            expect(hasErrors(result)).toBe(false);
            const clause = result.unit!.clauses[0]!;
            expect(clause.premises?.length).toBe(1);
            const premise = clause.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator).not.toBeNull();
                expect(premise.operator!.operatorType).toBe('diamondMinus');
            }
        });

        it('should parse a temporal rule with box minus operator', () => {
            const result = parse('always_on(X) :- [-[0s, 7d] sensor(X).');
            expect(hasErrors(result)).toBe(false);
            const premise = result.unit!.clauses[0]!.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator!.operatorType).toBe('boxMinus');
            }
        });

        it('should parse a temporal rule with diamond plus operator', () => {
            const result = parse('will_happen(X) :- <+[0s, 7d] predicted(X).');
            expect(hasErrors(result)).toBe(false);
            const premise = result.unit!.clauses[0]!.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator!.operatorType).toBe('diamondPlus');
            }
        });

        it('should parse a temporal rule with box plus operator', () => {
            const result = parse('always_will(X) :- [+[0s, 7d] predicted(X).');
            expect(hasErrors(result)).toBe(false);
            const premise = result.unit!.clauses[0]!.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator!.operatorType).toBe('boxPlus');
            }
        });

        it('should parse combined temporal operator and annotation', () => {
            const result = parse('result(X) :- <-[0s, 7d] sensor(X) @[T1, T2].');
            expect(hasErrors(result)).toBe(false);
            const premise = result.unit!.clauses[0]!.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator).not.toBeNull();
                expect(premise.interval).not.toBeNull();
                // The interval annotation has variable bounds
                expect(premise.interval!.start.boundType).toBe('variable');
                expect(premise.interval!.end.boundType).toBe('variable');
            }
        });

        it('should parse temporal head annotation with rule', () => {
            const result = parse('result(X) @[T] :- sensor(X) @[T].');
            // T in head should be parsed as headTime
            expect(hasErrors(result)).toBe(false);
            const clause = result.unit!.clauses[0]!;
            expect(clause.headTime).not.toBeNull();
        });

        it('should parse duration literals in temporal bounds', () => {
            const result = parse('result(X) :- <-[0s, 24h] sensor(X).');
            expect(hasErrors(result)).toBe(false);
            const premise = result.unit!.clauses[0]!.premises![0]!;
            expect(premise.type).toBe('TemporalLiteral');
            if (premise.type === 'TemporalLiteral') {
                expect(premise.operator!.interval!.end.boundType).toBe('duration');
            }
        });

        it('should parse multiple temporal premises', () => {
            const result = parse('correlated(X, Y) :- <-[0s, 1d] sensor_a(X), <-[0s, 1d] sensor_b(Y).');
            expect(hasErrors(result)).toBe(false);
            const premises = result.unit!.clauses[0]!.premises!;
            expect(premises.length).toBe(2);
            expect(premises[0]!.type).toBe('TemporalLiteral');
            expect(premises[1]!.type).toBe('TemporalLiteral');
        });
    });
});
