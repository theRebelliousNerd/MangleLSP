"use strict";
/**
 * Formatting provider for Mangle LSP.
 *
 * Pretty-prints Mangle source code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDocument = formatDocument;
/**
 * Format an entire document.
 */
function formatDocument(document, unit, options) {
    const formatted = formatSourceUnit(unit, options);
    // Replace entire document
    return [{
            range: {
                start: { line: 0, character: 0 },
                end: { line: document.lineCount, character: 0 },
            },
            newText: formatted,
        }];
}
/**
 * Format a source unit.
 */
function formatSourceUnit(unit, options) {
    const lines = [];
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    // Package declaration
    if (unit.packageDecl) {
        lines.push(`Package ${unit.packageDecl.name}.`);
        lines.push('');
    }
    // Use declarations
    for (const useDecl of unit.useDecls) {
        lines.push(`Use ${useDecl.name}.`);
    }
    if (unit.useDecls.length > 0) {
        lines.push('');
    }
    // Declarations
    for (const decl of unit.decls) {
        lines.push(formatDecl(decl, indent));
    }
    if (unit.decls.length > 0) {
        lines.push('');
    }
    // Group clauses by predicate for better formatting
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
    // Format each predicate group
    let isFirst = true;
    for (const [, clauses] of predicateGroups) {
        if (!isFirst) {
            lines.push('');
        }
        isFirst = false;
        for (const clause of clauses) {
            lines.push(formatClause(clause, indent));
        }
    }
    return lines.join('\n') + '\n';
}
/**
 * Format a declaration.
 */
function formatDecl(decl, indent) {
    const atom = formatAtom(decl.declaredAtom);
    let result = `Decl ${atom}`;
    // Add description atoms if present
    if (decl.descr && decl.descr.length > 0) {
        const descrParts = decl.descr.map(a => formatAtom(a));
        result += `\n${indent}descr ${descrParts.join(`,\n${indent}      `)}`;
    }
    // Add bounds if present
    if (decl.bounds && decl.bounds.length > 0) {
        const boundParts = decl.bounds.map(b => {
            const args = b.bounds.map(formatTerm).join(', ');
            return `bound(${args})`;
        });
        result += `\n${indent}bound ${boundParts.join(`,\n${indent}      `)}`;
    }
    result += '.';
    return result;
}
/**
 * Format a clause.
 */
function formatClause(clause, indent) {
    const head = formatAtom(clause.head);
    // Fact (no body)
    if (!clause.premises || clause.premises.length === 0) {
        if (clause.transform) {
            return `${head} |> ${formatTransform(clause.transform, indent)}.`;
        }
        return `${head}.`;
    }
    // Rule with body
    const premises = clause.premises.map(formatTerm);
    // Format based on length
    const singleLine = `${head} :- ${premises.join(', ')}`;
    if (singleLine.length <= 80 && !clause.transform) {
        return `${singleLine}.`;
    }
    // Multi-line format
    let result = `${head} :-\n`;
    for (let i = 0; i < premises.length; i++) {
        const isLast = i === premises.length - 1;
        result += `${indent}${premises[i]}${isLast ? '' : ','}\n`;
    }
    // Add transform if present
    if (clause.transform) {
        result += `${indent}|> ${formatTransform(clause.transform, indent)}`;
    }
    result = result.trimEnd() + '.';
    return result;
}
/**
 * Format an atom.
 */
function formatAtom(atom) {
    const pred = atom.predicate.symbol;
    if (atom.args.length === 0) {
        return pred;
    }
    const args = atom.args.map(formatTerm).join(', ');
    return `${pred}(${args})`;
}
/**
 * Format a term.
 */
function formatTerm(term) {
    switch (term.type) {
        case 'Variable':
            return term.symbol;
        case 'Constant': {
            const c = term;
            switch (c.constantType) {
                case 'name':
                    return c.symbol ?? '';
                case 'string':
                    return `"${escapeString(c.symbol ?? '')}"`;
                case 'bytes':
                    return `b"${escapeString(c.symbol ?? '')}"`;
                case 'number':
                    return (c.numValue ?? 0).toString();
                case 'float64':
                    return (c.floatValue ?? 0).toString();
                case 'list': {
                    // Lists are cons-cells: fst is head, snd is tail
                    if (!c.fst) {
                        return '[]';
                    }
                    const elements = [];
                    let current = c;
                    while (current && current.fst) {
                        elements.push(formatTerm(current.fst));
                        current = current.snd;
                    }
                    return `[${elements.join(', ')}]`;
                }
                case 'map':
                case 'struct': {
                    // Maps and structs are also cons-based
                    // For simplicity, use a placeholder since these are complex
                    if (!c.fst) {
                        return c.constantType === 'map' ? '[]' : '{}';
                    }
                    return c.constantType === 'map' ? '[...]' : '{...}';
                }
                case 'pair': {
                    const fstStr = c.fst ? formatTerm(c.fst) : '';
                    const sndStr = c.snd ? formatTerm(c.snd) : '';
                    return `fn:pair(${fstStr}, ${sndStr})`;
                }
                default:
                    return c.symbol ?? '';
            }
        }
        case 'ApplyFn': {
            const fn = term;
            const fnName = fn.function.symbol;
            const args = fn.args.map(formatTerm).join(', ');
            return `${fnName}(${args})`;
        }
        case 'Atom':
            return formatAtom(term);
        case 'NegAtom': {
            const neg = term;
            return `!${formatAtom(neg.atom)}`;
        }
        case 'Eq': {
            const eq = term;
            return `${formatTerm(eq.left)} = ${formatTerm(eq.right)}`;
        }
        case 'Ineq': {
            const ineq = term;
            return `${formatTerm(ineq.left)} != ${formatTerm(ineq.right)}`;
        }
        case 'Lt': {
            const lt = term;
            return `${formatTerm(lt.left)} < ${formatTerm(lt.right)}`;
        }
        case 'Le': {
            const le = term;
            return `${formatTerm(le.left)} <= ${formatTerm(le.right)}`;
        }
        case 'Gt': {
            const gt = term;
            return `${formatTerm(gt.left)} > ${formatTerm(gt.right)}`;
        }
        case 'Ge': {
            const ge = term;
            return `${formatTerm(ge.left)} >= ${formatTerm(ge.right)}`;
        }
        default:
            return '';
    }
}
/**
 * Format a transform.
 */
function formatTransform(transform, indent) {
    const parts = [];
    let current = transform;
    while (current) {
        for (const stmt of current.statements) {
            parts.push(formatTransformStmt(stmt));
        }
        current = current.next;
    }
    return parts.join(', ');
}
/**
 * Format a transform statement.
 */
function formatTransformStmt(stmt) {
    const fn = formatApplyFn(stmt.fn);
    if (stmt.variable === null) {
        return `do ${fn}`;
    }
    return `let ${stmt.variable.symbol} = ${fn}`;
}
/**
 * Format an ApplyFn.
 */
function formatApplyFn(fn) {
    const fnName = fn.function.symbol;
    const args = fn.args.map(formatTerm).join(', ');
    return `${fnName}(${args})`;
}
/**
 * Escape special characters in a string.
 */
function escapeString(s) {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
//# sourceMappingURL=formatting.js.map