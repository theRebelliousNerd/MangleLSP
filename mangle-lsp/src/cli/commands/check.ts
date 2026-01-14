/**
 * Check command - run diagnostics on Mangle files.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse, ParseError } from '../../parser/index';
import {
    validate,
    checkStratification,
    checkUnboundedRecursion,
    checkCartesianExplosion,
    checkLateFiltering,
    checkLateNegation,
    checkMultipleIndependentVars,
    SemanticError,
    StratificationError,
} from '../../analysis/index';
import {
    CheckResult,
    CheckOptions,
    FileDiagnostics,
    CLIDiagnostic,
    DiagnosticSeverity,
} from '../types';

/**
 * Run the check command on files.
 */
export function runCheck(files: string[], options: CheckOptions): CheckResult {
    const result: CheckResult = {
        version: '1.0',
        files: [],
        summary: {
            totalFiles: 0,
            totalErrors: 0,
            totalWarnings: 0,
            totalInfo: 0,
        },
    };

    for (const file of files) {
        const filePath = resolve(file);
        if (!existsSync(filePath)) {
            result.files.push({
                path: relative(process.cwd(), filePath),
                diagnostics: [{
                    severity: 'error',
                    code: 'E000',
                    source: 'mangle-cli',
                    message: `File not found: ${filePath}`,
                    range: {
                        start: { line: 1, column: 0 },
                        end: { line: 1, column: 0 },
                    },
                }],
            });
            result.summary.totalFiles++;
            result.summary.totalErrors++;
            continue;
        }

        let source: string;
        try {
            source = readFileSync(filePath, 'utf-8');
        } catch (e) {
            result.files.push({
                path: relative(process.cwd(), filePath),
                diagnostics: [{
                    severity: 'error',
                    code: 'E000',
                    source: 'mangle-cli',
                    message: `Error reading file: ${e}`,
                    range: {
                        start: { line: 1, column: 0 },
                        end: { line: 1, column: 0 },
                    },
                }],
            });
            result.summary.totalFiles++;
            result.summary.totalErrors++;
            continue;
        }

        const fileDiagnostics = checkFile(filePath, source, options);
        result.files.push(fileDiagnostics);
        result.summary.totalFiles++;

        for (const diag of fileDiagnostics.diagnostics) {
            if (diag.severity === 'error') {
                result.summary.totalErrors++;
            } else if (diag.severity === 'warning') {
                result.summary.totalWarnings++;
            } else {
                result.summary.totalInfo++;
            }
        }
    }

    return result;
}

/**
 * Check a single file.
 */
function checkFile(filePath: string, source: string, options: CheckOptions): FileDiagnostics {
    const diagnostics: CLIDiagnostic[] = [];
    const lines = source.split('\n');

    // Parse
    const parseResult = parse(source);

    // Add parse errors
    for (const error of parseResult.errors) {
        const diag = parseErrorToDiagnostic(error, lines);
        if (shouldInclude(diag.severity, options.severity)) {
            diagnostics.push(diag);
        }
    }

    // Semantic validation
    if (parseResult.unit) {
        const validationResult = validate(parseResult.unit);
        for (const error of validationResult.errors) {
            const diag = semanticErrorToDiagnostic(error, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Stratification errors
        const stratErrors = checkStratification(parseResult.unit);
        for (const error of stratErrors) {
            const diag = stratificationErrorToDiagnostic(error, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Unbounded recursion warnings
        const recursionWarnings = checkUnboundedRecursion(parseResult.unit);
        for (const warning of recursionWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Cartesian explosion warnings
        const cartesianWarnings = checkCartesianExplosion(parseResult.unit);
        for (const warning of cartesianWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Late filtering warnings
        const lateFilterWarnings = checkLateFiltering(parseResult.unit);
        for (const warning of lateFilterWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Late negation warnings
        const lateNegationWarnings = checkLateNegation(parseResult.unit);
        for (const warning of lateNegationWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }

        // Multiple independent variables
        const multiIndepWarnings = checkMultipleIndependentVars(parseResult.unit);
        for (const warning of multiIndepWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
    }

    return {
        path: relative(process.cwd(), filePath),
        diagnostics,
    };
}

/**
 * Convert a parse error to a CLI diagnostic.
 */
function parseErrorToDiagnostic(error: ParseError, lines: string[]): CLIDiagnostic {
    const line = lines[error.line - 1] || '';
    const context = line.trim();

    return {
        severity: 'error',
        code: 'P001',
        source: error.source === 'lexer' ? 'mangle-lexer' : 'mangle-parse',
        message: error.message,
        range: {
            start: { line: error.line, column: error.column },
            end: { line: error.line, column: error.column + error.length },
        },
        context: context.length > 0 ? context : undefined,
    };
}

/**
 * Convert a semantic error to a CLI diagnostic.
 */
function semanticErrorToDiagnostic(error: SemanticError, lines: string[]): CLIDiagnostic {
    const line = lines[error.range.start.line - 1] || '';
    const context = line.trim();

    return {
        severity: error.severity,
        code: error.code,
        source: 'mangle-semantic',
        message: error.message,
        range: {
            start: { line: error.range.start.line, column: error.range.start.column },
            end: { line: error.range.end.line, column: error.range.end.column },
        },
        context: context.length > 0 ? context : undefined,
    };
}

/**
 * Convert a stratification error to a CLI diagnostic.
 */
function stratificationErrorToDiagnostic(error: StratificationError, lines: string[]): CLIDiagnostic {
    const line = lines[error.range.start.line - 1] || '';
    const context = line.trim();

    return {
        severity: error.severity,
        code: error.code,
        source: 'mangle-stratification',
        message: error.message,
        range: {
            start: { line: error.range.start.line, column: error.range.start.column },
            end: { line: error.range.end.line, column: error.range.end.column },
        },
        context: context.length > 0 ? context : undefined,
    };
}

/**
 * Check if a diagnostic should be included based on minimum severity.
 */
function shouldInclude(severity: DiagnosticSeverity, minSeverity: DiagnosticSeverity): boolean {
    const order: DiagnosticSeverity[] = ['info', 'warning', 'error'];
    return order.indexOf(severity) >= order.indexOf(minSeverity);
}

/**
 * Determine exit code based on check result and options.
 */
export function getExitCode(result: CheckResult, options: CheckOptions): number {
    if (options.failOn === 'never') {
        return 0;
    }
    if (options.failOn === 'error' && result.summary.totalErrors > 0) {
        return 1;
    }
    if (options.failOn === 'warning' && (result.summary.totalErrors > 0 || result.summary.totalWarnings > 0)) {
        return 1;
    }
    return 0;
}
