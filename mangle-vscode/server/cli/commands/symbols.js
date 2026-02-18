"use strict";
/**
 * Symbols command - list document symbols.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSymbols = runSymbols;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const symbols_1 = require("../../services/symbols");
const node_1 = require("vscode-languageserver/node");
/**
 * Run the symbols command on a file.
 */
function runSymbols(file, _options) {
    const filePath = (0, path_1.resolve)(file);
    if (!(0, fs_1.existsSync)(filePath)) {
        return {
            path: (0, path_1.relative)(process.cwd(), filePath),
            symbols: [],
        };
    }
    let source;
    try {
        source = (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return {
            path: (0, path_1.relative)(process.cwd(), filePath),
            symbols: [],
        };
    }
    const parseResult = (0, index_1.parse)(source);
    if (!parseResult.unit) {
        return {
            path: (0, path_1.relative)(process.cwd(), filePath),
            symbols: [],
        };
    }
    const lspSymbols = (0, symbols_1.getDocumentSymbols)(parseResult.unit);
    const symbols = lspSymbols.map(convertSymbol);
    return {
        path: (0, path_1.relative)(process.cwd(), filePath),
        symbols,
    };
}
/**
 * Convert LSP DocumentSymbol to CLI symbol.
 */
function convertSymbol(symbol) {
    const result = {
        name: symbol.name,
        kind: mapSymbolKind(symbol.kind),
        range: {
            start: {
                line: symbol.range.start.line + 1,
                column: symbol.range.start.character,
            },
            end: {
                line: symbol.range.end.line + 1,
                column: symbol.range.end.character,
            },
        },
        selectionRange: {
            start: {
                line: symbol.selectionRange.start.line + 1,
                column: symbol.selectionRange.start.character,
            },
            end: {
                line: symbol.selectionRange.end.line + 1,
                column: symbol.selectionRange.end.character,
            },
        },
    };
    if (symbol.children && symbol.children.length > 0) {
        result.children = symbol.children.map(convertSymbol);
    }
    return result;
}
/**
 * Map LSP SymbolKind to CLI kind string.
 */
function mapSymbolKind(kind) {
    switch (kind) {
        case node_1.SymbolKind.Function:
            return 'predicate';
        case node_1.SymbolKind.Interface:
            return 'declaration';
        default:
            return 'clause';
    }
}
//# sourceMappingURL=symbols.js.map