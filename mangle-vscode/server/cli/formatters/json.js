"use strict";
/**
 * JSON output formatter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCheckResultJson = formatCheckResultJson;
exports.formatSymbolsResultJson = formatSymbolsResultJson;
exports.formatHoverResultJson = formatHoverResultJson;
exports.formatDefinitionResultJson = formatDefinitionResultJson;
exports.formatReferencesResultJson = formatReferencesResultJson;
exports.formatCompletionResultJson = formatCompletionResultJson;
exports.formatFormatResultJson = formatFormatResultJson;
/**
 * Format check result as JSON.
 */
function formatCheckResultJson(result) {
    return JSON.stringify(result, null, 2);
}
/**
 * Format symbols result as JSON.
 */
function formatSymbolsResultJson(result) {
    return JSON.stringify(result, null, 2);
}
/**
 * Format hover result as JSON.
 */
function formatHoverResultJson(result) {
    if (!result) {
        return JSON.stringify({ contents: null }, null, 2);
    }
    return JSON.stringify(result, null, 2);
}
/**
 * Format definition result as JSON.
 */
function formatDefinitionResultJson(result) {
    return JSON.stringify(result, null, 2);
}
/**
 * Format references result as JSON.
 */
function formatReferencesResultJson(result) {
    return JSON.stringify(result, null, 2);
}
/**
 * Format completion result as JSON.
 */
function formatCompletionResultJson(result) {
    return JSON.stringify(result, null, 2);
}
/**
 * Format format results as JSON.
 */
function formatFormatResultJson(results) {
    return JSON.stringify({ files: results }, null, 2);
}
//# sourceMappingURL=json.js.map