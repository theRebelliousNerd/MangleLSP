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
export declare function toPosition(pos: SourcePosition): Position;
/**
 * Convert an LSP Position to a Mangle SourcePosition.
 * Note: offset will be 0 since LSP doesn't provide it.
 */
export declare function fromPosition(pos: Position): SourcePosition;
/**
 * Convert a Mangle SourceRange to an LSP Range.
 */
export declare function toRange(range: SourceRange): Range;
/**
 * Convert an LSP Range to a Mangle SourceRange.
 * Note: offsets will be 0 since LSP doesn't provide them.
 */
export declare function fromRange(range: Range): SourceRange;
/**
 * Check if a position (line, column) is within a SourceRange.
 * Uses Mangle 1-indexed lines, 0-indexed columns.
 * This is the canonical implementation - use this instead of local copies.
 */
export declare function isWithinSourceRange(line: number, column: number, range: SourceRange): boolean;
/**
 * Check if a position is within a range.
 * Uses LSP 0-indexed positions.
 */
export declare function isPositionInRange(pos: Position, range: Range): boolean;
/**
 * Check if two ranges overlap.
 */
export declare function rangesOverlap(a: Range, b: Range): boolean;
/**
 * Compare two positions. Returns:
 * - negative if a < b
 * - 0 if a == b
 * - positive if a > b
 */
export declare function comparePositions(a: Position, b: Position): number;
/**
 * Get the union of two ranges.
 */
export declare function unionRanges(a: Range, b: Range): Range;
/**
 * Create a zero-width range at a position.
 */
export declare function pointRangeLSP(pos: Position): Range;
//# sourceMappingURL=position.d.ts.map