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
 *
 * Returns all definition locations for predicates (declaration + all clause heads),
 * or the binding location for variables.
 */
function getDefinition(uri, symbolTable, position) {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;
    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        const locations = [];
        // Add declaration location if available
        // Use declNameRange if available for precise name highlighting, otherwise declLocation
        if (predInfo.declLocation) {
            const range = predInfo.declNameRange || predInfo.declLocation;
            locations.push(createLocation(uri, range));
        }
        // Add ALL definition locations (clause heads) - not just first
        // Use definitionNameRanges for precise name highlighting if available
        const defs = predInfo.definitionNameRanges || predInfo.definitions;
        for (const def of defs) {
            locations.push(createLocation(uri, def));
        }
        if (locations.length === 0)
            return null;
        if (locations.length === 1)
            return locations[0];
        return locations;
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