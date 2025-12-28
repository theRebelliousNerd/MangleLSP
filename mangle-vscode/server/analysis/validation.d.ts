/**
 * Semantic validation for Mangle.
 *
 * Performs semantic analysis on parsed Mangle source and reports errors.
 * Ported from upstream Go implementation (analysis/validation.go).
 */
import { SourceUnit, SourceRange } from '../parser/ast';
import { SymbolTable } from './symbols';
/**
 * Semantic error with location.
 */
export interface SemanticError {
    /** Error code for categorization */
    code: string;
    /** Error message */
    message: string;
    /** Source location */
    range: SourceRange;
    /** Error severity */
    severity: 'error' | 'warning' | 'info';
}
/**
 * Validation result.
 */
export interface ValidationResult {
    /** List of semantic errors */
    errors: SemanticError[];
    /** Symbol table built during analysis */
    symbolTable: SymbolTable;
}
/**
 * Validate a source unit and return semantic errors.
 */
export declare function validate(unit: SourceUnit): ValidationResult;
//# sourceMappingURL=validation.d.ts.map