/**
 * Conversion of analysis diagnostics to CLI diagnostics, enriched with the
 * diagnostic catalog (title, category, docs link and - on request - the full
 * explanation with a before/after example).
 */

import { AnalysisDiagnostic } from '../analysis/pipeline';
import { getDiagnosticInfo, diagnosticDocUrl } from '../analysis/diagnostics';
import { ParseError } from '../parser/index';
import { CLIDiagnostic, CLIFix, Range } from './types';
import { SourceRange } from '../parser/ast';

/** Converts an AST range (1-indexed lines, 0-indexed columns) to a CLI range. */
export function toCLIRange(range: SourceRange): Range {
    return {
        start: { line: range.start.line, column: range.start.column },
        end: { line: range.end.line, column: range.end.column },
    };
}

function lineContext(lines: string[], line: number): string | undefined {
    const text = (lines[line - 1] || '').trim();
    return text.length > 0 ? text : undefined;
}

/**
 * Adds catalog information to a diagnostic.
 */
export function enrichDiagnostic(diag: CLIDiagnostic, explain: boolean): CLIDiagnostic {
    const info = getDiagnosticInfo(diag.code);
    if (!info) return diag;
    const enriched: CLIDiagnostic = {
        ...diag,
        title: info.title,
        category: info.category,
        docs: diagnosticDocUrl(info.code),
    };
    if (explain) {
        enriched.explanation = info.explanation;
        enriched.fix = info.fix;
        if (info.example) enriched.example = { ...info.example };
    }
    return enriched;
}

/**
 * Converts an analysis diagnostic to a CLI diagnostic.
 */
export function analysisToCLIDiagnostic(error: AnalysisDiagnostic, lines: string[], explain = false): CLIDiagnostic {
    const fixes: CLIFix[] | undefined = error.fixes?.map(f => ({
        title: f.title,
        range: toCLIRange(f.range),
        newText: f.newText,
    }));
    const diag: CLIDiagnostic = {
        severity: error.severity,
        code: error.code,
        source: error.source,
        message: error.message,
        range: toCLIRange(error.range),
        context: lineContext(lines, error.range.start.line),
    };
    if (error.hint) diag.hint = error.hint;
    if (fixes && fixes.length > 0) diag.fixes = fixes;
    return enrichDiagnostic(diag, explain);
}

/**
 * Converts a parse error to a CLI diagnostic.
 */
export function parseErrorToCLIDiagnostic(error: ParseError, lines: string[], explain = false): CLIDiagnostic {
    const diag: CLIDiagnostic = {
        severity: 'error',
        code: 'P001',
        source: error.source === 'lexer' ? 'mangle-lexer' : 'mangle-parse',
        message: error.message,
        range: {
            start: { line: error.line, column: error.column },
            end: { line: error.line, column: error.column + error.length },
        },
        context: lineContext(lines, error.line),
    };
    const hint = parseErrorHint(error.message, lines[error.line - 1] ?? '');
    if (hint) diag.hint = hint;
    return enrichDiagnostic(diag, explain);
}

/**
 * Heuristic hints for common syntax errors made by authors coming from other
 * languages (Prolog, SQL, Soufflé).
 */
export function parseErrorHint(message: string, lineText: string): string | undefined {
    const trimmed = lineText.trim();
    if (/\bnot\s+[a-z]/.test(trimmed)) return "negation is written with '!', e.g. !parent(X, Y)";
    if (/\\\+/.test(trimmed)) return "negation is written with '!' (not Prolog's \\+)";
    if (/;/.test(trimmed) && !/["'`][^"'`]*;[^"'`]*["'`]/.test(trimmed)) return "Mangle has no disjunction ';' - write one rule per alternative";
    if (/\b(if|then|else)\b/.test(trimmed)) return 'Mangle has no if/then/else - express alternatives as separate rules';
    if (/\b[a-z]\w*\s*\([^)]*\b[a-z]\w*\b/.test(trimmed) && /missing|extraneous|mismatched|no viable/.test(message) && /\(\s*[a-z]/.test(trimmed)) {
        return 'variables must start with an uppercase letter (X, Person); lowercase identifiers are predicates, /names are constants';
    }
    if (trimmed.length > 0 && !/[.!]\s*(#.*)?$/.test(trimmed) && /missing '\.'|expecting '\.'|extraneous input/.test(message)) {
        return "every clause and declaration must end with '.'";
    }
    if (/<EOF>/.test(message)) return "the file ends in the middle of a clause - check for a missing '.' or an unclosed bracket";
    return undefined;
}
