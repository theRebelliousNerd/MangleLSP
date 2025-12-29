/**
 * Text output formatter for human-readable output.
 */

import {
    CheckResult,
    SymbolsResult,
    HoverResult,
    DefinitionResult,
    ReferencesResult,
    CompletionResult,
    FormatResult,
    CLIDiagnostic,
} from '../types';

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
};

/**
 * Check if colors should be used.
 */
function useColors(): boolean {
    return process.stdout.isTTY && !process.env['NO_COLOR'];
}

/**
 * Apply color if supported.
 */
function color(text: string, colorCode: string): string {
    if (!useColors()) {
        return text;
    }
    return `${colorCode}${text}${COLORS.reset}`;
}

/**
 * Format a diagnostic for text output.
 */
function formatDiagnostic(diag: CLIDiagnostic, filePath: string): string {
    const loc = `${filePath}:${diag.range.start.line}:${diag.range.start.column}`;
    let severityLabel: string;

    switch (diag.severity) {
        case 'error':
            severityLabel = color('error', COLORS.red);
            break;
        case 'warning':
            severityLabel = color('warning', COLORS.yellow);
            break;
        default:
            severityLabel = color('info', COLORS.blue);
    }

    const code = color(`[${diag.code}]`, COLORS.gray);
    const location = color(loc, COLORS.cyan);

    let output = `${location}: ${severityLabel} ${code}: ${diag.message}`;

    if (diag.context) {
        output += `\n  ${color('|', COLORS.gray)} ${diag.context}`;
    }

    return output;
}

/**
 * Format check result as text.
 */
export function formatCheckResultText(result: CheckResult): string {
    const lines: string[] = [];

    for (const file of result.files) {
        for (const diag of file.diagnostics) {
            lines.push(formatDiagnostic(diag, file.path));
        }
    }

    if (result.summary.totalErrors > 0 || result.summary.totalWarnings > 0 || result.summary.totalInfo > 0) {
        lines.push('');
        lines.push(color('Summary:', COLORS.bold));
        lines.push(`  Files checked: ${result.summary.totalFiles}`);
        if (result.summary.totalErrors > 0) {
            lines.push(`  Errors: ${color(result.summary.totalErrors.toString(), COLORS.red)}`);
        }
        if (result.summary.totalWarnings > 0) {
            lines.push(`  Warnings: ${color(result.summary.totalWarnings.toString(), COLORS.yellow)}`);
        }
        if (result.summary.totalInfo > 0) {
            lines.push(`  Info: ${result.summary.totalInfo}`);
        }
    } else {
        lines.push(color('No issues found.', COLORS.gray));
    }

    return lines.join('\n');
}

/**
 * Format symbols result as text.
 */
export function formatSymbolsResultText(result: SymbolsResult): string {
    const lines: string[] = [];
    lines.push(color(`Symbols in ${result.path}:`, COLORS.bold));

    if (result.symbols.length === 0) {
        lines.push(color('  No symbols found.', COLORS.gray));
        return lines.join('\n');
    }

    for (const symbol of result.symbols) {
        const loc = `${symbol.range.start.line}:${symbol.range.start.column}`;
        const kind = color(`[${symbol.kind}]`, COLORS.cyan);
        lines.push(`  ${kind} ${symbol.name} ${color(`(${loc})`, COLORS.gray)}`);

        if (symbol.children) {
            for (const child of symbol.children) {
                const childLoc = `${child.range.start.line}:${child.range.start.column}`;
                const childKind = color(`[${child.kind}]`, COLORS.blue);
                lines.push(`    ${childKind} ${child.name} ${color(`(${childLoc})`, COLORS.gray)}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Format hover result as text.
 */
export function formatHoverResultText(result: HoverResult | null): string {
    if (!result) {
        return color('No hover information available.', COLORS.gray);
    }
    return result.contents;
}

/**
 * Format definition result as text.
 */
export function formatDefinitionResultText(result: DefinitionResult): string {
    if (result.locations.length === 0) {
        return color('No definition found.', COLORS.gray);
    }

    const lines: string[] = [];
    lines.push(color('Definitions:', COLORS.bold));
    for (const loc of result.locations) {
        const position = `${loc.range.start.line}:${loc.range.start.column}`;
        lines.push(`  ${color(loc.uri, COLORS.cyan)}:${position}`);
    }
    return lines.join('\n');
}

/**
 * Format references result as text.
 */
export function formatReferencesResultText(result: ReferencesResult): string {
    if (result.locations.length === 0) {
        return color('No references found.', COLORS.gray);
    }

    const lines: string[] = [];
    lines.push(color(`Found ${result.locations.length} reference(s):`, COLORS.bold));
    for (const loc of result.locations) {
        const position = `${loc.range.start.line}:${loc.range.start.column}`;
        lines.push(`  ${color(loc.uri, COLORS.cyan)}:${position}`);
    }
    return lines.join('\n');
}

/**
 * Format completion result as text.
 */
export function formatCompletionResultText(result: CompletionResult): string {
    if (result.items.length === 0) {
        return color('No completions available.', COLORS.gray);
    }

    const lines: string[] = [];
    lines.push(color(`Completions (${result.items.length}):`, COLORS.bold));
    for (const item of result.items.slice(0, 20)) {
        const kind = color(`[${item.kind}]`, COLORS.cyan);
        let line = `  ${kind} ${item.label}`;
        if (item.detail) {
            line += ` ${color(`- ${item.detail}`, COLORS.gray)}`;
        }
        lines.push(line);
    }
    if (result.items.length > 20) {
        lines.push(color(`  ... and ${result.items.length - 20} more`, COLORS.gray));
    }
    return lines.join('\n');
}

/**
 * Format format results as text.
 */
export function formatFormatResultText(results: FormatResult[]): string {
    const lines: string[] = [];
    let formattedCount = 0;
    let needsFormattingCount = 0;
    let errorCount = 0;

    for (const result of results) {
        if (result.error) {
            lines.push(`${color('error', COLORS.red)}: ${result.path}: ${result.error}`);
            errorCount++;
        } else if (!result.formatted) {
            lines.push(`${color('needs formatting', COLORS.yellow)}: ${result.path}`);
            if (result.diff) {
                lines.push(result.diff);
            }
            needsFormattingCount++;
        } else {
            formattedCount++;
        }
    }

    lines.push('');
    lines.push(color('Summary:', COLORS.bold));
    lines.push(`  Already formatted: ${formattedCount}`);
    if (needsFormattingCount > 0) {
        lines.push(`  Needs formatting: ${color(needsFormattingCount.toString(), COLORS.yellow)}`);
    }
    if (errorCount > 0) {
        lines.push(`  Errors: ${color(errorCount.toString(), COLORS.red)}`);
    }

    return lines.join('\n');
}
