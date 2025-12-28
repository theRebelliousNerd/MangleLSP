/**
 * Completion provider for Mangle LSP.
 *
 * Provides code completion for predicates, built-in predicates/functions, and variables.
 */
import { CompletionItem, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
/**
 * Get completion items at a position.
 */
export declare function getCompletions(document: TextDocument, unit: SourceUnit | null, symbolTable: SymbolTable | null, position: Position): CompletionItem[];
/**
 * Resolve additional details for a completion item.
 */
export declare function resolveCompletion(item: CompletionItem): CompletionItem;
//# sourceMappingURL=completion.d.ts.map