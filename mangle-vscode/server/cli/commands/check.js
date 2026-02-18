"use strict";
/**
 * Check command - run diagnostics on Mangle files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheck = runCheck;
exports.getExitCode = getExitCode;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const index_2 = require("../../analysis/index");
/**
 * Run the check command on files.
 */
function runCheck(files, options) {
    const result = {
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
        const filePath = (0, path_1.resolve)(file);
        if (!(0, fs_1.existsSync)(filePath)) {
            result.files.push({
                path: (0, path_1.relative)(process.cwd(), filePath),
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
        let source;
        try {
            source = (0, fs_1.readFileSync)(filePath, 'utf-8');
        }
        catch (e) {
            result.files.push({
                path: (0, path_1.relative)(process.cwd(), filePath),
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
            }
            else if (diag.severity === 'warning') {
                result.summary.totalWarnings++;
            }
            else {
                result.summary.totalInfo++;
            }
        }
    }
    return result;
}
/**
 * Check a single file.
 */
function checkFile(filePath, source, options) {
    const diagnostics = [];
    const lines = source.split('\n');
    // Parse
    const parseResult = (0, index_1.parse)(source);
    // Add parse errors
    for (const error of parseResult.errors) {
        const diag = parseErrorToDiagnostic(error, lines);
        if (shouldInclude(diag.severity, options.severity)) {
            diagnostics.push(diag);
        }
    }
    // Semantic validation
    if (parseResult.unit) {
        const validationResult = (0, index_2.validate)(parseResult.unit);
        for (const error of validationResult.errors) {
            const diag = semanticErrorToDiagnostic(error, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Stratification errors
        const stratErrors = (0, index_2.checkStratification)(parseResult.unit);
        for (const error of stratErrors) {
            const diag = stratificationErrorToDiagnostic(error, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Unbounded recursion warnings
        const recursionWarnings = (0, index_2.checkUnboundedRecursion)(parseResult.unit);
        for (const warning of recursionWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Cartesian explosion warnings
        const cartesianWarnings = (0, index_2.checkCartesianExplosion)(parseResult.unit);
        for (const warning of cartesianWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Late filtering warnings
        const lateFilterWarnings = (0, index_2.checkLateFiltering)(parseResult.unit);
        for (const warning of lateFilterWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Late negation warnings
        const lateNegationWarnings = (0, index_2.checkLateNegation)(parseResult.unit);
        for (const warning of lateNegationWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Multiple independent variables
        const multiIndepWarnings = (0, index_2.checkMultipleIndependentVars)(parseResult.unit);
        for (const warning of multiIndepWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
        // Temporal recursion warnings (DatalogMTL)
        const temporalWarnings = (0, index_2.checkTemporalRecursion)(parseResult.unit);
        for (const warning of temporalWarnings) {
            const diag = stratificationErrorToDiagnostic(warning, lines);
            if (shouldInclude(diag.severity, options.severity)) {
                diagnostics.push(diag);
            }
        }
    }
    return {
        path: (0, path_1.relative)(process.cwd(), filePath),
        diagnostics,
    };
}
/**
 * Convert a parse error to a CLI diagnostic.
 */
function parseErrorToDiagnostic(error, lines) {
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
function semanticErrorToDiagnostic(error, lines) {
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
function stratificationErrorToDiagnostic(error, lines) {
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
function shouldInclude(severity, minSeverity) {
    const order = ['info', 'warning', 'error'];
    return order.indexOf(severity) >= order.indexOf(minSeverity);
}
/**
 * Determine exit code based on check result and options.
 */
function getExitCode(result, options) {
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
//# sourceMappingURL=check.js.map