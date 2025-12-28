/**
 * Rename provider for Mangle LSP.
 *
 * Provides rename functionality for predicates and variables.
 */
import { Range, Position, WorkspaceEdit } from 'vscode-languageserver/node';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
/**
 * Check if the symbol at a position can be renamed and return its range.
 */
export declare function prepareRename(unit: SourceUnit, symbolTable: SymbolTable, position: Position): Range | null;
/**
 * Perform a rename operation.
 */
export declare function doRename(uri: string, unit: SourceUnit, symbolTable: SymbolTable, position: Position, newName: string): WorkspaceEdit | null;
//# sourceMappingURL=rename.d.ts.map