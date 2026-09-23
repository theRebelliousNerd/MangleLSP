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
 *   explain       Explain a diagnostic code (or list all codes)
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
    runBatch,
    parseBatchInput,
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

import { VERSION, UPSTREAM_MANGLE_REVISION } from './version';
import {
    getDiagnosticInfo,
    getAllDiagnosticInfos,
    renderExplanation,
    renderDiagnosticsMarkdown,
    suggestSimilar,
    didYouMean,
} from './analysis/diagnostics';

/**
 * Flags that never take a value (so `--check file.mg` does not swallow the file).
 */
const BOOLEAN_FLAGS = new Set([
    'quiet', 'help', 'version', 'write', 'check', 'diff',
    'include-declaration', 'explain', 'all', 'markdown', 'list',
]);

/**
 * Print usage information.
 */
function printUsage(): void {
    console.log(`
Mangle CLI v${VERSION} (tracks upstream Mangle ${UPSTREAM_MANGLE_REVISION})

Usage: mangle-cli <command> [options] <files...>

Commands:
  check         Run diagnostics (parse, semantic, stratification)
  symbols       List document symbols
  hover         Get hover information at position
  definition    Get definition location
  references    Find all references
  completion    Get completions at position
  format        Format Mangle source files
  batch         Run multiple queries in one call (for agents)
  file-info     Get complete analysis of a file
  explain       Explain a diagnostic code: what it means, how to fix it, example

Global Options:
  --format, -f    Output format: json | text | sarif (default: json)
  --quiet, -q     Suppress non-essential output
  --help, -h      Show help
  --version, -v   Show version

Check Options:
  --severity      Minimum severity: error | warning | info (default: info)
  --fail-on       Exit non-zero on: error | warning | never (default: error)
  --explain       Include the full explanation, fix and example of every code

Explain Options:
  mangle-cli explain E002          Explain one code
  mangle-cli explain --list        One line per code
  mangle-cli explain --all         Every code in full (--markdown for docs)

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

  # Explain a diagnostic code
  mangle-cli explain E003

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

  # Batch queries (for coding agents)
  mangle-cli batch queries.json
  echo '[{"type":"hover","file":"src/main.mg","line":10,"column":5}]' | mangle-cli batch -

  # Get complete file analysis
  mangle-cli file-info src/main.mg

Batch Query Format:
  [
    { "id": 1, "type": "hover", "file": "src/main.mg", "line": 10, "column": 5 },
    { "id": 2, "type": "definition", "file": "src/main.mg", "line": 15, "column": 3 },
    { "id": 3, "type": "diagnostics", "file": "src/main.mg" },
    { "id": 4, "type": "symbols", "file": "src/main.mg" },
    { "id": 5, "type": "fileInfo", "file": "src/main.mg" }
  ]

Query Types: hover, definition, references, completion, symbols, diagnostics, format, fileInfo
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
            const eq = arg.indexOf('=');
            if (eq !== -1) {
                result.options[arg.slice(2, eq)] = arg.slice(eq + 1);
                i++;
                continue;
            }
            const key = arg.slice(2);
            const next = args[i + 1];
            if (!BOOLEAN_FLAGS.has(key) && next && !next.startsWith('-')) {
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
        console.log(`mangle-cli v${VERSION} (upstream Mangle ${UPSTREAM_MANGLE_REVISION})`);
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

            case 'batch':
                handleBatch(files[0] || '', outputFormat, args.options);
                break;

            case 'file-info':
                handleFileInfo(files[0] || '', outputFormat, args.options);
                break;

            case 'explain':
                handleExplain(args.files, (args.options['format'] as string) || 'text', args.options);
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
        explain: !!options['explain'],
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
 * Handle explain command: long-form documentation of diagnostic codes.
 * JSON output (the default) returns the catalog entries for programmatic use.
 */
function handleExplain(
    codes: string[],
    format: string,
    options: Record<string, string | boolean | number>
): void {
    const all = getAllDiagnosticInfos();
    if (options['markdown']) {
        console.log(renderDiagnosticsMarkdown());
        return;
    }
    if (options['list']) {
        if (format === 'json') {
            console.log(JSON.stringify(all.map(i => ({ code: i.code, title: i.title, category: i.category, severity: i.severity })), null, 2));
        } else {
            for (const i of all) {
                console.log(`${i.code}  ${i.severity.padEnd(7)}  ${i.category.padEnd(14)}  ${i.title}`);
            }
        }
        return;
    }
    const selected = options['all'] ? all : codes.map(c => c.toUpperCase());
    if (selected.length === 0) {
        console.error('Error: specify a code (e.g. mangle-cli explain E002), --list or --all');
        process.exit(1);
    }
    const infos = [];
    for (const item of selected) {
        const info = typeof item === 'string' ? getDiagnosticInfo(item) : item;
        if (!info) {
            const hint = didYouMean(suggestSimilar(String(item), all.map(i => i.code)));
            console.error(`Unknown diagnostic code: ${item}${hint ? ` (${hint})` : ''}. Run 'mangle-cli explain --list' to see all codes.`);
            process.exit(1);
        }
        infos.push(info);
    }
    if (format === 'json') {
        console.log(JSON.stringify(infos.length === 1 ? infos[0] : infos, null, 2));
    } else {
        console.log(infos.map(i => renderExplanation(i, format === 'markdown')).join('\n\n---\n\n'));
    }
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

/**
 * Handle batch command.
 */
function handleBatch(
    input: string,
    format: string,
    options: Record<string, string | boolean | number>
): void {
    let queryInput: string;

    if (input === '-') {
        // Read from stdin
        const chunks: Buffer[] = [];
        const fd = require('fs').openSync(0, 'r');
        const buf = Buffer.alloc(1024);
        let n: number;
        while ((n = require('fs').readSync(fd, buf)) > 0) {
            chunks.push(buf.slice(0, n));
        }
        queryInput = Buffer.concat(chunks).toString('utf-8');
    } else if (input) {
        queryInput = input;
    } else {
        console.error('Error: No batch input specified. Use a file path or - for stdin');
        process.exit(1);
    }

    try {
        const queries = parseBatchInput(queryInput);
        const commonOptions = {
            format: format as 'json' | 'text' | 'sarif',
            quiet: !!options['quiet'],
        };

        const result = runBatch(queries, commonOptions);

        // Always output as JSON for batch (it's meant for programmatic use)
        console.log(JSON.stringify(result, null, 2));

        // Exit with error if any queries failed
        process.exit(result.summary.failed > 0 ? 1 : 0);
    } catch (e) {
        console.error(`Error parsing batch input: ${e}`);
        process.exit(2);
    }
}

/**
 * Handle file-info command.
 */
function handleFileInfo(
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

    // Run batch with a single fileInfo query
    const result = runBatch([{ type: 'fileInfo', file }], commonOptions);

    if (result.results.length > 0 && result.results[0]) {
        const fileInfo = result.results[0].result;
        if (format === 'text') {
            console.log(formatFileInfoText(fileInfo));
        } else {
            console.log(JSON.stringify(fileInfo, null, 2));
        }
    } else {
        console.error('Error: Failed to get file info');
        process.exit(1);
    }
}

/**
 * Format file info as text.
 */
function formatFileInfoText(info: any): string {
    if (!info) return 'No file info available';

    const lines: string[] = [];
    lines.push(`File: ${info.path}`);
    lines.push(`Lines: ${info.lineCount}`);
    lines.push(`Syntax Errors: ${info.hasSyntaxErrors ? 'Yes' : 'No'}`);
    lines.push(`Semantic Errors: ${info.hasSemanticErrors ? 'Yes' : 'No'}`);

    if (info.ast) {
        lines.push(`\nAST:`);
        lines.push(`  Declarations: ${info.ast.declCount}`);
        lines.push(`  Clauses: ${info.ast.clauseCount}`);
        if (info.ast.packageDecl) {
            lines.push(`  Package: ${info.ast.packageDecl.name}`);
        }
    }

    if (info.predicates && info.predicates.length > 0) {
        lines.push(`\nPredicates (${info.predicates.length}):`);
        for (const pred of info.predicates) {
            const attrs = [];
            if (pred.isExternal) attrs.push('external');
            if (pred.isPrivate) attrs.push('private');
            const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
            lines.push(`  ${pred.name}/${pred.arity}${attrStr} - ${pred.definitionCount} def, ${pred.referenceCount} ref`);
        }
    }

    if (info.symbols && info.symbols.length > 0) {
        lines.push(`\nSymbols (${info.symbols.length}):`);
        for (const sym of info.symbols.slice(0, 10)) {
            lines.push(`  ${sym.name} (line ${sym.range.start.line})`);
        }
        if (info.symbols.length > 10) {
            lines.push(`  ... and ${info.symbols.length - 10} more`);
        }
    }

    const diag = info.diagnostics;
    if (diag) {
        lines.push(`\nDiagnostics:`);
        lines.push(`  Errors: ${diag.totalErrors || 0}`);
        lines.push(`  Warnings: ${diag.totalWarnings || 0}`);
    }

    return lines.join('\n');
}

// Run main
main();
