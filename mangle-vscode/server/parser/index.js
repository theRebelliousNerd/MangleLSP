"use strict";
/**
 * Parser module for Mangle LSP.
 *
 * Provides AST types, parser, and visitor for Mangle source files.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangleASTVisitor = exports.getErrorCounts = exports.hasFatalErrors = exports.hasErrors = exports.errorToRange = exports.parseClause = exports.parse = void 0;
// AST types
__exportStar(require("./ast"), exports);
// Parser API
var parser_1 = require("./parser");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parser_1.parse; } });
Object.defineProperty(exports, "parseClause", { enumerable: true, get: function () { return parser_1.parseClause; } });
Object.defineProperty(exports, "errorToRange", { enumerable: true, get: function () { return parser_1.errorToRange; } });
Object.defineProperty(exports, "hasErrors", { enumerable: true, get: function () { return parser_1.hasErrors; } });
Object.defineProperty(exports, "hasFatalErrors", { enumerable: true, get: function () { return parser_1.hasFatalErrors; } });
Object.defineProperty(exports, "getErrorCounts", { enumerable: true, get: function () { return parser_1.getErrorCounts; } });
// Visitor (for advanced use cases)
var visitor_1 = require("./visitor");
Object.defineProperty(exports, "MangleASTVisitor", { enumerable: true, get: function () { return visitor_1.MangleASTVisitor; } });
//# sourceMappingURL=index.js.map