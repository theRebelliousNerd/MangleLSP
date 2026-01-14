"use strict";
/**
 * LSP services for Mangle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.doRename = exports.prepareRename = exports.formatDocument = exports.getDocumentSymbols = exports.findReferences = exports.getDefinition = exports.resolveCompletion = exports.getCompletions = exports.getHover = void 0;
var hover_1 = require("./hover");
Object.defineProperty(exports, "getHover", { enumerable: true, get: function () { return hover_1.getHover; } });
var completion_1 = require("./completion");
Object.defineProperty(exports, "getCompletions", { enumerable: true, get: function () { return completion_1.getCompletions; } });
Object.defineProperty(exports, "resolveCompletion", { enumerable: true, get: function () { return completion_1.resolveCompletion; } });
var definition_1 = require("./definition");
Object.defineProperty(exports, "getDefinition", { enumerable: true, get: function () { return definition_1.getDefinition; } });
var references_1 = require("./references");
Object.defineProperty(exports, "findReferences", { enumerable: true, get: function () { return references_1.findReferences; } });
var symbols_1 = require("./symbols");
Object.defineProperty(exports, "getDocumentSymbols", { enumerable: true, get: function () { return symbols_1.getDocumentSymbols; } });
var formatting_1 = require("./formatting");
Object.defineProperty(exports, "formatDocument", { enumerable: true, get: function () { return formatting_1.formatDocument; } });
var rename_1 = require("./rename");
Object.defineProperty(exports, "prepareRename", { enumerable: true, get: function () { return rename_1.prepareRename; } });
Object.defineProperty(exports, "doRename", { enumerable: true, get: function () { return rename_1.doRename; } });
//# sourceMappingURL=index.js.map