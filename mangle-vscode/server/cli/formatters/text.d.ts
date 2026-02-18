/**
 * Text output formatter for human-readable output.
 */
import { CheckResult, SymbolsResult, HoverResult, DefinitionResult, ReferencesResult, CompletionResult, FormatResult } from '../types';
/**
 * Format check result as text.
 */
export declare function formatCheckResultText(result: CheckResult): string;
/**
 * Format symbols result as text.
 */
export declare function formatSymbolsResultText(result: SymbolsResult): string;
/**
 * Format hover result as text.
 */
export declare function formatHoverResultText(result: HoverResult | null): string;
/**
 * Format definition result as text.
 */
export declare function formatDefinitionResultText(result: DefinitionResult): string;
/**
 * Format references result as text.
 */
export declare function formatReferencesResultText(result: ReferencesResult): string;
/**
 * Format completion result as text.
 */
export declare function formatCompletionResultText(result: CompletionResult): string;
/**
 * Format format results as text.
 */
export declare function formatFormatResultText(results: FormatResult[]): string;
//# sourceMappingURL=text.d.ts.map