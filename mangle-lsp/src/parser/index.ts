/**
 * Parser module for Mangle LSP.
 *
 * Provides AST types, parser, and visitor for Mangle source files.
 */

// AST types
export * from './ast';

// Parser API
export { parse, parseClause, errorToRange, hasErrors, hasFatalErrors, getErrorCounts } from './parser';
export type { ParseError, ParseResult } from './parser';

// Visitor (for advanced use cases)
export { MangleASTVisitor } from './visitor';
