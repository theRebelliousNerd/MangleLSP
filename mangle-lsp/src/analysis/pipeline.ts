/**
 * The complete analysis pipeline for a parsed Mangle unit.
 *
 * Every surface (language server, `mangle-cli check`, batch queries) runs the
 * same checks in the same order through this module, so diagnostics never
 * drift between the editor and CI.
 */

import { SourceUnit, SourceRange } from '../parser/ast';
import { validate, ValidationResult, QuickFix } from './validation';
import {
    checkStratification,
    checkUnboundedRecursion,
    checkCartesianExplosion,
    checkLateFiltering,
    checkLateNegation,
    checkMultipleIndependentVars,
    checkTemporalRecursion,
} from './stratification';

/**
 * A diagnostic produced by the analysis pipeline.
 */
export interface AnalysisDiagnostic {
    code: string;
    message: string;
    range: SourceRange;
    severity: 'error' | 'warning' | 'info';
    /** Which analysis produced it. */
    source: 'mangle-semantic' | 'mangle-stratification';
    /** Actionable, instance-specific suggestion. */
    hint?: string;
    /** Machine-applicable fixes. */
    fixes?: QuickFix[];
}

/**
 * Result of analyzing a unit.
 */
export interface AnalysisResult {
    validation: ValidationResult;
    diagnostics: AnalysisDiagnostic[];
}

/**
 * Runs semantic validation, stratification and all advisory checks.
 * Diagnostics are returned in source order.
 */
export function analyzeUnit(unit: SourceUnit): AnalysisResult {
    const validation = validate(unit);
    const diagnostics: AnalysisDiagnostic[] = validation.errors.map(e => ({
        code: e.code,
        message: e.message,
        range: e.range,
        severity: e.severity,
        source: 'mangle-semantic',
        hint: e.hint,
        fixes: e.fixes,
    }));

    const stratChecks = [
        checkStratification,
        checkUnboundedRecursion,
        checkCartesianExplosion,
        checkLateFiltering,
        checkLateNegation,
        checkMultipleIndependentVars,
        checkTemporalRecursion,
    ];
    for (const check of stratChecks) {
        for (const e of check(unit)) {
            diagnostics.push({
                code: e.code,
                message: e.message,
                range: e.range,
                severity: e.severity,
                source: 'mangle-stratification',
                hint: e.hint,
            });
        }
    }

    // Report in source order (stable: analyses keep their relative order per position).
    diagnostics.sort((a, b) =>
        a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column);

    return { validation, diagnostics };
}
