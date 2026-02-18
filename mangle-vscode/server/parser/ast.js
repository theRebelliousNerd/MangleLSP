"use strict";
/**
 * AST type definitions for Mangle with source location tracking.
 *
 * Ported from upstream Go implementation (ast/ast.go) with extensions
 * for LSP support (SourceRange on all nodes).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESCRIPTORS = exports.TYPE_BOUNDS = exports.COMPARISON_PREDICATES = void 0;
exports.pointRange = pointRange;
exports.spanRange = spanRange;
exports.containsPosition = containsPosition;
exports.mergeRanges = mergeRanges;
exports.createName = createName;
exports.createString = createString;
exports.createBytes = createBytes;
exports.createNumber = createNumber;
exports.createFloat64 = createFloat64;
exports.createTime = createTime;
exports.createDuration = createDuration;
exports.createList = createList;
exports.createVariable = createVariable;
exports.createPredicateSym = createPredicateSym;
exports.createFunctionSym = createFunctionSym;
exports.createAtom = createAtom;
exports.createNegAtom = createNegAtom;
exports.createEq = createEq;
exports.createIneq = createIneq;
exports.createApplyFn = createApplyFn;
exports.createClause = createClause;
exports.createDecl = createDecl;
exports.isBuiltinPredicate = isBuiltinPredicate;
exports.isFunction = isFunction;
exports.predicateKey = predicateKey;
exports.functionKey = functionKey;
exports.isVariable = isVariable;
exports.isConstant = isConstant;
exports.isAtom = isAtom;
exports.isNegAtom = isNegAtom;
exports.isApplyFn = isApplyFn;
exports.isTemporalLiteral = isTemporalLiteral;
exports.isTemporalAtom = isTemporalAtom;
exports.isEternalInterval = isEternalInterval;
exports.isDeclExternal = isDeclExternal;
exports.isDeclTemporal = isDeclTemporal;
exports.isDeclMaybeTemporal = isDeclMaybeTemporal;
exports.getDeclModes = getDeclModes;
exports.isComparisonAtom = isComparisonAtom;
exports.isLtAtom = isLtAtom;
exports.isLeAtom = isLeAtom;
exports.isGtAtom = isGtAtom;
exports.isGeAtom = isGeAtom;
exports.collectVariables = collectVariables;
exports.collectClauseVariables = collectClauseVariables;
exports.termToString = termToString;
exports.clauseToString = clauseToString;
exports.temporalBoundToString = temporalBoundToString;
exports.temporalIntervalToString = temporalIntervalToString;
exports.temporalOperatorToString = temporalOperatorToString;
/**
 * Create a zero-width range at a position.
 */
function pointRange(pos) {
    return { start: pos, end: pos };
}
/**
 * Create a range spanning from start to end.
 */
function spanRange(start, end) {
    return { start, end };
}
/**
 * Check if a position is contained within a range.
 */
function containsPosition(range, pos) {
    if (pos.line < range.start.line || pos.line > range.end.line)
        return false;
    if (pos.line === range.start.line && pos.column < range.start.column)
        return false;
    if (pos.line === range.end.line && pos.column >= range.end.column)
        return false;
    return true;
}
/**
 * Merge two ranges into a range spanning both.
 * Uses line/column comparison instead of offset to handle cases where offset may be 0.
 */
function mergeRanges(a, b) {
    // Compare by line/column instead of offset
    let start;
    if (a.start.line < b.start.line ||
        (a.start.line === b.start.line && a.start.column <= b.start.column)) {
        start = a.start;
    }
    else {
        start = b.start;
    }
    let end;
    if (a.end.line > b.end.line ||
        (a.end.line === b.end.line && a.end.column >= b.end.column)) {
        end = a.end;
    }
    else {
        end = b.end;
    }
    return { start, end };
}
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a name constant.
 */
function createName(symbol, range) {
    if (!symbol.startsWith('/')) {
        throw new Error(`Name constant must start with '/': ${symbol}`);
    }
    return { type: 'Constant', constantType: 'name', symbol, range };
}
/**
 * Create a string constant.
 */
function createString(value, range) {
    return { type: 'Constant', constantType: 'string', symbol: value, range };
}
/**
 * Create a bytes constant.
 */
function createBytes(value, range) {
    return { type: 'Constant', constantType: 'bytes', symbol: value, range };
}
/**
 * Create a number constant.
 */
function createNumber(value, range) {
    return { type: 'Constant', constantType: 'number', numValue: value, range };
}
/**
 * Create a float64 constant.
 */
function createFloat64(value, range) {
    return { type: 'Constant', constantType: 'float64', floatValue: value, range };
}
/**
 * Create a time constant (nanoseconds since Unix epoch).
 */
function createTime(nanos, range) {
    return { type: 'Constant', constantType: 'time', numValue: nanos, range };
}
/**
 * Create a duration constant (nanoseconds).
 */
function createDuration(nanos, range) {
    return { type: 'Constant', constantType: 'duration', numValue: nanos, range };
}
/**
 * Create a list constant.
 */
function createList(items, range) {
    if (items.length === 0) {
        return { type: 'Constant', constantType: 'list', range };
    }
    // Build cons-list from end
    let result = { type: 'Constant', constantType: 'list', range };
    for (let i = items.length - 1; i >= 0; i--) {
        result = { type: 'Constant', constantType: 'list', fst: items[i], snd: result, range };
    }
    return result;
}
/**
 * Create a variable.
 */
function createVariable(symbol, range) {
    return { type: 'Variable', symbol, range };
}
/**
 * Create a predicate symbol.
 */
function createPredicateSym(symbol, arity) {
    return { symbol, arity };
}
/**
 * Create a function symbol.
 */
function createFunctionSym(symbol, arity) {
    return { symbol, arity };
}
/**
 * Create an atom.
 */
function createAtom(predicate, args, range) {
    return { type: 'Atom', predicate, args, range };
}
/**
 * Create a negated atom.
 */
function createNegAtom(atom, range) {
    return { type: 'NegAtom', atom, range };
}
/**
 * Create an equality.
 */
function createEq(left, right, range) {
    return { type: 'Eq', left, right, range };
}
/**
 * Create an inequality.
 */
function createIneq(left, right, range) {
    return { type: 'Ineq', left, right, range };
}
/**
 * Create a function application.
 */
function createApplyFn(fn, args, range) {
    return { type: 'ApplyFn', function: fn, args, range };
}
/**
 * Create a clause.
 */
function createClause(head, premises, transform, range, headTime = null) {
    return { type: 'Clause', head, premises, transform, headTime, range };
}
/**
 * Create a declaration.
 */
function createDecl(declaredAtom, descr, bounds, constraints, range) {
    return { type: 'Decl', declaredAtom, descr, bounds, constraints, range };
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Check if a predicate symbol is a built-in (starts with ':').
 */
function isBuiltinPredicate(sym) {
    return sym.symbol.startsWith(':');
}
/**
 * Check if a function symbol is a function (starts with 'fn:').
 */
function isFunction(sym) {
    return sym.symbol.startsWith('fn:');
}
/**
 * Get a unique key for a predicate symbol (for use in maps).
 */
function predicateKey(sym) {
    return `${sym.symbol}/${sym.arity}`;
}
/**
 * Get a unique key for a function symbol (for use in maps).
 */
function functionKey(sym) {
    return `${sym.symbol}/${sym.arity}`;
}
/**
 * Check if a term is a variable.
 */
function isVariable(term) {
    return 'type' in term && term.type === 'Variable';
}
/**
 * Check if a term is a constant.
 */
function isConstant(term) {
    return 'type' in term && term.type === 'Constant';
}
/**
 * Check if a term is an atom.
 */
function isAtom(term) {
    return 'type' in term && term.type === 'Atom';
}
/**
 * Check if a term is a negated atom.
 */
function isNegAtom(term) {
    return 'type' in term && term.type === 'NegAtom';
}
/**
 * Check if a term is a function application.
 */
function isApplyFn(term) {
    return 'type' in term && term.type === 'ApplyFn';
}
/**
 * Check if a term is a temporal literal.
 */
function isTemporalLiteral(term) {
    return 'type' in term && term.type === 'TemporalLiteral';
}
/**
 * Check if a term is a temporal atom.
 */
function isTemporalAtom(term) {
    return 'type' in term && term.type === 'TemporalAtom';
}
/**
 * Check if a temporal interval is "eternal" (unbounded past to unbounded future).
 * Matches upstream Go Interval.IsEternal().
 */
function isEternalInterval(interval) {
    return interval.start.boundType === 'negativeInfinity' &&
        interval.end.boundType === 'positiveInfinity';
}
/**
 * Check if a declaration has the external() descriptor.
 */
function isDeclExternal(decl) {
    return decl.descr?.some(d => d.predicate.symbol === exports.DESCRIPTORS.EXTERNAL) ?? false;
}
/**
 * Check if a declaration has the temporal() descriptor.
 */
function isDeclTemporal(decl) {
    return decl.descr?.some(d => d.predicate.symbol === exports.DESCRIPTORS.TEMPORAL) ?? false;
}
/**
 * Check if a declaration has the internal:maybe_temporal() descriptor.
 */
function isDeclMaybeTemporal(decl) {
    return decl.descr?.some(d => d.predicate.symbol === exports.DESCRIPTORS.MAYBE_TEMPORAL) ?? false;
}
/**
 * Get modes from a declaration's descriptor atoms.
 */
function getDeclModes(decl) {
    return decl.descr?.filter(d => d.predicate.symbol === exports.DESCRIPTORS.MODE) ?? [];
}
/**
 * Comparison builtin predicate symbols.
 */
exports.COMPARISON_PREDICATES = [':lt', ':le', ':gt', ':ge'];
// ============================================================================
// Type Bound Constants (upstream ast.go)
// ============================================================================
/** Well-known type bound name constants matching upstream. */
exports.TYPE_BOUNDS = {
    ANY: '/any',
    BOT: '/bot',
    NUMBER: '/number',
    FLOAT64: '/float64',
    STRING: '/string',
    BYTES: '/bytes',
    NAME: '/name',
    TIME: '/time',
    DURATION: '/duration',
    BOOL: '/bool',
};
// ============================================================================
// Descriptor Constants (upstream decl.go)
// ============================================================================
/** Well-known descriptor names matching upstream decl.go constants. */
exports.DESCRIPTORS = {
    EXTERNAL: 'external',
    EXTENSIONAL: 'extensional',
    MODE: 'mode',
    REFLECTS: 'reflects',
    SYNTHETIC: 'synthetic',
    PRIVATE: 'private',
    DOC: 'doc',
    ARG: 'arg',
    NAME: 'name',
    DESUGARED: 'desugared',
    FUNDEP: 'fundep',
    MERGE_PREDICATE: 'merge',
    DEFERRED_PREDICATE: 'deferred',
    TEMPORAL: 'temporal',
    MAYBE_TEMPORAL: 'internal:maybe_temporal',
};
/**
 * Check if an atom is a comparison builtin (:lt, :le, :gt, :ge).
 * These are now generated by the parser for <, <=, >, >= operators.
 */
function isComparisonAtom(term) {
    return isAtom(term) && exports.COMPARISON_PREDICATES.includes(term.predicate.symbol);
}
/**
 * Check if an atom is a less-than comparison (:lt).
 */
function isLtAtom(term) {
    return isAtom(term) && term.predicate.symbol === ':lt';
}
/**
 * Check if an atom is a less-than-or-equal comparison (:le).
 */
function isLeAtom(term) {
    return isAtom(term) && term.predicate.symbol === ':le';
}
/**
 * Check if an atom is a greater-than comparison (:gt).
 */
function isGtAtom(term) {
    return isAtom(term) && term.predicate.symbol === ':gt';
}
/**
 * Check if an atom is a greater-than-or-equal comparison (:ge).
 */
function isGeAtom(term) {
    return isAtom(term) && term.predicate.symbol === ':ge';
}
/**
 * Collect all variables from a term.
 */
function collectVariables(term) {
    const vars = new Set();
    function visit(t) {
        if (isVariable(t)) {
            vars.add(t.symbol);
        }
        else if (isAtom(t)) {
            t.args.forEach(visit);
        }
        else if (isNegAtom(t)) {
            visit(t.atom);
        }
        else if (isTemporalLiteral(t)) {
            visit(t.literal);
            // Collect variables from interval bounds
            if (t.interval) {
                if (t.interval.start.variable)
                    vars.add(t.interval.start.variable.symbol);
                if (t.interval.end.variable)
                    vars.add(t.interval.end.variable.symbol);
            }
        }
        else if (isApplyFn(t)) {
            t.args.forEach(visit);
        }
        else if ('left' in t && 'right' in t) {
            // Eq, Ineq, Lt, Le, Gt, Ge
            visit(t.left);
            visit(t.right);
        }
    }
    visit(term);
    return vars;
}
/**
 * Collect all variables from a clause.
 */
function collectClauseVariables(clause) {
    const vars = new Set();
    // Head variables
    clause.head.args.forEach(arg => {
        for (const v of collectVariables(arg)) {
            vars.add(v);
        }
    });
    // HeadTime variables (DatalogMTL)
    if (clause.headTime) {
        if (clause.headTime.start.variable)
            vars.add(clause.headTime.start.variable.symbol);
        if (clause.headTime.end.variable)
            vars.add(clause.headTime.end.variable.symbol);
    }
    // Premise variables
    if (clause.premises) {
        clause.premises.forEach(premise => {
            for (const v of collectVariables(premise)) {
                vars.add(v);
            }
        });
    }
    // Transform variables
    if (clause.transform) {
        let transform = clause.transform;
        while (transform) {
            for (const stmt of transform.statements) {
                if (stmt.variable) {
                    vars.add(stmt.variable.symbol);
                }
                for (const v of collectVariables(stmt.fn)) {
                    vars.add(v);
                }
            }
            transform = transform.next;
        }
    }
    return vars;
}
/**
 * Get string representation of a term (for debugging/display).
 */
function termToString(term) {
    if (isConstant(term)) {
        switch (term.constantType) {
            case 'name':
                return term.symbol ?? '';
            case 'string':
                return `"${term.symbol ?? ''}"`;
            case 'bytes':
                return `b"${term.symbol ?? ''}"`;
            case 'number':
                return String(term.numValue ?? 0);
            case 'float64':
                return String(term.floatValue ?? 0);
            case 'time':
                return `time(${term.numValue ?? 0})`;
            case 'duration':
                return `duration(${term.numValue ?? 0})`;
            case 'list':
                if (!term.fst)
                    return '[]';
                // Collect list elements
                const elements = [];
                let current = term;
                while (current && current.fst) {
                    elements.push(termToString(current.fst));
                    current = current.snd;
                }
                return `[${elements.join(', ')}]`;
            case 'map':
            case 'struct':
                // Complex types - simplified representation
                return term.constantType === 'map' ? '[...]' : '{...}';
            case 'pair':
                return `fn:pair(${term.fst ? termToString(term.fst) : ''}, ${term.snd ? termToString(term.snd) : ''})`;
        }
    }
    if (isVariable(term)) {
        return term.symbol;
    }
    if (isAtom(term)) {
        const args = term.args.map(termToString).join(', ');
        return `${term.predicate.symbol}(${args})`;
    }
    if (isNegAtom(term)) {
        return `!${termToString(term.atom)}`;
    }
    if (isTemporalLiteral(term)) {
        let result = '';
        if (term.operator) {
            result += temporalOperatorToString(term.operator) + ' ';
        }
        result += termToString(term.literal);
        if (term.interval && !isEternalInterval(term.interval)) {
            result += temporalIntervalToString(term.interval);
        }
        return result;
    }
    if (isTemporalAtom(term)) {
        let result = termToString(term.atom);
        if (term.interval && !isEternalInterval(term.interval)) {
            result += temporalIntervalToString(term.interval);
        }
        return result;
    }
    if (isApplyFn(term)) {
        const args = term.args.map(termToString).join(', ');
        return `${term.function.symbol}(${args})`;
    }
    if ('left' in term && 'right' in term) {
        const left = termToString(term.left);
        const right = termToString(term.right);
        switch (term.type) {
            case 'Eq': return `${left} = ${right}`;
            case 'Ineq': return `${left} != ${right}`;
            case 'Lt': return `${left} < ${right}`;
            case 'Le': return `${left} <= ${right}`;
            case 'Gt': return `${left} > ${right}`;
            case 'Ge': return `${left} >= ${right}`;
        }
    }
    return '?';
}
/**
 * Get string representation of a clause.
 */
function clauseToString(clause) {
    let head = termToString(clause.head);
    // Append temporal annotation on head if present
    if (clause.headTime && !isEternalInterval(clause.headTime)) {
        head += temporalIntervalToString(clause.headTime);
    }
    if (!clause.premises) {
        return `${head}.`;
    }
    const premises = clause.premises.map(termToString).join(', ');
    if (!clause.transform) {
        return `${head} :- ${premises}.`;
    }
    // Transform string
    const transformParts = [];
    let transform = clause.transform;
    while (transform) {
        const stmts = transform.statements.map(stmt => {
            if (stmt.variable) {
                return `let ${stmt.variable.symbol} = ${termToString(stmt.fn)}`;
            }
            else {
                return `do ${termToString(stmt.fn)}`;
            }
        }).join(', ');
        transformParts.push(stmts);
        transform = transform.next;
    }
    return `${head} :- ${premises} |> ${transformParts.join(' |> ')}.`;
}
// ============================================================================
// Temporal String Helpers
// ============================================================================
/**
 * Map temporal operator type to its syntax symbol.
 */
const TEMPORAL_OP_SYMBOLS = {
    'diamondMinus': '<-',
    'diamondPlus': '<+',
    'boxMinus': '[-',
    'boxPlus': '[+',
};
/**
 * Format a temporal bound to string.
 * Matches upstream Go TemporalBound.String().
 */
function temporalBoundToString(bound) {
    switch (bound.boundType) {
        case 'variable':
            return bound.variable?.symbol ?? '_';
        case 'negativeInfinity':
        case 'positiveInfinity':
            return '_';
        case 'now':
            return 'now';
        case 'timestamp':
            if (bound.rawText)
                return bound.rawText;
            // Format nanos as ISO 8601 if possible
            if (bound.value !== undefined) {
                const ms = bound.value / 1000000;
                return new Date(ms).toISOString();
            }
            return '?';
        case 'duration':
            if (bound.rawText)
                return bound.rawText;
            if (bound.value !== undefined) {
                return formatDurationNanos(bound.value);
            }
            return '?';
        default:
            return '?';
    }
}
/**
 * Format nanosecond duration to human-readable string.
 */
function formatDurationNanos(nanos) {
    const ms = 1000000;
    const sec = 1000000000;
    const min = sec * 60;
    const hour = min * 60;
    const day = hour * 24;
    if (nanos === 0)
        return '0s';
    if (nanos % day === 0)
        return `${nanos / day}d`;
    if (nanos % hour === 0)
        return `${nanos / hour}h`;
    if (nanos % min === 0)
        return `${nanos / min}m`;
    if (nanos % sec === 0)
        return `${nanos / sec}s`;
    if (nanos % ms === 0)
        return `${nanos / ms}ms`;
    return `${nanos}ns`;
}
/**
 * Format a temporal interval to string (the @[start, end] annotation).
 * Matches upstream Go Interval.String().
 */
function temporalIntervalToString(interval) {
    if (isEternalInterval(interval))
        return '';
    const startStr = temporalBoundToString(interval.start);
    const endStr = temporalBoundToString(interval.end);
    // Point interval: start == end => @[T]
    if (startStr === endStr) {
        return `@[${startStr}]`;
    }
    return `@[${startStr}, ${endStr}]`;
}
/**
 * Format a temporal operator to string (e.g., <-[0, 5d]).
 * Matches upstream Go TemporalOperator.String().
 */
function temporalOperatorToString(op) {
    const symbol = TEMPORAL_OP_SYMBOLS[op.operatorType];
    if (op.interval) {
        const startStr = temporalBoundToString(op.interval.start);
        const endStr = temporalBoundToString(op.interval.end);
        return `${symbol}[${startStr}, ${endStr}]`;
    }
    return symbol;
}
//# sourceMappingURL=ast.js.map