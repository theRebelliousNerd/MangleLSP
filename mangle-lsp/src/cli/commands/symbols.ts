/**
 * Symbols command - list document symbols.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse } from '../../parser/index';
import { getDocumentSymbols } from '../../services/symbols';
import { SymbolsResult, CLISymbol, CommonOptions } from '../types';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';

/**
 * Run the symbols command on a file.
 */
export function runSymbols(file: string, _options: CommonOptions): SymbolsResult {
    const filePath = resolve(file);

    if (!existsSync(filePath)) {
        return {
            path: relative(process.cwd(), filePath),
            symbols: [],
        };
    }

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch {
        return {
            path: relative(process.cwd(), filePath),
            symbols: [],
        };
    }

    const parseResult = parse(source);
    if (!parseResult.unit) {
        return {
            path: relative(process.cwd(), filePath),
            symbols: [],
        };
    }

    const lspSymbols = getDocumentSymbols(parseResult.unit);
    const symbols = lspSymbols.map(convertSymbol);

    return {
        path: relative(process.cwd(), filePath),
        symbols,
    };
}

/**
 * Convert LSP DocumentSymbol to CLI symbol.
 */
function convertSymbol(symbol: DocumentSymbol): CLISymbol {
    const result: CLISymbol = {
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
function mapSymbolKind(kind: SymbolKind): 'predicate' | 'declaration' | 'clause' {
    switch (kind) {
        case SymbolKind.Function:
            return 'predicate';
        case SymbolKind.Interface:
            return 'declaration';
        default:
            return 'clause';
    }
}
