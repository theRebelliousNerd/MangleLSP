/**
 * Mangle VS Code Extension
 *
 * Provides language support for Mangle (.mg files) using the Mangle LSP server.
 * Includes CLI-accessible commands for coding agent integration.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
    workspace,
    ExtensionContext,
    window,
    OutputChannel,
    commands,
    languages,
    Uri,
    TextDocument,
    DiagnosticCollection,
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;
let outputChannel: OutputChannel;
let cliOutputChannel: OutputChannel;
let diagnosticCollection: DiagnosticCollection;

/**
 * Diagnostic result structure for CLI output.
 */
interface CLIDiagnostic {
    severity: string;
    code: string;
    source: string;
    message: string;
    range: {
        start: { line: number; column: number };
        end: { line: number; column: number };
    };
}

/**
 * Full diagnostics result for a file.
 */
interface FileDiagnosticsResult {
    path: string;
    diagnostics: CLIDiagnostic[];
}

/**
 * Check result structure.
 */
interface CheckResult {
    version: string;
    files: FileDiagnosticsResult[];
    summary: {
        totalFiles: number;
        totalErrors: number;
        totalWarnings: number;
        totalInfo: number;
    };
}

export async function activate(context: ExtensionContext) {
    // Create output channel for logging
    outputChannel = window.createOutputChannel('Mangle Extension');
    outputChannel.appendLine('Mangle extension activating...');

    // Create structured CLI output channel for programmatic access
    cliOutputChannel = window.createOutputChannel('Mangle CLI', 'json');

    // Path to the LSP server module (bundled in ./server/)
    const serverModule = context.asAbsolutePath(
        path.join('server', 'server.bundle.js')
    );
    outputChannel.appendLine(`Server module path: ${serverModule}`);

    // Server options - run in Node.js
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                execArgv: ['--nolazy', '--inspect=6009'],
            },
        },
    };

    // Client options
    const clientOptions: LanguageClientOptions = {
        // Register for Mangle documents
        documentSelector: [{ scheme: 'file', language: 'mangle' }],
        synchronize: {
            // Notify the server about file changes to '.mg' files in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.mg'),
        },
        outputChannel: outputChannel,
    };

    // Create the language client and start it
    client = new LanguageClient(
        'mangleLanguageServer',
        'Mangle Language Server',
        serverOptions,
        clientOptions
    );

    try {
        outputChannel.appendLine('Starting language client...');
        // Start the client (also starts the server)
        await client.start();
        context.subscriptions.push(client);
        outputChannel.appendLine('Mangle Language Server started successfully!');

        // Register commands after client is ready
        registerCommands(context);

        window.showInformationMessage('Mangle Language Server started');
    } catch (error) {
        outputChannel.appendLine(`ERROR: Failed to start server: ${error}`);
        window.showErrorMessage(`Failed to start Mangle Language Server: ${error}`);
    }
}

/**
 * Register VS Code commands for CLI access.
 */
function registerCommands(context: ExtensionContext): void {
    // Command: Check current file
    context.subscriptions.push(
        commands.registerCommand('mangle.checkFile', async () => {
            const editor = window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'mangle') {
                window.showWarningMessage('No Mangle file is open');
                return;
            }
            const result = await getDiagnosticsForDocument(editor.document);
            cliOutputChannel.clear();
            cliOutputChannel.appendLine(JSON.stringify(result, null, 2));
            cliOutputChannel.show();
            return result;
        })
    );

    // Command: Check all workspace files
    context.subscriptions.push(
        commands.registerCommand('mangle.checkWorkspace', async () => {
            const files = await workspace.findFiles('**/*.mg');
            const result = await checkMultipleFiles(files);
            cliOutputChannel.clear();
            cliOutputChannel.appendLine(JSON.stringify(result, null, 2));
            cliOutputChannel.show();
            return result;
        })
    );

    // Command: Export diagnostics to JSON (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.exportDiagnostics', async (uri?: string) => {
            if (uri) {
                const doc = await workspace.openTextDocument(Uri.parse(uri));
                return getDiagnosticsForDocument(doc);
            }
            const allDiagnostics = languages.getDiagnostics();
            return formatAllDiagnostics(allDiagnostics);
        })
    );

    // Command: Get diagnostics for a specific file (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getDiagnostics', async (uri?: string) => {
            const targetUri = uri || window.activeTextEditor?.document.uri.toString();
            if (!targetUri) {
                return { diagnostics: [] };
            }

            // Use custom LSP request
            try {
                const result = await client.sendRequest('mangle/getDiagnostics', { uri: targetUri });
                return result;
            } catch {
                // Fallback to VS Code diagnostics
                const vscodeDiags = languages.getDiagnostics(Uri.parse(targetUri));
                return {
                    uri: targetUri,
                    diagnostics: vscodeDiags.map(d => ({
                        severity: d.severity === 0 ? 'error' : d.severity === 1 ? 'warning' : 'info',
                        message: d.message,
                        range: {
                            start: { line: d.range.start.line + 1, column: d.range.start.character },
                            end: { line: d.range.end.line + 1, column: d.range.end.character },
                        },
                        code: typeof d.code === 'string' ? d.code : String(d.code ?? ''),
                        source: d.source || 'mangle',
                    })),
                };
            }
        })
    );

    // Command: Get symbols for a file (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getSymbols', async (uri?: string) => {
            const targetUri = uri || window.activeTextEditor?.document.uri.toString();
            if (!targetUri) {
                return { symbols: [] };
            }

            try {
                const symbols = await commands.executeCommand(
                    'vscode.executeDocumentSymbolProvider',
                    Uri.parse(targetUri)
                );
                return { uri: targetUri, symbols: symbols || [] };
            } catch {
                return { uri: targetUri, symbols: [] };
            }
        })
    );

    // Command: Get hover info at position (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getHover', async (uri: string, line: number, column: number) => {
            if (!uri || line === undefined || column === undefined) {
                return { contents: null };
            }

            try {
                const hovers = await commands.executeCommand(
                    'vscode.executeHoverProvider',
                    Uri.parse(uri),
                    { line: line - 1, character: column }
                );
                if (Array.isArray(hovers) && hovers.length > 0) {
                    const hover = hovers[0];
                    return {
                        contents: hover.contents,
                        range: hover.range ? {
                            start: { line: hover.range.start.line + 1, column: hover.range.start.character },
                            end: { line: hover.range.end.line + 1, column: hover.range.end.character },
                        } : undefined,
                    };
                }
                return { contents: null };
            } catch {
                return { contents: null };
            }
        })
    );

    // Command: Get definition location (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getDefinition', async (uri: string, line: number, column: number) => {
            if (!uri || line === undefined || column === undefined) {
                return { locations: [] };
            }

            try {
                const definitions = await commands.executeCommand(
                    'vscode.executeDefinitionProvider',
                    Uri.parse(uri),
                    { line: line - 1, character: column }
                );
                if (Array.isArray(definitions)) {
                    return {
                        locations: definitions.map((d: any) => ({
                            uri: d.uri.toString(),
                            range: {
                                start: { line: d.range.start.line + 1, column: d.range.start.character },
                                end: { line: d.range.end.line + 1, column: d.range.end.character },
                            },
                        })),
                    };
                }
                return { locations: [] };
            } catch {
                return { locations: [] };
            }
        })
    );

    // Command: Find references (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getReferences', async (uri: string, line: number, column: number, includeDeclaration?: boolean) => {
            if (!uri || line === undefined || column === undefined) {
                return { locations: [] };
            }

            try {
                const references = await commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    Uri.parse(uri),
                    { line: line - 1, character: column }
                );
                if (Array.isArray(references)) {
                    return {
                        locations: references.map((r: any) => ({
                            uri: r.uri.toString(),
                            range: {
                                start: { line: r.range.start.line + 1, column: r.range.start.character },
                                end: { line: r.range.end.line + 1, column: r.range.end.character },
                            },
                        })),
                    };
                }
                return { locations: [] };
            } catch {
                return { locations: [] };
            }
        })
    );

    // Command: Get completions (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getCompletions', async (uri: string, line: number, column: number) => {
            if (!uri || line === undefined || column === undefined) {
                return { items: [] };
            }

            try {
                const completions = await commands.executeCommand(
                    'vscode.executeCompletionItemProvider',
                    Uri.parse(uri),
                    { line: line - 1, character: column }
                );
                if (completions && typeof completions === 'object' && 'items' in completions) {
                    return {
                        items: (completions as any).items.map((c: any) => ({
                            label: c.label,
                            kind: c.kind,
                            detail: c.detail,
                            documentation: c.documentation,
                            insertText: c.insertText,
                        })),
                    };
                }
                return { items: [] };
            } catch {
                return { items: [] };
            }
        })
    );

    // Command: Format file (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.format', async (uri?: string) => {
            const targetUri = uri || window.activeTextEditor?.document.uri.toString();
            if (!targetUri) {
                return { success: false, error: 'No file specified' };
            }

            try {
                const edits = await commands.executeCommand(
                    'vscode.executeFormatDocumentProvider',
                    Uri.parse(targetUri),
                    { tabSize: 4, insertSpaces: true }
                );
                if (Array.isArray(edits) && edits.length > 0) {
                    const doc = await workspace.openTextDocument(Uri.parse(targetUri));
                    const edit = new (await import('vscode')).WorkspaceEdit();
                    for (const e of edits) {
                        edit.replace(Uri.parse(targetUri), e.range, e.newText);
                    }
                    await workspace.applyEdit(edit);
                    return { success: true, editsApplied: edits.length };
                }
                return { success: true, editsApplied: 0 };
            } catch (e) {
                return { success: false, error: String(e) };
            }
        })
    );

    // Command: Write output to file
    context.subscriptions.push(
        commands.registerCommand('mangle.exportToFile', async (outputPath?: string) => {
            const config = workspace.getConfiguration('mangle');
            const filePath = outputPath || config.get<string>('cli.outputFile');

            if (!filePath) {
                window.showWarningMessage('No output file configured. Set mangle.cli.outputFile or pass a path.');
                return;
            }

            const files = await workspace.findFiles('**/*.mg');
            const result = await checkMultipleFiles(files);
            const json = JSON.stringify(result, null, 2);

            try {
                fs.writeFileSync(filePath, json, 'utf-8');
                window.showInformationMessage(`Diagnostics exported to ${filePath}`);
                return { success: true, path: filePath };
            } catch (e) {
                window.showErrorMessage(`Failed to write to ${filePath}: ${e}`);
                return { success: false, error: String(e) };
            }
        })
    );

    // Command: Batch lookup (programmatic API for agents)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.batchLookup', async (queries: any[]) => {
            if (!queries || !Array.isArray(queries)) {
                return { results: [], error: 'Invalid queries array' };
            }

            try {
                const result = await client.sendRequest('mangle/batchLookup', { queries });
                return result;
            } catch (e) {
                return { results: [], error: String(e) };
            }
        })
    );

    // Command: Get file info (programmatic API)
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getFileInfo', async (uri?: string) => {
            const targetUri = uri || window.activeTextEditor?.document.uri.toString();
            if (!targetUri) {
                return { error: 'No file specified' };
            }

            try {
                const result = await client.sendRequest('mangle/getFileInfo', { uri: targetUri });
                return result;
            } catch (e) {
                return { error: String(e) };
            }
        })
    );

    // Command: Check all open files
    context.subscriptions.push(
        commands.registerCommand('mangle.api.checkAll', async () => {
            try {
                const result = await client.sendRequest('mangle/checkAll', {});
                return result;
            } catch (e) {
                return { error: String(e) };
            }
        })
    );

    // Command: Get workspace summary
    context.subscriptions.push(
        commands.registerCommand('mangle.api.getWorkspaceSummary', async () => {
            try {
                const result = await client.sendRequest('mangle/getWorkspaceSummary', {});
                return result;
            } catch (e) {
                return { error: String(e) };
            }
        })
    );

    outputChannel.appendLine('CLI commands registered');
}

/**
 * Get diagnostics for a single document.
 */
async function getDiagnosticsForDocument(document: TextDocument): Promise<FileDiagnosticsResult> {
    const diagnostics = languages.getDiagnostics(document.uri);
    const relativePath = workspace.asRelativePath(document.uri);

    return {
        path: relativePath,
        diagnostics: diagnostics.map(d => ({
            severity: d.severity === 0 ? 'error' : d.severity === 1 ? 'warning' : 'info',
            code: typeof d.code === 'string' ? d.code : String(d.code ?? 'unknown'),
            source: d.source || 'mangle',
            message: d.message,
            range: {
                start: { line: d.range.start.line + 1, column: d.range.start.character },
                end: { line: d.range.end.line + 1, column: d.range.end.character },
            },
        })),
    };
}

/**
 * Check multiple files.
 */
async function checkMultipleFiles(uris: Uri[]): Promise<CheckResult> {
    const result: CheckResult = {
        version: '1.0',
        files: [],
        summary: {
            totalFiles: 0,
            totalErrors: 0,
            totalWarnings: 0,
            totalInfo: 0,
        },
    };

    for (const uri of uris) {
        try {
            const doc = await workspace.openTextDocument(uri);
            const fileDiags = await getDiagnosticsForDocument(doc);
            result.files.push(fileDiags);
            result.summary.totalFiles++;

            for (const d of fileDiags.diagnostics) {
                if (d.severity === 'error') result.summary.totalErrors++;
                else if (d.severity === 'warning') result.summary.totalWarnings++;
                else result.summary.totalInfo++;
            }
        } catch (e) {
            result.files.push({
                path: workspace.asRelativePath(uri),
                diagnostics: [{
                    severity: 'error',
                    code: 'E000',
                    source: 'mangle-vscode',
                    message: `Failed to check file: ${e}`,
                    range: {
                        start: { line: 1, column: 0 },
                        end: { line: 1, column: 0 },
                    },
                }],
            });
            result.summary.totalFiles++;
            result.summary.totalErrors++;
        }
    }

    return result;
}

/**
 * Format all VS Code diagnostics.
 */
function formatAllDiagnostics(allDiagnostics: [Uri, readonly import('vscode').Diagnostic[]][]): CheckResult {
    const result: CheckResult = {
        version: '1.0',
        files: [],
        summary: {
            totalFiles: 0,
            totalErrors: 0,
            totalWarnings: 0,
            totalInfo: 0,
        },
    };

    for (const [uri, diagnostics] of allDiagnostics) {
        if (!uri.path.endsWith('.mg')) continue;

        const fileDiags: FileDiagnosticsResult = {
            path: workspace.asRelativePath(uri),
            diagnostics: diagnostics.map(d => ({
                severity: d.severity === 0 ? 'error' : d.severity === 1 ? 'warning' : 'info',
                code: typeof d.code === 'string' ? d.code : String(d.code ?? 'unknown'),
                source: d.source || 'mangle',
                message: d.message,
                range: {
                    start: { line: d.range.start.line + 1, column: d.range.start.character },
                    end: { line: d.range.end.line + 1, column: d.range.end.character },
                },
            })),
        };

        result.files.push(fileDiags);
        result.summary.totalFiles++;

        for (const d of fileDiags.diagnostics) {
            if (d.severity === 'error') result.summary.totalErrors++;
            else if (d.severity === 'warning') result.summary.totalWarnings++;
            else result.summary.totalInfo++;
        }
    }

    return result;
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
