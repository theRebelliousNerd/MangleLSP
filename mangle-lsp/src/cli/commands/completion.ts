/**
 * Completion command - get completions at position.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../../parser/index';
import { validate } from '../../analysis/index';
import { getCompletions } from '../../services/completion';
import { CompletionResult, CLICompletionItem, PositionOptions } from '../types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind } from 'vscode-languageserver/node';

/**
 * Run the completion command.
 */
export function runCompletion(file: string, options: PositionOptions): CompletionResult {
    const filePath = resolve(file);
    const result: CompletionResult = { items: [] };

    if (!existsSync(filePath)) {
        return result;
    }

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch {
        return result;
    }

    const parseResult = parse(source);
    const validationResult = parseResult.unit ? validate(parseResult.unit) : null;
    const symbolTable = validationResult?.symbolTable || null;

    // Create a TextDocument for the completion service
    const uri = `file://${filePath}`;
    const document = TextDocument.create(uri, 'mangle', 1, source);

    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };

    const completions = getCompletions(document, parseResult.unit, symbolTable, position);

    result.items = completions.map(item => {
        const cliItem: CLICompletionItem = {
            label: item.label,
            kind: mapCompletionKind(item.kind),
        };
        if (item.detail) {
            cliItem.detail = item.detail;
        }
        if (item.documentation) {
            cliItem.documentation = typeof item.documentation === 'string'
                ? item.documentation
                : (item.documentation as { value: string }).value;
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
function mapCompletionKind(kind?: CompletionItemKind): string {
    if (kind === undefined) {
        return 'text';
    }
    switch (kind) {
        case CompletionItemKind.Function:
            return 'function';
        case CompletionItemKind.Variable:
            return 'variable';
        case CompletionItemKind.Keyword:
            return 'keyword';
        case CompletionItemKind.Constant:
            return 'constant';
        case CompletionItemKind.Method:
            return 'method';
        case CompletionItemKind.Property:
            return 'property';
        default:
            return 'text';
    }
}
