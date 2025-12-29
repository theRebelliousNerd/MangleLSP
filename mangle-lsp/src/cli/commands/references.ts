/**
 * References command - find all references.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../../parser/index';
import { validate } from '../../analysis/index';
import { findReferences } from '../../services/references';
import { ReferencesResult, PositionOptions } from '../types';

export interface ReferencesOptions extends PositionOptions {
    includeDeclaration: boolean;
}

/**
 * Run the references command.
 */
export function runReferences(file: string, options: ReferencesOptions): ReferencesResult {
    const filePath = resolve(file);
    const result: ReferencesResult = { locations: [] };

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
    const context = { includeDeclaration: options.includeDeclaration };
    const references = findReferences(uri, symbolTable, position, context);

    result.locations = references.map(loc => ({
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
