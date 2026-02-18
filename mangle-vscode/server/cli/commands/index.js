"use strict";
/**
 * CLI commands index.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBatchInput = exports.runBatch = exports.getFormatExitCode = exports.runFormat = exports.runCompletion = exports.runReferences = exports.runDefinition = exports.runHover = exports.runSymbols = exports.getExitCode = exports.runCheck = void 0;
var check_1 = require("./check");
Object.defineProperty(exports, "runCheck", { enumerable: true, get: function () { return check_1.runCheck; } });
Object.defineProperty(exports, "getExitCode", { enumerable: true, get: function () { return check_1.getExitCode; } });
var symbols_1 = require("./symbols");
Object.defineProperty(exports, "runSymbols", { enumerable: true, get: function () { return symbols_1.runSymbols; } });
var hover_1 = require("./hover");
Object.defineProperty(exports, "runHover", { enumerable: true, get: function () { return hover_1.runHover; } });
var definition_1 = require("./definition");
Object.defineProperty(exports, "runDefinition", { enumerable: true, get: function () { return definition_1.runDefinition; } });
var references_1 = require("./references");
Object.defineProperty(exports, "runReferences", { enumerable: true, get: function () { return references_1.runReferences; } });
var completion_1 = require("./completion");
Object.defineProperty(exports, "runCompletion", { enumerable: true, get: function () { return completion_1.runCompletion; } });
var format_1 = require("./format");
Object.defineProperty(exports, "runFormat", { enumerable: true, get: function () { return format_1.runFormat; } });
Object.defineProperty(exports, "getFormatExitCode", { enumerable: true, get: function () { return format_1.getFormatExitCode; } });
var batch_1 = require("./batch");
Object.defineProperty(exports, "runBatch", { enumerable: true, get: function () { return batch_1.runBatch; } });
Object.defineProperty(exports, "parseBatchInput", { enumerable: true, get: function () { return batch_1.parseBatchInput; } });
//# sourceMappingURL=index.js.map