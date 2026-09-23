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
 * A machine-applicable fix for a diagnostic: replace `range` with `newText`.
 */
export interface CLIFix {
    title: string;
    range: Range;
    newText: string;
}

/**
 * A single diagnostic.
 *
 * Besides the location and message, diagnostics carry catalog information so
 * that a reader (or coding agent) who has never seen Mangle can act on them:
 * `hint` is an instance-specific suggestion, `fixes` are applicable edits,
 * `docs` links to the long-form explanation (also `mangle-cli explain CODE`).
 * `explanation`, `fix` and `example` are included with `--explain`.
 */
export interface CLIDiagnostic {
    severity: DiagnosticSeverity;
    code: string;
    source: string;
    message: string;
    range: Range;
    context?: string;
    /** Short title of the diagnostic code */
    title?: string;
    /** Category of the diagnostic code (safety, type, performance, ...) */
    category?: string;
    /** Instance-specific, actionable suggestion */
    hint?: string;
    /** Machine-applicable edits */
    fixes?: CLIFix[];
    /** Link to the documentation of the code */
    docs?: string;
    /** What the rule means (with --explain) */
    explanation?: string;
    /** How to fix it in general (with --explain) */
    fix?: string;
    /** Minimal failing and corrected program (with --explain) */
    example?: { bad: string; good: string };
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
    /** Include the long-form explanation of each code in the output */
    explain?: boolean;
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
