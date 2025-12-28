"use strict";
// Generated from Mangle.g4 by ANTLR 4.13.1
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangleVisitor = void 0;
const antlr4ng_1 = require("antlr4ng");
/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `MangleParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
class MangleVisitor extends antlr4ng_1.AbstractParseTreeVisitor {
    /**
     * Visit a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStart;
    /**
     * Visit a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram;
    /**
     * Visit a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageDecl;
    /**
     * Visit a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUseDecl;
    /**
     * Visit a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDecl;
    /**
     * Visit a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDescrBlock;
    /**
     * Visit a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBoundsBlock;
    /**
     * Visit a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstraintsBlock;
    /**
     * Visit a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClause;
    /**
     * Visit a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClauseBody;
    /**
     * Visit a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransform;
    /**
     * Visit a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLetStmt;
    /**
     * Visit a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralOrFml;
    /**
     * Visit a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVar;
    /**
     * Visit a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConst;
    /**
     * Visit a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNum;
    /**
     * Visit a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFloat;
    /**
     * Visit a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStr;
    /**
     * Visit a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBStr;
    /**
     * Visit a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitList;
    /**
     * Visit a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMap;
    /**
     * Visit a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStruct;
    /**
     * Visit a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDotType;
    /**
     * Visit a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAppl;
    /**
     * Visit a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMember;
    /**
     * Visit a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtom;
    /**
     * Visit a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtoms;
}
exports.MangleVisitor = MangleVisitor;
//# sourceMappingURL=MangleVisitor.js.map