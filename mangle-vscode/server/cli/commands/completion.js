"use strict";
/**
 * Completion command - get completions at position.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompletion = runCompletion;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const index_2 = require("../../analysis/index");
const completion_1 = require("../../services/completion");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const node_1 = require("vscode-languageserver/node");
/**
 * Run the completion command.
 */
function runCompletion(file, options) {
    const filePath = (0, path_1.resolve)(file);
    const result = { items: [] };
    if (!(0, fs_1.existsSync)(filePath)) {
        return result;
    }
    let source;
    try {
        source = (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return result;
    }
    const parseResult = (0, index_1.parse)(source);
    const validationResult = parseResult.unit ? (0, index_2.validate)(parseResult.unit) : null;
    const symbolTable = validationResult?.symbolTable || null;
    // Create a TextDocument for the completion service
    const uri = `file://${filePath}`;
    const document = vscode_languageserver_textdocument_1.TextDocument.create(uri, 'mangle', 1, source);
    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };
    const completions = (0, completion_1.getCompletions)(document, parseResult.unit, symbolTable, position);
    result.items = completions.map(item => {
        const cliItem = {
            label: item.label,
            kind: mapCompletionKind(item.kind),
        };
        if (item.detail) {
            cliItem.detail = item.detail;
        }
        if (item.documentation) {
            cliItem.documentation = typeof item.documentation === 'string'
                ? item.documentation
                : item.documentation.value;
        }
        if (item.insertText) {
            cliItem.insertText = item.insertText;
        }
        return cliItem;
    });
    return result;
}
/**
 * Map LSP CompletionItemKind to string.
 */
function mapCompletionKind(kind) {
    if (kind === undefined) {
        return 'text';
    }
    switch (kind) {
        case node_1.CompletionItemKind.Function:
            return 'function';
        case node_1.CompletionItemKind.Variable:
            return 'variable';
        case node_1.CompletionItemKind.Keyword:
            return 'keyword';
        case node_1.CompletionItemKind.Constant:
            return 'constant';
        case node_1.CompletionItemKind.Method:
            return 'method';
        case node_1.CompletionItemKind.Property:
            return 'property';
        default:
            return 'text';
    }
}
//# sourceMappingURL=completion.js.map