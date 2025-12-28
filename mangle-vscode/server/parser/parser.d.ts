/**
 * Parser wrapper that provides error collection and a clean API.
 *
 * Uses ANTLR-generated parser with custom error listener and visitor.
 */
import type { SourceUnit, SourceRange } from './ast';
/**
 * A parse error with location information.
 */
export interface ParseError {
    /** Error message */
    message: string;
    /** Line number (1-indexed) */
    line: number;
    /** Column number (0-indexed) */
    column: number;
    /** Character offset from start of file */
    offset: number;
    /** Length of the offending text (if known) */
    length: number;
    /** Error source (lexer or parser) */
    source: 'lexer' | 'parser';
}
/**
 * Result of parsing a Mangle source file.
 */
export interface ParseResult {
    /** The parsed source unit (null if fatal errors) */
    unit: SourceUnit | null;
    /** Parse errors encountered */
    errors: ParseError[];
}
/**
 * Parse Mangle source code into an AST.
 *
 * @param source The source code to parse
 * @returns ParseResult with AST and any errors
 */
export declare function parse(source: string): ParseResult;
/**
 * Parse a single clause from a string.
 *
 * @param source The clause source code
 * @returns The parsed clause or null if there were errors
 */
export declare function parseClause(source: string): ParseResult;
/**
 * Convert a ParseError to a SourceRange.
 */
export declare function errorToRange(error: ParseError): SourceRange;
/**
 * Check if parse result has any errors.
 */
export declare function hasErrors(result: ParseResult): boolean;
/**
 * Check if parse result has fatal errors (no AST produced).
 */
export declare function hasFatalErrors(result: ParseResult): boolean;
/**
 * Get error count by source.
 */
export declare function getErrorCounts(result: ParseResult): {
    lexer: number;
    parser: number;
};
//# sourceMappingURL=parser.d.ts.map