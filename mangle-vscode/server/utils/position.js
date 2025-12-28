"use strict";
/**
 * Position and range utilities for LSP integration.
 *
 * Handles conversion between:
 * - Mangle positions (1-indexed lines, 0-indexed columns)
 * - LSP positions (0-indexed lines, 0-indexed columns/UTF-16 code units)
 * - ANTLR token positions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPosition = toPosition;
exports.fromPosition = fromPosition;
exports.toRange = toRange;
exports.fromRange = fromRange;
exports.isWithinSourceRange = isWithinSourceRange;
exports.isPositionInRange = isPositionInRange;
exports.rangesOverlap = rangesOverlap;
exports.comparePositions = comparePositions;
exports.unionRanges = unionRanges;
exports.pointRangeLSP = pointRangeLSP;
/**
 * Convert a Mangle SourcePosition to an LSP Position.
 * Mangle uses 1-indexed lines, LSP uses 0-indexed.
 */
function toPosition(pos) {
    return {
        line: pos.line - 1, // Convert 1-indexed to 0-indexed
        character: pos.column
    };
}
/**
 * Convert an LSP Position to a Mangle SourcePosition.
 * Note: offset will be 0 since LSP doesn't provide it.
 */
function fromPosition(pos) {
    return {
        line: pos.line + 1, // Convert 0-indexed to 1-indexed
        column: pos.character,
        offset: 0 // LSP doesn't provide offset
    };
}
/**
 * Convert a Mangle SourceRange to an LSP Range.
 */
function toRange(range) {
    return {
        start: toPosition(range.start),
        end: toPosition(range.end)
    };
}
/**
 * Convert an LSP Range to a Mangle SourceRange.
 * Note: offsets will be 0 since LSP doesn't provide them.
 */
function fromRange(range) {
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
function isWithinSourceRange(line, column, range) {
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
function isPositionInRange(pos, range) {
    // Before start
    if (pos.line < range.start.line)
        return false;
    if (pos.line === range.start.line && pos.character < range.start.character)
        return false;
    // After end
    if (pos.line > range.end.line)
        return false;
    if (pos.line === range.end.line && pos.character >= range.end.character)
        return false;
    return true;
}
/**
 * Check if two ranges overlap.
 */
function rangesOverlap(a, b) {
    // a ends before b starts
    if (a.end.line < b.start.line)
        return false;
    if (a.end.line === b.start.line && a.end.character <= b.start.character)
        return false;
    // b ends before a starts
    if (b.end.line < a.start.line)
        return false;
    if (b.end.line === a.start.line && b.end.character <= a.start.character)
        return false;
    return true;
}
/**
 * Compare two positions. Returns:
 * - negative if a < b
 * - 0 if a == b
 * - positive if a > b
 */
function comparePositions(a, b) {
    if (a.line !== b.line) {
        return a.line - b.line;
    }
    return a.character - b.character;
}
/**
 * Get the union of two ranges.
 */
function unionRanges(a, b) {
    const start = comparePositions(a.start, b.start) <= 0 ? a.start : b.start;
    const end = comparePositions(a.end, b.end) >= 0 ? a.end : b.end;
    return { start, end };
}
/**
 * Create a zero-width range at a position.
 */
function pointRangeLSP(pos) {
    return { start: pos, end: pos };
}
//# sourceMappingURL=position.js.map