/**
 * Position and range utilities for LSP integration.
 *
 * Handles conversion between:
 * - Mangle positions (1-indexed lines, 0-indexed columns)
 * - LSP positions (0-indexed lines, 0-indexed columns/UTF-16 code units)
 * - ANTLR token positions
 */

import type { Position, Range } from 'vscode-languageserver';
import type { SourcePosition, SourceRange } from '../parser/ast.js';

/**
 * Convert a Mangle SourcePosition to an LSP Position.
 * Mangle uses 1-indexed lines, LSP uses 0-indexed.
 */
export function toPosition(pos: SourcePosition): Position {
    return {
        line: pos.line - 1,  // Convert 1-indexed to 0-indexed
        character: pos.column
    };
}

/**
 * Convert an LSP Position to a Mangle SourcePosition.
 * Note: offset will be 0 since LSP doesn't provide it.
 */
export function fromPosition(pos: Position): SourcePosition {
    return {
        line: pos.line + 1,  // Convert 0-indexed to 1-indexed
        column: pos.character,
        offset: 0  // LSP doesn't provide offset
    };
}

/**
 * Convert a Mangle SourceRange to an LSP Range.
 */
export function toRange(range: SourceRange): Range {
    return {
        start: toPosition(range.start),
        end: toPosition(range.end)
    };
}

/**
 * Convert an LSP Range to a Mangle SourceRange.
 * Note: offsets will be 0 since LSP doesn't provide them.
 */
export function fromRange(range: Range): SourceRange {
    return {
        start: fromPosition(range.start),
        end: fromPosition(range.end)
    };
}

/**
 * Check if a position (line, column) is within a SourceRange.
 * Uses Mangle 1-indexed lines, 0-indexed columns.
 * This is the canonical implementation - use this instead of local copies.
 */
export function isWithinSourceRange(
    line: number,
    column: number,
    range: SourceRange
): boolean {
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
 * Check if a position is within a range.
 * Uses LSP 0-indexed positions.
 */
export function isPositionInRange(pos: Position, range: Range): boolean {
    // Before start
    if (pos.line < range.start.line) return false;
    if (pos.line === range.start.line && pos.character < range.start.character) return false;

    // After end
    if (pos.line > range.end.line) return false;
    if (pos.line === range.end.line && pos.character >= range.end.character) return false;

    return true;
}

/**
 * Check if two ranges overlap.
 */
export function rangesOverlap(a: Range, b: Range): boolean {
    // a ends before b starts
    if (a.end.line < b.start.line) return false;
    if (a.end.line === b.start.line && a.end.character <= b.start.character) return false;

    // b ends before a starts
    if (b.end.line < a.start.line) return false;
    if (b.end.line === a.start.line && b.end.character <= a.start.character) return false;

    return true;
}

/**
 * Compare two positions. Returns:
 * - negative if a < b
 * - 0 if a == b
 * - positive if a > b
 */
export function comparePositions(a: Position, b: Position): number {
    if (a.line !== b.line) {
        return a.line - b.line;
    }
    return a.character - b.character;
}

/**
 * Get the union of two ranges.
 */
export function unionRanges(a: Range, b: Range): Range {
    const start = comparePositions(a.start, b.start) <= 0 ? a.start : b.start;
    const end = comparePositions(a.end, b.end) >= 0 ? a.end : b.end;
    return { start, end };
}

/**
 * Create a zero-width range at a position.
 */
export function pointRangeLSP(pos: Position): Range {
    return { start: pos, end: pos };
}
