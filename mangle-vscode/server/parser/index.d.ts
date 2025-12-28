/**
 * Parser module for Mangle LSP.
 *
 * Provides AST types, parser, and visitor for Mangle source files.
 */
export * from './ast';
export { parse, parseClause, errorToRange, hasErrors, hasFatalErrors, getErrorCounts } from './parser';
export type { ParseError, ParseResult } from './parser';
export { MangleASTVisitor } from './visitor';
//# sourceMappingURL=index.d.ts.map