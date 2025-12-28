"use strict";
/**
 * Document symbols provider for Mangle LSP.
 *
 * Provides the document outline (symbol tree).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocumentSymbols = getDocumentSymbols;
const node_1 = require("vscode-languageserver/node");
/**
 * Get document symbols for the outline view.
 */
function getDocumentSymbols(unit) {
    const symbols = [];
    // Group clauses by predicate
    const predicateGroups = new Map();
    for (const clause of unit.clauses) {
        const key = clause.head.predicate.symbol;
        const group = predicateGroups.get(key);
        if (group) {
            group.push(clause);
        }
        else {
            predicateGroups.set(key, [clause]);
        }
    }
    // Add package if present
    if (unit.packageDecl) {
        symbols.push({
            name: `Package: ${unit.packageDecl.name}`,
            kind: node_1.SymbolKind.Package,
            range: convertRange(unit.packageDecl.range),
            selectionRange: convertRange(unit.packageDecl.range),
        });
    }
    // Add declarations section if there are declarations
    if (unit.decls.length > 0) {
        const declSymbols = unit.decls.map(decl => createDeclSymbol(decl));
        const declsRange = combineRanges(unit.decls.map(d => d.range));
        symbols.push({
            name: 'Declarations',
            kind: node_1.SymbolKind.Namespace,
            range: convertRange(declsRange),
            selectionRange: convertRange(declsRange),
            children: declSymbols,
        });
    }
    // Add predicate groups
    for (const [predName, clauses] of predicateGroups) {
        const firstClause = clauses[0];
        if (!firstClause)
            continue;
        const arity = firstClause.head.predicate.arity;
        const clauseSymbols = clauses.map((clause, index) => createClauseSymbol(clause, index));
        const groupRange = combineRanges(clauses.map(c => c.range));
        symbols.push({
            name: `${predName}/${arity}`,
            kind: node_1.SymbolKind.Function,
            range: convertRange(groupRange),
            selectionRange: convertRange(firstClause.head.range),
            detail: `${clauses.length} clause(s)`,
            children: clauseSymbols.length > 1 ? clauseSymbols : undefined,
        });
    }
    return symbols;
}
/**
 * Create a symbol for a declaration.
 */
function createDeclSymbol(decl) {
    const name = decl.declaredAtom.predicate.symbol;
    const arity = decl.declaredAtom.predicate.arity;
    return {
        name: `${name}/${arity}`,
        kind: node_1.SymbolKind.Interface,
        range: convertRange(decl.range),
        selectionRange: convertRange(decl.declaredAtom.range),
        detail: 'Declaration',
    };
}
/**
 * Create a symbol for a clause.
 */
function createClauseSymbol(clause, index) {
    const name = clause.head.predicate.symbol;
    const isFact = !clause.premises || clause.premises.length === 0;
    const detail = isFact ? 'fact' : `rule (${clause.premises?.length || 0} premises)`;
    return {
        name: `${name} [${index + 1}]`,
        kind: isFact ? node_1.SymbolKind.Constant : node_1.SymbolKind.Method,
        range: convertRange(clause.range),
        selectionRange: convertRange(clause.head.range),
        detail,
    };
}
/**
 * Convert our SourceRange to LSP Range.
 */
function convertRange(range) {
    return {
        start: { line: range.start.line - 1, character: range.start.column },
        end: { line: range.end.line - 1, character: range.end.column },
    };
}
/**
 * Combine multiple ranges into one that encompasses all.
 */
function combineRanges(ranges) {
    if (ranges.length === 0) {
        return { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };
    }
    let minLine = Infinity, minCol = Infinity, minOffset = Infinity;
    let maxLine = 0, maxCol = 0, maxOffset = 0;
    for (const range of ranges) {
        if (range.start.line < minLine || (range.start.line === minLine && range.start.column < minCol)) {
            minLine = range.start.line;
            minCol = range.start.column;
            minOffset = range.start.offset;
        }
        if (range.end.line > maxLine || (range.end.line === maxLine && range.end.column > maxCol)) {
            maxLine = range.end.line;
            maxCol = range.end.column;
            maxOffset = range.end.offset;
        }
    }
    return {
        start: { line: minLine, column: minCol, offset: minOffset },
        end: { line: maxLine, column: maxCol, offset: maxOffset },
    };
}
//# sourceMappingURL=symbols.js.map