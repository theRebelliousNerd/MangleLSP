/**
 * Parser wrapper that provides error collection and a clean API.
 *
 * Uses ANTLR-generated parser with custom error listener and visitor.
 */

import {
    CharStream,
    CommonTokenStream,
    BaseErrorListener,
    RecognitionException,
    Recognizer,
    Token,
    ATNSimulator,
} from 'antlr4ng';

import { MangleLexer } from './gen/MangleLexer';
import { MangleParser } from './gen/MangleParser';
import { MangleASTVisitor, VisitorParseError } from './visitor';
import type { SourceUnit, SourceRange, SourcePosition } from './ast';

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
 * Custom error listener that collects errors.
 */
class MangleErrorListener extends BaseErrorListener {
    public errors: ParseError[] = [];
    public source: 'lexer' | 'parser' = 'parser';

    override syntaxError<T>(
        _recognizer: Recognizer<ATNSimulator>,
        offendingSymbol: T | null,
        line: number,
        charPositionInLine: number,
        msg: string,
        _e: RecognitionException | null
    ): void {
        let length = 1;

        // Try to get length from offending symbol
        if (offendingSymbol && typeof offendingSymbol === 'object' && 'text' in offendingSymbol) {
            const sym = offendingSymbol as { text?: string };
            length = sym.text?.length ?? 1;
        }

        this.errors.push({
            message: msg,
            line,
            column: charPositionInLine,
            offset: 0, // We don't have offset from ANTLR error listener
            length,
            source: this.source,
        });
    }
}

/**
 * Convert a VisitorParseError to a ParseError.
 */
function visitorErrorToParseError(error: VisitorParseError): ParseError {
    return {
        message: error.message,
        line: error.line,
        column: error.column,
        offset: error.offset,
        length: error.length,
        source: 'parser',
    };
}

/**
 * Parse Mangle source code into an AST.
 *
 * This parser implements error recovery: it will produce a partial AST
 * even when there are errors, enabling LSP features to work on broken code.
 *
 * @param source The source code to parse
 * @returns ParseResult with AST and any errors
 */
export function parse(source: string): ParseResult {
    const errors: ParseError[] = [];
    let visitor: MangleASTVisitor | null = null;

    try {
        // Create input stream
        const inputStream = CharStream.fromString(source);

        // Create lexer
        const lexer = new MangleLexer(inputStream);
        const lexerErrorListener = new MangleErrorListener();
        lexerErrorListener.source = 'lexer';
        lexer.removeErrorListeners();
        lexer.addErrorListener(lexerErrorListener);

        // Create token stream
        const tokenStream = new CommonTokenStream(lexer);

        // Create parser
        const parser = new MangleParser(tokenStream);
        const parserErrorListener = new MangleErrorListener();
        parserErrorListener.source = 'parser';
        parser.removeErrorListeners();
        parser.addErrorListener(parserErrorListener);

        // Parse
        const tree = parser.start();

        // Collect lexer and parser errors
        errors.push(...lexerErrorListener.errors);
        errors.push(...parserErrorListener.errors);

        // Build AST with error recovery
        visitor = new MangleASTVisitor();
        const unit = visitor.visit(tree) as SourceUnit;

        // Collect visitor errors (from AST construction)
        const visitorErrors = visitor.getErrors();
        errors.push(...visitorErrors.map(visitorErrorToParseError));

        return { unit, errors };
    } catch (e) {
        // Handle unexpected errors - try to return partial unit if available
        const message = e instanceof Error ? e.message : String(e);
        errors.push({
            message: `Internal parser error: ${message}`,
            line: 1,
            column: 0,
            offset: 0,
            length: 1,
            source: 'parser',
        });

        // Try to return partial unit if we have one from the visitor
        const partialUnit = visitor?.getPartialUnit() ?? null;
        return { unit: partialUnit, errors };
    }
}

/**
 * Parse a single clause from a string.
 *
 * @param source The clause source code
 * @returns The parsed clause or null if there were errors
 */
export function parseClause(source: string): ParseResult {
    // Wrap as a complete program and parse
    return parse(source);
}

/**
 * Convert a ParseError to a SourceRange.
 */
export function errorToRange(error: ParseError): SourceRange {
    const start: SourcePosition = {
        line: error.line,
        column: error.column,
        offset: error.offset,
    };
    const end: SourcePosition = {
        line: error.line,
        column: error.column + error.length,
        offset: error.offset + error.length,
    };
    return { start, end };
}

/**
 * Check if parse result has any errors.
 */
export function hasErrors(result: ParseResult): boolean {
    return result.errors.length > 0;
}

/**
 * Check if parse result has fatal errors (no AST produced).
 */
export function hasFatalErrors(result: ParseResult): boolean {
    return result.unit === null;
}

/**
 * Get error count by source.
 */
export function getErrorCounts(result: ParseResult): { lexer: number; parser: number } {
    let lexer = 0;
    let parser = 0;
    for (const error of result.errors) {
        if (error.source === 'lexer') {
            lexer++;
        } else {
            parser++;
        }
    }
    return { lexer, parser };
}
