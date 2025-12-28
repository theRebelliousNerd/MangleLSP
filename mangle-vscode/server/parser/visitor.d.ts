/**
 * ANTLR visitor that converts parse trees to AST with source locations.
 *
 * Ported from upstream Go implementation (parse/parse.go).
 */
import { AbstractParseTreeVisitor, ParserRuleContext } from 'antlr4ng';
import { SourceUnit, PackageDecl, UseDecl, Decl, Clause, Atom, Term, Variable, Constant, ApplyFn, Transform, TransformStmt, BoundDecl } from './ast';
import { StartContext, ProgramContext, PackageDeclContext, UseDeclContext, DeclContext, ClauseContext, ClauseBodyContext, TransformContext, LetStmtContext, LiteralOrFmlContext, AtomContext, AtomsContext, VarContext, ConstContext, NumContext, FloatContext, StrContext, BStrContext, ListContext, MapContext, StructContext, ApplContext, BoundsBlockContext, DescrBlockContext, ConstraintsBlockContext, DotTypeContext } from './gen/MangleParser';
/**
 * Visitor that builds AST from ANTLR parse tree.
 */
export declare class MangleASTVisitor extends AbstractParseTreeVisitor<any> {
    protected defaultResult(): any;
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
    visitList(ctx: ListContext): Constant;
    visitMap(ctx: MapContext): Constant;
    visitStruct(ctx: StructContext): Constant;
    visitDotType(ctx: DotTypeContext): Constant;
    visitAppl(ctx: ApplContext): Atom | ApplyFn;
}
//# sourceMappingURL=visitor.d.ts.map