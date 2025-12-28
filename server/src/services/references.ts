/**
 * Find references provider for Mangle LSP.
 *
 * Finds all references to predicates and variables.
 */

import { Location, Position, ReferenceContext } from 'vscode-languageserver/node';
import { SourceUnit, SourceRange } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';

/**
 * Find all references to the symbol at a position.
 */
export function findReferences(
    uri: string,
    unit: SourceUnit,
    symbolTable: SymbolTable,
    position: Position,
    context: ReferenceContext
): Location[] {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;
    const locations: Location[] = [];

    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        // Include declaration if requested
        if (context.includeDeclaration && predInfo.declLocation) {
            locations.push(createLocation(uri, predInfo.declLocation));
        }

        // Include all definitions
        if (context.includeDeclaration) {
            for (const def of predInfo.definitions) {
                locations.push(createLocation(uri, def));
            }
        }

        // Include all references
        for (const ref of predInfo.references) {
            locations.push(createLocation(uri, ref));
        }

        return locations;
    }

    // Check for variable at position
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        // Return all occurrences of the variable
        for (const occ of varInfo.occurrences) {
            locations.push(createLocation(uri, occ));
        }
        return locations;
    }

    return locations;
}

/**
 * Create an LSP Location from a URI and source range.
 */
function createLocation(uri: string, range: SourceRange): Location {
    return {
        uri,
        range: {
            start: { line: range.start.line - 1, character: range.start.column },
            end: { line: range.end.line - 1, character: range.end.column },
        },
    };
}
