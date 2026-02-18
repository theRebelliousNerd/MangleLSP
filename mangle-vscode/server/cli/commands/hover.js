"use strict";
/**
 * Hover command - get hover information at position.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHover = runHover;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const index_2 = require("../../analysis/index");
const hover_1 = require("../../services/hover");
/**
 * Run the hover command.
 */
function runHover(file, options) {
    const filePath = (0, path_1.resolve)(file);
    if (!(0, fs_1.existsSync)(filePath)) {
        return null;
    }
    let source;
    try {
        source = (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    const parseResult = (0, index_1.parse)(source);
    if (!parseResult.unit) {
        return null;
    }
    const validationResult = (0, index_2.validate)(parseResult.unit);
    const symbolTable = validationResult.symbolTable;
    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };
    const hover = (0, hover_1.getHover)(parseResult.unit, symbolTable, position);
    if (!hover) {
        return null;
    }
    const result = {
        contents: typeof hover.contents === 'string'
            ? hover.contents
            : hover.contents.value,
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
//# sourceMappingURL=hover.js.map