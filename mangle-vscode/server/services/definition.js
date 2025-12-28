"use strict";
/**
 * Go-to-definition provider for Mangle LSP.
 *
 * Provides navigation to predicate and variable definitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefinition = getDefinition;
/**
 * Get the definition location for the symbol at a position.
 */
function getDefinition(uri, unit, symbolTable, position) {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;
    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        const locations = [];
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
function createLocation(uri, range) {
    return {
        uri,
        range: {
            start: { line: range.start.line - 1, character: range.start.column },
            end: { line: range.end.line - 1, character: range.end.column },
        },
    };
}
//# sourceMappingURL=definition.js.map