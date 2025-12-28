/**
 * Completion provider for Mangle LSP.
 *
 * Provides code completion for predicates, built-in predicates/functions, and variables.
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
import { BUILTIN_PREDICATES } from '../builtins/predicates';
import { ALL_BUILTIN_FUNCTIONS, REDUCER_FUNCTIONS } from '../builtins/functions';

/**
 * Get completion items at a position.
 */
export function getCompletions(
    document: TextDocument,
    unit: SourceUnit | null,
    symbolTable: SymbolTable | null,
    position: Position
): CompletionItem[] {
    const items: CompletionItem[] = [];

    // Get the text before the cursor to determine context
    const lineText = document.getText({
        start: { line: position.line, character: 0 },
        end: position,
    });

    const context = analyzeContext(lineText);

    switch (context.type) {
        case 'builtin-predicate':
            // After ':' - suggest built-in predicates
            items.push(...getBuiltinPredicateCompletions(context.prefix));
            break;

        case 'function':
            // After 'fn:' - suggest built-in functions
            items.push(...getBuiltinFunctionCompletions(context.prefix));
            break;

        case 'transform-do':
            // After 'do ' in a transform - suggest fn:group_by first
            items.push(...getTransformDoCompletions());
            break;

        case 'transform-let':
            // After 'let X = ' in a transform - suggest reducer functions
            items.push(...getReducerFunctionCompletions());
            break;

        case 'general':
        default:
            // General completion - suggest user predicates and keywords
            if (symbolTable) {
                items.push(...getPredicateCompletions(symbolTable, context.prefix));
            }
            items.push(...getKeywordCompletions());
            // Also suggest built-in predicates
            items.push(...getBuiltinPredicateCompletions(context.prefix));
            break;
    }

    return items;
}

/**
 * Analyze the context to determine what completions to show.
 */
interface CompletionContext {
    type: 'builtin-predicate' | 'function' | 'transform-do' | 'transform-let' | 'general';
    prefix: string;
}

function analyzeContext(lineText: string): CompletionContext {
    // Check for 'fn:' prefix
    const fnMatch = lineText.match(/fn:(\w*)$/);
    if (fnMatch) {
        return { type: 'function', prefix: fnMatch[1] || '' };
    }

    // Check for ':' prefix (built-in predicate)
    const builtinMatch = lineText.match(/:(\w*)$/);
    if (builtinMatch) {
        return { type: 'builtin-predicate', prefix: builtinMatch[1] || '' };
    }

    // Check for 'do ' in transform context
    if (/\|>\s*do\s+$/.test(lineText)) {
        return { type: 'transform-do', prefix: '' };
    }

    // Check for 'let X = ' in transform context
    if (/let\s+\w+\s*=\s*$/.test(lineText)) {
        return { type: 'transform-let', prefix: '' };
    }

    // General context - get the last word as prefix
    const wordMatch = lineText.match(/(\w*)$/);
    const prefix = wordMatch?.[1] ?? '';

    return { type: 'general', prefix };
}

/**
 * Get completions for built-in predicates.
 */
function getBuiltinPredicateCompletions(prefix: string): CompletionItem[] {
    return BUILTIN_PREDICATES
        .filter(p => p.name.includes(prefix))
        .map((pred, index) => ({
            label: pred.name,
            kind: CompletionItemKind.Function,
            detail: `Built-in predicate (${pred.mode.join(', ')})`,
            documentation: pred.doc,
            insertText: createPredicateSnippet(pred.name, pred.arity),
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: `0${index.toString().padStart(3, '0')}`, // Sort built-ins first
        }));
}

/**
 * Get completions for built-in functions.
 */
function getBuiltinFunctionCompletions(prefix: string): CompletionItem[] {
    return ALL_BUILTIN_FUNCTIONS
        .filter(f => f.name.replace('fn:', '').startsWith(prefix))
        .map((fn, index) => ({
            label: fn.name,
            kind: CompletionItemKind.Function,
            detail: fn.isReducer ? 'Reducer function' : 'Built-in function',
            documentation: fn.doc,
            insertText: createFunctionSnippet(fn.name, fn.arity),
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: `0${index.toString().padStart(3, '0')}`,
        }));
}

/**
 * Get completions for transform 'do' context (fn:group_by first).
 */
function getTransformDoCompletions(): CompletionItem[] {
    return [
        {
            label: 'fn:group_by',
            kind: CompletionItemKind.Function,
            detail: 'Group tuples by key variables',
            documentation: 'Groups all tuples by the values of key variables. Empty group_by() treats the whole relation as a group.',
            insertText: 'fn:group_by(${1:Key})',
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: '000', // First
        },
        ...ALL_BUILTIN_FUNCTIONS
            .filter(f => f.name !== 'fn:group_by')
            .map((fn, index) => ({
                label: fn.name,
                kind: CompletionItemKind.Function,
                detail: fn.isReducer ? 'Reducer function' : 'Built-in function',
                documentation: fn.doc,
                insertText: createFunctionSnippet(fn.name, fn.arity),
                insertTextFormat: InsertTextFormat.Snippet,
                sortText: `1${index.toString().padStart(3, '0')}`,
            })),
    ];
}

/**
 * Get completions for transform 'let' context (reducer functions).
 */
function getReducerFunctionCompletions(): CompletionItem[] {
    return REDUCER_FUNCTIONS.map((fn, index) => ({
        label: fn.name,
        kind: CompletionItemKind.Function,
        detail: 'Reducer function',
        documentation: fn.doc,
        insertText: createFunctionSnippet(fn.name, fn.arity),
        insertTextFormat: InsertTextFormat.Snippet,
        sortText: `0${index.toString().padStart(3, '0')}`,
    }));
}

/**
 * Get completions for user-defined predicates.
 */
function getPredicateCompletions(symbolTable: SymbolTable, prefix: string): CompletionItem[] {
    return symbolTable.getAllPredicates()
        .filter(p => !p.symbol.symbol.startsWith(':')) // Exclude built-ins
        .filter(p => p.symbol.symbol.startsWith(prefix))
        .map((pred, index) => ({
            label: pred.symbol.symbol,
            kind: CompletionItemKind.Method,
            detail: `${pred.symbol.symbol}/${pred.symbol.arity}`,
            documentation: pred.documentation || undefined,
            insertText: createPredicateSnippet(pred.symbol.symbol, pred.symbol.arity),
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: `1${index.toString().padStart(3, '0')}`,
        }));
}

/**
 * Get keyword completions.
 */
function getKeywordCompletions(): CompletionItem[] {
    return [
        {
            label: 'Decl',
            kind: CompletionItemKind.Keyword,
            detail: 'Declare a predicate',
            insertText: 'Decl ${1:predicate}(${2:Args}).',
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: '200',
        },
        {
            label: 'Package',
            kind: CompletionItemKind.Keyword,
            detail: 'Package declaration',
            insertText: 'Package ${1:name}.',
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: '201',
        },
        {
            label: 'Use',
            kind: CompletionItemKind.Keyword,
            detail: 'Import package',
            insertText: 'Use ${1:package}.',
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: '202',
        },
    ];
}

/**
 * Create a snippet for a predicate call.
 */
function createPredicateSnippet(name: string, arity: number): string {
    if (arity === 0) {
        return name;
    }
    const args = Array.from({ length: arity }, (_, i) => `\${${i + 1}:arg${i + 1}}`);
    return `${name}(${args.join(', ')})`;
}

/**
 * Create a snippet for a function call.
 */
function createFunctionSnippet(name: string, arity: number): string {
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
export function resolveCompletion(item: CompletionItem): CompletionItem {
    // Item is already fully populated, just return it
    return item;
}
