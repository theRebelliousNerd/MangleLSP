/**
 * Go-to-definition provider for Mangle LSP.
 *
 * Provides navigation to predicate and variable definitions.
 */
import { Location, Position } from 'vscode-languageserver/node';
import { SymbolTable } from '../analysis/symbols';
/**
 * Get the definition location for the symbol at a position.
 *
 * Returns all definition locations for predicates (declaration + all clause heads),
 * or the binding location for variables.
 */
export declare function getDefinition(uri: string, symbolTable: SymbolTable, position: Position): Location | Location[] | null;
//# sourceMappingURL=definition.d.ts.map