/**
 * Hover provider for Mangle LSP.
 *
 * Provides hover information for predicates, built-in predicates/functions, and variables.
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import {
    SourceUnit,
    SourceRange,
    Clause,
    Atom,
    Variable,
    ApplyFn,
    Term,
    Transform,
} from '../parser/ast';
import { SymbolTable, PredicateInfo, VariableInfo } from '../analysis/symbols';
import { getBuiltinPredicate, BUILTIN_PREDICATES } from '../builtins/predicates';
import { getBuiltinFunction, ALL_BUILTIN_FUNCTIONS } from '../builtins/functions';

/**
 * Get hover information at a position in the document.
 */
export function getHover(
    unit: SourceUnit,
    symbolTable: SymbolTable,
    position: Position
): Hover | null {
    // Convert to 1-indexed for our AST
    const line = position.line + 1;
    const column = position.character;

    // Try to find what's at this position
    // Check predicates first
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        return createPredicateHover(predInfo);
    }

    // Check variables
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        return createVariableHover(varInfo);
    }

    // Check built-in predicates and functions by scanning the AST
    const builtinHover = findBuiltinAtPosition(unit, line, column);
    if (builtinHover) {
        return builtinHover;
    }

    return null;
}

/**
 * Create hover content for a user-defined predicate.
 */
function createPredicateHover(info: PredicateInfo): Hover {
    const lines: string[] = [];

    // Predicate signature
    lines.push(`**${info.symbol.symbol}/${info.symbol.arity}**`);
    lines.push('');

    // Documentation if available
    if (info.documentation) {
        lines.push(info.documentation);
        lines.push('');
    }

    // Definition info
    if (info.definitions.length > 0) {
        lines.push(`*Defined in ${info.definitions.length} clause(s)*`);
    }
    if (info.declLocation) {
        lines.push(`*Declared at line ${info.declLocation.start.line}*`);
    }

    // Reference count
    if (info.references.length > 0) {
        lines.push(`*Referenced ${info.references.length} time(s)*`);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: lines.join('\n'),
        },
    };
}

/**
 * Create hover content for a variable.
 */
function createVariableHover(info: VariableInfo): Hover {
    const lines: string[] = [];

    lines.push(`**Variable: ${info.name}**`);
    lines.push('');
    lines.push(`*Bound at line ${info.bindingLocation.start.line}*`);
    lines.push(`*${info.occurrences.length} occurrence(s) in this clause*`);

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: lines.join('\n'),
        },
    };
}

/**
 * Find built-in predicate or function at the given position.
 */
function findBuiltinAtPosition(
    unit: SourceUnit,
    line: number,
    column: number
): Hover | null {
    // Search through all clauses
    for (const clause of unit.clauses) {
        const hover = findBuiltinInClause(clause, line, column);
        if (hover) {
            return hover;
        }
    }
    return null;
}

/**
 * Search for built-in in a clause.
 */
function findBuiltinInClause(
    clause: Clause,
    line: number,
    column: number
): Hover | null {
    // Check head
    const headHover = findBuiltinInAtom(clause.head, line, column);
    if (headHover) return headHover;

    // Check premises
    if (clause.premises) {
        for (const premise of clause.premises) {
            const premiseHover = findBuiltinInTerm(premise, line, column);
            if (premiseHover) return premiseHover;
        }
    }

    // Check transform
    if (clause.transform) {
        let transform: Transform | null = clause.transform;
        while (transform) {
            for (const stmt of transform.statements) {
                const fnHover = findBuiltinInApplyFn(stmt.fn, line, column);
                if (fnHover) return fnHover;
            }
            transform = transform.next;
        }
    }

    return null;
}

/**
 * Search for built-in in a term.
 */
function findBuiltinInTerm(term: Term, line: number, column: number): Hover | null {
    if (term.type === 'Atom') {
        return findBuiltinInAtom(term as Atom, line, column);
    }
    if (term.type === 'NegAtom') {
        return findBuiltinInAtom((term as { atom: Atom }).atom, line, column);
    }
    if (term.type === 'ApplyFn') {
        return findBuiltinInApplyFn(term as ApplyFn, line, column);
    }
    return null;
}

/**
 * Search for built-in predicate in an atom.
 */
function findBuiltinInAtom(atom: Atom, line: number, column: number): Hover | null {
    // Check if this is a built-in predicate and position is on it
    if (atom.predicate.symbol.startsWith(':')) {
        if (isWithinRange(line, column, atom.range)) {
            const builtin = getBuiltinPredicate(atom.predicate.symbol);
            if (builtin) {
                return createBuiltinPredicateHover(builtin.name, builtin.doc, builtin.arity, builtin.mode);
            }
        }
    }

    // Check arguments for functions
    for (const arg of atom.args) {
        if (arg.type === 'ApplyFn') {
            const fnHover = findBuiltinInApplyFn(arg as ApplyFn, line, column);
            if (fnHover) return fnHover;
        }
    }

    return null;
}

/**
 * Search for built-in function in an ApplyFn.
 */
function findBuiltinInApplyFn(applyFn: ApplyFn, line: number, column: number): Hover | null {
    if (isWithinRange(line, column, applyFn.range)) {
        const builtin = getBuiltinFunction(applyFn.function.symbol);
        if (builtin) {
            return createBuiltinFunctionHover(builtin.name, builtin.doc, builtin.arity, builtin.isReducer);
        }
    }

    // Check nested functions
    for (const arg of applyFn.args) {
        if (arg.type === 'ApplyFn') {
            const fnHover = findBuiltinInApplyFn(arg as ApplyFn, line, column);
            if (fnHover) return fnHover;
        }
    }

    return null;
}

/**
 * Create hover for a built-in predicate.
 */
function createBuiltinPredicateHover(
    name: string,
    doc: string,
    arity: number,
    mode: string[]
): Hover {
    const lines: string[] = [];

    lines.push(`**Built-in Predicate: ${name}/${arity}**`);
    lines.push('');
    lines.push(doc);
    lines.push('');
    lines.push(`*Mode: (${mode.join(', ')})*`);

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: lines.join('\n'),
        },
    };
}

/**
 * Create hover for a built-in function.
 */
function createBuiltinFunctionHover(
    name: string,
    doc: string,
    arity: number,
    isReducer: boolean
): Hover {
    const lines: string[] = [];

    const arityStr = arity === -1 ? 'variadic' : `${arity}`;
    lines.push(`**Built-in Function: ${name}** (${arityStr})`);
    lines.push('');
    lines.push(doc);
    if (isReducer) {
        lines.push('');
        lines.push('*This is a reducer function (used in aggregations)*');
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: lines.join('\n'),
        },
    };
}

/**
 * Check if a position is within a range.
 */
function isWithinRange(line: number, column: number, range: SourceRange): boolean {
    if (line < range.start.line || line > range.end.line) {
        return false;
    }
    if (line === range.start.line && column < range.start.column) {
        return false;
    }
    if (line === range.end.line && column >= range.end.column) {
        return false;
    }
    return true;
}
