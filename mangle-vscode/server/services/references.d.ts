/**
 * Find references provider for Mangle LSP.
 *
 * Finds all references to predicates and variables.
 */
import { Location, Position, ReferenceContext } from 'vscode-languageserver/node';
import { SymbolTable } from '../analysis/symbols';
/**
 * Find all references to the symbol at a position.
 *
 * For variables: returns all occurrences, optionally excluding the binding location.
 * For predicates: returns all references and definitions (clause heads), optionally
 * including the declaration.
 *
 * Note: Variables are checked FIRST because predicate ranges include the full atom,
 * so clicking on a variable inside an atom would otherwise return predicate references.
 */
export declare function findReferences(uri: string, symbolTable: SymbolTable, position: Position, context: ReferenceContext): Location[];
//# sourceMappingURL=references.d.ts.map