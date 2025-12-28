/**
 * Mangle VS Code Extension
 *
 * Provides language support for Mangle (.mg files) using the Mangle LSP server.
 */

import * as path from 'path';
import { workspace, ExtensionContext, window } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    // Path to the LSP server module (bundled in ./server/)
    const serverModule = context.asAbsolutePath(
        path.join('server', 'server.js')
    );

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
    };

    // Create the language client and start it
    client = new LanguageClient(
        'mangleLanguageServer',
        'Mangle Language Server',
        serverOptions,
        clientOptions
    );

    try {
        // Start the client (also starts the server)
        await client.start();
        context.subscriptions.push(client);
        console.log('Mangle Language Server started');
    } catch (error) {
        window.showErrorMessage(`Failed to start Mangle Language Server: ${error}`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
