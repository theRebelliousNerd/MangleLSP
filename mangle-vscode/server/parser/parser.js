"use strict";
/**
 * Parser wrapper that provides error collection and a clean API.
 *
 * Uses ANTLR-generated parser with custom error listener and visitor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
exports.parseClause = parseClause;
exports.errorToRange = errorToRange;
exports.hasErrors = hasErrors;
exports.hasFatalErrors = hasFatalErrors;
exports.getErrorCounts = getErrorCounts;
const antlr4ng_1 = require("antlr4ng");
const MangleLexer_1 = require("./gen/MangleLexer");
const MangleParser_1 = require("./gen/MangleParser");
const visitor_1 = require("./visitor");
/**
 * Custom error listener that collects errors.
 */
class MangleErrorListener extends antlr4ng_1.BaseErrorListener {
    constructor() {
        super(...arguments);
        this.errors = [];
        this.source = 'parser';
    }
    syntaxError(_recognizer, offendingSymbol, line, charPositionInLine, msg, _e) {
        let length = 1;
        // Try to get length from offending symbol
        if (offendingSymbol && typeof offendingSymbol === 'object' && 'text' in offendingSymbol) {
            const sym = offendingSymbol;
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
function visitorErrorToParseError(error) {
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
function parse(source) {
    const errors = [];
    let visitor = null;
    try {
        // Create input stream
        const inputStream = antlr4ng_1.CharStream.fromString(source);
        // Create lexer
        const lexer = new MangleLexer_1.MangleLexer(inputStream);
        const lexerErrorListener = new MangleErrorListener();
        lexerErrorListener.source = 'lexer';
        lexer.removeErrorListeners();
        lexer.addErrorListener(lexerErrorListener);
        // Create token stream
        const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
        // Create parser
        const parser = new MangleParser_1.MangleParser(tokenStream);
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
        visitor = new visitor_1.MangleASTVisitor();
        const unit = visitor.visit(tree);
        // Collect visitor errors (from AST construction)
        const visitorErrors = visitor.getErrors();
        errors.push(...visitorErrors.map(visitorErrorToParseError));
        return { unit, errors };
    }
    catch (e) {
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
function parseClause(source) {
    // Wrap as a complete program and parse
    return parse(source);
}
/**
 * Convert a ParseError to a SourceRange.
 */
function errorToRange(error) {
    const start = {
        line: error.line,
        column: error.column,
        offset: error.offset,
    };
    const end = {
        line: error.line,
        column: error.column + error.length,
        offset: error.offset + error.length,
    };
    return { start, end };
}
/**
 * Check if parse result has any errors.
 */
function hasErrors(result) {
    return result.errors.length > 0;
}
/**
 * Check if parse result has fatal errors (no AST produced).
 */
function hasFatalErrors(result) {
    return result.unit === null;
}
/**
 * Get error count by source.
 */
function getErrorCounts(result) {
    let lexer = 0;
    let parser = 0;
    for (const error of result.errors) {
        if (error.source === 'lexer') {
            lexer++;
        }
        else {
            parser++;
        }
    }
    return { lexer, parser };
}
//# sourceMappingURL=parser.js.map