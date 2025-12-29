/**
 * Hover command - get hover information at position.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../../parser/index';
import { validate } from '../../analysis/index';
import { getHover } from '../../services/hover';
import { HoverResult, PositionOptions } from '../types';

/**
 * Run the hover command.
 */
export function runHover(file: string, options: PositionOptions): HoverResult | null {
    const filePath = resolve(file);

    if (!existsSync(filePath)) {
        return null;
    }

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }

    const parseResult = parse(source);
    if (!parseResult.unit) {
        return null;
    }

    const validationResult = validate(parseResult.unit);
    const symbolTable = validationResult.symbolTable;

    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };

    const hover = getHover(parseResult.unit, symbolTable, position);
    if (!hover) {
        return null;
    }

    const result: HoverResult = {
        contents: typeof hover.contents === 'string'
            ? hover.contents
            : (hover.contents as { value: string }).value,
    };

    if (hover.range) {
        result.range = {
            start: {
                line: hover.range.start.line + 1,
                column: hover.range.start.character,
            },
            end: {
                line: hover.range.end.line + 1,
                column: hover.range.end.character,
            },
        };
    }

    return result;
}
