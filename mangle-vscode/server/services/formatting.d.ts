/**
 * Formatting provider for Mangle LSP.
 *
 * Pretty-prints Mangle source code.
 */
import { TextEdit, FormattingOptions } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceUnit } from '../parser/ast';
/**
 * Format an entire document.
 */
export declare function formatDocument(document: TextDocument, unit: SourceUnit, options: FormattingOptions): TextEdit[];
//# sourceMappingURL=formatting.d.ts.map