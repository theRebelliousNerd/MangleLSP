/**
 * Definition command - get definition location.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parse } from '../../parser/index';
import { validate } from '../../analysis/index';
import { getDefinition } from '../../services/definition';
import { DefinitionResult, PositionOptions } from '../types';
import { Location } from 'vscode-languageserver/node';

/**
 * Run the definition command.
 */
export function runDefinition(file: string, options: PositionOptions): DefinitionResult {
    const filePath = resolve(file);
    const result: DefinitionResult = { locations: [] };

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
    if (!parseResult.unit) {
        return result;
    }

    const validationResult = validate(parseResult.unit);
    const symbolTable = validationResult.symbolTable;

    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };

    const uri = `file://${filePath}`;
    const definition = getDefinition(uri, symbolTable, position);

    if (!definition) {
        return result;
    }

    const locations = Array.isArray(definition) ? definition : [definition];
    result.locations = locations.map((loc: Location) => ({
        uri: loc.uri.replace('file://', ''),
        range: {
            start: {
                line: loc.range.start.line + 1,
                column: loc.range.start.character,
            },
            end: {
                line: loc.range.end.line + 1,
                column: loc.range.end.character,
            },
        },
    }));

    return result;
}
