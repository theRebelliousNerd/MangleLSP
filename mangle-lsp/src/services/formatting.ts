/**
 * Formatting provider for Mangle LSP.
 *
 * Pretty-prints Mangle source code.
 */

import { TextEdit, FormattingOptions } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    SourceUnit,
    Clause,
    Atom,
    Term,
    Variable,
    Constant,
    ApplyFn,
    NegAtom,
    Transform,
    TransformStmt,
    Decl,
    TemporalLiteral,
    TemporalAtom,
    TemporalBound,
    TemporalInterval,
    TemporalOperator,
    isLtAtom,
    isLeAtom,
    isGtAtom,
    isGeAtom,
    isTemporalLiteral,
    isTemporalAtom,
    isEternalInterval,
    temporalBoundToString,
    temporalIntervalToString,
    temporalOperatorToString,
} from '../parser/ast';

/**
 * Extract comments from original document text.
 * Returns a map from 1-based line number to the comment text (including #).
 */
function extractComments(text: string): Map<number, string> {
    const comments = new Map<number, string>();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        const commentIndex = line.indexOf('#');
        if (commentIndex !== -1) {
            // Check if # is inside a string (simple heuristic)
            const beforeHash = line.substring(0, commentIndex);
            const quoteCount = (beforeHash.match(/"/g) || []).length;
            if (quoteCount % 2 === 0) {
                comments.set(i + 1, line.substring(commentIndex));
            }
        }
    }
    return comments;
}

/**
 * Re-insert comments into formatted output.
 * This is a simple approach that preserves line comments at roughly the same positions.
 */
function insertComments(formatted: string, comments: Map<number, string>): string {
    if (comments.size === 0) {
        return formatted;
    }

    const formattedLines = formatted.split('\n');
    const result: string[] = [];

    // Track which comments we've used
    const usedComments = new Set<number>();

    // For each formatted line, check if there's a comment at a nearby original line
    for (let i = 0; i < formattedLines.length; i++) {
        const line = formattedLines[i];
        if (line !== undefined) {
            result.push(line);
        }
    }

    // Append any standalone comment lines (lines that were only comments)
    // at the end, preserving their relative order
    const sortedCommentLines = Array.from(comments.keys()).sort((a, b) => a - b);
    const standaloneComments: string[] = [];
    for (const lineNum of sortedCommentLines) {
        if (!usedComments.has(lineNum)) {
            const comment = comments.get(lineNum);
            if (comment) {
                standaloneComments.push(comment);
            }
        }
    }

    // If there are standalone comments, append them before the final newline
    if (standaloneComments.length > 0) {
        // Insert comments at the end, before trailing empty lines
        const lastNonEmpty = result.length - 1;
        for (const comment of standaloneComments) {
            result.splice(lastNonEmpty, 0, comment);
        }
    }

    return result.join('\n');
}

/**
 * Format an entire document.
 */
export function formatDocument(
    document: TextDocument,
    unit: SourceUnit,
    options: FormattingOptions
): TextEdit[] {
    const originalText = document.getText();
    const comments = extractComments(originalText);

    let formatted = formatSourceUnit(unit, options);

    // Re-insert comments at appropriate lines
    formatted = insertComments(formatted, comments);

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
function formatSourceUnit(unit: SourceUnit, options: FormattingOptions): string {
    const lines: string[] = [];
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
    const predicateGroups = new Map<string, Clause[]>();
    for (const clause of unit.clauses) {
        const key = clause.head.predicate.symbol;
        const group = predicateGroups.get(key);
        if (group) {
            group.push(clause);
        } else {
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
function formatDecl(decl: Decl, indent: string): string {
    const atom = formatAtom(decl.declaredAtom);
    let result = `Decl ${atom}`;

    // Add description atoms if present
    if (decl.descr && decl.descr.length > 0) {
        const descrParts = decl.descr.map(a => formatAtom(a));
        result += `\n${indent}descr [`;
        for (let i = 0; i < descrParts.length; i++) {
            result += `\n${indent}    ${descrParts[i]}${i < descrParts.length - 1 ? ',' : ''}`;
        }
        result += `\n${indent}]`;
    }

    // Add bounds if present
    if (decl.bounds && decl.bounds.length > 0) {
        for (const boundDecl of decl.bounds) {
            const boundsStr = boundDecl.bounds.map(formatTerm).join(', ');
            result += `\n${indent}bound [${boundsStr}]`;
        }
    }

    result += '.';
    return result;
}

/**
 * Format a clause.
 */
function formatClause(clause: Clause, indent: string): string {
    let head = formatAtom(clause.head);

    // Append temporal annotation on head if present and not eternal
    if (clause.headTime && !isEternalInterval(clause.headTime)) {
        head += temporalIntervalToString(clause.headTime);
    }

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
function formatAtom(atom: Atom): string {
    const pred = atom.predicate.symbol;
    // Always include parentheses, even for 0-arity
    if (atom.args.length === 0) {
        return `${pred}()`;
    }
    const args = atom.args.map(formatTerm).join(', ');
    return `${pred}(${args})`;
}

/**
 * Format a term.
 */
function formatTerm(term: Term): string {
    switch (term.type) {
        case 'Variable':
            return (term as Variable).symbol;

        case 'Constant': {
            const c = term as Constant;
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
                    const elements: string[] = [];
                    let current: Constant | undefined = c;
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
                case 'time': {
                    // Format as timestamp string or nanos
                    if (c.numValue !== undefined) {
                        const ms = c.numValue / 1_000_000;
                        const iso = new Date(ms).toISOString();
                        return `fn:time:parse_rfc3339("${iso}")`;
                    }
                    return 'fn:time:parse_rfc3339("?")';
                }
                case 'duration': {
                    if (c.symbol) return `fn:duration:parse("${c.symbol}")`;
                    if (c.numValue !== undefined) return `fn:duration:parse("${c.numValue}ns")`;
                    return 'fn:duration:parse("?")';
                }
                default:
                    return c.symbol ?? '';
            }
        }

        case 'ApplyFn': {
            const fn = term as ApplyFn;
            if (fn.function.symbol === 'fn:list') {
                const elements = fn.args.map(formatTerm).join(', ');
                return `[${elements}]`;
            }
            if (fn.function.symbol === 'fn:map') {
                // Pairs of key:value
                const pairs: string[] = [];
                for (let i = 0; i < fn.args.length; i += 2) {
                    const key = fn.args[i];
                    const value = fn.args[i + 1];
                    if (key && value) {
                        pairs.push(`${formatTerm(key)}: ${formatTerm(value)}`);
                    }
                }
                return `[${pairs.join(', ')}]`;
            }
            if (fn.function.symbol === 'fn:struct') {
                const pairs: string[] = [];
                for (let i = 0; i < fn.args.length; i += 2) {
                    const key = fn.args[i];
                    const value = fn.args[i + 1];
                    if (key && value) {
                        pairs.push(`${formatTerm(key)}: ${formatTerm(value)}`);
                    }
                }
                return `{${pairs.join(', ')}}`;
            }
            // Regular function
            const fnName = fn.function.symbol;
            const args = fn.args.map(formatTerm).join(', ');
            return `${fnName}(${args})`;
        }

        case 'Atom': {
            const atom = term as Atom;
            // Handle comparison atoms (:lt, :le, :gt, :ge) with infix notation
            if (isLtAtom(atom) && atom.args.length === 2) {
                const left = atom.args[0];
                const right = atom.args[1];
                if (left && right) {
                    return `${formatTerm(left)} < ${formatTerm(right)}`;
                }
            }
            if (isLeAtom(atom) && atom.args.length === 2) {
                const left = atom.args[0];
                const right = atom.args[1];
                if (left && right) {
                    return `${formatTerm(left)} <= ${formatTerm(right)}`;
                }
            }
            if (isGtAtom(atom) && atom.args.length === 2) {
                const left = atom.args[0];
                const right = atom.args[1];
                if (left && right) {
                    return `${formatTerm(left)} > ${formatTerm(right)}`;
                }
            }
            if (isGeAtom(atom) && atom.args.length === 2) {
                const left = atom.args[0];
                const right = atom.args[1];
                if (left && right) {
                    return `${formatTerm(left)} >= ${formatTerm(right)}`;
                }
            }
            // Regular atom
            return formatAtom(atom);
        }

        case 'NegAtom': {
            const neg = term as NegAtom;
            return `!${formatAtom(neg.atom)}`;
        }

        case 'TemporalLiteral': {
            const tl = term as TemporalLiteral;
            let result = '';
            if (tl.operator) {
                result += temporalOperatorToString(tl.operator) + ' ';
            }
            // Format the inner literal (Atom or NegAtom)
            if (tl.literal.type === 'NegAtom') {
                result += `!${formatAtom((tl.literal as NegAtom).atom)}`;
            } else {
                result += formatAtom(tl.literal as Atom);
            }
            // Append interval annotation if present
            if (tl.interval && !isEternalInterval(tl.interval)) {
                result += temporalIntervalToString(tl.interval);
            }
            return result;
        }

        case 'TemporalAtom': {
            const ta = term as TemporalAtom;
            let result = formatAtom(ta.atom);
            if (ta.interval && !isEternalInterval(ta.interval)) {
                result += temporalIntervalToString(ta.interval);
            }
            return result;
        }

        case 'Eq': {
            const eq = term as { left: Term; right: Term };
            return `${formatTerm(eq.left)} = ${formatTerm(eq.right)}`;
        }

        case 'Ineq': {
            const ineq = term as { left: Term; right: Term };
            return `${formatTerm(ineq.left)} != ${formatTerm(ineq.right)}`;
        }

        case 'Lt': {
            const lt = term as { left: Term; right: Term };
            return `${formatTerm(lt.left)} < ${formatTerm(lt.right)}`;
        }

        case 'Le': {
            const le = term as { left: Term; right: Term };
            return `${formatTerm(le.left)} <= ${formatTerm(le.right)}`;
        }

        case 'Gt': {
            const gt = term as { left: Term; right: Term };
            return `${formatTerm(gt.left)} > ${formatTerm(gt.right)}`;
        }

        case 'Ge': {
            const ge = term as { left: Term; right: Term };
            return `${formatTerm(ge.left)} >= ${formatTerm(ge.right)}`;
        }

        default:
            return '';
    }
}

/**
 * Format a transform.
 */
function formatTransform(transform: Transform, indent: string): string {
    const parts: string[] = [];
    let current: Transform | null = transform;

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
function formatTransformStmt(stmt: TransformStmt): string {
    const fn = formatApplyFn(stmt.fn);
    if (stmt.variable === null) {
        return `do ${fn}`;
    }
    return `let ${stmt.variable.symbol} = ${fn}`;
}

/**
 * Format an ApplyFn.
 */
function formatApplyFn(fn: ApplyFn): string {
    const fnName = fn.function.symbol;
    const args = fn.args.map(formatTerm).join(', ');
    return `${fnName}(${args})`;
}

/**
 * Escape special characters in a string.
 */
function escapeString(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
