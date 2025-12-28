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
import { isWithinSourceRange } from '../utils/position';

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

    // Check for variable at position FIRST (before predicates)
    // This ensures that when cursor is on a variable inside an atom like parent(X),
    // we rename the variable X, not the predicate parent.
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        // Can't rename wildcard
        if (varInfo.name === '_') {
            return null;
        }

        // Return the range of the current occurrence
        for (const occ of varInfo.occurrences) {
            if (isWithinSourceRange(line, column, occ)) {
                return convertRange(occ);
            }
        }
    }

    // Check for predicate at position
    // Only match if cursor is specifically on the predicate NAME, not anywhere in the atom
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        // Can't rename built-in predicates
        if (predInfo.symbol.symbol.startsWith(':')) {
            return null;
        }

        // Check if position is within the predicate NAME range (not full atom)
        if (predInfo.declNameRange && isWithinSourceRange(line, column, predInfo.declNameRange)) {
            return convertRange(predInfo.declNameRange);
        }
        for (const nameRange of predInfo.definitionNameRanges) {
            if (isWithinSourceRange(line, column, nameRange)) {
                return convertRange(nameRange);
            }
        }
        for (const nameRange of predInfo.referenceNameRanges) {
            if (isWithinSourceRange(line, column, nameRange)) {
                return convertRange(nameRange);
            }
        }
    }

    return null;
}

/**
 * Validate that a predicate name is valid.
 * Predicate names must start with a lowercase letter, or be a builtin (starting with ':').
 */
function isValidPredicateName(name: string): boolean {
    if (name.length === 0) {
        return false;
    }
    // Builtins start with ':'
    if (name.startsWith(':')) {
        return true;
    }
    // Regular predicates must start with lowercase letter
    const firstChar = name.charAt(0);
    return firstChar >= 'a' && firstChar <= 'z';
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

    // Check for variable at position FIRST (before predicates)
    // This ensures that when cursor is on a variable inside an atom like parent(X),
    // we rename the variable X, not the predicate parent.
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
            edits.push({
                range: convertRange(occ),
                newText: newName,
            });
        }

        return {
            changes: {
                [uri]: edits,
            },
        };
    }

    // Check for predicate at position
    // Only match if cursor is specifically on the predicate NAME, not anywhere in the atom
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        // Can't rename built-in predicates
        if (predInfo.symbol.symbol.startsWith(':')) {
            return null;
        }

        // Check if position is within the predicate NAME range (not full atom)
        let isOnPredicateName = false;
        if (predInfo.declNameRange && isWithinSourceRange(line, column, predInfo.declNameRange)) {
            isOnPredicateName = true;
        }
        for (const nameRange of predInfo.definitionNameRanges) {
            if (isWithinSourceRange(line, column, nameRange)) {
                isOnPredicateName = true;
                break;
            }
        }
        if (!isOnPredicateName) {
            for (const nameRange of predInfo.referenceNameRanges) {
                if (isWithinSourceRange(line, column, nameRange)) {
                    isOnPredicateName = true;
                    break;
                }
            }
        }

        if (!isOnPredicateName) {
            return null;
        }

        // Validate new predicate name
        if (!isValidPredicateName(newName)) {
            return null;
        }

        // Add edit for declaration name (if present)
        if (predInfo.declNameRange) {
            edits.push({
                range: convertRange(predInfo.declNameRange),
                newText: newName,
            });
        }

        // Add edits for all definition names
        for (const nameRange of predInfo.definitionNameRanges) {
            edits.push({
                range: convertRange(nameRange),
                newText: newName,
            });
        }

        // Add edits for all reference names
        for (const nameRange of predInfo.referenceNameRanges) {
            edits.push({
                range: convertRange(nameRange),
                newText: newName,
            });
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
 * Convert our SourceRange to LSP Range.
 */
function convertRange(range: SourceRange): Range {
    return {
        start: { line: range.start.line - 1, character: range.start.column },
        end: { line: range.end.line - 1, character: range.end.column },
    };
}
