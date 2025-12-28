"use strict";
/**
 * Completion provider for Mangle LSP.
 *
 * Provides code completion for predicates, built-in predicates/functions, and variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletions = getCompletions;
exports.resolveCompletion = resolveCompletion;
const node_1 = require("vscode-languageserver/node");
const ast_1 = require("../parser/ast");
const predicates_1 = require("../builtins/predicates");
const functions_1 = require("../builtins/functions");
/**
 * Get completion items at a position.
 */
function getCompletions(document, unit, symbolTable, position) {
    const items = [];
    // Get the text before the cursor to determine context
    const lineText = document.getText({
        start: { line: position.line, character: 0 },
        end: position,
    });
    const context = analyzeContext(lineText, position);
    // Create the range for text replacement
    const replaceRange = {
        start: context.replaceStart,
        end: position,
    };
    switch (context.type) {
        case 'builtin-predicate':
            // After ':' - suggest built-in predicates
            items.push(...getBuiltinPredicateCompletions(context.prefix, replaceRange));
            break;
        case 'function':
            // After 'fn:' - suggest built-in functions
            items.push(...getBuiltinFunctionCompletions(context.prefix, replaceRange));
            break;
        case 'transform-do':
            // After 'do ' in a transform - suggest fn:group_by first
            items.push(...getTransformDoCompletions(replaceRange));
            break;
        case 'transform-let':
            // After 'let X = ' in a transform - suggest reducer functions
            items.push(...getReducerFunctionCompletions(replaceRange));
            break;
        case 'general':
        default:
            // General completion - suggest user predicates, keywords, and variables
            if (symbolTable) {
                items.push(...getPredicateCompletions(symbolTable, context.prefix, replaceRange));
            }
            items.push(...getKeywordCompletions(replaceRange));
            // Also suggest built-in predicates (without the leading ':')
            items.push(...getBuiltinPredicateCompletions(context.prefix, replaceRange));
            // Add variable completions from current clause
            if (unit) {
                items.push(...getVariableCompletions(unit, position, context.prefix, replaceRange));
            }
            break;
    }
    return items;
}
/**
 * Analyze the context to determine what completions to show.
 */
function analyzeContext(lineText, position) {
    // Check for 'fn:' prefix - should replace from 'fn:'
    const fnMatch = lineText.match(/fn:(\w*)$/);
    if (fnMatch) {
        const prefixStart = lineText.length - fnMatch[0].length;
        return {
            type: 'function',
            prefix: fnMatch[1] || '',
            replaceStart: { line: position.line, character: prefixStart },
        };
    }
    // Check for ':' prefix (built-in predicate)
    // But only if NOT inside a string or after a name constant
    const colonMatch = lineText.match(/:(\w*)$/);
    if (colonMatch) {
        // Check if this colon is inside a string
        if (isInsideString(lineText)) {
            // Don't trigger on : inside strings
            return analyzeGeneralContext(lineText, position);
        }
        // Check if this colon is part of a name constant (preceded by /)
        // e.g., /foo/bar:baz - the : here is part of the name
        const beforeColon = lineText.slice(0, lineText.length - colonMatch[0].length);
        if (beforeColon.match(/\/[\w\/]*$/)) {
            // This is a name constant, not a builtin predicate
            return analyzeGeneralContext(lineText, position);
        }
        // Check if this is a nested builtin like :string:contains
        // In this case, include the full prefix
        const nestedBuiltinMatch = lineText.match(/:(\w+:)?(\w*)$/);
        if (nestedBuiltinMatch) {
            const fullMatch = nestedBuiltinMatch[0];
            const prefixStart = lineText.length - fullMatch.length;
            return {
                type: 'builtin-predicate',
                prefix: fullMatch.slice(1), // Remove leading ':'
                replaceStart: { line: position.line, character: prefixStart },
            };
        }
        const prefixStart = lineText.length - colonMatch[0].length;
        return {
            type: 'builtin-predicate',
            prefix: colonMatch[1] || '',
            replaceStart: { line: position.line, character: prefixStart },
        };
    }
    // Check for 'do ' in transform context
    if (/\|>\s*do\s+$/.test(lineText)) {
        return {
            type: 'transform-do',
            prefix: '',
            replaceStart: position, // No text to replace
        };
    }
    // Check for 'let X = ' in transform context
    if (/let\s+\w+\s*=\s*$/.test(lineText)) {
        return {
            type: 'transform-let',
            prefix: '',
            replaceStart: position, // No text to replace
        };
    }
    return analyzeGeneralContext(lineText, position);
}
/**
 * Analyze general context for completion.
 */
function analyzeGeneralContext(lineText, position) {
    // Get the last word as prefix
    const wordMatch = lineText.match(/(\w*)$/);
    const prefix = wordMatch?.[1] ?? '';
    const prefixStart = lineText.length - prefix.length;
    return {
        type: 'general',
        prefix,
        replaceStart: { line: position.line, character: prefixStart },
    };
}
/**
 * Check if the cursor position is inside a string literal.
 */
function isInsideString(lineText) {
    let inString = false;
    let stringChar = '';
    let i = 0;
    while (i < lineText.length) {
        const char = lineText[i];
        if (inString) {
            if (char === '\\' && i + 1 < lineText.length) {
                // Skip escaped character
                i += 2;
                continue;
            }
            if (char === stringChar) {
                inString = false;
            }
        }
        else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            }
        }
        i++;
    }
    return inString;
}
/**
 * Get completions for built-in predicates.
 */
function getBuiltinPredicateCompletions(prefix, replaceRange) {
    return predicates_1.BUILTIN_PREDICATES
        .filter(p => p.name.includes(prefix))
        .map((pred, index) => ({
        label: pred.name,
        kind: node_1.CompletionItemKind.Function,
        detail: `Built-in predicate (${pred.mode.join(', ')})`,
        documentation: pred.doc,
        textEdit: node_1.TextEdit.replace(replaceRange, createPredicateSnippet(pred.name, pred.arity)),
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        sortText: `0${index.toString().padStart(3, '0')}`, // Sort built-ins first
    }));
}
/**
 * Get completions for built-in functions.
 */
function getBuiltinFunctionCompletions(prefix, replaceRange) {
    return functions_1.ALL_BUILTIN_FUNCTIONS
        .filter(f => f.name.replace('fn:', '').startsWith(prefix))
        .map((fn, index) => ({
        label: fn.name,
        kind: node_1.CompletionItemKind.Function,
        detail: fn.isReducer ? 'Reducer function' : 'Built-in function',
        documentation: fn.doc,
        textEdit: node_1.TextEdit.replace(replaceRange, createFunctionSnippet(fn.name, fn.arity)),
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        sortText: `0${index.toString().padStart(3, '0')}`,
    }));
}
/**
 * Get completions for transform 'do' context (fn:group_by first).
 */
function getTransformDoCompletions(replaceRange) {
    return [
        {
            label: 'fn:group_by',
            kind: node_1.CompletionItemKind.Function,
            detail: 'Group tuples by key variables',
            documentation: 'Groups all tuples by the values of key variables. Empty group_by() treats the whole relation as a group.',
            textEdit: node_1.TextEdit.replace(replaceRange, 'fn:group_by(${1:Key})'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '000', // First
        },
        ...functions_1.ALL_BUILTIN_FUNCTIONS
            .filter(f => f.name !== 'fn:group_by')
            .map((fn, index) => ({
            label: fn.name,
            kind: node_1.CompletionItemKind.Function,
            detail: fn.isReducer ? 'Reducer function' : 'Built-in function',
            documentation: fn.doc,
            textEdit: node_1.TextEdit.replace(replaceRange, createFunctionSnippet(fn.name, fn.arity)),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: `1${index.toString().padStart(3, '0')}`,
        })),
    ];
}
/**
 * Get completions for transform 'let' context (reducer functions).
 */
function getReducerFunctionCompletions(replaceRange) {
    return functions_1.REDUCER_FUNCTIONS.map((fn, index) => ({
        label: fn.name,
        kind: node_1.CompletionItemKind.Function,
        detail: 'Reducer function',
        documentation: fn.doc,
        textEdit: node_1.TextEdit.replace(replaceRange, createFunctionSnippet(fn.name, fn.arity)),
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        sortText: `0${index.toString().padStart(3, '0')}`,
    }));
}
/**
 * Get completions for user-defined predicates.
 */
function getPredicateCompletions(symbolTable, prefix, replaceRange) {
    return symbolTable.getAllPredicates()
        .filter(p => !p.symbol.symbol.startsWith(':')) // Exclude built-ins
        .filter(p => p.symbol.symbol.startsWith(prefix))
        .map((pred, index) => ({
        label: pred.symbol.symbol,
        kind: node_1.CompletionItemKind.Method,
        detail: `${pred.symbol.symbol}/${pred.symbol.arity}`,
        documentation: pred.documentation || undefined,
        textEdit: node_1.TextEdit.replace(replaceRange, createPredicateSnippet(pred.symbol.symbol, pred.symbol.arity)),
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        sortText: `1${index.toString().padStart(3, '0')}`,
    }));
}
/**
 * Get variable completions from the current clause.
 */
function getVariableCompletions(unit, position, prefix, replaceRange) {
    // Find the clause containing the cursor position
    const clause = findClauseAtPosition(unit, position);
    if (!clause) {
        return [];
    }
    // Get all variables in this clause
    const variables = (0, ast_1.collectClauseVariables)(clause);
    // Filter by prefix and create completion items
    const items = [];
    let index = 0;
    for (const varName of Array.from(variables)) {
        // Skip anonymous variable
        if (varName === '_') {
            continue;
        }
        // Filter by prefix (case-sensitive for variables)
        if (prefix && !varName.startsWith(prefix)) {
            continue;
        }
        items.push({
            label: varName,
            kind: node_1.CompletionItemKind.Variable,
            detail: 'Variable',
            textEdit: node_1.TextEdit.replace(replaceRange, varName),
            insertTextFormat: node_1.InsertTextFormat.PlainText,
            sortText: `2${index.toString().padStart(3, '0')}`,
        });
        index++;
    }
    return items;
}
/**
 * Find the clause containing the given position.
 */
function findClauseAtPosition(unit, position) {
    // Convert LSP position (0-indexed line) to source position (1-indexed line)
    const sourcePos = {
        line: position.line + 1,
        column: position.character,
        offset: 0, // Not used for containment check
    };
    for (const clause of unit.clauses) {
        if ((0, ast_1.containsPosition)(clause.range, sourcePos)) {
            return clause;
        }
    }
    return null;
}
/**
 * Get keyword completions.
 */
function getKeywordCompletions(replaceRange) {
    return [
        {
            label: 'Decl',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Declare a predicate',
            textEdit: node_1.TextEdit.replace(replaceRange, 'Decl ${1:predicate}(${2:Args}).'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '300',
        },
        {
            label: 'Package',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Package declaration',
            textEdit: node_1.TextEdit.replace(replaceRange, 'Package ${1:name}.'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '301',
        },
        {
            label: 'Use',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Import package',
            textEdit: node_1.TextEdit.replace(replaceRange, 'Use ${1:package}.'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '302',
        },
        {
            label: 'bound',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Type bound constraint',
            textEdit: node_1.TextEdit.replace(replaceRange, 'bound([${1:type}])'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '303',
        },
        {
            label: 'descr',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Description block',
            textEdit: node_1.TextEdit.replace(replaceRange, 'descr(${1:description})'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '304',
        },
        {
            label: 'let',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Let binding in transform',
            textEdit: node_1.TextEdit.replace(replaceRange, 'let ${1:Var} = ${2:fn:reducer}'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '305',
        },
        {
            label: 'do',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Do statement in transform',
            textEdit: node_1.TextEdit.replace(replaceRange, 'do ${1:fn:group_by(Key)}'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '306',
        },
        {
            label: 'private',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Mark predicate as private',
            textEdit: node_1.TextEdit.replace(replaceRange, 'private'),
            insertTextFormat: node_1.InsertTextFormat.PlainText,
            sortText: '307',
        },
        {
            label: 'external',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Mark predicate as external',
            textEdit: node_1.TextEdit.replace(replaceRange, 'external'),
            insertTextFormat: node_1.InsertTextFormat.PlainText,
            sortText: '308',
        },
        {
            label: 'mode',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Mode declaration for predicate',
            textEdit: node_1.TextEdit.replace(replaceRange, 'mode(${1:+,-})'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '309',
        },
        {
            label: 'doc',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Documentation string',
            textEdit: node_1.TextEdit.replace(replaceRange, 'doc("${1:description}")'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '310',
        },
        {
            label: 'arg',
            kind: node_1.CompletionItemKind.Keyword,
            detail: 'Argument documentation',
            textEdit: node_1.TextEdit.replace(replaceRange, 'arg("${1:name}", "${2:description}")'),
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            sortText: '311',
        },
    ];
}
/**
 * Create a snippet for a predicate call.
 */
function createPredicateSnippet(name, arity) {
    if (arity === 0) {
        return name;
    }
    const args = Array.from({ length: arity }, (_, i) => `\${${i + 1}:arg${i + 1}}`);
    return `${name}(${args.join(', ')})`;
}
/**
 * Create a snippet for a function call.
 */
function createFunctionSnippet(name, arity) {
    if (arity === 0) {
        return `${name}()`;
    }
    if (arity === -1) {
        // Variable arity - provide one placeholder
        return `${name}(\${1:args})`;
    }
    const args = Array.from({ length: arity }, (_, i) => `\${${i + 1}:arg${i + 1}}`);
    return `${name}(${args.join(', ')})`;
}
/**
 * Resolve additional details for a completion item.
 */
function resolveCompletion(item) {
    // Item is already fully populated, just return it
    return item;
}
//# sourceMappingURL=completion.js.map