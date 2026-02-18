"use strict";
/**
 * Mangle Language Server Protocol (LSP) Server.
 *
 * Provides language intelligence for Mangle source files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const index_1 = require("./parser/index");
const index_2 = require("./analysis/index");
const symbols_1 = require("./analysis/symbols");
const index_3 = require("./services/index");
// Create connection
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create document manager
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const documentStates = new Map();
// Validation debouncing - prevents excessive revalidation during rapid typing
const validationTimeouts = new Map();
const defaultSettings = {
    maxNumberOfProblems: 100,
    enableSemanticAnalysis: true,
};
let globalSettings = defaultSettings;
const documentSettings = new Map();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
/**
 * Initialize the server.
 */
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Completion support
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [':', '(', ',', '|', '/', '.'],
            },
            // Hover support
            hoverProvider: true,
            // Go to definition
            definitionProvider: true,
            // Find references
            referencesProvider: true,
            // Document symbols (outline)
            documentSymbolProvider: true,
            // Document formatting
            documentFormattingProvider: true,
            // Rename
            renameProvider: {
                prepareProvider: true,
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
});
/**
 * Server initialized.
 */
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    connection.console.log('Mangle LSP server initialized.');
});
/**
 * Configuration changed.
 */
connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    }
    else {
        globalSettings = (change.settings.mangle || defaultSettings);
    }
    documents.all().forEach(validateDocument);
});
/**
 * Get document settings.
 */
function getDocumentSettings(uri) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(uri);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: uri,
            section: 'mangle',
        });
        documentSettings.set(uri, result);
    }
    return result;
}
/**
 * Document opened.
 */
documents.onDidOpen((event) => {
    validateDocument(event.document);
});
/**
 * Document content changed.
 */
documents.onDidChangeContent((change) => {
    scheduleValidation(change.document);
});
/**
 * Schedule validation with debouncing.
 * Prevents excessive revalidation during rapid typing.
 */
function scheduleValidation(document) {
    const uri = document.uri;
    // Clear any pending validation for this document
    const existing = validationTimeouts.get(uri);
    if (existing) {
        clearTimeout(existing);
    }
    // Schedule new validation with 200ms delay
    const timeout = setTimeout(() => {
        validationTimeouts.delete(uri);
        validateDocument(document);
    }, 200);
    validationTimeouts.set(uri, timeout);
}
/**
 * Document closed.
 */
documents.onDidClose((event) => {
    const uri = event.document.uri;
    // Clear any pending validation timeout
    const timeout = validationTimeouts.get(uri);
    if (timeout) {
        clearTimeout(timeout);
        validationTimeouts.delete(uri);
    }
    documentSettings.delete(uri);
    documentStates.delete(uri);
    // Clear diagnostics
    connection.sendDiagnostics({ uri, diagnostics: [] });
});
/**
 * Validate a document and publish diagnostics.
 */
async function validateDocument(document) {
    const settings = await getDocumentSettings(document.uri);
    const text = document.getText();
    // Parse the document
    const parseResult = (0, index_1.parse)(text);
    // Run semantic validation if parse succeeded
    let validationResult = null;
    if (parseResult.unit && settings.enableSemanticAnalysis) {
        validationResult = (0, index_2.validate)(parseResult.unit);
    }
    // Cache state
    documentStates.set(document.uri, {
        uri: document.uri,
        version: document.version,
        parseResult,
        validationResult,
    });
    // Collect diagnostics
    const diagnostics = [];
    // Parse errors
    for (const error of parseResult.errors) {
        if (diagnostics.length >= settings.maxNumberOfProblems) {
            break;
        }
        diagnostics.push(parseErrorToDiagnostic(error));
    }
    // Semantic errors
    if (validationResult) {
        for (const error of validationResult.errors) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(semanticErrorToDiagnostic(error));
        }
    }
    // Stratification errors (negation cycles)
    if (parseResult.unit && settings.enableSemanticAnalysis) {
        const stratErrors = (0, index_2.checkStratification)(parseResult.unit);
        for (const error of stratErrors) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(error));
        }
        // Unbounded recursion warnings
        const recursionWarnings = (0, index_2.checkUnboundedRecursion)(parseResult.unit);
        for (const warning of recursionWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
        // Cartesian explosion warnings
        const cartesianWarnings = (0, index_2.checkCartesianExplosion)(parseResult.unit);
        for (const warning of cartesianWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
        // Late filtering warnings
        const lateFilterWarnings = (0, index_2.checkLateFiltering)(parseResult.unit);
        for (const warning of lateFilterWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
        // Late negation warnings
        const lateNegationWarnings = (0, index_2.checkLateNegation)(parseResult.unit);
        for (const warning of lateNegationWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
        // Multiple independent variables (massive Cartesian)
        const multiIndepWarnings = (0, index_2.checkMultipleIndependentVars)(parseResult.unit);
        for (const warning of multiIndepWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
        // Temporal recursion warnings (DatalogMTL)
        const temporalWarnings = (0, index_2.checkTemporalRecursion)(parseResult.unit);
        for (const warning of temporalWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }
    }
    // Send diagnostics
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}
/**
 * Convert a parse error to an LSP diagnostic.
 */
function parseErrorToDiagnostic(error) {
    return {
        severity: node_1.DiagnosticSeverity.Error,
        range: {
            start: { line: error.line - 1, character: error.column },
            end: { line: error.line - 1, character: error.column + error.length },
        },
        message: error.message,
        source: error.source === 'lexer' ? 'mangle-lexer' : 'mangle-parse',
    };
}
/**
 * Convert a semantic error to an LSP diagnostic.
 */
function semanticErrorToDiagnostic(error) {
    let severity;
    switch (error.severity) {
        case 'error':
            severity = node_1.DiagnosticSeverity.Error;
            break;
        case 'warning':
            severity = node_1.DiagnosticSeverity.Warning;
            break;
        case 'info':
            severity = node_1.DiagnosticSeverity.Information;
            break;
        default:
            severity = node_1.DiagnosticSeverity.Error;
    }
    return {
        severity,
        range: {
            start: { line: error.range.start.line - 1, character: error.range.start.column },
            end: { line: error.range.end.line - 1, character: error.range.end.column },
        },
        message: error.message,
        source: 'mangle-semantic',
        code: error.code,
    };
}
/**
 * Convert a stratification error to an LSP diagnostic.
 */
function stratificationErrorToDiagnostic(error) {
    let severity;
    switch (error.severity) {
        case 'error':
            severity = node_1.DiagnosticSeverity.Error;
            break;
        case 'warning':
            severity = node_1.DiagnosticSeverity.Warning;
            break;
        default:
            severity = node_1.DiagnosticSeverity.Error;
    }
    return {
        severity,
        range: {
            start: { line: error.range.start.line - 1, character: error.range.start.column },
            end: { line: error.range.end.line - 1, character: error.range.end.column },
        },
        message: error.message,
        source: 'mangle-stratification',
        code: error.code,
    };
}
/**
 * Get the symbol table for a document.
 */
function getSymbolTable(state) {
    if (state.validationResult) {
        return state.validationResult.symbolTable;
    }
    if (state.parseResult.unit) {
        return (0, symbols_1.buildSymbolTable)(state.parseResult.unit);
    }
    return null;
}
/**
 * Hover provider.
 */
connection.onHover((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }
        return (0, index_3.getHover)(state.parseResult.unit, symbolTable, params.position);
    }
    catch (e) {
        connection.console.error(`Hover error: ${e}`);
        return null;
    }
});
/**
 * Completion provider.
 */
connection.onCompletion((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        const symbolTable = state ? getSymbolTable(state) : null;
        const unit = state?.parseResult.unit || null;
        return (0, index_3.getCompletions)(document, unit, symbolTable, params.position);
    }
    catch (e) {
        connection.console.error(`Completion error: ${e}`);
        return [];
    }
});
/**
 * Completion resolve provider.
 */
connection.onCompletionResolve((item) => {
    try {
        return (0, index_3.resolveCompletion)(item);
    }
    catch (e) {
        connection.console.error(`Completion resolve error: ${e}`);
        return item;
    }
});
/**
 * Go to definition provider.
 */
connection.onDefinition((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }
        return (0, index_3.getDefinition)(params.textDocument.uri, symbolTable, params.position);
    }
    catch (e) {
        connection.console.error(`Definition error: ${e}`);
        return null;
    }
});
/**
 * Find references provider.
 */
connection.onReferences((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return [];
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return [];
        }
        return (0, index_3.findReferences)(params.textDocument.uri, symbolTable, params.position, params.context);
    }
    catch (e) {
        connection.console.error(`References error: ${e}`);
        return [];
    }
});
/**
 * Document symbols provider.
 */
connection.onDocumentSymbol((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return [];
        }
        return (0, index_3.getDocumentSymbols)(state.parseResult.unit);
    }
    catch (e) {
        connection.console.error(`Document symbols error: ${e}`);
        return [];
    }
});
/**
 * Document formatting provider.
 */
connection.onDocumentFormatting((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        const document = documents.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit || !document) {
            return [];
        }
        return (0, index_3.formatDocument)(document, state.parseResult.unit, params.options);
    }
    catch (e) {
        connection.console.error(`Formatting error: ${e}`);
        return [];
    }
});
/**
 * Prepare rename provider.
 */
connection.onPrepareRename((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }
        return (0, index_3.prepareRename)(state.parseResult.unit, symbolTable, params.position);
    }
    catch (e) {
        connection.console.error(`Prepare rename error: ${e}`);
        return null;
    }
});
/**
 * Rename provider.
 */
connection.onRenameRequest((params) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }
        return (0, index_3.doRename)(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.newName);
    }
    catch (e) {
        connection.console.error(`Rename error: ${e}`);
        return null;
    }
});
// ============================================================================
// Custom LSP Request Handlers for CLI/Agent Integration
// ============================================================================
/**
 * Custom request: Get all diagnostics for a file.
 * Request: 'mangle/getDiagnostics'
 * Params: { uri: string }
 * Returns: { uri, parseErrors, semanticErrors, stratificationErrors }
 */
connection.onRequest('mangle/getDiagnostics', (params) => {
    try {
        const state = documentStates.get(params.uri);
        if (!state) {
            return {
                uri: params.uri,
                parseErrors: [],
                semanticErrors: [],
                stratificationErrors: [],
            };
        }
        // Collect parse errors
        const parseErrors = state.parseResult.errors.map(e => ({
            code: 'P001',
            source: e.source === 'lexer' ? 'mangle-lexer' : 'mangle-parse',
            message: e.message,
            range: {
                start: { line: e.line, column: e.column },
                end: { line: e.line, column: e.column + e.length },
            },
        }));
        // Collect semantic errors
        const semanticErrors = state.validationResult?.errors.map(e => ({
            code: e.code,
            source: 'mangle-semantic',
            severity: e.severity,
            message: e.message,
            range: {
                start: { line: e.range.start.line, column: e.range.start.column },
                end: { line: e.range.end.line, column: e.range.end.column },
            },
        })) || [];
        // Collect stratification errors
        let stratificationErrors = [];
        if (state.parseResult.unit) {
            const stratErrors = (0, index_2.checkStratification)(state.parseResult.unit);
            stratificationErrors = stratErrors.map(e => ({
                code: e.code,
                source: 'mangle-stratification',
                severity: e.severity,
                message: e.message,
                range: {
                    start: { line: e.range.start.line, column: e.range.start.column },
                    end: { line: e.range.end.line, column: e.range.end.column },
                },
                cycle: e.cycle,
            }));
        }
        return {
            uri: params.uri,
            parseErrors,
            semanticErrors,
            stratificationErrors,
        };
    }
    catch (e) {
        connection.console.error(`mangle/getDiagnostics error: ${e}`);
        return {
            uri: params.uri,
            parseErrors: [],
            semanticErrors: [],
            stratificationErrors: [],
            error: String(e),
        };
    }
});
/**
 * Custom request: Check multiple files.
 * Request: 'mangle/checkFiles'
 * Params: { uris: string[] }
 * Returns: { files: [{ uri, diagnostics }] }
 */
connection.onRequest('mangle/checkFiles', async (params) => {
    const results = [];
    for (const uri of params.uris) {
        const state = documentStates.get(uri);
        if (state) {
            const diagnostics = await connection.sendRequest('mangle/getDiagnostics', { uri });
            results.push({ uri, ...diagnostics });
        }
    }
    return { files: results };
});
/**
 * Custom request: Get structured symbol information.
 * Request: 'mangle/getStructuredSymbols'
 * Params: { uri: string }
 * Returns: { uri, predicates, declarations, clauses }
 */
connection.onRequest('mangle/getStructuredSymbols', (params) => {
    try {
        const state = documentStates.get(params.uri);
        if (!state || !state.parseResult.unit) {
            return {
                uri: params.uri,
                predicates: [],
                declarations: [],
                clauses: [],
            };
        }
        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return {
                uri: params.uri,
                predicates: [],
                declarations: [],
                clauses: [],
            };
        }
        // Get predicate info
        const predicates = symbolTable.getAllPredicates().map(info => ({
            name: info.symbol.symbol,
            arity: info.symbol.arity,
            isExternal: info.isExternal,
            isPrivate: info.isPrivate,
            declLocation: info.declLocation ? {
                start: { line: info.declLocation.start.line, column: info.declLocation.start.column },
                end: { line: info.declLocation.end.line, column: info.declLocation.end.column },
            } : null,
            definitionCount: info.definitions.length,
            referenceCount: info.references.length,
        }));
        // Get declaration info
        const declarations = state.parseResult.unit.decls.map(d => ({
            predicate: `${d.declaredAtom.predicate.symbol}/${d.declaredAtom.predicate.arity}`,
            range: {
                start: { line: d.range.start.line, column: d.range.start.column },
                end: { line: d.range.end.line, column: d.range.end.column },
            },
        }));
        // Get clause info
        const clauses = state.parseResult.unit.clauses.map(c => ({
            head: `${c.head.predicate.symbol}/${c.head.predicate.arity}`,
            isFact: !c.premises || c.premises.length === 0,
            hasTransform: !!c.transform,
            range: {
                start: { line: c.head.range.start.line, column: c.head.range.start.column },
                end: { line: c.head.range.end.line, column: c.head.range.end.column },
            },
        }));
        return {
            uri: params.uri,
            predicates,
            declarations,
            clauses,
        };
    }
    catch (e) {
        connection.console.error(`mangle/getStructuredSymbols error: ${e}`);
        return {
            uri: params.uri,
            predicates: [],
            declarations: [],
            clauses: [],
            error: String(e),
        };
    }
});
/**
 * Custom request: Get AST for a file.
 * Request: 'mangle/getAST'
 * Params: { uri: string }
 * Returns: { uri, ast } where ast is the parsed SourceUnit
 */
connection.onRequest('mangle/getAST', (params) => {
    try {
        const state = documentStates.get(params.uri);
        if (!state || !state.parseResult.unit) {
            return {
                uri: params.uri,
                ast: null,
                error: state ? 'Parse errors present' : 'Document not found',
            };
        }
        // Return a simplified AST (to avoid circular references)
        const unit = state.parseResult.unit;
        return {
            uri: params.uri,
            ast: {
                packageDecl: unit.packageDecl,
                useDecls: unit.useDecls,
                declCount: unit.decls.length,
                clauseCount: unit.clauses.length,
            },
        };
    }
    catch (e) {
        connection.console.error(`mangle/getAST error: ${e}`);
        return {
            uri: params.uri,
            ast: null,
            error: String(e),
        };
    }
});
/**
 * Custom request: Batch lookup - perform multiple queries in one request.
 * Request: 'mangle/batchLookup'
 * Params: { queries: BatchQuery[] }
 * Returns: { results: BatchResult[] }
 */
connection.onRequest('mangle/batchLookup', async (params) => {
    const results = [];
    for (const query of params.queries) {
        const result = {
            id: query.id,
            type: query.type,
            uri: query.uri,
            result: null,
        };
        try {
            const state = documentStates.get(query.uri);
            const document = documents.get(query.uri);
            switch (query.type) {
                case 'hover': {
                    if (!state?.parseResult.unit || query.line === undefined || query.column === undefined) {
                        result.result = null;
                        break;
                    }
                    const symbolTable = getSymbolTable(state);
                    if (!symbolTable) {
                        result.result = null;
                        break;
                    }
                    const position = { line: query.line - 1, character: query.column };
                    result.result = (0, index_3.getHover)(state.parseResult.unit, symbolTable, position);
                    break;
                }
                case 'definition': {
                    if (!state?.parseResult.unit || query.line === undefined || query.column === undefined) {
                        result.result = { locations: [] };
                        break;
                    }
                    const symbolTable = getSymbolTable(state);
                    if (!symbolTable) {
                        result.result = { locations: [] };
                        break;
                    }
                    const position = { line: query.line - 1, character: query.column };
                    const def = (0, index_3.getDefinition)(query.uri, symbolTable, position);
                    result.result = { locations: def ? (Array.isArray(def) ? def : [def]) : [] };
                    break;
                }
                case 'references': {
                    if (!state?.parseResult.unit || query.line === undefined || query.column === undefined) {
                        result.result = { locations: [] };
                        break;
                    }
                    const symbolTable = getSymbolTable(state);
                    if (!symbolTable) {
                        result.result = { locations: [] };
                        break;
                    }
                    const position = { line: query.line - 1, character: query.column };
                    const refs = (0, index_3.findReferences)(query.uri, symbolTable, position, { includeDeclaration: query.includeDeclaration ?? true });
                    result.result = { locations: refs };
                    break;
                }
                case 'completion': {
                    if (!document || query.line === undefined || query.column === undefined) {
                        result.result = { items: [] };
                        break;
                    }
                    const symbolTable = state ? getSymbolTable(state) : null;
                    const unit = state?.parseResult.unit || null;
                    const position = { line: query.line - 1, character: query.column };
                    const items = (0, index_3.getCompletions)(document, unit, symbolTable, position);
                    result.result = { items };
                    break;
                }
                case 'symbols': {
                    if (!state?.parseResult.unit) {
                        result.result = { symbols: [] };
                        break;
                    }
                    const symbols = (0, index_3.getDocumentSymbols)(state.parseResult.unit);
                    result.result = { symbols };
                    break;
                }
                case 'diagnostics': {
                    const diagResult = await connection.sendRequest('mangle/getDiagnostics', { uri: query.uri });
                    result.result = diagResult;
                    break;
                }
                case 'format': {
                    if (!state?.parseResult.unit || !document) {
                        result.result = { edits: [] };
                        break;
                    }
                    const edits = (0, index_3.formatDocument)(document, state.parseResult.unit, { tabSize: 4, insertSpaces: true });
                    result.result = { edits };
                    break;
                }
                default:
                    result.error = `Unknown query type: ${query.type}`;
            }
        }
        catch (e) {
            result.error = String(e);
        }
        results.push(result);
    }
    return { results };
});
/**
 * Custom request: Get all information about a file.
 * Request: 'mangle/getFileInfo'
 * Params: { uri: string }
 * Returns: Complete file analysis including diagnostics, symbols, predicates
 */
connection.onRequest('mangle/getFileInfo', async (params) => {
    try {
        const state = documentStates.get(params.uri);
        const document = documents.get(params.uri);
        if (!state) {
            return {
                uri: params.uri,
                exists: false,
                error: 'Document not found in cache',
            };
        }
        // Get diagnostics
        const diagResult = await connection.sendRequest('mangle/getDiagnostics', { uri: params.uri });
        // Get symbols
        const symbols = state.parseResult.unit ? (0, index_3.getDocumentSymbols)(state.parseResult.unit) : [];
        // Get structured symbols
        const symbolTable = getSymbolTable(state);
        const predicates = symbolTable ? symbolTable.getAllPredicates().map(info => ({
            name: info.symbol.symbol,
            arity: info.symbol.arity,
            isExternal: info.isExternal,
            isPrivate: info.isPrivate,
            definitionCount: info.definitions.length,
            referenceCount: info.references.length,
        })) : [];
        // Get AST info
        const ast = state.parseResult.unit ? {
            packageDecl: state.parseResult.unit.packageDecl,
            useDecls: state.parseResult.unit.useDecls,
            declCount: state.parseResult.unit.decls.length,
            clauseCount: state.parseResult.unit.clauses.length,
        } : null;
        return {
            uri: params.uri,
            exists: true,
            version: state.version,
            hasSyntaxErrors: state.parseResult.errors.length > 0,
            hasSemanticErrors: (state.validationResult?.errors.length ?? 0) > 0,
            diagnostics: diagResult,
            symbols,
            predicates,
            ast,
            lineCount: document?.lineCount ?? 0,
        };
    }
    catch (e) {
        return {
            uri: params.uri,
            exists: false,
            error: String(e),
        };
    }
});
/**
 * Custom request: Check all open documents.
 * Request: 'mangle/checkAll'
 * Params: {}
 * Returns: { files: [...], summary: {...} }
 */
connection.onRequest('mangle/checkAll', async () => {
    const files = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;
    for (const [uri, state] of documentStates) {
        const diagResult = await connection.sendRequest('mangle/getDiagnostics', { uri });
        const fileResult = {
            uri,
            ...diagResult,
        };
        files.push(fileResult);
        // Count diagnostics
        const parseErrors = diagResult.parseErrors?.length ?? 0;
        const semanticErrors = diagResult.semanticErrors?.filter((e) => e.severity === 'error')?.length ?? 0;
        const semanticWarnings = diagResult.semanticErrors?.filter((e) => e.severity === 'warning')?.length ?? 0;
        const semanticInfo = diagResult.semanticErrors?.filter((e) => e.severity === 'info')?.length ?? 0;
        const stratErrors = diagResult.stratificationErrors?.filter((e) => e.severity === 'error')?.length ?? 0;
        const stratWarnings = diagResult.stratificationErrors?.filter((e) => e.severity === 'warning')?.length ?? 0;
        totalErrors += parseErrors + semanticErrors + stratErrors;
        totalWarnings += semanticWarnings + stratWarnings;
        totalInfo += semanticInfo;
    }
    return {
        files,
        summary: {
            totalFiles: files.length,
            totalErrors,
            totalWarnings,
            totalInfo,
        },
    };
});
/**
 * Custom request: Get workspace summary.
 * Request: 'mangle/getWorkspaceSummary'
 * Params: {}
 * Returns: Summary of all predicates, files, and diagnostics in workspace
 */
connection.onRequest('mangle/getWorkspaceSummary', async () => {
    const allPredicates = new Map();
    const fileInfos = [];
    for (const [uri, state] of documentStates) {
        const symbolTable = getSymbolTable(state);
        if (symbolTable) {
            for (const pred of symbolTable.getAllPredicates()) {
                const key = `${pred.symbol.symbol}/${pred.symbol.arity}`;
                if (!allPredicates.has(key)) {
                    allPredicates.set(key, {
                        arity: pred.symbol.arity,
                        definedIn: [],
                        referencedIn: [],
                    });
                }
                const info = allPredicates.get(key);
                if (pred.definitions.length > 0) {
                    info.definedIn.push(uri);
                }
                if (pred.references.length > 0) {
                    info.referencedIn.push(uri);
                }
            }
        }
        fileInfos.push({
            uri,
            hasSyntaxErrors: state.parseResult.errors.length > 0,
            hasSemanticErrors: (state.validationResult?.errors.length ?? 0) > 0,
            declCount: state.parseResult.unit?.decls.length ?? 0,
            clauseCount: state.parseResult.unit?.clauses.length ?? 0,
        });
    }
    const predicates = Array.from(allPredicates.entries()).map(([name, info]) => ({
        name,
        arity: info.arity,
        definedIn: info.definedIn,
        referencedIn: info.referencedIn,
    }));
    return {
        files: fileInfos,
        predicates,
        totalFiles: fileInfos.length,
        totalPredicates: predicates.length,
    };
});
/**
 * Shutdown handler.
 * Called when the client requests the server to shut down.
 */
connection.onShutdown(() => {
    connection.console.log('Mangle LSP server shutting down');
    // Clear all pending validation timeouts
    for (const timeout of validationTimeouts.values()) {
        clearTimeout(timeout);
    }
    validationTimeouts.clear();
    // Clean up document caches
    documentStates.clear();
    documentSettings.clear();
});
/**
 * Exit handler.
 * Called when the connection is closed.
 */
connection.onExit(() => {
    process.exit(0);
});
// Start listening
documents.listen(connection);
connection.listen();
/**
 * Start the server (for programmatic use).
 */
function startServer() {
    // Server is started when this module is imported
    connection.console.log('Mangle LSP server started.');
}
//# sourceMappingURL=server.js.map