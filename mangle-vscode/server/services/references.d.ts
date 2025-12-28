/**
 * Find references provider for Mangle LSP.
 *
 * Finds all references to predicates and variables.
 */
import { Location, Position, ReferenceContext } from 'vscode-languageserver/node';
import { SourceUnit } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';
/**
 * Find all references to the symbol at a position.
 */
export declare function findReferences(uri: string, unit: SourceUnit, symbolTable: SymbolTable, position: Position, context: ReferenceContext): Location[];
//# sourceMappingURL=references.d.ts.map