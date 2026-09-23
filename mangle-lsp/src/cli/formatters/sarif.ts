/**
 * SARIF (Static Analysis Results Interchange Format) output formatter.
 * https://sarifweb.azurewebsites.net/
 */

import { CheckResult, CLIDiagnostic } from '../types';
import { getDiagnosticInfo, diagnosticDocUrl } from '../../analysis/diagnostics';
import { VERSION } from '../../version';

/**
 * SARIF schema version.
 */
const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const SARIF_VERSION = '2.1.0';

/**
 * SARIF result level.
 */
type SarifLevel = 'error' | 'warning' | 'note' | 'none';

/**
 * Map diagnostic severity to SARIF level.
 */
function mapSeverityToLevel(severity: string): SarifLevel {
    switch (severity) {
        case 'error':
            return 'error';
        case 'warning':
            return 'warning';
        case 'info':
            return 'note';
        default:
            return 'warning';
    }
}

/**
 * SARIF rule descriptor.
 */
interface SarifRule {
    id: string;
    name?: string;
    shortDescription: { text: string };
    fullDescription?: { text: string };
    help?: { text: string; markdown?: string };
    helpUri?: string;
    properties?: { category: string };
    defaultConfiguration?: {
        level: SarifLevel;
    };
}

/**
 * SARIF region (1-indexed lines and columns).
 */
interface SarifRegion {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}

/**
 * SARIF fix (replacement edits).
 */
interface SarifFix {
    description: { text: string };
    artifactChanges: {
        artifactLocation: { uri: string };
        replacements: { deletedRegion: SarifRegion; insertedContent: { text: string } }[];
    }[];
}

/**
 * SARIF result.
 */
interface SarifResult {
    ruleId: string;
    level: SarifLevel;
    message: { text: string };
    fixes?: SarifFix[];
    locations: {
        physicalLocation: {
            artifactLocation: { uri: string };
            region: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
            };
        };
    }[];
}

/**
 * Full SARIF document.
 */
interface SarifDocument {
    $schema: string;
    version: string;
    runs: {
        tool: {
            driver: {
                name: string;
                version: string;
                informationUri: string;
                rules: SarifRule[];
            };
        };
        results: SarifResult[];
    }[];
}

/**
 * Collect all unique rules from diagnostics.
 */
function collectRules(result: CheckResult): Map<string, SarifRule> {
    const rules = new Map<string, SarifRule>();

    for (const file of result.files) {
        for (const diag of file.diagnostics) {
            if (!rules.has(diag.code)) {
                const info = getDiagnosticInfo(diag.code);
                const rule: SarifRule = {
                    id: diag.code,
                    shortDescription: { text: getRuleDescription(diag.code) },
                    defaultConfiguration: {
                        level: mapSeverityToLevel(info?.severity ?? diag.severity),
                    },
                };
                if (info) {
                    rule.name = toRuleName(info.title);
                    rule.fullDescription = { text: info.explanation };
                    const example = info.example
                        ? `\n\nInstead of:\n${info.example.bad}\n\nwrite:\n${info.example.good}`
                        : '';
                    const exampleMd = info.example
                        ? `\n\nInstead of:\n\`\`\`\n${info.example.bad}\n\`\`\`\nwrite:\n\`\`\`\n${info.example.good}\n\`\`\``
                        : '';
                    rule.help = { text: `${info.fix}${example}`, markdown: `${info.fix}${exampleMd}` };
                    rule.helpUri = diagnosticDocUrl(info.code);
                    rule.properties = { category: info.category };
                }
                rules.set(diag.code, rule);
            }
        }
    }

    return rules;
}

/**
 * Get a description for a rule code (from the diagnostic catalog).
 */
function getRuleDescription(code: string): string {
    return getDiagnosticInfo(code)?.title ?? `Mangle diagnostic ${code}`;
}

/** PascalCase rule name from a title, as SARIF viewers expect. */
function toRuleName(title: string): string {
    return title
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w[0]!.toUpperCase() + w.slice(1))
        .join('');
}

function toRegion(range: CLIDiagnostic['range']): SarifRegion {
    return {
        startLine: range.start.line,
        startColumn: range.start.column + 1, // SARIF uses 1-indexed columns
        endLine: range.end.line,
        endColumn: range.end.column + 1,
    };
}

/**
 * Convert a diagnostic to SARIF result.
 */
function diagnosticToResult(diag: CLIDiagnostic, filePath: string): SarifResult {
    const result: SarifResult = {
        ruleId: diag.code,
        level: mapSeverityToLevel(diag.severity),
        message: { text: diag.hint ? `${diag.message}. Help: ${diag.hint}` : diag.message },
        locations: [{
            physicalLocation: {
                artifactLocation: { uri: filePath },
                region: toRegion(diag.range),
            },
        }],
    };
    if (diag.fixes && diag.fixes.length > 0) {
        result.fixes = diag.fixes.map(f => ({
            description: { text: f.title },
            artifactChanges: [{
                artifactLocation: { uri: filePath },
                replacements: [{ deletedRegion: toRegion(f.range), insertedContent: { text: f.newText } }],
            }],
        }));
    }
    return result;
}

/**
 * Format check result as SARIF.
 */
export function formatCheckResultSarif(result: CheckResult): string {
    const rules = collectRules(result);
    const results: SarifResult[] = [];

    for (const file of result.files) {
        for (const diag of file.diagnostics) {
            results.push(diagnosticToResult(diag, file.path));
        }
    }

    const sarif: SarifDocument = {
        $schema: SARIF_SCHEMA,
        version: SARIF_VERSION,
        runs: [{
            tool: {
                driver: {
                    name: 'mangle-cli',
                    version: VERSION,
                    informationUri: 'https://github.com/theRebelliousNerd/MangleLSP',
                    rules: Array.from(rules.values()),
                },
            },
            results,
        }],
    };

    return JSON.stringify(sarif, null, 2);
}
