"use strict";
/**
 * References command - find all references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReferences = runReferences;
const fs_1 = require("fs");
const path_1 = require("path");
const index_1 = require("../../parser/index");
const index_2 = require("../../analysis/index");
const references_1 = require("../../services/references");
/**
 * Run the references command.
 */
function runReferences(file, options) {
    const filePath = (0, path_1.resolve)(file);
    const result = { locations: [] };
    if (!(0, fs_1.existsSync)(filePath)) {
        return result;
    }
    let source;
    try {
        source = (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return result;
    }
    const parseResult = (0, index_1.parse)(source);
    if (!parseResult.unit) {
        return result;
    }
    const validationResult = (0, index_2.validate)(parseResult.unit);
    const symbolTable = validationResult.symbolTable;
    // LSP uses 0-indexed positions
    const position = {
        line: options.line - 1,
        character: options.column,
    };
    const uri = `file://${filePath}`;
    const context = { includeDeclaration: options.includeDeclaration };
    const references = (0, references_1.findReferences)(uri, symbolTable, position, context);
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
//# sourceMappingURL=references.js.map