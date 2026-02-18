/**
 * AST type definitions for Mangle with source location tracking.
 *
 * Ported from upstream Go implementation (ast/ast.go) with extensions
 * for LSP support (SourceRange on all nodes).
 */
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
export declare function pointRange(pos: SourcePosition): SourceRange;
/**
 * Create a range spanning from start to end.
 */
export declare function spanRange(start: SourcePosition, end: SourcePosition): SourceRange;
/**
 * Check if a position is contained within a range.
 */
export declare function containsPosition(range: SourceRange, pos: SourcePosition): boolean;
/**
 * Merge two ranges into a range spanning both.
 * Uses line/column comparison instead of offset to handle cases where offset may be 0.
 */
export declare function mergeRanges(a: SourceRange, b: SourceRange): SourceRange;
/**
 * Base interface for all AST nodes with source location.
 */
export interface LocatedNode {
    range: SourceRange;
}
/**
 * Constant type enumeration (mirrors Go ConstantType).
 */
export type ConstantType = 'name' | 'string' | 'bytes' | 'number' | 'float64' | 'time' | 'duration' | 'pair' | 'list' | 'map' | 'struct';
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
/**
 * Temporal operator type.
 * Matches upstream Go ast.TemporalOperatorType enum.
 */
export type TemporalOperatorType = 'diamondMinus' | 'diamondPlus' | 'boxMinus' | 'boxPlus';
/**
 * Type for temporal interval bounds.
 * Matches upstream Go ast.TemporalBoundType enum (6 variants).
 */
export type TemporalBoundType = 'timestamp' | 'variable' | 'negativeInfinity' | 'positiveInfinity' | 'now' | 'duration';
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
/**
 * Create a name constant.
 */
export declare function createName(symbol: string, range: SourceRange): Constant;
/**
 * Create a string constant.
 */
export declare function createString(value: string, range: SourceRange): Constant;
/**
 * Create a bytes constant.
 */
export declare function createBytes(value: string, range: SourceRange): Constant;
/**
 * Create a number constant.
 */
export declare function createNumber(value: number, range: SourceRange): Constant;
/**
 * Create a float64 constant.
 */
export declare function createFloat64(value: number, range: SourceRange): Constant;
/**
 * Create a time constant (nanoseconds since Unix epoch).
 */
export declare function createTime(nanos: number, range: SourceRange): Constant;
/**
 * Create a duration constant (nanoseconds).
 */
export declare function createDuration(nanos: number, range: SourceRange): Constant;
/**
 * Create a list constant.
 */
export declare function createList(items: Constant[], range: SourceRange): Constant;
/**
 * Create a variable.
 */
export declare function createVariable(symbol: string, range: SourceRange): Variable;
/**
 * Create a predicate symbol.
 */
export declare function createPredicateSym(symbol: string, arity: number): PredicateSym;
/**
 * Create a function symbol.
 */
export declare function createFunctionSym(symbol: string, arity: number): FunctionSym;
/**
 * Create an atom.
 */
export declare function createAtom(predicate: PredicateSym, args: BaseTerm[], range: SourceRange): Atom;
/**
 * Create a negated atom.
 */
export declare function createNegAtom(atom: Atom, range: SourceRange): NegAtom;
/**
 * Create an equality.
 */
export declare function createEq(left: BaseTerm, right: BaseTerm, range: SourceRange): Eq;
/**
 * Create an inequality.
 */
export declare function createIneq(left: BaseTerm, right: BaseTerm, range: SourceRange): Ineq;
/**
 * Create a function application.
 */
export declare function createApplyFn(fn: FunctionSym, args: BaseTerm[], range: SourceRange): ApplyFn;
/**
 * Create a clause.
 */
export declare function createClause(head: Atom, premises: Term[] | null, transform: Transform | null, range: SourceRange, headTime?: TemporalInterval | null): Clause;
/**
 * Create a declaration.
 */
export declare function createDecl(declaredAtom: Atom, descr: Atom[] | null, bounds: BoundDecl[] | null, constraints: Atom[] | null, range: SourceRange): Decl;
/**
 * Check if a predicate symbol is a built-in (starts with ':').
 */
export declare function isBuiltinPredicate(sym: PredicateSym): boolean;
/**
 * Check if a function symbol is a function (starts with 'fn:').
 */
export declare function isFunction(sym: FunctionSym): boolean;
/**
 * Get a unique key for a predicate symbol (for use in maps).
 */
export declare function predicateKey(sym: PredicateSym): string;
/**
 * Get a unique key for a function symbol (for use in maps).
 */
export declare function functionKey(sym: FunctionSym): string;
/**
 * Check if a term is a variable.
 */
export declare function isVariable(term: Term): term is Variable;
/**
 * Check if a term is a constant.
 */
export declare function isConstant(term: Term): term is Constant;
/**
 * Check if a term is an atom.
 */
export declare function isAtom(term: Term): term is Atom;
/**
 * Check if a term is a negated atom.
 */
export declare function isNegAtom(term: Term): term is NegAtom;
/**
 * Check if a term is a function application.
 */
export declare function isApplyFn(term: Term): term is ApplyFn;
/**
 * Check if a term is a temporal literal.
 */
export declare function isTemporalLiteral(term: Term): term is TemporalLiteral;
/**
 * Check if a term is a temporal atom.
 */
export declare function isTemporalAtom(term: Term): term is TemporalAtom;
/**
 * Check if a temporal interval is "eternal" (unbounded past to unbounded future).
 * Matches upstream Go Interval.IsEternal().
 */
export declare function isEternalInterval(interval: TemporalInterval): boolean;
/**
 * Check if a declaration has the external() descriptor.
 */
export declare function isDeclExternal(decl: Decl): boolean;
/**
 * Check if a declaration has the temporal() descriptor.
 */
export declare function isDeclTemporal(decl: Decl): boolean;
/**
 * Check if a declaration has the internal:maybe_temporal() descriptor.
 */
export declare function isDeclMaybeTemporal(decl: Decl): boolean;
/**
 * Get modes from a declaration's descriptor atoms.
 */
export declare function getDeclModes(decl: Decl): Atom[];
/**
 * Comparison builtin predicate symbols.
 */
export declare const COMPARISON_PREDICATES: readonly [":lt", ":le", ":gt", ":ge"];
/** Well-known type bound name constants matching upstream. */
export declare const TYPE_BOUNDS: {
    readonly ANY: "/any";
    readonly BOT: "/bot";
    readonly NUMBER: "/number";
    readonly FLOAT64: "/float64";
    readonly STRING: "/string";
    readonly BYTES: "/bytes";
    readonly NAME: "/name";
    readonly TIME: "/time";
    readonly DURATION: "/duration";
    readonly BOOL: "/bool";
};
/** Well-known descriptor names matching upstream decl.go constants. */
export declare const DESCRIPTORS: {
    readonly EXTERNAL: "external";
    readonly EXTENSIONAL: "extensional";
    readonly MODE: "mode";
    readonly REFLECTS: "reflects";
    readonly SYNTHETIC: "synthetic";
    readonly PRIVATE: "private";
    readonly DOC: "doc";
    readonly ARG: "arg";
    readonly NAME: "name";
    readonly DESUGARED: "desugared";
    readonly FUNDEP: "fundep";
    readonly MERGE_PREDICATE: "merge";
    readonly DEFERRED_PREDICATE: "deferred";
    readonly TEMPORAL: "temporal";
    readonly MAYBE_TEMPORAL: "internal:maybe_temporal";
};
/**
 * Check if an atom is a comparison builtin (:lt, :le, :gt, :ge).
 * These are now generated by the parser for <, <=, >, >= operators.
 */
export declare function isComparisonAtom(term: Term): term is Atom;
/**
 * Check if an atom is a less-than comparison (:lt).
 */
export declare function isLtAtom(term: Term): term is Atom;
/**
 * Check if an atom is a less-than-or-equal comparison (:le).
 */
export declare function isLeAtom(term: Term): term is Atom;
/**
 * Check if an atom is a greater-than comparison (:gt).
 */
export declare function isGtAtom(term: Term): term is Atom;
/**
 * Check if an atom is a greater-than-or-equal comparison (:ge).
 */
export declare function isGeAtom(term: Term): term is Atom;
/**
 * Collect all variables from a term.
 */
export declare function collectVariables(term: Term): Set<string>;
/**
 * Collect all variables from a clause.
 */
export declare function collectClauseVariables(clause: Clause): Set<string>;
/**
 * Get string representation of a term (for debugging/display).
 */
export declare function termToString(term: Term): string;
/**
 * Get string representation of a clause.
 */
export declare function clauseToString(clause: Clause): string;
/**
 * Format a temporal bound to string.
 * Matches upstream Go TemporalBound.String().
 */
export declare function temporalBoundToString(bound: TemporalBound): string;
/**
 * Format a temporal interval to string (the @[start, end] annotation).
 * Matches upstream Go Interval.String().
 */
export declare function temporalIntervalToString(interval: TemporalInterval): string;
/**
 * Format a temporal operator to string (e.g., <-[0, 5d]).
 * Matches upstream Go TemporalOperator.String().
 */
export declare function temporalOperatorToString(op: TemporalOperator): string;
//# sourceMappingURL=ast.d.ts.map