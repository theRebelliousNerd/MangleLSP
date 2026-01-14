/**
 * Hover provider for Mangle LSP.
 *
 * Provides hover information for predicates, built-in predicates/functions, and variables.
 */
import { Hover, Position } from 'vscode-languageserver/node';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
/**
 * Get hover information at a position in the document.
 */
export declare function getHover(unit: SourceUnit, symbolTable: SymbolTable, position: Position): Hover | null;
//# sourceMappingURL=hover.d.ts.map