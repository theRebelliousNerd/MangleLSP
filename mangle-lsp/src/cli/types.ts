/**
 * Shared types for CLI output.
 */

/**
 * Position in a source file (1-indexed).
 */
export interface Position {
    line: number;
    column: number;
}

/**
 * Range in a source file.
 */
export interface Range {
    start: Position;
    end: Position;
}

/**
 * Diagnostic severity.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A single diagnostic.
 */
export interface CLIDiagnostic {
    severity: DiagnosticSeverity;
    code: string;
    source: string;
    message: string;
    range: Range;
    context?: string;
}

/**
 * Diagnostics for a single file.
 */
export interface FileDiagnostics {
    path: string;
    diagnostics: CLIDiagnostic[];
}

/**
 * Summary of check results.
 */
export interface CheckSummary {
    totalFiles: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
}

/**
 * Full check result output.
 */
export interface CheckResult {
    version: string;
    files: FileDiagnostics[];
    summary: CheckSummary;
}

/**
 * Symbol kind.
 */
export type SymbolKind = 'predicate' | 'declaration' | 'clause';

/**
 * A document symbol.
 */
export interface CLISymbol {
    name: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    children?: CLISymbol[];
}

/**
 * Symbols result.
 */
export interface SymbolsResult {
    path: string;
    symbols: CLISymbol[];
}

/**
 * Hover result.
 */
export interface HoverResult {
    contents: string;
    range?: Range;
}

/**
 * Location result.
 */
export interface LocationResult {
    uri: string;
    range: Range;
}

/**
 * Definition result.
 */
export interface DefinitionResult {
    locations: LocationResult[];
}

/**
 * References result.
 */
export interface ReferencesResult {
    locations: LocationResult[];
}

/**
 * Completion item.
 */
export interface CLICompletionItem {
    label: string;
    kind: string;
    detail?: string;
    documentation?: string;
    insertText?: string;
}

/**
 * Completion result.
 */
export interface CompletionResult {
    items: CLICompletionItem[];
}

/**
 * Format result.
 */
export interface FormatResult {
    path: string;
    formatted: boolean;
    diff?: string;
    error?: string;
}

/**
 * Common CLI options.
 */
export interface CommonOptions {
    format: 'json' | 'text' | 'sarif';
    quiet: boolean;
}

/**
 * Check command options.
 */
export interface CheckOptions extends CommonOptions {
    severity: DiagnosticSeverity;
    failOn: 'error' | 'warning' | 'never';
}

/**
 * Format command options.
 */
export interface FormatOptions extends CommonOptions {
    write: boolean;
    check: boolean;
    diff: boolean;
}

/**
 * Position options for commands that need a position.
 */
export interface PositionOptions extends CommonOptions {
    line: number;
    column: number;
}
