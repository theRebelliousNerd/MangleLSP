"use strict";
// Generated from Mangle.g4 by ANTLR 4.13.1
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtomsContext = exports.AtomContext = exports.MemberContext = exports.DotTypeContext = exports.StructContext = exports.MapContext = exports.ListContext = exports.NumContext = exports.ConstContext = exports.VarContext = exports.ApplContext = exports.FloatContext = exports.BStrContext = exports.StrContext = exports.TermContext = exports.LiteralOrFmlContext = exports.LetStmtContext = exports.TransformContext = exports.ClauseBodyContext = exports.ClauseContext = exports.ConstraintsBlockContext = exports.BoundsBlockContext = exports.DescrBlockContext = exports.DeclContext = exports.UseDeclContext = exports.PackageDeclContext = exports.ProgramContext = exports.StartContext = exports.MangleParser = void 0;
const antlr = __importStar(require("antlr4ng"));
class MangleParser extends antlr.Parser {
    static T__0 = 1;
    static T__1 = 2;
    static T__2 = 3;
    static T__3 = 4;
    static T__4 = 5;
    static T__5 = 6;
    static T__6 = 7;
    static WHITESPACE = 8;
    static COMMENT = 9;
    static LONGLEFTDOUBLEARROW = 10;
    static PACKAGE = 11;
    static USE = 12;
    static DECL = 13;
    static BOUND = 14;
    static LET = 15;
    static DO = 16;
    static LPAREN = 17;
    static RPAREN = 18;
    static LBRACKET = 19;
    static RBRACKET = 20;
    static EQ = 21;
    static BANGEQ = 22;
    static COMMA = 23;
    static BANG = 24;
    static LESS = 25;
    static LESSEQ = 26;
    static GREATER = 27;
    static GREATEREQ = 28;
    static COLONDASH = 29;
    static NEWLINE = 30;
    static PIPEGREATER = 31;
    static NUMBER = 32;
    static FLOAT = 33;
    static VARIABLE = 34;
    static NAME = 35;
    static TYPENAME = 36;
    static DOT_TYPE = 37;
    static CONSTANT = 38;
    static STRING = 39;
    static BYTESTRING = 40;
    static RULE_start = 0;
    static RULE_program = 1;
    static RULE_packageDecl = 2;
    static RULE_useDecl = 3;
    static RULE_decl = 4;
    static RULE_descrBlock = 5;
    static RULE_boundsBlock = 6;
    static RULE_constraintsBlock = 7;
    static RULE_clause = 8;
    static RULE_clauseBody = 9;
    static RULE_transform = 10;
    static RULE_letStmt = 11;
    static RULE_literalOrFml = 12;
    static RULE_term = 13;
    static RULE_member = 14;
    static RULE_atom = 15;
    static RULE_atoms = 16;
    static literalNames = [
        null, "'.'", "'descr'", "'inclusion'", "':'", "'{'", "'}'", "'opt'",
        null, null, "'\\u00E2\\u0178\\u00B8'", "'Package'", "'Use'", "'Decl'",
        "'bound'", "'let'", "'do'", "'('", "')'", "'['", "']'", "'='", "'!='",
        "','", "'!'", "'<'", "'<='", "'>'", "'>='", "':-'", "'\\n'", "'|>'"
    ];
    static symbolicNames = [
        null, null, null, null, null, null, null, null, "WHITESPACE", "COMMENT",
        "LONGLEFTDOUBLEARROW", "PACKAGE", "USE", "DECL", "BOUND", "LET",
        "DO", "LPAREN", "RPAREN", "LBRACKET", "RBRACKET", "EQ", "BANGEQ",
        "COMMA", "BANG", "LESS", "LESSEQ", "GREATER", "GREATEREQ", "COLONDASH",
        "NEWLINE", "PIPEGREATER", "NUMBER", "FLOAT", "VARIABLE", "NAME",
        "TYPENAME", "DOT_TYPE", "CONSTANT", "STRING", "BYTESTRING"
    ];
    static ruleNames = [
        "start", "program", "packageDecl", "useDecl", "decl", "descrBlock",
        "boundsBlock", "constraintsBlock", "clause", "clauseBody", "transform",
        "letStmt", "literalOrFml", "term", "member", "atom", "atoms",
    ];
    get grammarFileName() { return "Mangle.g4"; }
    get literalNames() { return MangleParser.literalNames; }
    get symbolicNames() { return MangleParser.symbolicNames; }
    get ruleNames() { return MangleParser.ruleNames; }
    get serializedATN() { return MangleParser._serializedATN; }
    createFailedPredicateException(predicate, message) {
        return new antlr.FailedPredicateException(this, predicate, message);
    }
    constructor(input) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, MangleParser._ATN, MangleParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    start() {
        let localContext = new StartContext(this.context, this.state);
        this.enterRule(localContext, 0, MangleParser.RULE_start);
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 34;
                this.program();
                this.state = 35;
                this.match(MangleParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    program() {
        let localContext = new ProgramContext(this.context, this.state);
        this.enterRule(localContext, 2, MangleParser.RULE_program);
        let _la;
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 38;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 11) {
                    {
                        this.state = 37;
                        this.packageDecl();
                    }
                }
                this.state = 43;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 12) {
                    {
                        {
                            this.state = 40;
                            this.useDecl();
                        }
                    }
                    this.state = 45;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 50;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 532512) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                    {
                        this.state = 48;
                        this.errorHandler.sync(this);
                        switch (this.tokenStream.LA(1)) {
                            case MangleParser.DECL:
                                {
                                    this.state = 46;
                                    this.decl();
                                }
                                break;
                            case MangleParser.T__4:
                            case MangleParser.LBRACKET:
                            case MangleParser.NUMBER:
                            case MangleParser.FLOAT:
                            case MangleParser.VARIABLE:
                            case MangleParser.NAME:
                            case MangleParser.DOT_TYPE:
                            case MangleParser.CONSTANT:
                            case MangleParser.STRING:
                            case MangleParser.BYTESTRING:
                                {
                                    this.state = 47;
                                    this.clause();
                                }
                                break;
                            default:
                                throw new antlr.NoViableAltException(this);
                        }
                    }
                    this.state = 52;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    packageDecl() {
        let localContext = new PackageDeclContext(this.context, this.state);
        this.enterRule(localContext, 4, MangleParser.RULE_packageDecl);
        let _la;
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 53;
                this.match(MangleParser.PACKAGE);
                this.state = 54;
                this.match(MangleParser.NAME);
                this.state = 56;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 19) {
                    {
                        this.state = 55;
                        this.atoms();
                    }
                }
                this.state = 58;
                this.match(MangleParser.BANG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    useDecl() {
        let localContext = new UseDeclContext(this.context, this.state);
        this.enterRule(localContext, 6, MangleParser.RULE_useDecl);
        let _la;
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 60;
                this.match(MangleParser.USE);
                this.state = 61;
                this.match(MangleParser.NAME);
                this.state = 63;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 19) {
                    {
                        this.state = 62;
                        this.atoms();
                    }
                }
                this.state = 65;
                this.match(MangleParser.BANG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    decl() {
        let localContext = new DeclContext(this.context, this.state);
        this.enterRule(localContext, 8, MangleParser.RULE_decl);
        let _la;
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 67;
                this.match(MangleParser.DECL);
                this.state = 68;
                this.atom();
                this.state = 70;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 2) {
                    {
                        this.state = 69;
                        this.descrBlock();
                    }
                }
                this.state = 75;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 14) {
                    {
                        {
                            this.state = 72;
                            this.boundsBlock();
                        }
                    }
                    this.state = 77;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 79;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 3) {
                    {
                        this.state = 78;
                        this.constraintsBlock();
                    }
                }
                this.state = 81;
                this.match(MangleParser.T__0);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    descrBlock() {
        let localContext = new DescrBlockContext(this.context, this.state);
        this.enterRule(localContext, 10, MangleParser.RULE_descrBlock);
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 83;
                this.match(MangleParser.T__1);
                this.state = 84;
                this.atoms();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    boundsBlock() {
        let localContext = new BoundsBlockContext(this.context, this.state);
        this.enterRule(localContext, 12, MangleParser.RULE_boundsBlock);
        let _la;
        try {
            let alternative;
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 86;
                this.match(MangleParser.BOUND);
                this.state = 87;
                this.match(MangleParser.LBRACKET);
                this.state = 93;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 9, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                            {
                                this.state = 88;
                                this.term();
                                this.state = 89;
                                this.match(MangleParser.COMMA);
                            }
                        }
                    }
                    this.state = 95;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 9, this.context);
                }
                this.state = 97;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                    {
                        this.state = 96;
                        this.term();
                    }
                }
                this.state = 99;
                this.match(MangleParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    constraintsBlock() {
        let localContext = new ConstraintsBlockContext(this.context, this.state);
        this.enterRule(localContext, 14, MangleParser.RULE_constraintsBlock);
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 101;
                this.match(MangleParser.T__2);
                this.state = 102;
                this.atoms();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    clause() {
        let localContext = new ClauseContext(this.context, this.state);
        this.enterRule(localContext, 16, MangleParser.RULE_clause);
        let _la;
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 104;
                this.atom();
                this.state = 107;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 29) {
                    {
                        this.state = 105;
                        _la = this.tokenStream.LA(1);
                        if (!(_la === 10 || _la === 29)) {
                            this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        this.state = 106;
                        this.clauseBody();
                    }
                }
                this.state = 109;
                this.match(MangleParser.T__0);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    clauseBody() {
        let localContext = new ClauseBodyContext(this.context, this.state);
        this.enterRule(localContext, 18, MangleParser.RULE_clauseBody);
        let _la;
        try {
            let alternative;
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 111;
                this.literalOrFml();
                this.state = 116;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                            {
                                this.state = 112;
                                this.match(MangleParser.COMMA);
                                this.state = 113;
                                this.literalOrFml();
                            }
                        }
                    }
                    this.state = 118;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
                }
                this.state = 120;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 23) {
                    {
                        this.state = 119;
                        this.match(MangleParser.COMMA);
                    }
                }
                this.state = 126;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 31) {
                    {
                        {
                            this.state = 122;
                            this.match(MangleParser.PIPEGREATER);
                            this.state = 123;
                            this.transform();
                        }
                    }
                    this.state = 128;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    transform() {
        let localContext = new TransformContext(this.context, this.state);
        this.enterRule(localContext, 20, MangleParser.RULE_transform);
        let _la;
        try {
            this.state = 150;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
                case MangleParser.DO:
                    this.enterOuterAlt(localContext, 1);
                    {
                        this.state = 129;
                        this.match(MangleParser.DO);
                        this.state = 130;
                        this.term();
                        this.state = 140;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 23) {
                            {
                                this.state = 131;
                                this.match(MangleParser.COMMA);
                                this.state = 132;
                                this.letStmt();
                                this.state = 137;
                                this.errorHandler.sync(this);
                                _la = this.tokenStream.LA(1);
                                while (_la === 23) {
                                    {
                                        {
                                            this.state = 133;
                                            this.match(MangleParser.COMMA);
                                            this.state = 134;
                                            this.letStmt();
                                        }
                                    }
                                    this.state = 139;
                                    this.errorHandler.sync(this);
                                    _la = this.tokenStream.LA(1);
                                }
                            }
                        }
                    }
                    break;
                case MangleParser.LET:
                    this.enterOuterAlt(localContext, 2);
                    {
                        this.state = 142;
                        this.letStmt();
                        this.state = 147;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        while (_la === 23) {
                            {
                                {
                                    this.state = 143;
                                    this.match(MangleParser.COMMA);
                                    this.state = 144;
                                    this.letStmt();
                                }
                            }
                            this.state = 149;
                            this.errorHandler.sync(this);
                            _la = this.tokenStream.LA(1);
                        }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    letStmt() {
        let localContext = new LetStmtContext(this.context, this.state);
        this.enterRule(localContext, 22, MangleParser.RULE_letStmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 152;
                this.match(MangleParser.LET);
                this.state = 153;
                this.match(MangleParser.VARIABLE);
                this.state = 154;
                this.match(MangleParser.EQ);
                this.state = 155;
                this.term();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    literalOrFml() {
        let localContext = new LiteralOrFmlContext(this.context, this.state);
        this.enterRule(localContext, 24, MangleParser.RULE_literalOrFml);
        let _la;
        try {
            this.state = 164;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
                case MangleParser.T__4:
                case MangleParser.LBRACKET:
                case MangleParser.NUMBER:
                case MangleParser.FLOAT:
                case MangleParser.VARIABLE:
                case MangleParser.NAME:
                case MangleParser.DOT_TYPE:
                case MangleParser.CONSTANT:
                case MangleParser.STRING:
                case MangleParser.BYTESTRING:
                    this.enterOuterAlt(localContext, 1);
                    {
                        this.state = 157;
                        this.term();
                        this.state = 160;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 509607936) !== 0)) {
                            {
                                this.state = 158;
                                _la = this.tokenStream.LA(1);
                                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & 509607936) !== 0))) {
                                    this.errorHandler.recoverInline(this);
                                }
                                else {
                                    this.errorHandler.reportMatch(this);
                                    this.consume();
                                }
                                this.state = 159;
                                this.term();
                            }
                        }
                    }
                    break;
                case MangleParser.BANG:
                    this.enterOuterAlt(localContext, 2);
                    {
                        this.state = 162;
                        this.match(MangleParser.BANG);
                        this.state = 163;
                        this.term();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    term() {
        let localContext = new TermContext(this.context, this.state);
        this.enterRule(localContext, 26, MangleParser.RULE_term);
        let _la;
        try {
            let alternative;
            this.state = 252;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 32, this.context)) {
                case 1:
                    localContext = new VarContext(localContext);
                    this.enterOuterAlt(localContext, 1);
                    {
                        this.state = 166;
                        this.match(MangleParser.VARIABLE);
                    }
                    break;
                case 2:
                    localContext = new ConstContext(localContext);
                    this.enterOuterAlt(localContext, 2);
                    {
                        this.state = 167;
                        this.match(MangleParser.CONSTANT);
                    }
                    break;
                case 3:
                    localContext = new NumContext(localContext);
                    this.enterOuterAlt(localContext, 3);
                    {
                        this.state = 168;
                        this.match(MangleParser.NUMBER);
                    }
                    break;
                case 4:
                    localContext = new FloatContext(localContext);
                    this.enterOuterAlt(localContext, 4);
                    {
                        this.state = 169;
                        this.match(MangleParser.FLOAT);
                    }
                    break;
                case 5:
                    localContext = new StrContext(localContext);
                    this.enterOuterAlt(localContext, 5);
                    {
                        this.state = 170;
                        this.match(MangleParser.STRING);
                    }
                    break;
                case 6:
                    localContext = new BStrContext(localContext);
                    this.enterOuterAlt(localContext, 6);
                    {
                        this.state = 171;
                        this.match(MangleParser.BYTESTRING);
                    }
                    break;
                case 7:
                    localContext = new ListContext(localContext);
                    this.enterOuterAlt(localContext, 7);
                    {
                        this.state = 172;
                        this.match(MangleParser.LBRACKET);
                        this.state = 178;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                    {
                                        this.state = 173;
                                        this.term();
                                        this.state = 174;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                            this.state = 180;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 21, this.context);
                        }
                        this.state = 182;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                            {
                                this.state = 181;
                                this.term();
                            }
                        }
                        this.state = 184;
                        this.match(MangleParser.RBRACKET);
                    }
                    break;
                case 8:
                    localContext = new MapContext(localContext);
                    this.enterOuterAlt(localContext, 8);
                    {
                        this.state = 185;
                        this.match(MangleParser.LBRACKET);
                        this.state = 193;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 23, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                    {
                                        this.state = 186;
                                        this.term();
                                        this.state = 187;
                                        this.match(MangleParser.T__3);
                                        this.state = 188;
                                        this.term();
                                        this.state = 189;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                            this.state = 195;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 23, this.context);
                        }
                        this.state = 200;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                            {
                                this.state = 196;
                                this.term();
                                this.state = 197;
                                this.match(MangleParser.T__3);
                                this.state = 198;
                                this.term();
                            }
                        }
                        this.state = 202;
                        this.match(MangleParser.RBRACKET);
                    }
                    break;
                case 9:
                    localContext = new StructContext(localContext);
                    this.enterOuterAlt(localContext, 9);
                    {
                        this.state = 203;
                        this.match(MangleParser.T__4);
                        this.state = 211;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                    {
                                        this.state = 204;
                                        this.term();
                                        this.state = 205;
                                        this.match(MangleParser.T__3);
                                        this.state = 206;
                                        this.term();
                                        this.state = 207;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                            this.state = 213;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
                        }
                        this.state = 218;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                            {
                                this.state = 214;
                                this.term();
                                this.state = 215;
                                this.match(MangleParser.T__3);
                                this.state = 216;
                                this.term();
                            }
                        }
                        this.state = 220;
                        this.match(MangleParser.T__5);
                    }
                    break;
                case 10:
                    localContext = new DotTypeContext(localContext);
                    this.enterOuterAlt(localContext, 10);
                    {
                        this.state = 221;
                        this.match(MangleParser.DOT_TYPE);
                        this.state = 222;
                        this.match(MangleParser.LESS);
                        this.state = 228;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 27, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                    {
                                        this.state = 223;
                                        this.member();
                                        this.state = 224;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                            this.state = 230;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 27, this.context);
                        }
                        this.state = 235;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 524448) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                            {
                                this.state = 231;
                                this.member();
                                this.state = 233;
                                this.errorHandler.sync(this);
                                _la = this.tokenStream.LA(1);
                                if (_la === 23) {
                                    {
                                        this.state = 232;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                        }
                        this.state = 237;
                        this.match(MangleParser.GREATER);
                    }
                    break;
                case 11:
                    localContext = new ApplContext(localContext);
                    this.enterOuterAlt(localContext, 11);
                    {
                        this.state = 238;
                        this.match(MangleParser.NAME);
                        this.state = 239;
                        this.match(MangleParser.LPAREN);
                        this.state = 245;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 30, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                    {
                                        this.state = 240;
                                        this.term();
                                        this.state = 241;
                                        this.match(MangleParser.COMMA);
                                    }
                                }
                            }
                            this.state = 247;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 30, this.context);
                        }
                        this.state = 249;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                            {
                                this.state = 248;
                                this.term();
                            }
                        }
                        this.state = 251;
                        this.match(MangleParser.RPAREN);
                    }
                    break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    member() {
        let localContext = new MemberContext(this.context, this.state);
        this.enterRule(localContext, 28, MangleParser.RULE_member);
        let _la;
        try {
            this.state = 264;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
                case MangleParser.T__4:
                case MangleParser.LBRACKET:
                case MangleParser.NUMBER:
                case MangleParser.FLOAT:
                case MangleParser.VARIABLE:
                case MangleParser.NAME:
                case MangleParser.DOT_TYPE:
                case MangleParser.CONSTANT:
                case MangleParser.STRING:
                case MangleParser.BYTESTRING:
                    this.enterOuterAlt(localContext, 1);
                    {
                        this.state = 254;
                        this.term();
                        this.state = 257;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 4) {
                            {
                                this.state = 255;
                                this.match(MangleParser.T__3);
                                this.state = 256;
                                this.term();
                            }
                        }
                    }
                    break;
                case MangleParser.T__6:
                    this.enterOuterAlt(localContext, 2);
                    {
                        this.state = 259;
                        this.match(MangleParser.T__6);
                        this.state = 260;
                        this.term();
                        this.state = 261;
                        this.match(MangleParser.T__3);
                        this.state = 262;
                        this.term();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    atom() {
        let localContext = new AtomContext(this.context, this.state);
        this.enterRule(localContext, 30, MangleParser.RULE_atom);
        try {
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 266;
                this.term();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    atoms() {
        let localContext = new AtomsContext(this.context, this.state);
        this.enterRule(localContext, 32, MangleParser.RULE_atoms);
        let _la;
        try {
            let alternative;
            this.enterOuterAlt(localContext, 1);
            {
                this.state = 268;
                this.match(MangleParser.LBRACKET);
                this.state = 274;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 35, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                            {
                                this.state = 269;
                                this.atom();
                                this.state = 270;
                                this.match(MangleParser.COMMA);
                            }
                        }
                    }
                    this.state = 276;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 35, this.context);
                }
                this.state = 278;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 5 || _la === 19 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 495) !== 0)) {
                    {
                        this.state = 277;
                        this.atom();
                    }
                }
                this.state = 280;
                this.match(MangleParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    static _serializedATN = [
        4, 1, 40, 283, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 4, 2, 5, 7, 5, 2, 6, 7,
        6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7, 10, 2, 11, 7, 11, 2, 12, 7, 12, 2, 13, 7, 13,
        2, 14, 7, 14, 2, 15, 7, 15, 2, 16, 7, 16, 1, 0, 1, 0, 1, 0, 1, 1, 3, 1, 39, 8, 1, 1, 1, 5, 1,
        42, 8, 1, 10, 1, 12, 1, 45, 9, 1, 1, 1, 1, 1, 5, 1, 49, 8, 1, 10, 1, 12, 1, 52, 9, 1, 1, 2,
        1, 2, 1, 2, 3, 2, 57, 8, 2, 1, 2, 1, 2, 1, 3, 1, 3, 1, 3, 3, 3, 64, 8, 3, 1, 3, 1, 3, 1, 4, 1,
        4, 1, 4, 3, 4, 71, 8, 4, 1, 4, 5, 4, 74, 8, 4, 10, 4, 12, 4, 77, 9, 4, 1, 4, 3, 4, 80, 8, 4,
        1, 4, 1, 4, 1, 5, 1, 5, 1, 5, 1, 6, 1, 6, 1, 6, 1, 6, 1, 6, 5, 6, 92, 8, 6, 10, 6, 12, 6, 95,
        9, 6, 1, 6, 3, 6, 98, 8, 6, 1, 6, 1, 6, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 8, 3, 8, 108, 8, 8, 1,
        8, 1, 8, 1, 9, 1, 9, 1, 9, 5, 9, 115, 8, 9, 10, 9, 12, 9, 118, 9, 9, 1, 9, 3, 9, 121, 8, 9,
        1, 9, 1, 9, 5, 9, 125, 8, 9, 10, 9, 12, 9, 128, 9, 9, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1,
        10, 5, 10, 136, 8, 10, 10, 10, 12, 10, 139, 9, 10, 3, 10, 141, 8, 10, 1, 10, 1, 10, 1,
        10, 5, 10, 146, 8, 10, 10, 10, 12, 10, 149, 9, 10, 3, 10, 151, 8, 10, 1, 11, 1, 11, 1,
        11, 1, 11, 1, 11, 1, 12, 1, 12, 1, 12, 3, 12, 161, 8, 12, 1, 12, 1, 12, 3, 12, 165, 8, 12,
        1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 5, 13, 177, 8, 13,
        10, 13, 12, 13, 180, 9, 13, 1, 13, 3, 13, 183, 8, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13,
        1, 13, 1, 13, 5, 13, 192, 8, 13, 10, 13, 12, 13, 195, 9, 13, 1, 13, 1, 13, 1, 13, 1, 13,
        3, 13, 201, 8, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 5, 13, 210, 8, 13, 10,
        13, 12, 13, 213, 9, 13, 1, 13, 1, 13, 1, 13, 1, 13, 3, 13, 219, 8, 13, 1, 13, 1, 13, 1,
        13, 1, 13, 1, 13, 1, 13, 5, 13, 227, 8, 13, 10, 13, 12, 13, 230, 9, 13, 1, 13, 1, 13, 3,
        13, 234, 8, 13, 3, 13, 236, 8, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 1, 13, 5, 13, 244,
        8, 13, 10, 13, 12, 13, 247, 9, 13, 1, 13, 3, 13, 250, 8, 13, 1, 13, 3, 13, 253, 8, 13,
        1, 14, 1, 14, 1, 14, 3, 14, 258, 8, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 3, 14, 265, 8,
        14, 1, 15, 1, 15, 1, 16, 1, 16, 1, 16, 1, 16, 5, 16, 273, 8, 16, 10, 16, 12, 16, 276, 9,
        16, 1, 16, 3, 16, 279, 8, 16, 1, 16, 1, 16, 1, 16, 0, 0, 17, 0, 2, 4, 6, 8, 10, 12, 14, 16,
        18, 20, 22, 24, 26, 28, 30, 32, 0, 2, 2, 0, 10, 10, 29, 29, 2, 0, 21, 22, 25, 28, 311,
        0, 34, 1, 0, 0, 0, 2, 38, 1, 0, 0, 0, 4, 53, 1, 0, 0, 0, 6, 60, 1, 0, 0, 0, 8, 67, 1, 0, 0, 0,
        10, 83, 1, 0, 0, 0, 12, 86, 1, 0, 0, 0, 14, 101, 1, 0, 0, 0, 16, 104, 1, 0, 0, 0, 18, 111,
        1, 0, 0, 0, 20, 150, 1, 0, 0, 0, 22, 152, 1, 0, 0, 0, 24, 164, 1, 0, 0, 0, 26, 252, 1, 0,
        0, 0, 28, 264, 1, 0, 0, 0, 30, 266, 1, 0, 0, 0, 32, 268, 1, 0, 0, 0, 34, 35, 3, 2, 1, 0, 35,
        36, 5, 0, 0, 1, 36, 1, 1, 0, 0, 0, 37, 39, 3, 4, 2, 0, 38, 37, 1, 0, 0, 0, 38, 39, 1, 0, 0,
        0, 39, 43, 1, 0, 0, 0, 40, 42, 3, 6, 3, 0, 41, 40, 1, 0, 0, 0, 42, 45, 1, 0, 0, 0, 43, 41,
        1, 0, 0, 0, 43, 44, 1, 0, 0, 0, 44, 50, 1, 0, 0, 0, 45, 43, 1, 0, 0, 0, 46, 49, 3, 8, 4, 0,
        47, 49, 3, 16, 8, 0, 48, 46, 1, 0, 0, 0, 48, 47, 1, 0, 0, 0, 49, 52, 1, 0, 0, 0, 50, 48, 1,
        0, 0, 0, 50, 51, 1, 0, 0, 0, 51, 3, 1, 0, 0, 0, 52, 50, 1, 0, 0, 0, 53, 54, 5, 11, 0, 0, 54,
        56, 5, 35, 0, 0, 55, 57, 3, 32, 16, 0, 56, 55, 1, 0, 0, 0, 56, 57, 1, 0, 0, 0, 57, 58, 1,
        0, 0, 0, 58, 59, 5, 24, 0, 0, 59, 5, 1, 0, 0, 0, 60, 61, 5, 12, 0, 0, 61, 63, 5, 35, 0, 0,
        62, 64, 3, 32, 16, 0, 63, 62, 1, 0, 0, 0, 63, 64, 1, 0, 0, 0, 64, 65, 1, 0, 0, 0, 65, 66,
        5, 24, 0, 0, 66, 7, 1, 0, 0, 0, 67, 68, 5, 13, 0, 0, 68, 70, 3, 30, 15, 0, 69, 71, 3, 10,
        5, 0, 70, 69, 1, 0, 0, 0, 70, 71, 1, 0, 0, 0, 71, 75, 1, 0, 0, 0, 72, 74, 3, 12, 6, 0, 73,
        72, 1, 0, 0, 0, 74, 77, 1, 0, 0, 0, 75, 73, 1, 0, 0, 0, 75, 76, 1, 0, 0, 0, 76, 79, 1, 0, 0,
        0, 77, 75, 1, 0, 0, 0, 78, 80, 3, 14, 7, 0, 79, 78, 1, 0, 0, 0, 79, 80, 1, 0, 0, 0, 80, 81,
        1, 0, 0, 0, 81, 82, 5, 1, 0, 0, 82, 9, 1, 0, 0, 0, 83, 84, 5, 2, 0, 0, 84, 85, 3, 32, 16, 0,
        85, 11, 1, 0, 0, 0, 86, 87, 5, 14, 0, 0, 87, 93, 5, 19, 0, 0, 88, 89, 3, 26, 13, 0, 89, 90,
        5, 23, 0, 0, 90, 92, 1, 0, 0, 0, 91, 88, 1, 0, 0, 0, 92, 95, 1, 0, 0, 0, 93, 91, 1, 0, 0, 0,
        93, 94, 1, 0, 0, 0, 94, 97, 1, 0, 0, 0, 95, 93, 1, 0, 0, 0, 96, 98, 3, 26, 13, 0, 97, 96,
        1, 0, 0, 0, 97, 98, 1, 0, 0, 0, 98, 99, 1, 0, 0, 0, 99, 100, 5, 20, 0, 0, 100, 13, 1, 0, 0,
        0, 101, 102, 5, 3, 0, 0, 102, 103, 3, 32, 16, 0, 103, 15, 1, 0, 0, 0, 104, 107, 3, 30,
        15, 0, 105, 106, 7, 0, 0, 0, 106, 108, 3, 18, 9, 0, 107, 105, 1, 0, 0, 0, 107, 108, 1,
        0, 0, 0, 108, 109, 1, 0, 0, 0, 109, 110, 5, 1, 0, 0, 110, 17, 1, 0, 0, 0, 111, 116, 3, 24,
        12, 0, 112, 113, 5, 23, 0, 0, 113, 115, 3, 24, 12, 0, 114, 112, 1, 0, 0, 0, 115, 118,
        1, 0, 0, 0, 116, 114, 1, 0, 0, 0, 116, 117, 1, 0, 0, 0, 117, 120, 1, 0, 0, 0, 118, 116,
        1, 0, 0, 0, 119, 121, 5, 23, 0, 0, 120, 119, 1, 0, 0, 0, 120, 121, 1, 0, 0, 0, 121, 126,
        1, 0, 0, 0, 122, 123, 5, 31, 0, 0, 123, 125, 3, 20, 10, 0, 124, 122, 1, 0, 0, 0, 125, 128,
        1, 0, 0, 0, 126, 124, 1, 0, 0, 0, 126, 127, 1, 0, 0, 0, 127, 19, 1, 0, 0, 0, 128, 126, 1,
        0, 0, 0, 129, 130, 5, 16, 0, 0, 130, 140, 3, 26, 13, 0, 131, 132, 5, 23, 0, 0, 132, 137,
        3, 22, 11, 0, 133, 134, 5, 23, 0, 0, 134, 136, 3, 22, 11, 0, 135, 133, 1, 0, 0, 0, 136,
        139, 1, 0, 0, 0, 137, 135, 1, 0, 0, 0, 137, 138, 1, 0, 0, 0, 138, 141, 1, 0, 0, 0, 139,
        137, 1, 0, 0, 0, 140, 131, 1, 0, 0, 0, 140, 141, 1, 0, 0, 0, 141, 151, 1, 0, 0, 0, 142,
        147, 3, 22, 11, 0, 143, 144, 5, 23, 0, 0, 144, 146, 3, 22, 11, 0, 145, 143, 1, 0, 0, 0,
        146, 149, 1, 0, 0, 0, 147, 145, 1, 0, 0, 0, 147, 148, 1, 0, 0, 0, 148, 151, 1, 0, 0, 0,
        149, 147, 1, 0, 0, 0, 150, 129, 1, 0, 0, 0, 150, 142, 1, 0, 0, 0, 151, 21, 1, 0, 0, 0, 152,
        153, 5, 15, 0, 0, 153, 154, 5, 34, 0, 0, 154, 155, 5, 21, 0, 0, 155, 156, 3, 26, 13, 0,
        156, 23, 1, 0, 0, 0, 157, 160, 3, 26, 13, 0, 158, 159, 7, 1, 0, 0, 159, 161, 3, 26, 13,
        0, 160, 158, 1, 0, 0, 0, 160, 161, 1, 0, 0, 0, 161, 165, 1, 0, 0, 0, 162, 163, 5, 24, 0,
        0, 163, 165, 3, 26, 13, 0, 164, 157, 1, 0, 0, 0, 164, 162, 1, 0, 0, 0, 165, 25, 1, 0, 0,
        0, 166, 253, 5, 34, 0, 0, 167, 253, 5, 38, 0, 0, 168, 253, 5, 32, 0, 0, 169, 253, 5, 33,
        0, 0, 170, 253, 5, 39, 0, 0, 171, 253, 5, 40, 0, 0, 172, 178, 5, 19, 0, 0, 173, 174, 3,
        26, 13, 0, 174, 175, 5, 23, 0, 0, 175, 177, 1, 0, 0, 0, 176, 173, 1, 0, 0, 0, 177, 180,
        1, 0, 0, 0, 178, 176, 1, 0, 0, 0, 178, 179, 1, 0, 0, 0, 179, 182, 1, 0, 0, 0, 180, 178,
        1, 0, 0, 0, 181, 183, 3, 26, 13, 0, 182, 181, 1, 0, 0, 0, 182, 183, 1, 0, 0, 0, 183, 184,
        1, 0, 0, 0, 184, 253, 5, 20, 0, 0, 185, 193, 5, 19, 0, 0, 186, 187, 3, 26, 13, 0, 187,
        188, 5, 4, 0, 0, 188, 189, 3, 26, 13, 0, 189, 190, 5, 23, 0, 0, 190, 192, 1, 0, 0, 0, 191,
        186, 1, 0, 0, 0, 192, 195, 1, 0, 0, 0, 193, 191, 1, 0, 0, 0, 193, 194, 1, 0, 0, 0, 194,
        200, 1, 0, 0, 0, 195, 193, 1, 0, 0, 0, 196, 197, 3, 26, 13, 0, 197, 198, 5, 4, 0, 0, 198,
        199, 3, 26, 13, 0, 199, 201, 1, 0, 0, 0, 200, 196, 1, 0, 0, 0, 200, 201, 1, 0, 0, 0, 201,
        202, 1, 0, 0, 0, 202, 253, 5, 20, 0, 0, 203, 211, 5, 5, 0, 0, 204, 205, 3, 26, 13, 0, 205,
        206, 5, 4, 0, 0, 206, 207, 3, 26, 13, 0, 207, 208, 5, 23, 0, 0, 208, 210, 1, 0, 0, 0, 209,
        204, 1, 0, 0, 0, 210, 213, 1, 0, 0, 0, 211, 209, 1, 0, 0, 0, 211, 212, 1, 0, 0, 0, 212,
        218, 1, 0, 0, 0, 213, 211, 1, 0, 0, 0, 214, 215, 3, 26, 13, 0, 215, 216, 5, 4, 0, 0, 216,
        217, 3, 26, 13, 0, 217, 219, 1, 0, 0, 0, 218, 214, 1, 0, 0, 0, 218, 219, 1, 0, 0, 0, 219,
        220, 1, 0, 0, 0, 220, 253, 5, 6, 0, 0, 221, 222, 5, 37, 0, 0, 222, 228, 5, 25, 0, 0, 223,
        224, 3, 28, 14, 0, 224, 225, 5, 23, 0, 0, 225, 227, 1, 0, 0, 0, 226, 223, 1, 0, 0, 0, 227,
        230, 1, 0, 0, 0, 228, 226, 1, 0, 0, 0, 228, 229, 1, 0, 0, 0, 229, 235, 1, 0, 0, 0, 230,
        228, 1, 0, 0, 0, 231, 233, 3, 28, 14, 0, 232, 234, 5, 23, 0, 0, 233, 232, 1, 0, 0, 0, 233,
        234, 1, 0, 0, 0, 234, 236, 1, 0, 0, 0, 235, 231, 1, 0, 0, 0, 235, 236, 1, 0, 0, 0, 236,
        237, 1, 0, 0, 0, 237, 253, 5, 27, 0, 0, 238, 239, 5, 35, 0, 0, 239, 245, 5, 17, 0, 0, 240,
        241, 3, 26, 13, 0, 241, 242, 5, 23, 0, 0, 242, 244, 1, 0, 0, 0, 243, 240, 1, 0, 0, 0, 244,
        247, 1, 0, 0, 0, 245, 243, 1, 0, 0, 0, 245, 246, 1, 0, 0, 0, 246, 249, 1, 0, 0, 0, 247,
        245, 1, 0, 0, 0, 248, 250, 3, 26, 13, 0, 249, 248, 1, 0, 0, 0, 249, 250, 1, 0, 0, 0, 250,
        251, 1, 0, 0, 0, 251, 253, 5, 18, 0, 0, 252, 166, 1, 0, 0, 0, 252, 167, 1, 0, 0, 0, 252,
        168, 1, 0, 0, 0, 252, 169, 1, 0, 0, 0, 252, 170, 1, 0, 0, 0, 252, 171, 1, 0, 0, 0, 252,
        172, 1, 0, 0, 0, 252, 185, 1, 0, 0, 0, 252, 203, 1, 0, 0, 0, 252, 221, 1, 0, 0, 0, 252,
        238, 1, 0, 0, 0, 253, 27, 1, 0, 0, 0, 254, 257, 3, 26, 13, 0, 255, 256, 5, 4, 0, 0, 256,
        258, 3, 26, 13, 0, 257, 255, 1, 0, 0, 0, 257, 258, 1, 0, 0, 0, 258, 265, 1, 0, 0, 0, 259,
        260, 5, 7, 0, 0, 260, 261, 3, 26, 13, 0, 261, 262, 5, 4, 0, 0, 262, 263, 3, 26, 13, 0,
        263, 265, 1, 0, 0, 0, 264, 254, 1, 0, 0, 0, 264, 259, 1, 0, 0, 0, 265, 29, 1, 0, 0, 0, 266,
        267, 3, 26, 13, 0, 267, 31, 1, 0, 0, 0, 268, 274, 5, 19, 0, 0, 269, 270, 3, 30, 15, 0,
        270, 271, 5, 23, 0, 0, 271, 273, 1, 0, 0, 0, 272, 269, 1, 0, 0, 0, 273, 276, 1, 0, 0, 0,
        274, 272, 1, 0, 0, 0, 274, 275, 1, 0, 0, 0, 275, 278, 1, 0, 0, 0, 276, 274, 1, 0, 0, 0,
        277, 279, 3, 30, 15, 0, 278, 277, 1, 0, 0, 0, 278, 279, 1, 0, 0, 0, 279, 280, 1, 0, 0,
        0, 280, 281, 5, 20, 0, 0, 281, 33, 1, 0, 0, 0, 37, 38, 43, 48, 50, 56, 63, 70, 75, 79,
        93, 97, 107, 116, 120, 126, 137, 140, 147, 150, 160, 164, 178, 182, 193, 200, 211,
        218, 228, 233, 235, 245, 249, 252, 257, 264, 274, 278
    ];
    static __ATN;
    static get _ATN() {
        if (!MangleParser.__ATN) {
            MangleParser.__ATN = new antlr.ATNDeserializer().deserialize(MangleParser._serializedATN);
        }
        return MangleParser.__ATN;
    }
    static vocabulary = new antlr.Vocabulary(MangleParser.literalNames, MangleParser.symbolicNames, []);
    get vocabulary() {
        return MangleParser.vocabulary;
    }
    static decisionsToDFA = MangleParser._ATN.decisionToState.map((ds, index) => new antlr.DFA(ds, index));
}
exports.MangleParser = MangleParser;
class StartContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    program() {
        return this.getRuleContext(0, ProgramContext);
    }
    EOF() {
        return this.getToken(MangleParser.EOF, 0);
    }
    get ruleIndex() {
        return MangleParser.RULE_start;
    }
    enterRule(listener) {
        if (listener.enterStart) {
            listener.enterStart(this);
        }
    }
    exitRule(listener) {
        if (listener.exitStart) {
            listener.exitStart(this);
        }
    }
    accept(visitor) {
        if (visitor.visitStart) {
            return visitor.visitStart(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StartContext = StartContext;
class ProgramContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    packageDecl() {
        return this.getRuleContext(0, PackageDeclContext);
    }
    useDecl(i) {
        if (i === undefined) {
            return this.getRuleContexts(UseDeclContext);
        }
        return this.getRuleContext(i, UseDeclContext);
    }
    decl(i) {
        if (i === undefined) {
            return this.getRuleContexts(DeclContext);
        }
        return this.getRuleContext(i, DeclContext);
    }
    clause(i) {
        if (i === undefined) {
            return this.getRuleContexts(ClauseContext);
        }
        return this.getRuleContext(i, ClauseContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_program;
    }
    enterRule(listener) {
        if (listener.enterProgram) {
            listener.enterProgram(this);
        }
    }
    exitRule(listener) {
        if (listener.exitProgram) {
            listener.exitProgram(this);
        }
    }
    accept(visitor) {
        if (visitor.visitProgram) {
            return visitor.visitProgram(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ProgramContext = ProgramContext;
class PackageDeclContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    PACKAGE() {
        return this.getToken(MangleParser.PACKAGE, 0);
    }
    NAME() {
        return this.getToken(MangleParser.NAME, 0);
    }
    BANG() {
        return this.getToken(MangleParser.BANG, 0);
    }
    atoms() {
        return this.getRuleContext(0, AtomsContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_packageDecl;
    }
    enterRule(listener) {
        if (listener.enterPackageDecl) {
            listener.enterPackageDecl(this);
        }
    }
    exitRule(listener) {
        if (listener.exitPackageDecl) {
            listener.exitPackageDecl(this);
        }
    }
    accept(visitor) {
        if (visitor.visitPackageDecl) {
            return visitor.visitPackageDecl(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.PackageDeclContext = PackageDeclContext;
class UseDeclContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    USE() {
        return this.getToken(MangleParser.USE, 0);
    }
    NAME() {
        return this.getToken(MangleParser.NAME, 0);
    }
    BANG() {
        return this.getToken(MangleParser.BANG, 0);
    }
    atoms() {
        return this.getRuleContext(0, AtomsContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_useDecl;
    }
    enterRule(listener) {
        if (listener.enterUseDecl) {
            listener.enterUseDecl(this);
        }
    }
    exitRule(listener) {
        if (listener.exitUseDecl) {
            listener.exitUseDecl(this);
        }
    }
    accept(visitor) {
        if (visitor.visitUseDecl) {
            return visitor.visitUseDecl(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.UseDeclContext = UseDeclContext;
class DeclContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    DECL() {
        return this.getToken(MangleParser.DECL, 0);
    }
    atom() {
        return this.getRuleContext(0, AtomContext);
    }
    descrBlock() {
        return this.getRuleContext(0, DescrBlockContext);
    }
    boundsBlock(i) {
        if (i === undefined) {
            return this.getRuleContexts(BoundsBlockContext);
        }
        return this.getRuleContext(i, BoundsBlockContext);
    }
    constraintsBlock() {
        return this.getRuleContext(0, ConstraintsBlockContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_decl;
    }
    enterRule(listener) {
        if (listener.enterDecl) {
            listener.enterDecl(this);
        }
    }
    exitRule(listener) {
        if (listener.exitDecl) {
            listener.exitDecl(this);
        }
    }
    accept(visitor) {
        if (visitor.visitDecl) {
            return visitor.visitDecl(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DeclContext = DeclContext;
class DescrBlockContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    atoms() {
        return this.getRuleContext(0, AtomsContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_descrBlock;
    }
    enterRule(listener) {
        if (listener.enterDescrBlock) {
            listener.enterDescrBlock(this);
        }
    }
    exitRule(listener) {
        if (listener.exitDescrBlock) {
            listener.exitDescrBlock(this);
        }
    }
    accept(visitor) {
        if (visitor.visitDescrBlock) {
            return visitor.visitDescrBlock(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DescrBlockContext = DescrBlockContext;
class BoundsBlockContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    BOUND() {
        return this.getToken(MangleParser.BOUND, 0);
    }
    LBRACKET() {
        return this.getToken(MangleParser.LBRACKET, 0);
    }
    RBRACKET() {
        return this.getToken(MangleParser.RBRACKET, 0);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    get ruleIndex() {
        return MangleParser.RULE_boundsBlock;
    }
    enterRule(listener) {
        if (listener.enterBoundsBlock) {
            listener.enterBoundsBlock(this);
        }
    }
    exitRule(listener) {
        if (listener.exitBoundsBlock) {
            listener.exitBoundsBlock(this);
        }
    }
    accept(visitor) {
        if (visitor.visitBoundsBlock) {
            return visitor.visitBoundsBlock(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BoundsBlockContext = BoundsBlockContext;
class ConstraintsBlockContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    atoms() {
        return this.getRuleContext(0, AtomsContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_constraintsBlock;
    }
    enterRule(listener) {
        if (listener.enterConstraintsBlock) {
            listener.enterConstraintsBlock(this);
        }
    }
    exitRule(listener) {
        if (listener.exitConstraintsBlock) {
            listener.exitConstraintsBlock(this);
        }
    }
    accept(visitor) {
        if (visitor.visitConstraintsBlock) {
            return visitor.visitConstraintsBlock(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ConstraintsBlockContext = ConstraintsBlockContext;
class ClauseContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    atom() {
        return this.getRuleContext(0, AtomContext);
    }
    clauseBody() {
        return this.getRuleContext(0, ClauseBodyContext);
    }
    COLONDASH() {
        return this.getToken(MangleParser.COLONDASH, 0);
    }
    LONGLEFTDOUBLEARROW() {
        return this.getToken(MangleParser.LONGLEFTDOUBLEARROW, 0);
    }
    get ruleIndex() {
        return MangleParser.RULE_clause;
    }
    enterRule(listener) {
        if (listener.enterClause) {
            listener.enterClause(this);
        }
    }
    exitRule(listener) {
        if (listener.exitClause) {
            listener.exitClause(this);
        }
    }
    accept(visitor) {
        if (visitor.visitClause) {
            return visitor.visitClause(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClauseContext = ClauseContext;
class ClauseBodyContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    literalOrFml(i) {
        if (i === undefined) {
            return this.getRuleContexts(LiteralOrFmlContext);
        }
        return this.getRuleContext(i, LiteralOrFmlContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    PIPEGREATER(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.PIPEGREATER);
        }
        else {
            return this.getToken(MangleParser.PIPEGREATER, i);
        }
    }
    transform(i) {
        if (i === undefined) {
            return this.getRuleContexts(TransformContext);
        }
        return this.getRuleContext(i, TransformContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_clauseBody;
    }
    enterRule(listener) {
        if (listener.enterClauseBody) {
            listener.enterClauseBody(this);
        }
    }
    exitRule(listener) {
        if (listener.exitClauseBody) {
            listener.exitClauseBody(this);
        }
    }
    accept(visitor) {
        if (visitor.visitClauseBody) {
            return visitor.visitClauseBody(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClauseBodyContext = ClauseBodyContext;
class TransformContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    DO() {
        return this.getToken(MangleParser.DO, 0);
    }
    term() {
        return this.getRuleContext(0, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    letStmt(i) {
        if (i === undefined) {
            return this.getRuleContexts(LetStmtContext);
        }
        return this.getRuleContext(i, LetStmtContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_transform;
    }
    enterRule(listener) {
        if (listener.enterTransform) {
            listener.enterTransform(this);
        }
    }
    exitRule(listener) {
        if (listener.exitTransform) {
            listener.exitTransform(this);
        }
    }
    accept(visitor) {
        if (visitor.visitTransform) {
            return visitor.visitTransform(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.TransformContext = TransformContext;
class LetStmtContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    LET() {
        return this.getToken(MangleParser.LET, 0);
    }
    VARIABLE() {
        return this.getToken(MangleParser.VARIABLE, 0);
    }
    EQ() {
        return this.getToken(MangleParser.EQ, 0);
    }
    term() {
        return this.getRuleContext(0, TermContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_letStmt;
    }
    enterRule(listener) {
        if (listener.enterLetStmt) {
            listener.enterLetStmt(this);
        }
    }
    exitRule(listener) {
        if (listener.exitLetStmt) {
            listener.exitLetStmt(this);
        }
    }
    accept(visitor) {
        if (visitor.visitLetStmt) {
            return visitor.visitLetStmt(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.LetStmtContext = LetStmtContext;
class LiteralOrFmlContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    EQ() {
        return this.getToken(MangleParser.EQ, 0);
    }
    BANGEQ() {
        return this.getToken(MangleParser.BANGEQ, 0);
    }
    LESS() {
        return this.getToken(MangleParser.LESS, 0);
    }
    LESSEQ() {
        return this.getToken(MangleParser.LESSEQ, 0);
    }
    GREATER() {
        return this.getToken(MangleParser.GREATER, 0);
    }
    GREATEREQ() {
        return this.getToken(MangleParser.GREATEREQ, 0);
    }
    BANG() {
        return this.getToken(MangleParser.BANG, 0);
    }
    get ruleIndex() {
        return MangleParser.RULE_literalOrFml;
    }
    enterRule(listener) {
        if (listener.enterLiteralOrFml) {
            listener.enterLiteralOrFml(this);
        }
    }
    exitRule(listener) {
        if (listener.exitLiteralOrFml) {
            listener.exitLiteralOrFml(this);
        }
    }
    accept(visitor) {
        if (visitor.visitLiteralOrFml) {
            return visitor.visitLiteralOrFml(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.LiteralOrFmlContext = LiteralOrFmlContext;
class TermContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    get ruleIndex() {
        return MangleParser.RULE_term;
    }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.TermContext = TermContext;
class StrContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    STRING() {
        return this.getToken(MangleParser.STRING, 0);
    }
    enterRule(listener) {
        if (listener.enterStr) {
            listener.enterStr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitStr) {
            listener.exitStr(this);
        }
    }
    accept(visitor) {
        if (visitor.visitStr) {
            return visitor.visitStr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StrContext = StrContext;
class BStrContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    BYTESTRING() {
        return this.getToken(MangleParser.BYTESTRING, 0);
    }
    enterRule(listener) {
        if (listener.enterBStr) {
            listener.enterBStr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitBStr) {
            listener.exitBStr(this);
        }
    }
    accept(visitor) {
        if (visitor.visitBStr) {
            return visitor.visitBStr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BStrContext = BStrContext;
class FloatContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    FLOAT() {
        return this.getToken(MangleParser.FLOAT, 0);
    }
    enterRule(listener) {
        if (listener.enterFloat) {
            listener.enterFloat(this);
        }
    }
    exitRule(listener) {
        if (listener.exitFloat) {
            listener.exitFloat(this);
        }
    }
    accept(visitor) {
        if (visitor.visitFloat) {
            return visitor.visitFloat(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FloatContext = FloatContext;
class ApplContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    NAME() {
        return this.getToken(MangleParser.NAME, 0);
    }
    LPAREN() {
        return this.getToken(MangleParser.LPAREN, 0);
    }
    RPAREN() {
        return this.getToken(MangleParser.RPAREN, 0);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    enterRule(listener) {
        if (listener.enterAppl) {
            listener.enterAppl(this);
        }
    }
    exitRule(listener) {
        if (listener.exitAppl) {
            listener.exitAppl(this);
        }
    }
    accept(visitor) {
        if (visitor.visitAppl) {
            return visitor.visitAppl(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ApplContext = ApplContext;
class VarContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    VARIABLE() {
        return this.getToken(MangleParser.VARIABLE, 0);
    }
    enterRule(listener) {
        if (listener.enterVar) {
            listener.enterVar(this);
        }
    }
    exitRule(listener) {
        if (listener.exitVar) {
            listener.exitVar(this);
        }
    }
    accept(visitor) {
        if (visitor.visitVar) {
            return visitor.visitVar(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.VarContext = VarContext;
class ConstContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    CONSTANT() {
        return this.getToken(MangleParser.CONSTANT, 0);
    }
    enterRule(listener) {
        if (listener.enterConst) {
            listener.enterConst(this);
        }
    }
    exitRule(listener) {
        if (listener.exitConst) {
            listener.exitConst(this);
        }
    }
    accept(visitor) {
        if (visitor.visitConst) {
            return visitor.visitConst(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ConstContext = ConstContext;
class NumContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    NUMBER() {
        return this.getToken(MangleParser.NUMBER, 0);
    }
    enterRule(listener) {
        if (listener.enterNum) {
            listener.enterNum(this);
        }
    }
    exitRule(listener) {
        if (listener.exitNum) {
            listener.exitNum(this);
        }
    }
    accept(visitor) {
        if (visitor.visitNum) {
            return visitor.visitNum(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.NumContext = NumContext;
class ListContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    LBRACKET() {
        return this.getToken(MangleParser.LBRACKET, 0);
    }
    RBRACKET() {
        return this.getToken(MangleParser.RBRACKET, 0);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    enterRule(listener) {
        if (listener.enterList) {
            listener.enterList(this);
        }
    }
    exitRule(listener) {
        if (listener.exitList) {
            listener.exitList(this);
        }
    }
    accept(visitor) {
        if (visitor.visitList) {
            return visitor.visitList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ListContext = ListContext;
class MapContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    LBRACKET() {
        return this.getToken(MangleParser.LBRACKET, 0);
    }
    RBRACKET() {
        return this.getToken(MangleParser.RBRACKET, 0);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    enterRule(listener) {
        if (listener.enterMap) {
            listener.enterMap(this);
        }
    }
    exitRule(listener) {
        if (listener.exitMap) {
            listener.exitMap(this);
        }
    }
    accept(visitor) {
        if (visitor.visitMap) {
            return visitor.visitMap(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MapContext = MapContext;
class StructContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    enterRule(listener) {
        if (listener.enterStruct) {
            listener.enterStruct(this);
        }
    }
    exitRule(listener) {
        if (listener.exitStruct) {
            listener.exitStruct(this);
        }
    }
    accept(visitor) {
        if (visitor.visitStruct) {
            return visitor.visitStruct(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StructContext = StructContext;
class DotTypeContext extends TermContext {
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    DOT_TYPE() {
        return this.getToken(MangleParser.DOT_TYPE, 0);
    }
    LESS() {
        return this.getToken(MangleParser.LESS, 0);
    }
    GREATER() {
        return this.getToken(MangleParser.GREATER, 0);
    }
    member(i) {
        if (i === undefined) {
            return this.getRuleContexts(MemberContext);
        }
        return this.getRuleContext(i, MemberContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    enterRule(listener) {
        if (listener.enterDotType) {
            listener.enterDotType(this);
        }
    }
    exitRule(listener) {
        if (listener.exitDotType) {
            listener.exitDotType(this);
        }
    }
    accept(visitor) {
        if (visitor.visitDotType) {
            return visitor.visitDotType(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DotTypeContext = DotTypeContext;
class MemberContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    term(i) {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }
        return this.getRuleContext(i, TermContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_member;
    }
    enterRule(listener) {
        if (listener.enterMember) {
            listener.enterMember(this);
        }
    }
    exitRule(listener) {
        if (listener.exitMember) {
            listener.exitMember(this);
        }
    }
    accept(visitor) {
        if (visitor.visitMember) {
            return visitor.visitMember(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MemberContext = MemberContext;
class AtomContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    term() {
        return this.getRuleContext(0, TermContext);
    }
    get ruleIndex() {
        return MangleParser.RULE_atom;
    }
    enterRule(listener) {
        if (listener.enterAtom) {
            listener.enterAtom(this);
        }
    }
    exitRule(listener) {
        if (listener.exitAtom) {
            listener.exitAtom(this);
        }
    }
    accept(visitor) {
        if (visitor.visitAtom) {
            return visitor.visitAtom(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AtomContext = AtomContext;
class AtomsContext extends antlr.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    LBRACKET() {
        return this.getToken(MangleParser.LBRACKET, 0);
    }
    RBRACKET() {
        return this.getToken(MangleParser.RBRACKET, 0);
    }
    atom(i) {
        if (i === undefined) {
            return this.getRuleContexts(AtomContext);
        }
        return this.getRuleContext(i, AtomContext);
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(MangleParser.COMMA);
        }
        else {
            return this.getToken(MangleParser.COMMA, i);
        }
    }
    get ruleIndex() {
        return MangleParser.RULE_atoms;
    }
    enterRule(listener) {
        if (listener.enterAtoms) {
            listener.enterAtoms(this);
        }
    }
    exitRule(listener) {
        if (listener.exitAtoms) {
            listener.exitAtoms(this);
        }
    }
    accept(visitor) {
        if (visitor.visitAtoms) {
            return visitor.visitAtoms(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AtomsContext = AtomsContext;
//# sourceMappingURL=MangleParser.js.map