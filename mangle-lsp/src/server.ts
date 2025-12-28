/**
 * Mangle Language Server Protocol (LSP) Server.
 *
 * Provides language intelligence for Mangle source files.
 */

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    Diagnostic,
    DiagnosticSeverity,
    DidChangeConfigurationNotification,
    HoverParams,
    CompletionParams,
    CompletionItem,
    DefinitionParams,
    ReferenceParams,
    DocumentSymbolParams,
    DocumentFormattingParams,
    PrepareRenameParams,
    RenameParams,
    DidChangeConfigurationParams,
    WorkspaceFoldersChangeEvent,
    TextDocumentChangeEvent,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { parse, ParseError, ParseResult } from './parser/index';
import { validate, SemanticError, ValidationResult, checkStratification, checkUnboundedRecursion, checkCartesianExplosion, checkLateFiltering, checkLateNegation, checkMultipleIndependentVars, StratificationError } from './analysis/index';
import { SymbolTable, buildSymbolTable } from './analysis/symbols';
import {
    getHover,
    getCompletions,
    resolveCompletion,
    getDefinition,
    findReferences,
    getDocumentSymbols,
    formatDocument,
    prepareRename,
    doRename,
} from './services/index';

// Create connection
const connection = createConnection(ProposedFeatures.all);

// Create document manager
const documents = new TextDocuments<TextDocument>(TextDocument);

// Document state cache
interface DocumentState {
    uri: string;
    version: number;
    parseResult: ParseResult;
    validationResult: ValidationResult | null;
}
const documentStates = new Map<string, DocumentState>();

// Validation debouncing - prevents excessive revalidation during rapid typing
const validationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// Configuration
interface MangleLSPSettings {
    maxNumberOfProblems: number;
    enableSemanticAnalysis: boolean;
}

const defaultSettings: MangleLSPSettings = {
    maxNumberOfProblems: 100,
    enableSemanticAnalysis: true,
};

let globalSettings: MangleLSPSettings = defaultSettings;
const documentSettings = new Map<string, Thenable<MangleLSPSettings>>();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

/**
 * Initialize the server.
 */
connection.onInitialize((params: InitializeParams): InitializeResult => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
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
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event: WorkspaceFoldersChangeEvent) => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    connection.console.log('Mangle LSP server initialized.');
});

/**
 * Configuration changed.
 */
connection.onDidChangeConfiguration((change: DidChangeConfigurationParams) => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    } else {
        globalSettings = (
            (change.settings.mangle || defaultSettings) as MangleLSPSettings
        );
    }
    documents.all().forEach(validateDocument);
});

/**
 * Get document settings.
 */
function getDocumentSettings(uri: string): Thenable<MangleLSPSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(uri);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: uri,
            section: 'mangle',
        }) as Thenable<MangleLSPSettings>;
        documentSettings.set(uri, result);
    }
    return result;
}

/**
 * Document opened.
 */
documents.onDidOpen((event: TextDocumentChangeEvent<TextDocument>) => {
    validateDocument(event.document);
});

/**
 * Document content changed.
 */
documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
    scheduleValidation(change.document);
});

/**
 * Schedule validation with debouncing.
 * Prevents excessive revalidation during rapid typing.
 */
function scheduleValidation(document: TextDocument): void {
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
documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
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
async function validateDocument(document: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(document.uri);
    const text = document.getText();

    // Parse the document
    const parseResult = parse(text);

    // Run semantic validation if parse succeeded
    let validationResult: ValidationResult | null = null;
    if (parseResult.unit && settings.enableSemanticAnalysis) {
        validationResult = validate(parseResult.unit);
    }

    // Cache state
    documentStates.set(document.uri, {
        uri: document.uri,
        version: document.version,
        parseResult,
        validationResult,
    });

    // Collect diagnostics
    const diagnostics: Diagnostic[] = [];

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
        const stratErrors = checkStratification(parseResult.unit);
        for (const error of stratErrors) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(error));
        }

        // Unbounded recursion warnings
        const recursionWarnings = checkUnboundedRecursion(parseResult.unit);
        for (const warning of recursionWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }

        // Cartesian explosion warnings
        const cartesianWarnings = checkCartesianExplosion(parseResult.unit);
        for (const warning of cartesianWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }

        // Late filtering warnings
        const lateFilterWarnings = checkLateFiltering(parseResult.unit);
        for (const warning of lateFilterWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }

        // Late negation warnings
        const lateNegationWarnings = checkLateNegation(parseResult.unit);
        for (const warning of lateNegationWarnings) {
            if (diagnostics.length >= settings.maxNumberOfProblems) {
                break;
            }
            diagnostics.push(stratificationErrorToDiagnostic(warning));
        }

        // Multiple independent variables (massive Cartesian)
        const multiIndepWarnings = checkMultipleIndependentVars(parseResult.unit);
        for (const warning of multiIndepWarnings) {
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
function parseErrorToDiagnostic(error: ParseError): Diagnostic {
    return {
        severity: DiagnosticSeverity.Error,
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
function semanticErrorToDiagnostic(error: SemanticError): Diagnostic {
    let severity: DiagnosticSeverity;
    switch (error.severity) {
        case 'error':
            severity = DiagnosticSeverity.Error;
            break;
        case 'warning':
            severity = DiagnosticSeverity.Warning;
            break;
        case 'info':
            severity = DiagnosticSeverity.Information;
            break;
        default:
            severity = DiagnosticSeverity.Error;
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
function stratificationErrorToDiagnostic(error: StratificationError): Diagnostic {
    let severity: DiagnosticSeverity;
    switch (error.severity) {
        case 'error':
            severity = DiagnosticSeverity.Error;
            break;
        case 'warning':
            severity = DiagnosticSeverity.Warning;
            break;
        default:
            severity = DiagnosticSeverity.Error;
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
function getSymbolTable(state: DocumentState): SymbolTable | null {
    if (state.validationResult) {
        return state.validationResult.symbolTable;
    }
    if (state.parseResult.unit) {
        return buildSymbolTable(state.parseResult.unit);
    }
    return null;
}

/**
 * Hover provider.
 */
connection.onHover((params: HoverParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }

        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }

        return getHover(state.parseResult.unit, symbolTable, params.position);
    } catch (e) {
        connection.console.error(`Hover error: ${e}`);
        return null;
    }
});

/**
 * Completion provider.
 */
connection.onCompletion((params: CompletionParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        const symbolTable = state ? getSymbolTable(state) : null;
        const unit = state?.parseResult.unit || null;

        return getCompletions(document, unit, symbolTable, params.position);
    } catch (e) {
        connection.console.error(`Completion error: ${e}`);
        return [];
    }
});

/**
 * Completion resolve provider.
 */
connection.onCompletionResolve((item: CompletionItem) => {
    try {
        return resolveCompletion(item);
    } catch (e) {
        connection.console.error(`Completion resolve error: ${e}`);
        return item;
    }
});

/**
 * Go to definition provider.
 */
connection.onDefinition((params: DefinitionParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }

        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }

        return getDefinition(params.textDocument.uri, symbolTable, params.position);
    } catch (e) {
        connection.console.error(`Definition error: ${e}`);
        return null;
    }
});

/**
 * Find references provider.
 */
connection.onReferences((params: ReferenceParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return [];
        }

        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return [];
        }

        return findReferences(params.textDocument.uri, symbolTable, params.position, params.context);
    } catch (e) {
        connection.console.error(`References error: ${e}`);
        return [];
    }
});

/**
 * Document symbols provider.
 */
connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return [];
        }

        return getDocumentSymbols(state.parseResult.unit);
    } catch (e) {
        connection.console.error(`Document symbols error: ${e}`);
        return [];
    }
});

/**
 * Document formatting provider.
 */
connection.onDocumentFormatting((params: DocumentFormattingParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        const document = documents.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit || !document) {
            return [];
        }

        return formatDocument(document, state.parseResult.unit, params.options);
    } catch (e) {
        connection.console.error(`Formatting error: ${e}`);
        return [];
    }
});

/**
 * Prepare rename provider.
 */
connection.onPrepareRename((params: PrepareRenameParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }

        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }

        return prepareRename(state.parseResult.unit, symbolTable, params.position);
    } catch (e) {
        connection.console.error(`Prepare rename error: ${e}`);
        return null;
    }
});

/**
 * Rename provider.
 */
connection.onRenameRequest((params: RenameParams) => {
    try {
        const state = documentStates.get(params.textDocument.uri);
        if (!state || !state.parseResult.unit) {
            return null;
        }

        const symbolTable = getSymbolTable(state);
        if (!symbolTable) {
            return null;
        }

        return doRename(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.newName);
    } catch (e) {
        connection.console.error(`Rename error: ${e}`);
        return null;
    }
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
export function startServer(): void {
    // Server is started when this module is imported
    connection.console.log('Mangle LSP server started.');
}
