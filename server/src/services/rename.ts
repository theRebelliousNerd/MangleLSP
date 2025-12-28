/**
 * Rename provider for Mangle LSP.
 *
 * Provides rename functionality for predicates and variables.
 */

import {
    Range,
    Position,
    WorkspaceEdit,
    TextEdit,
} from 'vscode-languageserver/node';
import { SourceUnit, SourceRange } from '../parser/ast';
import { SymbolTable } from '../analysis/symbols';

/**
 * Check if the symbol at a position can be renamed and return its range.
 */
export function prepareRename(
    unit: SourceUnit,
    symbolTable: SymbolTable,
    position: Position
): Range | null {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;

    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        // Can't rename built-in predicates
        if (predInfo.symbol.symbol.startsWith(':')) {
            return null;
        }

        // Return the range of the current occurrence
        // Find which occurrence we're in
        if (predInfo.declLocation && isWithinRange(line, column, predInfo.declLocation)) {
            return convertRange(predInfo.declLocation);
        }
        for (const def of predInfo.definitions) {
            if (isWithinRange(line, column, def)) {
                return convertRange(def);
            }
        }
        for (const ref of predInfo.references) {
            if (isWithinRange(line, column, ref)) {
                return convertRange(ref);
            }
        }
    }

    // Check for variable at position
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        // Can't rename wildcard
        if (varInfo.name === '_') {
            return null;
        }

        // Return the range of the current occurrence
        for (const occ of varInfo.occurrences) {
            if (isWithinRange(line, column, occ)) {
                return convertRange(occ);
            }
        }
    }

    return null;
}

/**
 * Perform a rename operation.
 */
export function doRename(
    uri: string,
    unit: SourceUnit,
    symbolTable: SymbolTable,
    position: Position,
    newName: string
): WorkspaceEdit | null {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;

    const edits: TextEdit[] = [];

    // Check for predicate at position
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        // Can't rename built-in predicates
        if (predInfo.symbol.symbol.startsWith(':')) {
            return null;
        }

        // Add edits for declaration
        if (predInfo.declLocation) {
            edits.push(createRenameEdit(predInfo.declLocation, predInfo.symbol.symbol, newName));
        }

        // Add edits for all definitions
        for (const def of predInfo.definitions) {
            edits.push(createRenameEdit(def, predInfo.symbol.symbol, newName));
        }

        // Add edits for all references
        for (const ref of predInfo.references) {
            edits.push(createRenameEdit(ref, predInfo.symbol.symbol, newName));
        }

        return {
            changes: {
                [uri]: edits,
            },
        };
    }

    // Check for variable at position
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        // Can't rename wildcard
        if (varInfo.name === '_') {
            return null;
        }

        // Validate new name is a valid variable name (starts with uppercase)
        if (!/^[A-Z_][A-Za-z0-9_]*$/.test(newName)) {
            return null;
        }

        // Add edits for all occurrences
        for (const occ of varInfo.occurrences) {
            edits.push(createRenameEdit(occ, varInfo.name, newName));
        }

        return {
            changes: {
                [uri]: edits,
            },
        };
    }

    return null;
}

/**
 * Create a text edit for renaming.
 */
function createRenameEdit(range: SourceRange, oldName: string, newName: string): TextEdit {
    return {
        range: convertRange(range),
        newText: newName,
    };
}

/**
 * Check if a position is within a range.
 */
function isWithinRange(line: number, column: number, range: SourceRange): boolean {
    if (line < range.start.line || line > range.end.line) {
        return false;
    }
    if (line === range.start.line && column < range.start.column) {
        return false;
    }
    if (line === range.end.line && column >= range.end.column) {
        return false;
    }
    return true;
}

/**
 * Convert our SourceRange to LSP Range.
 */
function convertRange(range: SourceRange): Range {
    return {
        start: { line: range.start.line - 1, character: range.start.column },
        end: { line: range.end.line - 1, character: range.end.column },
    };
}
