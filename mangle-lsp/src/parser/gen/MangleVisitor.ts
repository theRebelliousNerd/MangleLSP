// Generated from Mangle.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `MangleParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class MangleVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStart?: (ctx: StartContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram?: (ctx: ProgramContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageDecl?: (ctx: PackageDeclContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUseDecl?: (ctx: UseDeclContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDecl?: (ctx: DeclContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDescrBlock?: (ctx: DescrBlockContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBoundsBlock?: (ctx: BoundsBlockContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstraintsBlock?: (ctx: ConstraintsBlockContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClause?: (ctx: ClauseContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.temporalAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemporalAnnotation?: (ctx: TemporalAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.temporalBound`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemporalBound?: (ctx: TemporalBoundContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClauseBody?: (ctx: ClauseBodyContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransform?: (ctx: TransformContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLetStmt?: (ctx: LetStmtContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralOrFml?: (ctx: LiteralOrFmlContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.temporalOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemporalOperator?: (ctx: TemporalOperatorContext) => Result;
    /**
     * Visit a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVar?: (ctx: VarContext) => Result;
    /**
     * Visit a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConst?: (ctx: ConstContext) => Result;
    /**
     * Visit a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNum?: (ctx: NumContext) => Result;
    /**
     * Visit a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFloat?: (ctx: FloatContext) => Result;
    /**
     * Visit a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStr?: (ctx: StrContext) => Result;
    /**
     * Visit a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBStr?: (ctx: BStrContext) => Result;
    /**
     * Visit a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitList?: (ctx: ListContext) => Result;
    /**
     * Visit a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMap?: (ctx: MapContext) => Result;
    /**
     * Visit a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStruct?: (ctx: StructContext) => Result;
    /**
     * Visit a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDotType?: (ctx: DotTypeContext) => Result;
    /**
     * Visit a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAppl?: (ctx: ApplContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMember?: (ctx: MemberContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtom?: (ctx: AtomContext) => Result;
    /**
     * Visit a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtoms?: (ctx: AtomsContext) => Result;
}

