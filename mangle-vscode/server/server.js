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
    validateDocument(change.document);
});
/**
 * Document closed.
 */
documents.onDidClose((event) => {
    documentSettings.delete(event.document.uri);
    documentStates.delete(event.document.uri);
    // Clear diagnostics
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
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
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }
    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }
    return (0, index_3.getHover)(state.parseResult.unit, symbolTable, params.position);
});
/**
 * Completion provider.
 */
connection.onCompletion((params) => {
    const state = documentStates.get(params.textDocument.uri);
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const symbolTable = state ? getSymbolTable(state) : null;
    const unit = state?.parseResult.unit || null;
    return (0, index_3.getCompletions)(document, unit, symbolTable, params.position);
});
/**
 * Completion resolve provider.
 */
connection.onCompletionResolve((item) => {
    return (0, index_3.resolveCompletion)(item);
});
/**
 * Go to definition provider.
 */
connection.onDefinition((params) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }
    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }
    return (0, index_3.getDefinition)(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position);
});
/**
 * Find references provider.
 */
connection.onReferences((params) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return [];
    }
    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return [];
    }
    return (0, index_3.findReferences)(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.context);
});
/**
 * Document symbols provider.
 */
connection.onDocumentSymbol((params) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return [];
    }
    return (0, index_3.getDocumentSymbols)(state.parseResult.unit);
});
/**
 * Document formatting provider.
 */
connection.onDocumentFormatting((params) => {
    const state = documentStates.get(params.textDocument.uri);
    const document = documents.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit || !document) {
        return [];
    }
    return (0, index_3.formatDocument)(document, state.parseResult.unit, params.options);
});
/**
 * Prepare rename provider.
 */
connection.onPrepareRename((params) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }
    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }
    return (0, index_3.prepareRename)(state.parseResult.unit, symbolTable, params.position);
});
/**
 * Rename provider.
 */
connection.onRenameRequest((params) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }
    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }
    return (0, index_3.doRename)(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.newName);
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