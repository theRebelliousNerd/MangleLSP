/**
 * Batch command - run multiple queries in a single call.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse } from '../../parser/index';
import { validate, buildSymbolTable } from '../../analysis/index';
import { getHover } from '../../services/hover';
import { getDefinition } from '../../services/definition';
import { findReferences } from '../../services/references';
import { getCompletions } from '../../services/completion';
import { getDocumentSymbols } from '../../services/symbols';
import { formatDocument } from '../../services/formatting';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CommonOptions } from '../types';

/**
 * Batch query types.
 */
export type BatchQueryType = 'hover' | 'definition' | 'references' | 'completion' | 'symbols' | 'diagnostics' | 'format' | 'fileInfo';

/**
 * A single batch query.
 */
export interface BatchQuery {
    id?: string | number;
    type: BatchQueryType;
    file: string;
    line?: number;
    column?: number;
    includeDeclaration?: boolean;
}

/**
 * Result of a single batch query.
 */
export interface BatchResult {
    id?: string | number;
    type: BatchQueryType;
    file: string;
    result: any;
    error?: string;
}

/**
 * Full batch result.
 */
export interface BatchOutput {
    version: string;
    results: BatchResult[];
    summary: {
        total: number;
        succeeded: number;
        failed: number;
    };
}

/**
 * File cache for batch processing.
 */
interface FileCache {
    source: string;
    document: TextDocument;
    parseResult: ReturnType<typeof parse>;
    validationResult: ReturnType<typeof validate> | null;
}

const fileCache = new Map<string, FileCache>();

/**
 * Get or create file cache entry.
 */
function getFileCache(filePath: string): FileCache | null {
    if (fileCache.has(filePath)) {
        return fileCache.get(filePath)!;
    }

    if (!existsSync(filePath)) {
        return null;
    }

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }

    const uri = `file://${filePath}`;
    const document = TextDocument.create(uri, 'mangle', 1, source);
    const parseResult = parse(source);
    const validationResult = parseResult.unit ? validate(parseResult.unit) : null;

    const cache: FileCache = {
        source,
        document,
        parseResult,
        validationResult,
    };

    fileCache.set(filePath, cache);
    return cache;
}

/**
 * Run batch queries.
 */
export function runBatch(queries: BatchQuery[], _options: CommonOptions): BatchOutput {
    const results: BatchResult[] = [];
    let succeeded = 0;
    let failed = 0;

    // Clear cache for fresh analysis
    fileCache.clear();

    for (const query of queries) {
        const filePath = resolve(query.file);
        const result: BatchResult = {
            id: query.id,
            type: query.type,
            file: relative(process.cwd(), filePath),
            result: null,
        };

        try {
            const cache = getFileCache(filePath);
            if (!cache) {
                result.error = `File not found: ${filePath}`;
                failed++;
                results.push(result);
                continue;
            }

            switch (query.type) {
                case 'hover':
                    result.result = processHover(cache, query);
                    break;

                case 'definition':
                    result.result = processDefinition(cache, query);
                    break;

                case 'references':
                    result.result = processReferences(cache, query);
                    break;

                case 'completion':
                    result.result = processCompletion(cache, query);
                    break;

                case 'symbols':
                    result.result = processSymbols(cache);
                    break;

                case 'diagnostics':
                    result.result = processDiagnostics(cache);
                    break;

                case 'format':
                    result.result = processFormat(cache);
                    break;

                case 'fileInfo':
                    result.result = processFileInfo(cache, filePath);
                    break;

                default:
                    result.error = `Unknown query type: ${query.type}`;
                    failed++;
                    results.push(result);
                    continue;
            }

            succeeded++;
        } catch (e) {
            result.error = String(e);
            failed++;
        }

        results.push(result);
    }

    return {
        version: '1.0',
        results,
        summary: {
            total: queries.length,
            succeeded,
            failed,
        },
    };
}

/**
 * Process hover query.
 */
function processHover(cache: FileCache, query: BatchQuery): any {
    if (!cache.parseResult.unit || query.line === undefined || query.column === undefined) {
        return null;
    }

    const symbolTable = cache.validationResult?.symbolTable ?? buildSymbolTable(cache.parseResult.unit);
    const position = { line: query.line - 1, character: query.column };
    const hover = getHover(cache.parseResult.unit, symbolTable, position);

    if (!hover) return null;

    return {
        contents: typeof hover.contents === 'string'
            ? hover.contents
            : (hover.contents as { value: string }).value,
        range: hover.range ? {
            start: { line: hover.range.start.line + 1, column: hover.range.start.character },
            end: { line: hover.range.end.line + 1, column: hover.range.end.character },
        } : undefined,
    };
}

/**
 * Process definition query.
 */
function processDefinition(cache: FileCache, query: BatchQuery): any {
    if (!cache.parseResult.unit || query.line === undefined || query.column === undefined) {
        return { locations: [] };
    }

    const symbolTable = cache.validationResult?.symbolTable ?? buildSymbolTable(cache.parseResult.unit);
    const position = { line: query.line - 1, character: query.column };
    const uri = `file://${resolve(query.file)}`;
    const def = getDefinition(uri, symbolTable, position);

    if (!def) return { locations: [] };

    const locations = Array.isArray(def) ? def : [def];
    return {
        locations: locations.map(loc => ({
            uri: loc.uri.replace('file://', ''),
            range: {
                start: { line: loc.range.start.line + 1, column: loc.range.start.character },
                end: { line: loc.range.end.line + 1, column: loc.range.end.character },
            },
        })),
    };
}

/**
 * Process references query.
 */
function processReferences(cache: FileCache, query: BatchQuery): any {
    if (!cache.parseResult.unit || query.line === undefined || query.column === undefined) {
        return { locations: [] };
    }

    const symbolTable = cache.validationResult?.symbolTable ?? buildSymbolTable(cache.parseResult.unit);
    const position = { line: query.line - 1, character: query.column };
    const uri = `file://${resolve(query.file)}`;
    const refs = findReferences(uri, symbolTable, position, {
        includeDeclaration: query.includeDeclaration ?? true,
    });

    return {
        locations: refs.map(loc => ({
            uri: loc.uri.replace('file://', ''),
            range: {
                start: { line: loc.range.start.line + 1, column: loc.range.start.character },
                end: { line: loc.range.end.line + 1, column: loc.range.end.character },
            },
        })),
    };
}

/**
 * Process completion query.
 */
function processCompletion(cache: FileCache, query: BatchQuery): any {
    if (query.line === undefined || query.column === undefined) {
        return { items: [] };
    }

    const symbolTable = cache.validationResult?.symbolTable ?? null;
    const position = { line: query.line - 1, character: query.column };
    const items = getCompletions(cache.document, cache.parseResult.unit, symbolTable, position);

    return {
        items: items.map(item => ({
            label: item.label,
            kind: item.kind,
            detail: item.detail,
            documentation: typeof item.documentation === 'string'
                ? item.documentation
                : (item.documentation as { value: string } | undefined)?.value,
            insertText: item.insertText,
        })),
    };
}

/**
 * Process symbols query.
 */
function processSymbols(cache: FileCache): any {
    if (!cache.parseResult.unit) {
        return { symbols: [] };
    }

    const symbols = getDocumentSymbols(cache.parseResult.unit);
    return {
        symbols: symbols.map(s => ({
            name: s.name,
            kind: s.kind,
            range: {
                start: { line: s.range.start.line + 1, column: s.range.start.character },
                end: { line: s.range.end.line + 1, column: s.range.end.character },
            },
        })),
    };
}

/**
 * Process diagnostics query.
 */
function processDiagnostics(cache: FileCache): any {
    const parseErrors = cache.parseResult.errors.map(e => ({
        code: 'P001',
        source: e.source === 'lexer' ? 'mangle-lexer' : 'mangle-parse',
        severity: 'error',
        message: e.message,
        range: {
            start: { line: e.line, column: e.column },
            end: { line: e.line, column: e.column + e.length },
        },
    }));

    const semanticErrors = cache.validationResult?.errors.map(e => ({
        code: e.code,
        source: 'mangle-semantic',
        severity: e.severity,
        message: e.message,
        range: {
            start: { line: e.range.start.line, column: e.range.start.column },
            end: { line: e.range.end.line, column: e.range.end.column },
        },
    })) ?? [];

    return {
        parseErrors,
        semanticErrors,
        totalErrors: parseErrors.length + semanticErrors.filter(e => e.severity === 'error').length,
        totalWarnings: semanticErrors.filter(e => e.severity === 'warning').length,
    };
}

/**
 * Process format query.
 */
function processFormat(cache: FileCache): any {
    if (!cache.parseResult.unit) {
        return { edits: [], error: 'Cannot format file with syntax errors' };
    }

    const edits = formatDocument(cache.document, cache.parseResult.unit, { tabSize: 4, insertSpaces: true });
    return {
        edits: edits.map(e => ({
            range: {
                start: { line: e.range.start.line + 1, column: e.range.start.character },
                end: { line: e.range.end.line + 1, column: e.range.end.character },
            },
            newText: e.newText,
        })),
        formatted: edits.length > 0 ? edits[0]?.newText : cache.source,
    };
}

/**
 * Process fileInfo query - get everything about a file.
 */
function processFileInfo(cache: FileCache, filePath: string): any {
    const diagnostics = processDiagnostics(cache);
    const symbols = processSymbols(cache);

    const predicates = cache.validationResult?.symbolTable.getAllPredicates().map(info => ({
        name: info.symbol.symbol,
        arity: info.symbol.arity,
        isExternal: info.isExternal,
        isPrivate: info.isPrivate,
        definitionCount: info.definitions.length,
        referenceCount: info.references.length,
    })) ?? [];

    return {
        path: relative(process.cwd(), filePath),
        hasSyntaxErrors: cache.parseResult.errors.length > 0,
        hasSemanticErrors: (cache.validationResult?.errors.length ?? 0) > 0,
        diagnostics,
        symbols: symbols.symbols,
        predicates,
        ast: cache.parseResult.unit ? {
            declCount: cache.parseResult.unit.decls.length,
            clauseCount: cache.parseResult.unit.clauses.length,
            packageDecl: cache.parseResult.unit.packageDecl,
        } : null,
        lineCount: cache.document.lineCount,
    };
}

/**
 * Parse batch queries from JSON string or file.
 */
export function parseBatchInput(input: string): BatchQuery[] {
    let data: any;

    // Check if input is a file path
    if (existsSync(input)) {
        data = JSON.parse(readFileSync(input, 'utf-8'));
    } else {
        // Try to parse as JSON directly
        data = JSON.parse(input);
    }

    // Handle both array of queries and { queries: [...] } format
    const queries = Array.isArray(data) ? data : data.queries;

    if (!Array.isArray(queries)) {
        throw new Error('Invalid batch input: expected array of queries');
    }

    return queries;
}
