/**
 * Check command - run diagnostics on Mangle files.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse } from '../../parser/index';
import { ProgramContext } from '../../workspace/context';
import { analysisToCLIDiagnostic, parseErrorToCLIDiagnostic } from '../diagnostics';
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
        version: '1.1',
        files: [],
        summary: {
            totalFiles: 0,
            totalErrors: 0,
            totalWarnings: 0,
            totalInfo: 0,
        },
    };

    const context = new ProgramContext({ isolated: options.isolated });
    let ignoredFiles = 0;
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

        if (!options.noIgnore && context.ignore.isIgnored(filePath, source)) {
            ignoredFiles++;
            continue;
        }
        const fileDiagnostics = checkFile(filePath, source, options, context);
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

    if (ignoredFiles > 0) result.summary.ignoredFiles = ignoredFiles;
    return result;
}

/**
 * Check a single file, in the context of the program the host loads it with.
 */
export function checkFile(
    filePath: string,
    source: string,
    options: CheckOptions,
    context: ProgramContext = new ProgramContext({ isolated: options.isolated }),
): FileDiagnostics {
    const diagnostics: CLIDiagnostic[] = [];
    const lines = source.split('\n');
    const explain = !!options.explain;

    const parseResult = parse(source);
    const report = context.analyze(filePath, source, parseResult);

    for (const error of report.parseErrors) {
        const diag = parseErrorToCLIDiagnostic(error, lines, explain);
        if (shouldInclude(diag.severity, options.severity)) {
            diagnostics.push(diag);
        }
    }

    // Semantic validation, stratification and advisory checks (of this file only)
    for (const error of report.diagnostics) {
        const diag = analysisToCLIDiagnostic(error, lines, explain);
        if (shouldInclude(diag.severity, options.severity)) {
            diagnostics.push(diag);
        }
    }

    return {
        path: relative(process.cwd(), filePath),
        diagnostics,
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
