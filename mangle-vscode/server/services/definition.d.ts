/**
 * Go-to-definition provider for Mangle LSP.
 *
 * Provides navigation to predicate and variable definitions.
 */
import { Location, Position } from 'vscode-languageserver/node';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
/**
 * Get the definition location for the symbol at a position.
 */
export declare function getDefinition(uri: string, unit: SourceUnit, symbolTable: SymbolTable, position: Position): Location | Location[] | null;
//# sourceMappingURL=definition.d.ts.map