import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";
import { StartContext } from "./MangleParser.js";
import { ProgramContext } from "./MangleParser.js";
import { PackageDeclContext } from "./MangleParser.js";
import { UseDeclContext } from "./MangleParser.js";
import { DeclContext } from "./MangleParser.js";
import { DescrBlockContext } from "./MangleParser.js";
import { BoundsBlockContext } from "./MangleParser.js";
import { ConstraintsBlockContext } from "./MangleParser.js";
import { ClauseContext } from "./MangleParser.js";
import { TemporalAnnotationContext } from "./MangleParser.js";
import { TemporalBoundContext } from "./MangleParser.js";
import { ClauseBodyContext } from "./MangleParser.js";
import { TransformContext } from "./MangleParser.js";
import { LetStmtContext } from "./MangleParser.js";
import { LiteralOrFmlContext } from "./MangleParser.js";
import { TemporalOperatorContext } from "./MangleParser.js";
import { VarContext } from "./MangleParser.js";
import { ConstContext } from "./MangleParser.js";
import { NumContext } from "./MangleParser.js";
import { FloatContext } from "./MangleParser.js";
import { StrContext } from "./MangleParser.js";
import { BStrContext } from "./MangleParser.js";
import { ListContext } from "./MangleParser.js";
import { MapContext } from "./MangleParser.js";
import { StructContext } from "./MangleParser.js";
import { DotTypeContext } from "./MangleParser.js";
import { ApplContext } from "./MangleParser.js";
import { MemberContext } from "./MangleParser.js";
import { AtomContext } from "./MangleParser.js";
import { AtomsContext } from "./MangleParser.js";
/**
 * This interface defines a complete listener for a parse tree produced by
 * `MangleParser`.
 */
export declare class MangleListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     */
    enterStart?: (ctx: StartContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     */
    exitStart?: (ctx: StartContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     */
    enterProgram?: (ctx: ProgramContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     */
    exitProgram?: (ctx: ProgramContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     */
    enterPackageDecl?: (ctx: PackageDeclContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     */
    exitPackageDecl?: (ctx: PackageDeclContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     */
    enterUseDecl?: (ctx: UseDeclContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     */
    exitUseDecl?: (ctx: UseDeclContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     */
    enterDecl?: (ctx: DeclContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     */
    exitDecl?: (ctx: DeclContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     */
    enterDescrBlock?: (ctx: DescrBlockContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     */
    exitDescrBlock?: (ctx: DescrBlockContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     */
    enterBoundsBlock?: (ctx: BoundsBlockContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     */
    exitBoundsBlock?: (ctx: BoundsBlockContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     */
    enterConstraintsBlock?: (ctx: ConstraintsBlockContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     */
    exitConstraintsBlock?: (ctx: ConstraintsBlockContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     */
    enterClause?: (ctx: ClauseContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     */
    exitClause?: (ctx: ClauseContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.temporalAnnotation`.
     * @param ctx the parse tree
     */
    enterTemporalAnnotation?: (ctx: TemporalAnnotationContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.temporalAnnotation`.
     * @param ctx the parse tree
     */
    exitTemporalAnnotation?: (ctx: TemporalAnnotationContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.temporalBound`.
     * @param ctx the parse tree
     */
    enterTemporalBound?: (ctx: TemporalBoundContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.temporalBound`.
     * @param ctx the parse tree
     */
    exitTemporalBound?: (ctx: TemporalBoundContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     */
    enterClauseBody?: (ctx: ClauseBodyContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     */
    exitClauseBody?: (ctx: ClauseBodyContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     */
    enterTransform?: (ctx: TransformContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     */
    exitTransform?: (ctx: TransformContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     */
    enterLetStmt?: (ctx: LetStmtContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     */
    exitLetStmt?: (ctx: LetStmtContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     */
    enterLiteralOrFml?: (ctx: LiteralOrFmlContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     */
    exitLiteralOrFml?: (ctx: LiteralOrFmlContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.temporalOperator`.
     * @param ctx the parse tree
     */
    enterTemporalOperator?: (ctx: TemporalOperatorContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.temporalOperator`.
     * @param ctx the parse tree
     */
    exitTemporalOperator?: (ctx: TemporalOperatorContext) => void;
    /**
     * Enter a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterVar?: (ctx: VarContext) => void;
    /**
     * Exit a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitVar?: (ctx: VarContext) => void;
    /**
     * Enter a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterConst?: (ctx: ConstContext) => void;
    /**
     * Exit a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitConst?: (ctx: ConstContext) => void;
    /**
     * Enter a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterNum?: (ctx: NumContext) => void;
    /**
     * Exit a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitNum?: (ctx: NumContext) => void;
    /**
     * Enter a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterFloat?: (ctx: FloatContext) => void;
    /**
     * Exit a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitFloat?: (ctx: FloatContext) => void;
    /**
     * Enter a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterStr?: (ctx: StrContext) => void;
    /**
     * Exit a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitStr?: (ctx: StrContext) => void;
    /**
     * Enter a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterBStr?: (ctx: BStrContext) => void;
    /**
     * Exit a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitBStr?: (ctx: BStrContext) => void;
    /**
     * Enter a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterList?: (ctx: ListContext) => void;
    /**
     * Exit a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitList?: (ctx: ListContext) => void;
    /**
     * Enter a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterMap?: (ctx: MapContext) => void;
    /**
     * Exit a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitMap?: (ctx: MapContext) => void;
    /**
     * Enter a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterStruct?: (ctx: StructContext) => void;
    /**
     * Exit a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitStruct?: (ctx: StructContext) => void;
    /**
     * Enter a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterDotType?: (ctx: DotTypeContext) => void;
    /**
     * Exit a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitDotType?: (ctx: DotTypeContext) => void;
    /**
     * Enter a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterAppl?: (ctx: ApplContext) => void;
    /**
     * Exit a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitAppl?: (ctx: ApplContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     */
    enterMember?: (ctx: MemberContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     */
    exitMember?: (ctx: MemberContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     */
    enterAtom?: (ctx: AtomContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     */
    exitAtom?: (ctx: AtomContext) => void;
    /**
     * Enter a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     */
    enterAtoms?: (ctx: AtomsContext) => void;
    /**
     * Exit a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     */
    exitAtoms?: (ctx: AtomsContext) => void;
    visitTerminal(node: TerminalNode): void;
    visitErrorNode(node: ErrorNode): void;
    enterEveryRule(node: ParserRuleContext): void;
    exitEveryRule(node: ParserRuleContext): void;
}
//# sourceMappingURL=MangleListener.d.ts.map