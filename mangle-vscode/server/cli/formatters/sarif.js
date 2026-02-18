"use strict";
/**
 * SARIF (Static Analysis Results Interchange Format) output formatter.
 * https://sarifweb.azurewebsites.net/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCheckResultSarif = formatCheckResultSarif;
/**
 * SARIF schema version.
 */
const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const SARIF_VERSION = '2.1.0';
/**
 * Map diagnostic severity to SARIF level.
 */
function mapSeverityToLevel(severity) {
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
 * Collect all unique rules from diagnostics.
 */
function collectRules(result) {
    const rules = new Map();
    for (const file of result.files) {
        for (const diag of file.diagnostics) {
            if (!rules.has(diag.code)) {
                rules.set(diag.code, {
                    id: diag.code,
                    shortDescription: { text: getRuleDescription(diag.code) },
                    defaultConfiguration: {
                        level: mapSeverityToLevel(diag.severity),
                    },
                });
            }
        }
    }
    return rules;
}
/**
 * Get a description for a rule code.
 */
function getRuleDescription(code) {
    const descriptions = {
        'E000': 'File or I/O error',
        'E001': 'Variables in facts must be ground',
        'E002': 'Range restriction violation',
        'E003': 'Variables in negation must be bound',
        'E004': 'Variables in comparison must be bound',
        'E005': 'Unknown built-in predicate',
        'E006': 'Built-in predicate arity mismatch',
        'E007': 'Built-in predicate mode violation',
        'E008': 'Unknown built-in function',
        'E009': 'Built-in function arity mismatch',
        'E010': 'Unbound variable in function',
        'E011': 'Invalid transform structure',
        'E012': 'Unbound variable in group_by',
        'E013': 'Invalid function in let-transform',
        'E014': 'Unbound variable in function application',
        'E015': 'Stratification violation (negation cycle)',
        'E018': 'Wrong function casing',
        'E020': 'Hallucinated function',
        'E023': 'Stratification warning',
        'E024': 'Invalid declaration argument',
        'E025': 'Declaration bounds count mismatch',
        'E026': 'External predicate mode error',
        'E027': 'Invalid key-value pair count',
        'E030': 'Invalid pattern argument type',
        'E031': 'Package name must be lowercase',
        'E032': 'Invalid name constant format',
        'E033': 'Invalid destructuring argument',
        'E034': 'Invalid field selector type',
        'E035': 'Division by zero',
        'E036': 'Invalid group_by argument type',
        'E037': 'Duplicate variable in group_by',
        'E038': 'Invalid string escape sequence',
        'E039': 'Wildcard in head warning',
        'E040': 'Predicate arity mismatch',
        'E041': 'Private predicate access',
        'E043': 'Transform redefines body variable',
        'E044': 'Duplicate predicate declaration',
        'E045': 'Transform without body',
        'E046': 'Declaration arity mismatch',
        'P001': 'Parse error',
    };
    return descriptions[code] || `Mangle diagnostic ${code}`;
}
/**
 * Convert a diagnostic to SARIF result.
 */
function diagnosticToResult(diag, filePath) {
    return {
        ruleId: diag.code,
        level: mapSeverityToLevel(diag.severity),
        message: { text: diag.message },
        locations: [{
                physicalLocation: {
                    artifactLocation: { uri: filePath },
                    region: {
                        startLine: diag.range.start.line,
                        startColumn: diag.range.start.column + 1, // SARIF uses 1-indexed columns
                        endLine: diag.range.end.line,
                        endColumn: diag.range.end.column + 1,
                    },
                },
            }],
    };
}
/**
 * Format check result as SARIF.
 */
function formatCheckResultSarif(result) {
    const rules = collectRules(result);
    const results = [];
    for (const file of result.files) {
        for (const diag of file.diagnostics) {
            results.push(diagnosticToResult(diag, file.path));
        }
    }
    const sarif = {
        $schema: SARIF_SCHEMA,
        version: SARIF_VERSION,
        runs: [{
                tool: {
                    driver: {
                        name: 'mangle-cli',
                        version: '1.0.0',
                        informationUri: 'https://github.com/theRebelliousNerd/MangleLSP',
                        rules: Array.from(rules.values()),
                    },
                },
                results,
            }],
    };
    return JSON.stringify(sarif, null, 2);
}
//# sourceMappingURL=sarif.js.map