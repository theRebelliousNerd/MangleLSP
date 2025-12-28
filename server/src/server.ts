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
    validateDocument(change.document);
});

/**
 * Document closed.
 */
documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
    documentSettings.delete(event.document.uri);
    documentStates.delete(event.document.uri);
    // Clear diagnostics
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
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
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }

    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }

    return getHover(state.parseResult.unit, symbolTable, params.position);
});

/**
 * Completion provider.
 */
connection.onCompletion((params: CompletionParams) => {
    const state = documentStates.get(params.textDocument.uri);
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    const symbolTable = state ? getSymbolTable(state) : null;
    const unit = state?.parseResult.unit || null;

    return getCompletions(document, unit, symbolTable, params.position);
});

/**
 * Completion resolve provider.
 */
connection.onCompletionResolve((item: CompletionItem) => {
    return resolveCompletion(item);
});

/**
 * Go to definition provider.
 */
connection.onDefinition((params: DefinitionParams) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }

    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }

    return getDefinition(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position);
});

/**
 * Find references provider.
 */
connection.onReferences((params: ReferenceParams) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return [];
    }

    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return [];
    }

    return findReferences(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.context);
});

/**
 * Document symbols provider.
 */
connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return [];
    }

    return getDocumentSymbols(state.parseResult.unit);
});

/**
 * Document formatting provider.
 */
connection.onDocumentFormatting((params: DocumentFormattingParams) => {
    const state = documentStates.get(params.textDocument.uri);
    const document = documents.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit || !document) {
        return [];
    }

    return formatDocument(document, state.parseResult.unit, params.options);
});

/**
 * Prepare rename provider.
 */
connection.onPrepareRename((params: PrepareRenameParams) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }

    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }

    return prepareRename(state.parseResult.unit, symbolTable, params.position);
});

/**
 * Rename provider.
 */
connection.onRenameRequest((params: RenameParams) => {
    const state = documentStates.get(params.textDocument.uri);
    if (!state || !state.parseResult.unit) {
        return null;
    }

    const symbolTable = getSymbolTable(state);
    if (!symbolTable) {
        return null;
    }

    return doRename(params.textDocument.uri, state.parseResult.unit, symbolTable, params.position, params.newName);
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
