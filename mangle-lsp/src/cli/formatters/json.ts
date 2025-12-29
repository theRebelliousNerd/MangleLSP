/**
 * JSON output formatter.
 */

import {
    CheckResult,
    SymbolsResult,
    HoverResult,
    DefinitionResult,
    ReferencesResult,
    CompletionResult,
    FormatResult,
} from '../types';

/**
 * Format check result as JSON.
 */
export function formatCheckResultJson(result: CheckResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Format symbols result as JSON.
 */
export function formatSymbolsResultJson(result: SymbolsResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Format hover result as JSON.
 */
export function formatHoverResultJson(result: HoverResult | null): string {
    if (!result) {
        return JSON.stringify({ contents: null }, null, 2);
    }
    return JSON.stringify(result, null, 2);
}

/**
 * Format definition result as JSON.
 */
export function formatDefinitionResultJson(result: DefinitionResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Format references result as JSON.
 */
export function formatReferencesResultJson(result: ReferencesResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Format completion result as JSON.
 */
export function formatCompletionResultJson(result: CompletionResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * Format format results as JSON.
 */
export function formatFormatResultJson(results: FormatResult[]): string {
    return JSON.stringify({ files: results }, null, 2);
}
