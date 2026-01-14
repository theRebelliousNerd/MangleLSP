/**
 * Find references provider for Mangle LSP.
 *
 * Finds all references to predicates and variables.
 */

import { Location, Position, ReferenceContext } from 'vscode-languageserver/node';
import { SourceRange } from '../parser/ast';
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
export function findReferences(
    uri: string,
    symbolTable: SymbolTable,
    position: Position,
    context: ReferenceContext
): Location[] {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;

    // Check variables FIRST (more specific - inside atoms)
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        const locations: Location[] = [];
        for (const occ of varInfo.occurrences) {
            locations.push(createLocation(uri, occ));
        }

        // Respect includeDeclaration - filter out binding location if false
        if (!context.includeDeclaration) {
            return locations.filter(
                (loc) =>
                    !(
                        loc.range.start.line === varInfo.bindingLocation.start.line - 1 &&
                        loc.range.start.character === varInfo.bindingLocation.start.column
                    )
            );
        }
        return locations;
    }

    // Then check predicates
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        const locations: Location[] = [];

        // Declaration is optional based on includeDeclaration
        if (context.includeDeclaration && predInfo.declLocation) {
            const range = predInfo.declNameRange || predInfo.declLocation;
            locations.push(createLocation(uri, range));
        }

        // Definitions (clause heads) are ALWAYS included - they are usages
        // Use definitionNameRanges for precise name highlighting if available
        const defs = predInfo.definitionNameRanges || predInfo.definitions;
        for (const def of defs) {
            locations.push(createLocation(uri, def));
        }

        // References are ALWAYS included
        // Use referenceNameRanges for precise name highlighting if available
        const refs = predInfo.referenceNameRanges || predInfo.references;
        for (const ref of refs) {
            locations.push(createLocation(uri, ref));
        }

        return locations;
    }

    return [];
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
