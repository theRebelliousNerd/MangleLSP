#!/usr/bin/env node
/**
 * Mangle CLI - Command-line interface for Mangle language analysis.
 *
 * Provides machine-readable output for coding agents and CI/CD integration.
 *
 * Usage:
 *   mangle-cli <command> [options] <files...>
 *
 * Commands:
 *   check         Run diagnostics (parse, semantic, stratification)
 *   symbols       List document symbols
 *   hover         Get hover information at position
 *   definition    Get definition location
 *   references    Find all references
 *   completion    Get completions at position
 *   format        Format Mangle source files
 */

import { resolve } from 'path';

import {
    runCheck,
    getExitCode,
    runSymbols,
    runHover,
    runDefinition,
    runReferences,
    runCompletion,
    runFormat,
    getFormatExitCode,
    ReferencesOptions,
} from './cli/commands/index';

import {
    formatCheckResultJson,
    formatSymbolsResultJson,
    formatHoverResultJson,
    formatDefinitionResultJson,
    formatReferencesResultJson,
    formatCompletionResultJson,
    formatFormatResultJson,
    formatCheckResultText,
    formatSymbolsResultText,
    formatHoverResultText,
    formatDefinitionResultText,
    formatReferencesResultText,
    formatCompletionResultText,
    formatFormatResultText,
    formatCheckResultSarif,
} from './cli/formatters/index';

import {
    CheckOptions,
    FormatOptions,
    PositionOptions,
    DiagnosticSeverity,
} from './cli/types';

const VERSION = '1.0.0';

/**
 * Print usage information.
 */
function printUsage(): void {
    console.log(`
Mangle CLI v${VERSION}

Usage: mangle-cli <command> [options] <files...>

Commands:
  check         Run diagnostics (parse, semantic, stratification)
  symbols       List document symbols
  hover         Get hover information at position
  definition    Get definition location
  references    Find all references
  completion    Get completions at position
  format        Format Mangle source files

Global Options:
  --format, -f    Output format: json | text | sarif (default: json)
  --quiet, -q     Suppress non-essential output
  --help, -h      Show help
  --version, -v   Show version

Check Options:
  --severity      Minimum severity: error | warning | info (default: info)
  --fail-on       Exit non-zero on: error | warning | never (default: error)

Position Options (hover, definition, references, completion):
  --line          Line number (1-indexed, required)
  --column        Column number (0-indexed, required)

References Options:
  --include-declaration  Include declaration in results

Format Options:
  --write, -w     Write formatted output back to files
  --check         Check if files are formatted (exit non-zero if not)
  --diff          Show diff of formatting changes

Examples:
  # Check files for errors (JSON output for agents)
  mangle-cli check src/**/*.mg

  # Check with human-readable output
  mangle-cli check --format text src/**/*.mg

  # Get symbols from a file
  mangle-cli symbols src/main.mg

  # Get hover info at position
  mangle-cli hover src/main.mg --line 10 --column 5

  # Format files in place
  mangle-cli format --write src/**/*.mg

  # Check if files need formatting (for CI)
  mangle-cli format --check src/**/*.mg

  # Generate SARIF for GitHub Actions
  mangle-cli check --format sarif src/**/*.mg > results.sarif
`);
}

/**
 * Parse command line arguments.
 */
interface ParsedArgs {
    command: string;
    files: string[];
    options: Record<string, string | boolean | number>;
}

function parseArgs(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
        command: '',
        files: [],
        options: {},
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (!arg) {
            i++;
            continue;
        }

        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('-')) {
                result.options[key] = next;
                i += 2;
            } else {
                result.options[key] = true;
                i++;
            }
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            // Handle short options
            switch (key) {
                case 'f':
                    result.options['format'] = args[++i] || 'json';
                    break;
                case 'q':
                    result.options['quiet'] = true;
                    break;
                case 'h':
                    result.options['help'] = true;
                    break;
                case 'v':
                    result.options['version'] = true;
                    break;
                case 'w':
                    result.options['write'] = true;
                    break;
                default:
                    result.options[key] = true;
            }
            i++;
        } else if (!result.command) {
            result.command = arg;
            i++;
        } else {
            result.files.push(arg);
            i++;
        }
    }

    return result;
}

/**
 * Expand glob patterns in file list.
 */
function expandGlobs(patterns: string[]): string[] {
    const files: string[] = [];
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            try {
                // Use a simple approach - fs.globSync in Node 22+
                // For compatibility, we'll just warn if glob patterns are used
                console.error(`Warning: Glob pattern "${pattern}" - please expand globs before passing to CLI`);
                files.push(pattern);
            } catch {
                files.push(pattern);
            }
        } else {
            files.push(pattern);
        }
    }
    return files;
}

/**
 * Main entry point.
 */
function main(): void {
    const args = parseArgs(process.argv.slice(2));

    // Handle global flags
    if (args.options['version']) {
        console.log(`mangle-cli v${VERSION}`);
        process.exit(0);
    }

    if (args.options['help'] || !args.command) {
        printUsage();
        process.exit(args.options['help'] ? 0 : 1);
    }

    const outputFormat = (args.options['format'] as string) || 'json';
    const quiet = !!args.options['quiet'];

    // Expand glob patterns
    const files = expandGlobs(args.files);

    try {
        switch (args.command) {
            case 'check':
                handleCheck(files, outputFormat, args.options);
                break;

            case 'symbols':
                handleSymbols(files[0] || '', outputFormat, args.options);
                break;

            case 'hover':
                handleHover(files[0] || '', outputFormat, args.options);
                break;

            case 'definition':
                handleDefinition(files[0] || '', outputFormat, args.options);
                break;

            case 'references':
                handleReferences(files[0] || '', outputFormat, args.options);
                break;

            case 'completion':
                handleCompletion(files[0] || '', outputFormat, args.options);
                break;

            case 'format':
                handleFormat(files, outputFormat, args.options);
                break;

            default:
                console.error(`Unknown command: ${args.command}`);
                printUsage();
                process.exit(1);
        }
    } catch (e) {
        if (!quiet) {
            console.error(`Error: ${e}`);
        }
        process.exit(2);
    }
}

/**
 * Handle check command.
 */
function handleCheck(
    files: string[],
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (files.length === 0) {
        console.error('Error: No files specified');
        process.exit(1);
    }

    const checkOptions: CheckOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        severity: (options['severity'] as DiagnosticSeverity) || 'info',
        failOn: (options['fail-on'] as 'error' | 'warning' | 'never') || 'error',
    };

    const result = runCheck(files, checkOptions);

    switch (format) {
        case 'text':
            console.log(formatCheckResultText(result));
            break;
        case 'sarif':
            console.log(formatCheckResultSarif(result));
            break;
        default:
            console.log(formatCheckResultJson(result));
    }

    process.exit(getExitCode(result, checkOptions));
}

/**
 * Handle symbols command.
 */
function handleSymbols(
    file: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (!file) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    const commonOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
    };

    const result = runSymbols(file, commonOptions);

    switch (format) {
        case 'text':
            console.log(formatSymbolsResultText(result));
            break;
        default:
            console.log(formatSymbolsResultJson(result));
    }
}

/**
 * Handle hover command.
 */
function handleHover(
    file: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (!file) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    const line = parseInt(options['line'] as string, 10);
    const column = parseInt(options['column'] as string, 10);

    if (isNaN(line) || isNaN(column)) {
        console.error('Error: --line and --column are required');
        process.exit(1);
    }

    const posOptions: PositionOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        line,
        column,
    };

    const result = runHover(file, posOptions);

    switch (format) {
        case 'text':
            console.log(formatHoverResultText(result));
            break;
        default:
            console.log(formatHoverResultJson(result));
    }
}

/**
 * Handle definition command.
 */
function handleDefinition(
    file: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (!file) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    const line = parseInt(options['line'] as string, 10);
    const column = parseInt(options['column'] as string, 10);

    if (isNaN(line) || isNaN(column)) {
        console.error('Error: --line and --column are required');
        process.exit(1);
    }

    const posOptions: PositionOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        line,
        column,
    };

    const result = runDefinition(file, posOptions);

    switch (format) {
        case 'text':
            console.log(formatDefinitionResultText(result));
            break;
        default:
            console.log(formatDefinitionResultJson(result));
    }
}

/**
 * Handle references command.
 */
function handleReferences(
    file: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (!file) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    const line = parseInt(options['line'] as string, 10);
    const column = parseInt(options['column'] as string, 10);

    if (isNaN(line) || isNaN(column)) {
        console.error('Error: --line and --column are required');
        process.exit(1);
    }

    const refOptions: ReferencesOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        line,
        column,
        includeDeclaration: !!options['include-declaration'],
    };

    const result = runReferences(file, refOptions);

    switch (format) {
        case 'text':
            console.log(formatReferencesResultText(result));
            break;
        default:
            console.log(formatReferencesResultJson(result));
    }
}

/**
 * Handle completion command.
 */
function handleCompletion(
    file: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (!file) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    const line = parseInt(options['line'] as string, 10);
    const column = parseInt(options['column'] as string, 10);

    if (isNaN(line) || isNaN(column)) {
        console.error('Error: --line and --column are required');
        process.exit(1);
    }

    const posOptions: PositionOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        line,
        column,
    };

    const result = runCompletion(file, posOptions);

    switch (format) {
        case 'text':
            console.log(formatCompletionResultText(result));
            break;
        default:
            console.log(formatCompletionResultJson(result));
    }
}

/**
 * Handle format command.
 */
function handleFormat(
    files: string[],
    format: string,
    options: Record<string, string | boolean | number>
): void {
    if (files.length === 0) {
        console.error('Error: No files specified');
        process.exit(1);
    }

    const formatOptions: FormatOptions = {
        format: format as 'json' | 'text' | 'sarif',
        quiet: !!options['quiet'],
        write: !!options['write'],
        check: !!options['check'],
        diff: !!options['diff'],
    };

    const results = runFormat(files, formatOptions);

    switch (format) {
        case 'text':
            console.log(formatFormatResultText(results));
            break;
        default:
            console.log(formatFormatResultJson(results));
    }

    process.exit(getFormatExitCode(results, formatOptions));
}

// Run main
main();
