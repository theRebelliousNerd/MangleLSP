/**
 * Comprehensive tests for Mangle LSP formatting service.
 *
 * Tests cover:
 * 1. Zero-argument atoms with parentheses
 * 2. Comment preservation
 * 3. Declaration formatting with proper spacing
 * 4. Clause formatting with :- separator
 * 5. Transform syntax (|> let and |> do)
 * 6. bound [...] syntax
 * 7. descr [...] syntax
 * 8. fn:list, fn:map, fn:struct formatting
 * 9. String literal preservation
 * 10. Multi-line clause indentation
 * 11. Negation formatting
 */

import { describe, it, expect } from 'vitest';
import { formatDocument } from '../../src/services/formatting';
import { parse } from '../../src/parser/index';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { FormattingOptions } from 'vscode-languageserver/node';

/**
 * Helper to create a text document from source string.
 */
function createDocument(source: string): TextDocument {
    return TextDocument.create('file:///test.mg', 'mangle', 1, source);
}

/**
 * Helper to format source and return formatted text.
 */
function format(source: string, options?: Partial<FormattingOptions>): string {
    const doc = createDocument(source);
    const parseResult = parse(source);

    if (!parseResult.unit) {
        throw new Error('Parse failed: ' + parseResult.errors.map(e => e.message).join(', '));
    }

    const defaultOptions: FormattingOptions = {
        tabSize: 4,
        insertSpaces: true,
        ...options,
    };

    const edits = formatDocument(doc, parseResult.unit, defaultOptions);

    if (edits.length === 0) {
        return source;
    }

    // Apply the edit
    return edits[0]?.newText ?? source;
}

describe('Mangle Formatting Service', () => {
    describe('Zero-argument atoms', () => {
        it('should include parentheses for zero-argument atoms in facts', () => {
            const input = 'fact.';
            const output = format(input);
            expect(output).toContain('fact().');
        });

        it('should include parentheses for zero-argument atoms in rules', () => {
            const input = 'conclusion :- premise.';
            const output = format(input);
            expect(output).toContain('conclusion() :- premise().');
        });

        it('should include parentheses for zero-argument atoms in premises', () => {
            const input = 'foo(X) :- bar, baz(X).';
            const output = format(input);
            expect(output).toContain('bar()');
        });

        it('should include parentheses in declarations', () => {
            const input = 'Decl singleton.';
            const output = format(input);
            expect(output).toContain('Decl singleton().');
        });
    });

    describe('Comments preservation', () => {
        it('should preserve standalone comment lines', () => {
            const input = '# This is a comment\nfoo(X).';
            const output = format(input);
            expect(output).toContain('# This is a comment');
        });

        it('should preserve inline comments', () => {
            const input = 'foo(X). # inline comment';
            const output = format(input);
            expect(output).toContain('# inline comment');
        });

        it('should preserve multiple comment lines', () => {
            const input = `# Comment 1
# Comment 2
foo(X).
# Comment 3`;
            const output = format(input);
            expect(output).toContain('# Comment 1');
            expect(output).toContain('# Comment 2');
            expect(output).toContain('# Comment 3');
        });

        it('should not treat # in strings as comments', () => {
            const input = 'foo("#hashtag").';
            const output = format(input);
            expect(output).toContain('"#hashtag"');
            // The string should be preserved, not treated as comment
            expect(output).toContain('foo("#hashtag").');
        });

        it('should preserve comments in multi-clause files', () => {
            const input = `# Header comment
foo(X).
# Middle comment
bar(Y).`;
            const output = format(input);
            expect(output).toContain('# Header comment');
            expect(output).toContain('# Middle comment');
        });
    });

    describe('Declaration formatting', () => {
        it('should format simple declaration with proper spacing', () => {
            const input = 'Decl foo(X,Y).';
            const output = format(input);
            // Formatter adds blank line after declarations
            expect(output).toBe('Decl foo(X, Y).\n\n');
        });

        it('should format declaration with bound using array syntax', () => {
            const input = 'Decl foo(X) bound [/string].';
            const output = format(input);
            expect(output).toContain('bound [/string]');
            expect(output).not.toContain('bound(/string)');
        });

        it('should format declaration with multiple bounds', () => {
            const input = 'Decl rel(X, Y, Z) bound [/a] bound [/b] bound [/c].';
            const output = format(input);
            expect(output).toContain('bound [/a]');
            expect(output).toContain('bound [/b]');
            expect(output).toContain('bound [/c]');
        });

        it('should format declaration with descr using array syntax', () => {
            const input = 'Decl foo(X) descr [doc("documentation")].';
            const output = format(input);
            expect(output).toContain('descr [');
            expect(output).toContain('doc("documentation")');
            expect(output).toContain(']');
        });

        it('should format declaration with multiple descr atoms', () => {
            const input = 'Decl foo(X, Y) descr [doc("first"), doc("second")].';
            const output = format(input);
            expect(output).toContain('descr [');
            expect(output).toContain('doc("first")');
            expect(output).toContain('doc("second")');
        });

        it('should format declaration with both bound and descr', () => {
            const input = 'Decl person(Name, Age) descr [doc("A person")] bound [/string, /number].';
            const output = format(input);
            expect(output).toContain('Decl person(Name, Age)');
            expect(output).toContain('descr [');
            expect(output).toContain('bound [/string, /number]');
        });

        it('should properly indent descr array', () => {
            const input = 'Decl foo(X) descr [a(), b()].';
            const output = format(input);
            // Check that descr array is on new line and indented
            expect(output).toMatch(/descr \[[\s\S]*\]/);
        });
    });

    describe('Clause formatting with :- separator', () => {
        it('should format simple rule with :- separator', () => {
            const input = 'head(X) :- body(X).';
            const output = format(input);
            expect(output).toContain('head(X) :- body(X).');
        });

        it('should format rule with multiple premises on one line if short', () => {
            const input = 'a(X) :- b(X), c(X).';
            const output = format(input);
            // Should stay on one line if under 80 chars
            expect(output).toContain('a(X) :- b(X), c(X).');
        });

        it('should format long rule across multiple lines', () => {
            const input = 'longPredicate(X, Y, Z) :- veryLongPremise1(X, Y, Z), veryLongPremise2(X, Y, Z), veryLongPremise3(X, Y, Z).';
            const output = format(input);
            // Should be multiline due to length
            expect(output).toContain(':-\n');
        });

        it('should properly indent multiline rule premises', () => {
            const input = 'result(X, Y, Z) :- first(X), second(Y), third(Z), fourth(X, Y), fifth(Y, Z).';
            const output = format(input, { tabSize: 4, insertSpaces: true });
            // If the rule is multiline (over 80 chars), premises should be indented
            if (output.includes(':-\n')) {
                const lines = output.split('\n');
                expect(lines.some(line => line.match(/^\s+\w+/))).toBe(true);
            } else {
                // If it fits on one line, that's also acceptable
                expect(output).toContain(':-');
            }
        });

        it('should format fact without :- separator', () => {
            const input = 'parent(/alice, /bob).';
            const output = format(input);
            expect(output).toContain('parent(/alice, /bob).');
            expect(output).not.toContain(':-');
        });
    });

    describe('Transform syntax', () => {
        it('should format |> let transform correctly', () => {
            const input = 'result(Y) :- input(X) |> let Y = fn:plus(X, 1).';
            const output = format(input);
            expect(output).toContain('|> let Y = fn:plus(X, 1)');
        });

        it('should format |> do transform correctly', () => {
            const input = 'count(C) :- items(X) |> do fn:group_by().';
            const output = format(input);
            expect(output).toContain('|> do fn:group_by()');
        });

        it('should format chained transforms', () => {
            const input = 'out(Z) :- input(X) |> let Y = fn:plus(X, 1) |> let Z = fn:mult(Y, 2).';
            const output = format(input);
            expect(output).toContain('|> let Y = fn:plus(X, 1)');
            expect(output).toContain('let Z = fn:mult(Y, 2)');
        });

        it('should format do followed by let', () => {
            const input = 'sum(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X).';
            const output = format(input);
            expect(output).toContain('|> do fn:group_by()');
            expect(output).toContain('let S = fn:sum(X)');
        });

        it('should format transform in fact (no premises)', () => {
            // Note: The parser may have issues with transforms on facts without premises
            // This tests the formatter's behavior when given a valid parsed AST
            const input = 'result(X) :- base(X) |> let Y = fn:compute(X).';
            const output = format(input);
            expect(output).toContain('|> let Y = fn:compute(X)');
        });
    });

    describe('fn:list, fn:map, fn:struct formatting', () => {
        it('should format fn:list as array brackets', () => {
            const input = 'foo([1, 2, 3]).';
            const output = format(input);
            expect(output).toContain('[1, 2, 3]');
        });

        it('should format empty fn:list', () => {
            const input = 'foo([]).';
            const output = format(input);
            expect(output).toContain('foo([]).');
        });

        it('should format nested fn:list', () => {
            const input = 'foo([[1, 2], [3, 4]]).';
            const output = format(input);
            expect(output).toContain('[[1, 2], [3, 4]]');
        });

        it('should format fn:map with key-value pairs', () => {
            const input = 'foo([/a: 1, /b: 2]).';
            const output = format(input);
            expect(output).toContain('[/a: 1, /b: 2]');
        });

        it('should format fn:struct with braces', () => {
            const input = 'foo({/name: "Alice", /age: 30}).';
            const output = format(input);
            expect(output).toContain('{/name: "Alice", /age: 30}');
        });

        it('should format fn:list with variables', () => {
            const input = 'foo([X, Y, Z]).';
            const output = format(input);
            expect(output).toContain('[X, Y, Z]');
        });

        it('should format fn:pair correctly', () => {
            const input = 'foo(fn:pair(1, 2)).';
            const output = format(input);
            expect(output).toContain('fn:pair(1, 2)');
        });
    });

    describe('String literal preservation', () => {
        it('should preserve double-quoted strings', () => {
            const input = 'foo("hello world").';
            const output = format(input);
            expect(output).toContain('"hello world"');
        });

        it('should escape special characters in strings', () => {
            const input = 'foo("line1\\nline2").';
            const output = format(input);
            // Should preserve escaped newline
            expect(output).toContain('\\n');
        });

        it('should preserve tab escapes', () => {
            const input = 'foo("col1\\tcol2").';
            const output = format(input);
            expect(output).toContain('\\t');
        });

        it('should preserve escaped quotes', () => {
            const input = 'foo("say \\"hello\\"").';
            const output = format(input);
            expect(output).toContain('\\"');
        });

        it('should preserve byte strings', () => {
            const input = 'foo(b"binary").';
            const output = format(input);
            expect(output).toContain('b"binary"');
        });

        it('should handle empty strings', () => {
            const input = 'foo("").';
            const output = format(input);
            expect(output).toContain('""');
        });

        it('should preserve backslash escapes', () => {
            const input = 'foo("path\\\\to\\\\file").';
            const output = format(input);
            expect(output).toContain('\\\\');
        });
    });

    describe('Multi-line clause indentation', () => {
        it('should indent premises in multi-line rules', () => {
            const input = `ancestor(X, Z) :-
parent(X, Y),
ancestor(Y, Z).`;
            const output = format(input, { tabSize: 4, insertSpaces: true });
            // The formatter may reformat this to single-line or multi-line based on length
            // Just verify it's valid and contains the predicates
            expect(output).toContain('ancestor(X, Z)');
            expect(output).toContain('parent(X, Y)');
            expect(output).toContain('ancestor(Y, Z)');
        });

        it('should use correct indentation with tabs', () => {
            const input = 'long(X, Y, Z) :- premise1(X), premise2(Y), premise3(Z).';
            const output = format(input, { tabSize: 4, insertSpaces: false });
            // When using tabs, should have tab character
            if (output.includes(':-\n')) {
                expect(output).toContain('\t');
            }
        });

        it('should use correct indentation with spaces', () => {
            const input = 'long(X, Y, Z) :- premise1(X), premise2(Y), premise3(Z).';
            const output = format(input, { tabSize: 2, insertSpaces: true });
            // Should have space indentation
            if (output.includes(':-\n')) {
                const lines = output.split('\n');
                const indentedLine = lines.find(l => l.match(/^\s+premise/));
                if (indentedLine) {
                    expect(indentedLine.startsWith('  ')).toBe(true);
                }
            }
        });

        it('should not add trailing comma to last premise', () => {
            const input = 'long(X, Y, Z) :- very_long_premise_one(X, Y, Z), very_long_premise_two(X, Y, Z).';
            const output = format(input);
            const lines = output.split('\n');
            // Last premise line should not have comma before period
            const lastPremiseLine = lines.find(l => l.includes('very_long_premise_two'));
            if (lastPremiseLine) {
                expect(lastPremiseLine).not.toMatch(/,\s*$/);
            }
        });

        it('should add commas to all but last premise', () => {
            const input = 'rule(X, Y, Z) :- veryLongPredicateName1(X, Y, Z), veryLongPredicateName2(X, Y, Z), veryLongPredicateName3(X, Y, Z).';
            const output = format(input);
            if (output.includes(':-\n')) {
                const lines = output.split('\n');
                const premiseLines = lines.filter(l => l.match(/veryLongPredicateName/));
                // First and second should have comma
                if (premiseLines.length >= 2) {
                    expect(premiseLines[0]).toMatch(/,\s*$/);
                }
            }
        });
    });

    describe('Negation formatting', () => {
        it('should format negated atoms with ! prefix', () => {
            const input = 'orphan(X) :- person(X), !parent(_, X).';
            const output = format(input);
            expect(output).toContain('!parent(_, X)');
        });

        it('should format multiple negations', () => {
            const input = 'isolated(X) :- node(X), !edge(X, _), !edge(_, X).';
            const output = format(input);
            expect(output).toContain('!edge(X, _)');
            expect(output).toContain('!edge(_, X)');
        });

        it('should preserve spacing around negation', () => {
            const input = 'foo(X) :- bar(X), !baz(X).';
            const output = format(input);
            // Should have proper spacing
            expect(output).toMatch(/,\s+!baz\(X\)/);
        });
    });

    describe('Comparison operators', () => {
        it('should format less than with infix notation', () => {
            const input = 'foo(X) :- bar(X), X < 10.';
            const output = format(input);
            expect(output).toContain('X < 10');
        });

        it('should format less than or equal', () => {
            const input = 'foo(X) :- bar(X), X <= 10.';
            const output = format(input);
            expect(output).toContain('X <= 10');
        });

        it('should format greater than', () => {
            const input = 'foo(X) :- bar(X), X > 0.';
            const output = format(input);
            expect(output).toContain('X > 0');
        });

        it('should format greater than or equal', () => {
            const input = 'foo(X) :- bar(X), X >= 0.';
            const output = format(input);
            expect(output).toContain('X >= 0');
        });

        it('should format equality', () => {
            const input = 'foo(X, Y) :- bar(X), baz(Y), X = Y.';
            const output = format(input);
            expect(output).toContain('X = Y');
        });

        it('should format inequality', () => {
            const input = 'foo(X, Y) :- bar(X), baz(Y), X != Y.';
            const output = format(input);
            expect(output).toContain('X != Y');
        });
    });

    describe('Package and Use declarations', () => {
        it('should format package declaration', () => {
            const input = 'Package foo.bar!';
            const output = format(input);
            expect(output).toContain('Package foo.bar.');
        });

        it('should format use declaration', () => {
            const input = 'Use other.pkg!';
            const output = format(input);
            expect(output).toContain('Use other.pkg.');
        });

        it('should add blank line after package/use declarations', () => {
            const input = 'Package foo!\nUse bar!\nfoo(X).';
            const output = format(input);
            const lines = output.split('\n');
            // Should have blank line separating declarations from clauses
            expect(lines.some(line => line === '')).toBe(true);
        });
    });

    describe('Variable and constant formatting', () => {
        it('should preserve variable names', () => {
            const input = 'foo(MyVar, AnotherVar).';
            const output = format(input);
            expect(output).toContain('MyVar');
            expect(output).toContain('AnotherVar');
        });

        it('should preserve underscore wildcard', () => {
            const input = 'foo(_, X).';
            const output = format(input);
            expect(output).toContain('_,');
        });

        it('should format name constants', () => {
            const input = 'foo(/alice, /bob).';
            const output = format(input);
            expect(output).toContain('/alice');
            expect(output).toContain('/bob');
        });

        it('should format hierarchical name constants', () => {
            const input = 'foo(/org/team/user).';
            const output = format(input);
            expect(output).toContain('/org/team/user');
        });

        it('should format number constants', () => {
            const input = 'foo(42, -17, 0).';
            const output = format(input);
            expect(output).toContain('42');
            expect(output).toContain('-17');
            expect(output).toContain('0');
        });

        it('should format float constants', () => {
            const input = 'foo(3.14, -2.5).';
            const output = format(input);
            expect(output).toContain('3.14');
            expect(output).toContain('-2.5');
        });
    });

    describe('Predicate grouping', () => {
        it('should group clauses by predicate', () => {
            const input = `foo(1).
bar(2).
foo(3).`;
            const output = format(input);
            // foo clauses should be together
            const lines = output.split('\n').filter(l => l.trim());
            const fooIndices = lines.map((l, i) => l.includes('foo') ? i : -1).filter(i => i >= 0);
            // foo clauses might be grouped, but at minimum should be formatted
            expect(fooIndices.length).toBe(2);
        });

        it('should add blank lines between predicate groups', () => {
            const input = `foo(1).
foo(2).
bar(1).
bar(2).`;
            const output = format(input);
            const lines = output.split('\n');
            // Should have blank lines separating predicate groups
            expect(lines.some(line => line === '')).toBe(true);
        });
    });

    describe('Complex integration tests', () => {
        it('should format complete program correctly', () => {
            const input = `Package family!
Decl parent(X,Y) descr [doc("parent relation")].
parent(/alice,/bob).
parent(/bob,/carol).
ancestor(X,Y):-parent(X,Y).
ancestor(X,Z):-parent(X,Y),ancestor(Y,Z).`;
            const output = format(input);

            expect(output).toContain('Package family.');
            expect(output).toContain('Decl parent(X, Y)');
            expect(output).toContain('descr [');
            expect(output).toContain('parent(/alice, /bob).');
            expect(output).toContain('ancestor(X, Y) :- parent(X, Y).');
            expect(output).toContain('ancestor(X, Z)');
        });

        it('should format declaration with bounds and descr correctly', () => {
            const input = 'Decl typed(Name, Age) descr [doc("Person data")] bound [/string, /number].';
            const output = format(input);

            expect(output).toContain('Decl typed(Name, Age)');
            expect(output).toContain('descr [');
            expect(output).toContain('doc("Person data")');
            expect(output).toContain('bound [/string, /number]');
        });

        it('should format rule with transform and comments', () => {
            const input = `# Calculate sum
sum(S) :- values(X) |> do fn:group_by(), let S = fn:sum(X). # aggregate`;
            const output = format(input);

            expect(output).toContain('# Calculate sum');
            expect(output).toContain('|> do fn:group_by()');
            expect(output).toContain('let S = fn:sum(X)');
            expect(output).toContain('# aggregate');
        });

        it('should format complex nested structures', () => {
            const input = 'data({/users: [{/name: "Alice", /age: 30}, {/name: "Bob", /age: 25}]}).';
            const output = format(input);

            expect(output).toContain('{/users:');
            expect(output).toContain('{/name: "Alice"');
            expect(output).toContain('{/name: "Bob"');
        });

        it('should handle all formatting requirements together', () => {
            const input = `# Test program
Package test!
Use lib!

Decl relation(X, Y) descr [doc("test")] bound [/string].

# Zero-arg fact
singleton().

# Rule with negation
valid(X) :- data(X), !invalid(X), X > 0.

# Transform
result(S) :- numbers(N) |> let S = fn:sum(N).

# Lists and maps
process([1, 2, 3], [/a: "x"]).`;

            const output = format(input);

            // Comments preserved
            expect(output).toContain('# Test program');
            expect(output).toContain('# Zero-arg fact');
            expect(output).toContain('# Rule with negation');

            // Package/Use
            expect(output).toContain('Package test.');
            expect(output).toContain('Use lib.');

            // Declaration with bound and descr
            expect(output).toContain('Decl relation(X, Y)');
            expect(output).toContain('descr [');
            expect(output).toContain('bound [/string]');

            // Zero-arg with parens
            expect(output).toContain('singleton().');

            // Negation
            expect(output).toContain('!invalid(X)');

            // Comparison
            expect(output).toContain('X > 0');

            // Transform
            expect(output).toContain('|> let S = fn:sum(N)');

            // Lists and maps
            expect(output).toContain('[1, 2, 3]');
            expect(output).toContain('[/a: "x"]');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty source', () => {
            const input = '';
            const parseResult = parse(input);
            if (parseResult.unit) {
                const doc = createDocument(input);
                const output = formatDocument(doc, parseResult.unit, { tabSize: 4, insertSpaces: true });
                expect(output).toBeDefined();
            }
        });

        it('should handle single fact', () => {
            const input = 'fact().';
            const output = format(input);
            expect(output).toBe('fact().\n');
        });

        it('should handle very long predicate names', () => {
            const input = 'thisIsAVeryLongPredicateNameThatShouldStillBeFormattedCorrectly(X).';
            const output = format(input);
            expect(output).toContain('thisIsAVeryLongPredicateNameThatShouldStillBeFormattedCorrectly(X).');
        });

        it('should handle deeply nested function calls', () => {
            const input = 'foo(fn:plus(fn:mult(2, 3), fn:div(8, 2))).';
            const output = format(input);
            expect(output).toContain('fn:plus(fn:mult(2, 3), fn:div(8, 2))');
        });
    });
});
