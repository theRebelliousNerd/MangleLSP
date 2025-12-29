/**
 * Format command - format Mangle source files.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse } from '../../parser/index';
import { formatDocument } from '../../services/formatting';
import { FormatResult, FormatOptions } from '../types';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Run the format command on files.
 */
export function runFormat(files: string[], options: FormatOptions): FormatResult[] {
    const results: FormatResult[] = [];

    for (const file of files) {
        const result = formatFile(file, options);
        results.push(result);
    }

    return results;
}

/**
 * Format a single file.
 */
function formatFile(file: string, options: FormatOptions): FormatResult {
    const filePath = resolve(file);
    const relativePath = relative(process.cwd(), filePath);

    if (!existsSync(filePath)) {
        return {
            path: relativePath,
            formatted: false,
            error: `File not found: ${filePath}`,
        };
    }

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch (e) {
        return {
            path: relativePath,
            formatted: false,
            error: `Error reading file: ${e}`,
        };
    }

    const parseResult = parse(source);
    if (!parseResult.unit) {
        return {
            path: relativePath,
            formatted: false,
            error: 'Parse error: cannot format file with syntax errors',
        };
    }

    // Create a TextDocument for the formatting service
    const uri = `file://${filePath}`;
    const document = TextDocument.create(uri, 'mangle', 1, source);

    const formatOptions = {
        tabSize: 4,
        insertSpaces: true,
    };

    const edits = formatDocument(document, parseResult.unit, formatOptions);
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
    let diff: string | undefined;
    if (options.diff && contentChanged) {
        diff = generateDiff(source, formatted, relativePath);
    }

    // Write back if requested
    if (options.write && contentChanged) {
        try {
            writeFileSync(filePath, formatted, 'utf-8');
        } catch (e) {
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
function generateDiff(original: string, formatted: string, filename: string): string {
    const originalLines = original.split('\n');
    const formattedLines = formatted.split('\n');

    const lines: string[] = [];
    lines.push(`--- a/${filename}`);
    lines.push(`+++ b/${filename}`);

    // Simple line-by-line diff
    const maxLen = Math.max(originalLines.length, formattedLines.length);
    let inHunk = false;
    let hunkStart = 0;
    let hunkOriginalLines: string[] = [];
    let hunkFormattedLines: string[] = [];

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
        } else {
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
export function getFormatExitCode(results: FormatResult[], options: FormatOptions): number {
    if (options.check) {
        const unformatted = results.filter(r => !r.formatted && !r.error);
        return unformatted.length > 0 ? 1 : 0;
    }
    const errors = results.filter(r => r.error);
    return errors.length > 0 ? 1 : 0;
}
