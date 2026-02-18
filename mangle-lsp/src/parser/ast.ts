/**
 * AST type definitions for Mangle with source location tracking.
 *
 * Ported from upstream Go implementation (ast/ast.go) with extensions
 * for LSP support (SourceRange on all nodes).
 */

// ============================================================================
// Source Location Types
// ============================================================================

/**
 * A position in a source file.
 * Line is 1-indexed (matches Mangle convention), column is 0-indexed (LSP convention).
 */
export interface SourcePosition {
    /** 1-indexed line number */
    line: number;
    /** 0-indexed column (character offset within line) */
    column: number;
    /** Character offset from start of document */
    offset: number;
}

/**
 * A range in a source file, from start (inclusive) to end (exclusive).
 */
export interface SourceRange {
    start: SourcePosition;
    end: SourcePosition;
}

/**
 * Create a zero-width range at a position.
 */
export function pointRange(pos: SourcePosition): SourceRange {
    return { start: pos, end: pos };
}

/**
 * Create a range spanning from start to end.
 */
export function spanRange(start: SourcePosition, end: SourcePosition): SourceRange {
    return { start, end };
}

/**
 * Check if a position is contained within a range.
 */
export function containsPosition(range: SourceRange, pos: SourcePosition): boolean {
    if (pos.line < range.start.line || pos.line > range.end.line) return false;
    if (pos.line === range.start.line && pos.column < range.start.column) return false;
    if (pos.line === range.end.line && pos.column >= range.end.column) return false;
    return true;
}

/**
 * Merge two ranges into a range spanning both.
 * Uses line/column comparison instead of offset to handle cases where offset may be 0.
 */
export function mergeRanges(a: SourceRange, b: SourceRange): SourceRange {
    // Compare by line/column instead of offset
    let start: SourcePosition;
    if (a.start.line < b.start.line ||
        (a.start.line === b.start.line && a.start.column <= b.start.column)) {
        start = a.start;
    } else {
        start = b.start;
    }

    let end: SourcePosition;
    if (a.end.line > b.end.line ||
        (a.end.line === b.end.line && a.end.column >= b.end.column)) {
        end = a.end;
    } else {
        end = b.end;
    }

    return { start, end };
}

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface for all AST nodes with source location.
 */
export interface LocatedNode {
    range: SourceRange;
}

/**
 * Constant type enumeration (mirrors Go ConstantType).
 */
export type ConstantType =
    | 'name'      // Name constants starting with "/" (e.g., /true, /user/admin)
    | 'string'    // Quoted strings
    | 'bytes'     // Byte strings (b"...")
    | 'number'    // int64 values
    | 'float64'   // float64 values
    | 'time'      // Time instant constants (nanoseconds since Unix epoch UTC)
    | 'duration'  // Duration constants (nanoseconds)
    | 'pair'      // (X, Y) pairs
    | 'list'      // [X, Y, Z] lists
    | 'map'       // [k1: v1, k2: v2] maps
    | 'struct';   // {field1: v1, field2: v2} structs

/**
 * A constant value in Mangle.
 */
export interface Constant extends LocatedNode {
    readonly type: 'Constant';
    readonly constantType: ConstantType;
    /** For name/string/bytes, the string value */
    readonly symbol?: string;
    /** For number, the numeric value */
    readonly numValue?: number;
    /** For float64, the numeric value */
    readonly floatValue?: number;
    /** For composite types (pair/list/map/struct), first component */
    readonly fst?: Constant;
    /** For composite types, second component (tail for lists) */
    readonly snd?: Constant;
}

/**
 * A variable in Mangle (starts with uppercase letter or underscore).
 */
export interface Variable extends LocatedNode {
    readonly type: 'Variable';
    readonly symbol: string;
}

/**
 * A predicate symbol with name and arity.
 */
export interface PredicateSym {
    readonly symbol: string;
    readonly arity: number;
}

/**
 * A function symbol with name and arity.
 * Function names always start with "fn:".
 */
export interface FunctionSym {
    readonly symbol: string;
    /** Arity, or -1 for variadic functions */
    readonly arity: number;
}

/**
 * A function application (e.g., fn:plus(X, Y)).
 */
export interface ApplyFn extends LocatedNode {
    readonly type: 'ApplyFn';
    readonly function: FunctionSym;
    readonly args: BaseTerm[];
}

/**
 * Base term types: Constant, Variable, or ApplyFn.
 */
export type BaseTerm = Constant | Variable | ApplyFn;

// ============================================================================
// Atom Types
// ============================================================================

/**
 * An atom (predicate application), e.g., parent(X, Y).
 */
export interface Atom extends LocatedNode {
    readonly type: 'Atom';
    readonly predicate: PredicateSym;
    readonly args: BaseTerm[];
}

/**
 * A negated atom, e.g., !parent(X, Y).
 */
export interface NegAtom extends LocatedNode {
    readonly type: 'NegAtom';
    readonly atom: Atom;
}

/**
 * An equality constraint, e.g., X = Y or X = /foo.
 */
export interface Eq extends LocatedNode {
    readonly type: 'Eq';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * An inequality constraint, e.g., X != Y.
 */
export interface Ineq extends LocatedNode {
    readonly type: 'Ineq';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * A comparison (less than), e.g., X < Y.
 *
 * @deprecated Comparisons are now represented as Atom nodes with builtin predicates
 * (:lt, :le, :gt, :ge) to match upstream Go behavior. The parser now generates
 * Atom nodes instead of Lt/Le/Gt/Ge nodes. This type is retained for backwards
 * compatibility with existing code that may check for these types.
 *
 * To check for a less-than comparison, use:
 *   term.type === 'Atom' && term.predicate.symbol === ':lt'
 */
export interface Lt extends LocatedNode {
    readonly type: 'Lt';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * A comparison (less than or equal), e.g., X <= Y.
 *
 * @deprecated Comparisons are now represented as Atom nodes with builtin predicates
 * (:lt, :le, :gt, :ge) to match upstream Go behavior. The parser now generates
 * Atom nodes instead of Lt/Le/Gt/Ge nodes. This type is retained for backwards
 * compatibility with existing code that may check for these types.
 *
 * To check for a less-than-or-equal comparison, use:
 *   term.type === 'Atom' && term.predicate.symbol === ':le'
 */
export interface Le extends LocatedNode {
    readonly type: 'Le';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * A comparison (greater than), e.g., X > Y.
 *
 * @deprecated Comparisons are now represented as Atom nodes with builtin predicates
 * (:lt, :le, :gt, :ge) to match upstream Go behavior. The parser now generates
 * Atom nodes instead of Lt/Le/Gt/Ge nodes. This type is retained for backwards
 * compatibility with existing code that may check for these types.
 *
 * To check for a greater-than comparison, use:
 *   term.type === 'Atom' && term.predicate.symbol === ':gt'
 */
export interface Gt extends LocatedNode {
    readonly type: 'Gt';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * A comparison (greater than or equal), e.g., X >= Y.
 *
 * @deprecated Comparisons are now represented as Atom nodes with builtin predicates
 * (:lt, :le, :gt, :ge) to match upstream Go behavior. The parser now generates
 * Atom nodes instead of Lt/Le/Gt/Ge nodes. This type is retained for backwards
 * compatibility with existing code that may check for these types.
 *
 * To check for a greater-than-or-equal comparison, use:
 *   term.type === 'Atom' && term.predicate.symbol === ':ge'
 */
export interface Ge extends LocatedNode {
    readonly type: 'Ge';
    readonly left: BaseTerm;
    readonly right: BaseTerm;
}

/**
 * All term types that can appear in clause premises.
 *
 * Note: Lt, Le, Gt, Ge are retained in this union for backwards compatibility,
 * but the parser now generates Atom nodes with :lt, :le, :gt, :ge predicates
 * for comparison operators.
 */
export type Term = BaseTerm | Atom | NegAtom | Eq | Ineq | Lt | Le | Gt | Ge | TemporalLiteral | TemporalAtom;

// ============================================================================
// Transform Types
// ============================================================================

/**
 * A single transform statement (either "do fn:..." or "let X = fn:...").
 */
export interface TransformStmt extends LocatedNode {
    /** Variable to assign result to (null for "do" statements) */
    readonly variable: Variable | null;
    /** The function application */
    readonly fn: ApplyFn;
}

/**
 * A transform (aggregation/grouping operation on a relation).
 */
export interface Transform extends LocatedNode {
    readonly statements: TransformStmt[];
    /** Chained transform (for |> composition) - mutable for building during parse */
    next: Transform | null;
}

// ============================================================================
// Temporal Types (DatalogMTL)
// ============================================================================

/**
 * Temporal operator type.
 * Matches upstream Go ast.TemporalOperatorType enum.
 */
export type TemporalOperatorType =
    | 'diamondMinus'  // <- (eventually in the past)
    | 'diamondPlus'   // <+ (eventually in the future)
    | 'boxMinus'      // [- (always in the past)
    | 'boxPlus';      // [+ (always in the future)

/**
 * Type for temporal interval bounds.
 * Matches upstream Go ast.TemporalBoundType enum (6 variants).
 */
export type TemporalBoundType =
    | 'timestamp'         // A concrete point in time (Unix nanos)
    | 'variable'          // A variable to be bound during evaluation
    | 'negativeInfinity'  // Negative infinity (unbounded past)
    | 'positiveInfinity'  // Positive infinity (unbounded future)
    | 'now'               // Current evaluation time
    | 'duration';         // A relative duration (nanoseconds)

/**
 * A temporal interval bound.
 * Matches upstream Go ast.TemporalBound struct.
 */
export interface TemporalBound extends LocatedNode {
    readonly boundType: TemporalBoundType;
    /** For timestamp bounds: Unix nanos. For duration bounds: nanos. */
    readonly value?: number;
    /** For variable bounds */
    readonly variable?: Variable;
    /** Original text from source (e.g., "2024-01-15", "7d") for display */
    readonly rawText?: string;
}

/**
 * A temporal interval [start, end].
 */
export interface TemporalInterval extends LocatedNode {
    readonly start: TemporalBound;
    readonly end: TemporalBound;
}

/**
 * A temporal operator with optional interval.
 */
export interface TemporalOperator extends LocatedNode {
    readonly operatorType: TemporalOperatorType;
    readonly interval: TemporalInterval | null;
}

/**
 * A temporal literal wrapping an atom/literal with temporal annotations.
 * Matches upstream Go ast.TemporalLiteral.
 * Used in clause premises for temporally-qualified literals.
 */
export interface TemporalLiteral extends LocatedNode {
    readonly type: 'TemporalLiteral';
    /** The inner literal (Atom or NegAtom) */
    readonly literal: Atom | NegAtom;
    /** Optional temporal operator (<-, <+, [-, [+) */
    readonly operator: TemporalOperator | null;
    /** Optional explicit interval annotation @[start, end] */
    readonly interval: TemporalInterval | null;
}

/**
 * A temporal atom: an atom with an optional temporal interval annotation.
 * Matches upstream Go ast.TemporalAtom.
 * Used in clause heads and initial facts.
 */
export interface TemporalAtom extends LocatedNode {
    readonly type: 'TemporalAtom';
    readonly atom: Atom;
    /** Temporal interval annotation (null means eternal / no annotation) */
    readonly interval: TemporalInterval | null;
}

// ============================================================================
// Clause Types
// ============================================================================

/**
 * A clause (rule or fact).
 * - Fact: head only, premises is null
 * - Rule: head with premises (and optional transform)
 */
export interface Clause extends LocatedNode {
    readonly type: 'Clause';
    readonly head: Atom;
    /** Body of the rule (null for unit clauses/facts) */
    readonly premises: Term[] | null;
    /** Optional transform (aggregation) */
    readonly transform: Transform | null;
    /** Optional temporal annotation on the head (DatalogMTL) */
    readonly headTime: TemporalInterval | null;
}

// ============================================================================
// Declaration Types
// ============================================================================

/**
 * Argument mode for built-in predicates.
 */
export type ArgMode = 'input' | 'output' | 'input_output';

/**
 * Mode declaration for a predicate.
 */
export type Mode = ArgMode[];

/**
 * A bound declaration (type constraint for an argument).
 */
export interface BoundDecl extends LocatedNode {
    readonly bounds: BaseTerm[];
}

/**
 * A declaration (Decl statement).
 */
export interface Decl extends LocatedNode {
    readonly type: 'Decl';
    /** The declared predicate */
    readonly declaredAtom: Atom;
    /** Description atoms (doc, arg, mode, etc.) */
    readonly descr: Atom[] | null;
    /** Type bounds for arguments */
    readonly bounds: BoundDecl[] | null;
    /** Inclusion constraints */
    readonly constraints: Atom[] | null;
}

// ============================================================================
// Package/Use Declarations
// ============================================================================

/**
 * A package declaration.
 */
export interface PackageDecl extends LocatedNode {
    readonly type: 'PackageDecl';
    readonly name: string;
    readonly atoms: Atom[] | null;
}

/**
 * A use declaration (import).
 */
export interface UseDecl extends LocatedNode {
    readonly type: 'UseDecl';
    readonly name: string;
    readonly atoms: Atom[] | null;
}

// ============================================================================
// Source Unit
// ============================================================================

/**
 * A complete source file (the result of parsing).
 */
export interface SourceUnit {
    /** Package declaration (optional) */
    readonly packageDecl: PackageDecl | null;
    /** Use declarations */
    readonly useDecls: UseDecl[];
    /** Predicate declarations */
    readonly decls: Decl[];
    /** Rules and facts */
    readonly clauses: Clause[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a name constant.
 */
export function createName(symbol: string, range: SourceRange): Constant {
    if (!symbol.startsWith('/')) {
        throw new Error(`Name constant must start with '/': ${symbol}`);
    }
    return { type: 'Constant', constantType: 'name', symbol, range };
}

/**
 * Create a string constant.
 */
export function createString(value: string, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'string', symbol: value, range };
}

/**
 * Create a bytes constant.
 */
export function createBytes(value: string, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'bytes', symbol: value, range };
}

/**
 * Create a number constant.
 */
export function createNumber(value: number, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'number', numValue: value, range };
}

/**
 * Create a float64 constant.
 */
export function createFloat64(value: number, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'float64', floatValue: value, range };
}

/**
 * Create a time constant (nanoseconds since Unix epoch).
 */
export function createTime(nanos: number, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'time', numValue: nanos, range };
}

/**
 * Create a duration constant (nanoseconds).
 */
export function createDuration(nanos: number, range: SourceRange): Constant {
    return { type: 'Constant', constantType: 'duration', numValue: nanos, range };
}

/**
 * Create a list constant.
 */
export function createList(items: Constant[], range: SourceRange): Constant {
    if (items.length === 0) {
        return { type: 'Constant', constantType: 'list', range };
    }
    // Build cons-list from end
    let result: Constant = { type: 'Constant', constantType: 'list', range };
    for (let i = items.length - 1; i >= 0; i--) {
        result = { type: 'Constant', constantType: 'list', fst: items[i], snd: result, range };
    }
    return result;
}

/**
 * Create a variable.
 */
export function createVariable(symbol: string, range: SourceRange): Variable {
    return { type: 'Variable', symbol, range };
}

/**
 * Create a predicate symbol.
 */
export function createPredicateSym(symbol: string, arity: number): PredicateSym {
    return { symbol, arity };
}

/**
 * Create a function symbol.
 */
export function createFunctionSym(symbol: string, arity: number): FunctionSym {
    return { symbol, arity };
}

/**
 * Create an atom.
 */
export function createAtom(predicate: PredicateSym, args: BaseTerm[], range: SourceRange): Atom {
    return { type: 'Atom', predicate, args, range };
}

/**
 * Create a negated atom.
 */
export function createNegAtom(atom: Atom, range: SourceRange): NegAtom {
    return { type: 'NegAtom', atom, range };
}

/**
 * Create an equality.
 */
export function createEq(left: BaseTerm, right: BaseTerm, range: SourceRange): Eq {
    return { type: 'Eq', left, right, range };
}

/**
 * Create an inequality.
 */
export function createIneq(left: BaseTerm, right: BaseTerm, range: SourceRange): Ineq {
    return { type: 'Ineq', left, right, range };
}

/**
 * Create a function application.
 */
export function createApplyFn(fn: FunctionSym, args: BaseTerm[], range: SourceRange): ApplyFn {
    return { type: 'ApplyFn', function: fn, args, range };
}

/**
 * Create a clause.
 */
export function createClause(
    head: Atom,
    premises: Term[] | null,
    transform: Transform | null,
    range: SourceRange,
    headTime: TemporalInterval | null = null
): Clause {
    return { type: 'Clause', head, premises, transform, headTime, range };
}

/**
 * Create a declaration.
 */
export function createDecl(
    declaredAtom: Atom,
    descr: Atom[] | null,
    bounds: BoundDecl[] | null,
    constraints: Atom[] | null,
    range: SourceRange
): Decl {
    return { type: 'Decl', declaredAtom, descr, bounds, constraints, range };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a predicate symbol is a built-in (starts with ':').
 */
export function isBuiltinPredicate(sym: PredicateSym): boolean {
    return sym.symbol.startsWith(':');
}

/**
 * Check if a function symbol is a function (starts with 'fn:').
 */
export function isFunction(sym: FunctionSym): boolean {
    return sym.symbol.startsWith('fn:');
}

/**
 * Get a unique key for a predicate symbol (for use in maps).
 */
export function predicateKey(sym: PredicateSym): string {
    return `${sym.symbol}/${sym.arity}`;
}

/**
 * Get a unique key for a function symbol (for use in maps).
 */
export function functionKey(sym: FunctionSym): string {
    return `${sym.symbol}/${sym.arity}`;
}

/**
 * Check if a term is a variable.
 */
export function isVariable(term: Term): term is Variable {
    return 'type' in term && term.type === 'Variable';
}

/**
 * Check if a term is a constant.
 */
export function isConstant(term: Term): term is Constant {
    return 'type' in term && term.type === 'Constant';
}

/**
 * Check if a term is an atom.
 */
export function isAtom(term: Term): term is Atom {
    return 'type' in term && term.type === 'Atom';
}

/**
 * Check if a term is a negated atom.
 */
export function isNegAtom(term: Term): term is NegAtom {
    return 'type' in term && term.type === 'NegAtom';
}

/**
 * Check if a term is a function application.
 */
export function isApplyFn(term: Term): term is ApplyFn {
    return 'type' in term && term.type === 'ApplyFn';
}

/**
 * Check if a term is a temporal literal.
 */
export function isTemporalLiteral(term: Term): term is TemporalLiteral {
    return 'type' in term && term.type === 'TemporalLiteral';
}

/**
 * Check if a term is a temporal atom.
 */
export function isTemporalAtom(term: Term): term is TemporalAtom {
    return 'type' in term && term.type === 'TemporalAtom';
}

/**
 * Check if a temporal interval is "eternal" (unbounded past to unbounded future).
 * Matches upstream Go Interval.IsEternal().
 */
export function isEternalInterval(interval: TemporalInterval): boolean {
    return interval.start.boundType === 'negativeInfinity' &&
           interval.end.boundType === 'positiveInfinity';
}

/**
 * Check if a declaration has the external() descriptor.
 */
export function isDeclExternal(decl: Decl): boolean {
    return decl.descr?.some(d => d.predicate.symbol === DESCRIPTORS.EXTERNAL) ?? false;
}

/**
 * Check if a declaration has the temporal() descriptor.
 */
export function isDeclTemporal(decl: Decl): boolean {
    return decl.descr?.some(d => d.predicate.symbol === DESCRIPTORS.TEMPORAL) ?? false;
}

/**
 * Check if a declaration has the internal:maybe_temporal() descriptor.
 */
export function isDeclMaybeTemporal(decl: Decl): boolean {
    return decl.descr?.some(d => d.predicate.symbol === DESCRIPTORS.MAYBE_TEMPORAL) ?? false;
}

/**
 * Get modes from a declaration's descriptor atoms.
 */
export function getDeclModes(decl: Decl): Atom[] {
    return decl.descr?.filter(d => d.predicate.symbol === DESCRIPTORS.MODE) ?? [];
}

/**
 * Comparison builtin predicate symbols.
 */
export const COMPARISON_PREDICATES = [':lt', ':le', ':gt', ':ge'] as const;

// ============================================================================
// Type Bound Constants (upstream ast.go)
// ============================================================================

/** Well-known type bound name constants matching upstream. */
export const TYPE_BOUNDS = {
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
} as const;

// ============================================================================
// Descriptor Constants (upstream decl.go)
// ============================================================================

/** Well-known descriptor names matching upstream decl.go constants. */
export const DESCRIPTORS = {
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
} as const;

/**
 * Check if an atom is a comparison builtin (:lt, :le, :gt, :ge).
 * These are now generated by the parser for <, <=, >, >= operators.
 */
export function isComparisonAtom(term: Term): term is Atom {
    return isAtom(term) && COMPARISON_PREDICATES.includes(term.predicate.symbol as typeof COMPARISON_PREDICATES[number]);
}

/**
 * Check if an atom is a less-than comparison (:lt).
 */
export function isLtAtom(term: Term): term is Atom {
    return isAtom(term) && term.predicate.symbol === ':lt';
}

/**
 * Check if an atom is a less-than-or-equal comparison (:le).
 */
export function isLeAtom(term: Term): term is Atom {
    return isAtom(term) && term.predicate.symbol === ':le';
}

/**
 * Check if an atom is a greater-than comparison (:gt).
 */
export function isGtAtom(term: Term): term is Atom {
    return isAtom(term) && term.predicate.symbol === ':gt';
}

/**
 * Check if an atom is a greater-than-or-equal comparison (:ge).
 */
export function isGeAtom(term: Term): term is Atom {
    return isAtom(term) && term.predicate.symbol === ':ge';
}

/**
 * Collect all variables from a term.
 */
export function collectVariables(term: Term): Set<string> {
    const vars = new Set<string>();

    function visit(t: Term): void {
        if (isVariable(t)) {
            vars.add(t.symbol);
        } else if (isAtom(t)) {
            t.args.forEach(visit);
        } else if (isNegAtom(t)) {
            visit(t.atom);
        } else if (isTemporalLiteral(t)) {
            visit(t.literal);
            // Collect variables from interval bounds
            if (t.interval) {
                if (t.interval.start.variable) vars.add(t.interval.start.variable.symbol);
                if (t.interval.end.variable) vars.add(t.interval.end.variable.symbol);
            }
        } else if (isApplyFn(t)) {
            t.args.forEach(visit);
        } else if ('left' in t && 'right' in t) {
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
export function collectClauseVariables(clause: Clause): Set<string> {
    const vars = new Set<string>();

    // Head variables
    clause.head.args.forEach(arg => {
        for (const v of collectVariables(arg)) {
            vars.add(v);
        }
    });

    // HeadTime variables (DatalogMTL)
    if (clause.headTime) {
        if (clause.headTime.start.variable) vars.add(clause.headTime.start.variable.symbol);
        if (clause.headTime.end.variable) vars.add(clause.headTime.end.variable.symbol);
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
        let transform: Transform | null = clause.transform;
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
export function termToString(term: Term): string {
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
                if (!term.fst) return '[]';
                // Collect list elements
                const elements: string[] = [];
                let current: Constant | undefined = term;
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
export function clauseToString(clause: Clause): string {
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
    const transformParts: string[] = [];
    let transform: Transform | null = clause.transform;
    while (transform) {
        const stmts = transform.statements.map(stmt => {
            if (stmt.variable) {
                return `let ${stmt.variable.symbol} = ${termToString(stmt.fn)}`;
            } else {
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
const TEMPORAL_OP_SYMBOLS: Record<TemporalOperatorType, string> = {
    'diamondMinus': '<-',
    'diamondPlus': '<+',
    'boxMinus': '[-',
    'boxPlus': '[+',
};

/**
 * Format a temporal bound to string.
 * Matches upstream Go TemporalBound.String().
 */
export function temporalBoundToString(bound: TemporalBound): string {
    switch (bound.boundType) {
        case 'variable':
            return bound.variable?.symbol ?? '_';
        case 'negativeInfinity':
        case 'positiveInfinity':
            return '_';
        case 'now':
            return 'now';
        case 'timestamp':
            if (bound.rawText) return bound.rawText;
            // Format nanos as ISO 8601 if possible
            if (bound.value !== undefined) {
                const ms = bound.value / 1_000_000;
                return new Date(ms).toISOString();
            }
            return '?';
        case 'duration':
            if (bound.rawText) return bound.rawText;
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
function formatDurationNanos(nanos: number): string {
    const ms = 1_000_000;
    const sec = 1_000_000_000;
    const min = sec * 60;
    const hour = min * 60;
    const day = hour * 24;

    if (nanos === 0) return '0s';
    if (nanos % day === 0) return `${nanos / day}d`;
    if (nanos % hour === 0) return `${nanos / hour}h`;
    if (nanos % min === 0) return `${nanos / min}m`;
    if (nanos % sec === 0) return `${nanos / sec}s`;
    if (nanos % ms === 0) return `${nanos / ms}ms`;
    return `${nanos}ns`;
}

/**
 * Format a temporal interval to string (the @[start, end] annotation).
 * Matches upstream Go Interval.String().
 */
export function temporalIntervalToString(interval: TemporalInterval): string {
    if (isEternalInterval(interval)) return '';

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
export function temporalOperatorToString(op: TemporalOperator): string {
    const symbol = TEMPORAL_OP_SYMBOLS[op.operatorType];
    if (op.interval) {
        const startStr = temporalBoundToString(op.interval.start);
        const endStr = temporalBoundToString(op.interval.end);
        return `${symbol}[${startStr}, ${endStr}]`;
    }
    return symbol;
}
