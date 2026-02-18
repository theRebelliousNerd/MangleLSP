"use strict";
/**
 * Format command - format Mangle source files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFormat = runFormat;
exports.getFormatExitCode = getFormatExitCode;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const formatting_1 = require("../../services/formatting");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
/**
 * Run the format command on files.
 */
function runFormat(files, options) {
    const results = [];
    for (const file of files) {
        const result = formatFile(file, options);
        results.push(result);
    }
    return results;
}
/**
 * Format a single file.
 */
function formatFile(file, options) {
    const filePath = (0, path_1.resolve)(file);
    const relativePath = (0, path_1.relative)(process.cwd(), filePath);
    if (!(0, fs_1.existsSync)(filePath)) {
        return {
            path: relativePath,
            formatted: false,
            error: `File not found: ${filePath}`,
        };
    }
    let source;
    try {
        source = (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch (e) {
        return {
            path: relativePath,
            formatted: false,
            error: `Error reading file: ${e}`,
        };
    }
    const parseResult = (0, index_1.parse)(source);
    if (!parseResult.unit) {
        return {
            path: relativePath,
            formatted: false,
            error: 'Parse error: cannot format file with syntax errors',
        };
    }
    // Create a TextDocument for the formatting service
    const uri = `file://${filePath}`;
    const document = vscode_languageserver_textdocument_1.TextDocument.create(uri, 'mangle', 1, source);
    const formatOptions = {
        tabSize: 4,
        insertSpaces: true,
    };
    const edits = (0, formatting_1.formatDocument)(document, parseResult.unit, formatOptions);
    if (edits.length === 0) {
        return {
            path: relativePath,
            formatted: true,
        };
    }
    // Apply edits to get formatted text
    const formatted = edits[0]?.newText || source;
    // Check if content changed
    const contentChanged = formatted !== source;
    // Generate diff if requested
    let diff;
    if (options.diff && contentChanged) {
        diff = generateDiff(source, formatted, relativePath);
    }
    // Write back if requested
    if (options.write && contentChanged) {
        try {
            (0, fs_1.writeFileSync)(filePath, formatted, 'utf-8');
        }
        catch (e) {
            return {
                path: relativePath,
                formatted: false,
                error: `Error writing file: ${e}`,
            };
        }
    }
    return {
        path: relativePath,
        formatted: !contentChanged,
        diff,
    };
}
/**
 * Generate a simple unified diff.
 */
function generateDiff(original, formatted, filename) {
    const originalLines = original.split('\n');
    const formattedLines = formatted.split('\n');
    const lines = [];
    lines.push(`--- a/${filename}`);
    lines.push(`+++ b/${filename}`);
    // Simple line-by-line diff
    const maxLen = Math.max(originalLines.length, formattedLines.length);
    let inHunk = false;
    let hunkStart = 0;
    let hunkOriginalLines = [];
    let hunkFormattedLines = [];
    const flushHunk = () => {
        if (hunkOriginalLines.length > 0 || hunkFormattedLines.length > 0) {
            lines.push(`@@ -${hunkStart + 1},${hunkOriginalLines.length} +${hunkStart + 1},${hunkFormattedLines.length} @@`);
            for (const line of hunkOriginalLines) {
                lines.push(`-${line}`);
            }
            for (const line of hunkFormattedLines) {
                lines.push(`+${line}`);
            }
            hunkOriginalLines = [];
            hunkFormattedLines = [];
        }
    };
    for (let i = 0; i < maxLen; i++) {
        const origLine = originalLines[i];
        const fmtLine = formattedLines[i];
        if (origLine !== fmtLine) {
            if (!inHunk) {
                hunkStart = i;
                inHunk = true;
            }
            if (origLine !== undefined) {
                hunkOriginalLines.push(origLine);
            }
            if (fmtLine !== undefined) {
                hunkFormattedLines.push(fmtLine);
            }
        }
        else {
            if (inHunk) {
                flushHunk();
                inHunk = false;
            }
        }
    }
    if (inHunk) {
        flushHunk();
    }
    return lines.join('\n');
}
/**
 * Determine exit code for format check mode.
 */
function getFormatExitCode(results, options) {
    if (options.check) {
        const unformatted = results.filter(r => !r.formatted && !r.error);
        return unformatted.length > 0 ? 1 : 0;
    }
    const errors = results.filter(r => r.error);
    return errors.length > 0 ? 1 : 0;
}
//# sourceMappingURL=format.js.map