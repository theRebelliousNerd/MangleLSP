"use strict";
// Generated from Mangle.g4 by ANTLR 4.13.1
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangleListener = void 0;
/**
 * This interface defines a complete listener for a parse tree produced by
 * `MangleParser`.
 */
class MangleListener {
    /**
     * Enter a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     */
    enterStart;
    /**
     * Exit a parse tree produced by `MangleParser.start`.
     * @param ctx the parse tree
     */
    exitStart;
    /**
     * Enter a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     */
    enterProgram;
    /**
     * Exit a parse tree produced by `MangleParser.program`.
     * @param ctx the parse tree
     */
    exitProgram;
    /**
     * Enter a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     */
    enterPackageDecl;
    /**
     * Exit a parse tree produced by `MangleParser.packageDecl`.
     * @param ctx the parse tree
     */
    exitPackageDecl;
    /**
     * Enter a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     */
    enterUseDecl;
    /**
     * Exit a parse tree produced by `MangleParser.useDecl`.
     * @param ctx the parse tree
     */
    exitUseDecl;
    /**
     * Enter a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     */
    enterDecl;
    /**
     * Exit a parse tree produced by `MangleParser.decl`.
     * @param ctx the parse tree
     */
    exitDecl;
    /**
     * Enter a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     */
    enterDescrBlock;
    /**
     * Exit a parse tree produced by `MangleParser.descrBlock`.
     * @param ctx the parse tree
     */
    exitDescrBlock;
    /**
     * Enter a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     */
    enterBoundsBlock;
    /**
     * Exit a parse tree produced by `MangleParser.boundsBlock`.
     * @param ctx the parse tree
     */
    exitBoundsBlock;
    /**
     * Enter a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     */
    enterConstraintsBlock;
    /**
     * Exit a parse tree produced by `MangleParser.constraintsBlock`.
     * @param ctx the parse tree
     */
    exitConstraintsBlock;
    /**
     * Enter a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     */
    enterClause;
    /**
     * Exit a parse tree produced by `MangleParser.clause`.
     * @param ctx the parse tree
     */
    exitClause;
    /**
     * Enter a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     */
    enterClauseBody;
    /**
     * Exit a parse tree produced by `MangleParser.clauseBody`.
     * @param ctx the parse tree
     */
    exitClauseBody;
    /**
     * Enter a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     */
    enterTransform;
    /**
     * Exit a parse tree produced by `MangleParser.transform`.
     * @param ctx the parse tree
     */
    exitTransform;
    /**
     * Enter a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     */
    enterLetStmt;
    /**
     * Exit a parse tree produced by `MangleParser.letStmt`.
     * @param ctx the parse tree
     */
    exitLetStmt;
    /**
     * Enter a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     */
    enterLiteralOrFml;
    /**
     * Exit a parse tree produced by `MangleParser.literalOrFml`.
     * @param ctx the parse tree
     */
    exitLiteralOrFml;
    /**
     * Enter a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterVar;
    /**
     * Exit a parse tree produced by the `Var`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitVar;
    /**
     * Enter a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterConst;
    /**
     * Exit a parse tree produced by the `Const`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitConst;
    /**
     * Enter a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterNum;
    /**
     * Exit a parse tree produced by the `Num`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitNum;
    /**
     * Enter a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterFloat;
    /**
     * Exit a parse tree produced by the `Float`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitFloat;
    /**
     * Enter a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterStr;
    /**
     * Exit a parse tree produced by the `Str`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitStr;
    /**
     * Enter a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterBStr;
    /**
     * Exit a parse tree produced by the `BStr`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitBStr;
    /**
     * Enter a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterList;
    /**
     * Exit a parse tree produced by the `List`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitList;
    /**
     * Enter a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterMap;
    /**
     * Exit a parse tree produced by the `Map`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitMap;
    /**
     * Enter a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterStruct;
    /**
     * Exit a parse tree produced by the `Struct`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitStruct;
    /**
     * Enter a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterDotType;
    /**
     * Exit a parse tree produced by the `DotType`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitDotType;
    /**
     * Enter a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    enterAppl;
    /**
     * Exit a parse tree produced by the `Appl`
     * labeled alternative in `MangleParser.term`.
     * @param ctx the parse tree
     */
    exitAppl;
    /**
     * Enter a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     */
    enterMember;
    /**
     * Exit a parse tree produced by `MangleParser.member`.
     * @param ctx the parse tree
     */
    exitMember;
    /**
     * Enter a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     */
    enterAtom;
    /**
     * Exit a parse tree produced by `MangleParser.atom`.
     * @param ctx the parse tree
     */
    exitAtom;
    /**
     * Enter a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     */
    enterAtoms;
    /**
     * Exit a parse tree produced by `MangleParser.atoms`.
     * @param ctx the parse tree
     */
    exitAtoms;
    visitTerminal(node) { }
    visitErrorNode(node) { }
    enterEveryRule(node) { }
    exitEveryRule(node) { }
}
exports.MangleListener = MangleListener;
//# sourceMappingURL=MangleListener.js.map