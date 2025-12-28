/**
 * Go-to-definition provider for Mangle LSP.
 *
 * Provides navigation to predicate and variable definitions.
 */

import { Location, Position } from 'vscode-languageserver/node';
import { SourceUnit, SourceRange } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';

/**
 * Get the definition location for the symbol at a position.
 */
export function getDefinition(
    uri: string,
    unit: SourceUnit,
    symbolTable: SymbolTable,
    position: Position
): Location | Location[] | null {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;

    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        const locations: Location[] = [];

        // Add declaration location if available
        if (predInfo.declLocation) {
            locations.push(createLocation(uri, predInfo.declLocation));
        }

        // Add first definition location if no declaration
        if (locations.length === 0 && predInfo.definitions.length > 0) {
            const firstDef = predInfo.definitions[0];
            if (firstDef) {
                locations.push(createLocation(uri, firstDef));
            }
        }

        // If we clicked on a reference, show definition
        // If we clicked on definition, show all definitions
        if (locations.length === 1) {
            return locations[0] || null;
        }
        return locations.length > 0 ? locations : null;
    }

    // Check for variable at position
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        // Go to the binding location
        return createLocation(uri, varInfo.bindingLocation);
    }

    return null;
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
