/**
 * Document symbols provider for Mangle LSP.
 *
 * Provides the document outline (symbol tree).
 */
import { DocumentSymbol } from 'vscode-languageserver/node';
import { SourceUnit } from '../parser/ast';
/**
 * Get document symbols for the outline view.
 */
export declare function getDocumentSymbols(unit: SourceUnit): DocumentSymbol[];
//# sourceMappingURL=symbols.d.ts.map