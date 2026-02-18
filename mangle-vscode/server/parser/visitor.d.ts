/**
 * ANTLR visitor that converts parse trees to AST with source locations.
 *
 * Ported from upstream Go implementation (parse/parse.go).
 */
import { AbstractParseTreeVisitor, ParserRuleContext } from 'antlr4ng';
import { SourceUnit, PackageDecl, UseDecl, Decl, Clause, Atom, Term, BaseTerm, Variable, Constant, ApplyFn, Transform, TransformStmt, BoundDecl, TemporalBound, TemporalInterval, TemporalOperator } from './ast';
/**
 * Error placeholder symbol used in broken AST nodes.
 * LSP features can check for this to identify error nodes.
 */
export declare const ERROR_SYMBOL = "$$error$$";
/**
 * A parse error with location information (for visitor-level errors).
 */
export interface VisitorParseError {
    /** Error message */
    message: string;
    /** Line number (1-indexed) */
    line: number;
    /** Column number (0-indexed) */
    column: number;
    /** Character offset from start of file */
    offset: number;
    /** Length of the offending text (if known) */
    length: number;
}
import { StartContext, ProgramContext, PackageDeclContext, UseDeclContext, DeclContext, ClauseContext, ClauseBodyContext, TransformContext, LetStmtContext, LiteralOrFmlContext, AtomContext, AtomsContext, VarContext, ConstContext, NumContext, FloatContext, StrContext, BStrContext, ListContext, MapContext, StructContext, ApplContext, BoundsBlockContext, DescrBlockContext, ConstraintsBlockContext, DotTypeContext, MemberContext, TemporalAnnotationContext, TemporalBoundContext, TemporalOperatorContext } from './gen/MangleParser';
/**
 * Visitor that builds AST from ANTLR parse tree.
 *
 * This visitor implements error recovery: instead of throwing exceptions
 * when encountering malformed AST nodes, it records the error and returns
 * placeholder nodes. This allows the parser to produce a partial AST
 * even when there are errors, enabling LSP features to work on broken code.
 */
export declare class MangleASTVisitor extends AbstractParseTreeVisitor<any> {
    /** Collected visitor errors during AST construction */
    private errors;
    /** Partial unit built so far (for error recovery) */
    private partialUnit;
    protected defaultResult(): any;
    /**
     * Get all errors collected during AST construction.
     */
    getErrors(): VisitorParseError[];
    /**
     * Get the partial unit built so far (for error recovery).
     * Returns the last successfully built unit, or null if none.
     */
    getPartialUnit(): SourceUnit | null;
    /**
     * Record an error and return a range from the context.
     */
    private addError;
    /**
     * Create an error placeholder atom.
     */
    private createErrorAtom;
    /**
     * Create an error placeholder variable.
     */
    private createErrorVariable;
    /**
     * Create an error placeholder ApplyFn.
     */
    private createErrorApplyFn;
    visitStart(ctx: StartContext): SourceUnit;
    visitProgram(ctx: ProgramContext): SourceUnit;
    visitPackageDecl(ctx: PackageDeclContext): PackageDecl;
    visitUseDecl(ctx: UseDeclContext): UseDecl;
    visitDecl(ctx: DeclContext): Decl;
    visitDescrBlock(ctx: DescrBlockContext): Atom[];
    visitBoundsBlock(ctx: BoundsBlockContext): BoundDecl;
    visitConstraintsBlock(ctx: ConstraintsBlockContext): Atom[];
    visitAtoms(ctx: AtomsContext): Atom[];
    visitAtom(ctx: AtomContext): Atom;
    visitClause(ctx: ClauseContext): Clause;
    visitClauseBody(ctx: ClauseBodyContext): {
        premises: Term[];
        transform: Transform | null;
    };
    visitTransform(ctx: TransformContext): Transform;
    visitLetStmt(ctx: LetStmtContext): TransformStmt;
    visitLiteralOrFml(ctx: LiteralOrFmlContext): Term;
    visitTerm(ctx: ParserRuleContext): Term;
    visitVar(ctx: VarContext): Variable;
    visitConst(ctx: ConstContext): Constant;
    visitNum(ctx: NumContext): Constant;
    visitFloat(ctx: FloatContext): Constant;
    visitStr(ctx: StrContext): Constant;
    visitBStr(ctx: BStrContext): Constant;
    visitList(ctx: ListContext): ApplyFn;
    visitMap(ctx: MapContext): ApplyFn;
    visitStruct(ctx: StructContext): ApplyFn;
    visitDotType(ctx: DotTypeContext): ApplyFn;
    visitMember(ctx: MemberContext): BaseTerm[];
    visitAppl(ctx: ApplContext): Atom | ApplyFn;
    /**
     * Visit a temporal annotation: @[bound] or @[bound, bound]
     * Returns a TemporalInterval.
     * Upstream: parse.go:786-812
     */
    visitTemporalAnnotation(ctx: TemporalAnnotationContext): TemporalInterval;
    /**
     * Visit a temporal bound: TIMESTAMP | DURATION | VARIABLE | 'now'
     * Returns a TemporalBound.
     * Upstream: parse.go:816-849
     */
    visitTemporalBound(ctx: TemporalBoundContext): TemporalBound;
    /**
     * Visit a temporal operator: <-[b,b] | [-[b,b] | <+[b,b] | [+[b,b]
     * Returns a TemporalOperator.
     * Upstream: parse.go:853-896
     */
    visitTemporalOperator(ctx: TemporalOperatorContext): TemporalOperator;
}
//# sourceMappingURL=visitor.d.ts.map