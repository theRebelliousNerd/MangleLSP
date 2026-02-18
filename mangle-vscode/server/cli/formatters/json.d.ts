/**
 * JSON output formatter.
 */
import { CheckResult, SymbolsResult, HoverResult, DefinitionResult, ReferencesResult, CompletionResult, FormatResult } from '../types';
/**
 * Format check result as JSON.
 */
export declare function formatCheckResultJson(result: CheckResult): string;
/**
 * Format symbols result as JSON.
 */
export declare function formatSymbolsResultJson(result: SymbolsResult): string;
/**
 * Format hover result as JSON.
 */
export declare function formatHoverResultJson(result: HoverResult | null): string;
/**
 * Format definition result as JSON.
 */
export declare function formatDefinitionResultJson(result: DefinitionResult): string;
/**
 * Format references result as JSON.
 */
export declare function formatReferencesResultJson(result: ReferencesResult): string;
/**
 * Format completion result as JSON.
 */
export declare function formatCompletionResultJson(result: CompletionResult): string;
/**
 * Format format results as JSON.
 */
export declare function formatFormatResultJson(results: FormatResult[]): string;
//# sourceMappingURL=json.d.ts.map