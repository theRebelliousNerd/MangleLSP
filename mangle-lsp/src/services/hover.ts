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
import { isWithinSourceRange } from '../utils/position';

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
    // IMPORTANT: Check more specific items FIRST (variables), then less specific (predicates)
    // This ensures hovering on a variable argument inside an atom returns the variable,
    // not the containing predicate.

    // Check variables FIRST (most specific - can be inside predicates)
    const varInfo = symbolTable.findVariableAt(line, column);
    if (varInfo) {
        return createVariableHover(varInfo);
    }

    // Check built-in predicates and functions by scanning the AST
    // This also needs to be before user-defined predicates since builtins
    // can have nested functions that need precise hover
    const builtinHover = findBuiltinAtPosition(unit, line, column);
    if (builtinHover) {
        return builtinHover;
    }

    // Check user-defined predicates (least specific - contains other elements)
    const predInfo = symbolTable.findPredicateAt(line, column);
    if (predInfo) {
        return createPredicateHover(predInfo);
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
    // IMPORTANT: Check arguments FIRST (most specific - nested elements)
    // This ensures hovering on a function inside an atom returns the function,
    // not the containing predicate.
    for (const arg of atom.args) {
        if (arg.type === 'ApplyFn') {
            const fnHover = findBuiltinInApplyFn(arg as ApplyFn, line, column);
            if (fnHover) return fnHover;
        }
    }

    // Check if this is a built-in predicate and position is on the predicate NAME only
    // The predicate name starts at the atom's start position and extends for the length of the name
    if (atom.predicate.symbol.startsWith(':')) {
        const predicateNameRange = calculateNameRange(atom.range, atom.predicate.symbol);
        if (isWithinSourceRange(line, column, predicateNameRange)) {
            const builtin = getBuiltinPredicate(atom.predicate.symbol);
            if (builtin) {
                return createBuiltinPredicateHover(builtin.name, builtin.doc, builtin.arity, builtin.mode);
            }
        }
    }

    return null;
}

/**
 * Search for built-in function in an ApplyFn.
 */
function findBuiltinInApplyFn(applyFn: ApplyFn, line: number, column: number): Hover | null {
    // IMPORTANT: Check nested functions FIRST (most specific)
    // For `fn:plus(fn:mult(X, 2), 3)`, hovering on `fn:mult` should return fn:mult,
    // not fn:plus. Since fn:mult's range is within fn:plus's range, we must check
    // the more specific (nested) element first.
    for (const arg of applyFn.args) {
        if (arg.type === 'ApplyFn') {
            const fnHover = findBuiltinInApplyFn(arg as ApplyFn, line, column);
            if (fnHover) return fnHover;
        }
    }

    // Now check if position is on THIS function's NAME only (not the entire expression)
    // The function name starts at the ApplyFn's start position and extends for the length of the name
    const functionNameRange = calculateNameRange(applyFn.range, applyFn.function.symbol);
    if (isWithinSourceRange(line, column, functionNameRange)) {
        const builtin = getBuiltinFunction(applyFn.function.symbol);
        if (builtin) {
            return createBuiltinFunctionHover(builtin.name, builtin.doc, builtin.arity, builtin.isReducer);
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
 * Calculate the range that covers just the function/predicate NAME,
 * not the entire expression including arguments.
 *
 * For `fn:plus(X, Y)` starting at column 5, this returns the range for "fn:plus"
 * (columns 5-12), not the entire expression (columns 5-20).
 *
 * This is critical for proper hover behavior: hovering on arguments should not
 * trigger hover for the containing function.
 */
function calculateNameRange(expressionRange: SourceRange, name: string): SourceRange {
    // The name starts at the expression's start and extends for the name's length
    return {
        start: expressionRange.start,
        end: {
            line: expressionRange.start.line,
            column: expressionRange.start.column + name.length,
            offset: expressionRange.start.offset + name.length,
        },
    };
}

