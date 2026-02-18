// Generated from Mangle.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { MangleListener } from "./MangleListener.js";
import { MangleVisitor } from "./MangleVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class MangleParser extends antlr.Parser {
    public static readonly T__0 = 1;
    public static readonly T__1 = 2;
    public static readonly T__2 = 3;
    public static readonly T__3 = 4;
    public static readonly T__4 = 5;
    public static readonly T__5 = 6;
    public static readonly T__6 = 7;
    public static readonly WHITESPACE = 8;
    public static readonly COMMENT = 9;
    public static readonly LONGLEFTDOUBLEARROW = 10;
    public static readonly PACKAGE = 11;
    public static readonly USE = 12;
    public static readonly DECL = 13;
    public static readonly BOUND = 14;
    public static readonly LET = 15;
    public static readonly DO = 16;
    public static readonly LPAREN = 17;
    public static readonly RPAREN = 18;
    public static readonly LBRACKET = 19;
    public static readonly RBRACKET = 20;
    public static readonly LBRACE = 21;
    public static readonly RBRACE = 22;
    public static readonly EQ = 23;
    public static readonly BANGEQ = 24;
    public static readonly COMMA = 25;
    public static readonly BANG = 26;
    public static readonly LESSEQ = 27;
    public static readonly LESS = 28;
    public static readonly GREATEREQ = 29;
    public static readonly GREATER = 30;
    public static readonly COLONDASH = 31;
    public static readonly NEWLINE = 32;
    public static readonly PIPEGREATER = 33;
    public static readonly AT = 34;
    public static readonly DIAMONDMINUS = 35;
    public static readonly DIAMONDPLUS = 36;
    public static readonly BOXMINUS = 37;
    public static readonly BOXPLUS = 38;
    public static readonly TIMESTAMP = 39;
    public static readonly DURATION = 40;
    public static readonly NUMBER = 41;
    public static readonly FLOAT = 42;
    public static readonly VARIABLE = 43;
    public static readonly NAME = 44;
    public static readonly TYPENAME = 45;
    public static readonly DOT_TYPE = 46;
    public static readonly CONSTANT = 47;
    public static readonly STRING = 48;
    public static readonly BYTESTRING = 49;
    public static readonly RULE_start = 0;
    public static readonly RULE_program = 1;
    public static readonly RULE_packageDecl = 2;
    public static readonly RULE_useDecl = 3;
    public static readonly RULE_decl = 4;
    public static readonly RULE_descrBlock = 5;
    public static readonly RULE_boundsBlock = 6;
    public static readonly RULE_constraintsBlock = 7;
    public static readonly RULE_clause = 8;
    public static readonly RULE_temporalAnnotation = 9;
    public static readonly RULE_temporalBound = 10;
    public static readonly RULE_clauseBody = 11;
    public static readonly RULE_transform = 12;
    public static readonly RULE_letStmt = 13;
    public static readonly RULE_literalOrFml = 14;
    public static readonly RULE_temporalOperator = 15;
    public static readonly RULE_term = 16;
    public static readonly RULE_member = 17;
    public static readonly RULE_atom = 18;
    public static readonly RULE_atoms = 19;

    public static readonly literalNames = [
        null, "'temporal'", "'.'", "'descr'", "'inclusion'", "'now'", "':'", 
        "'opt'", null, null, "'\\u27F8'", "'Package'", "'Use'", "'Decl'", 
        "'bound'", "'let'", "'do'", "'('", "')'", "'['", "']'", "'{'", "'}'", 
        "'='", "'!='", "','", "'!'", "'<='", "'<'", "'>='", "'>'", "':-'", 
        "'\\n'", "'|>'", "'@'", "'<-'", "'<+'", "'[-'", "'[+'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, "WHITESPACE", "COMMENT", 
        "LONGLEFTDOUBLEARROW", "PACKAGE", "USE", "DECL", "BOUND", "LET", 
        "DO", "LPAREN", "RPAREN", "LBRACKET", "RBRACKET", "LBRACE", "RBRACE", 
        "EQ", "BANGEQ", "COMMA", "BANG", "LESSEQ", "LESS", "GREATEREQ", 
        "GREATER", "COLONDASH", "NEWLINE", "PIPEGREATER", "AT", "DIAMONDMINUS", 
        "DIAMONDPLUS", "BOXMINUS", "BOXPLUS", "TIMESTAMP", "DURATION", "NUMBER", 
        "FLOAT", "VARIABLE", "NAME", "TYPENAME", "DOT_TYPE", "CONSTANT", 
        "STRING", "BYTESTRING"
    ];
    public static readonly ruleNames = [
        "start", "program", "packageDecl", "useDecl", "decl", "descrBlock", 
        "boundsBlock", "constraintsBlock", "clause", "temporalAnnotation", 
        "temporalBound", "clauseBody", "transform", "letStmt", "literalOrFml", 
        "temporalOperator", "term", "member", "atom", "atoms",
    ];

    public get grammarFileName(): string { return "Mangle.g4"; }
    public get literalNames(): (string | null)[] { return MangleParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return MangleParser.symbolicNames; }
    public get ruleNames(): string[] { return MangleParser.ruleNames; }
    public get serializedATN(): number[] { return MangleParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, MangleParser._ATN, MangleParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public start(): StartContext {
        let localContext = new StartContext(this.context, this.state);
        this.enterRule(localContext, 0, MangleParser.RULE_start);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 40;
            this.program();
            this.state = 41;
            this.match(MangleParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public program(): ProgramContext {
        let localContext = new ProgramContext(this.context, this.state);
        this.enterRule(localContext, 2, MangleParser.RULE_program);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 44;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 11) {
                {
                this.state = 43;
                this.packageDecl();
                }
            }

            this.state = 49;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 12) {
                {
                {
                this.state = 46;
                this.useDecl();
                }
                }
                this.state = 51;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 56;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2629632) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & 495) !== 0)) {
                {
                this.state = 54;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case MangleParser.DECL:
                    {
                    this.state = 52;
                    this.decl();
                    }
                    break;
                case MangleParser.LBRACKET:
                case MangleParser.LBRACE:
                case MangleParser.NUMBER:
                case MangleParser.FLOAT:
                case MangleParser.VARIABLE:
                case MangleParser.NAME:
                case MangleParser.DOT_TYPE:
                case MangleParser.CONSTANT:
                case MangleParser.STRING:
                case MangleParser.BYTESTRING:
                    {
                    this.state = 53;
                    this.clause();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 58;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public packageDecl(): PackageDeclContext {
        let localContext = new PackageDeclContext(this.context, this.state);
        this.enterRule(localContext, 4, MangleParser.RULE_packageDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 59;
            this.match(MangleParser.PACKAGE);
            this.state = 60;
            this.match(MangleParser.NAME);
            this.state = 62;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 61;
                this.atoms();
                }
            }

            this.state = 64;
            this.match(MangleParser.BANG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public useDecl(): UseDeclContext {
        let localContext = new UseDeclContext(this.context, this.state);
        this.enterRule(localContext, 6, MangleParser.RULE_useDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 66;
            this.match(MangleParser.USE);
            this.state = 67;
            this.match(MangleParser.NAME);
            this.state = 69;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 68;
                this.atoms();
                }
            }

            this.state = 71;
            this.match(MangleParser.BANG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public decl(): DeclContext {
        let localContext = new DeclContext(this.context, this.state);
        this.enterRule(localContext, 8, MangleParser.RULE_decl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 73;
            this.match(MangleParser.DECL);
            this.state = 74;
            this.atom();
            this.state = 76;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 1) {
                {
                this.state = 75;
                this.match(MangleParser.T__0);
                }
            }

            this.state = 79;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 78;
                this.descrBlock();
                }
            }

            this.state = 84;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 14) {
                {
                {
                this.state = 81;
                this.boundsBlock();
                }
                }
                this.state = 86;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 88;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 4) {
                {
                this.state = 87;
                this.constraintsBlock();
                }
            }

            this.state = 90;
            this.match(MangleParser.T__1);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public descrBlock(): DescrBlockContext {
        let localContext = new DescrBlockContext(this.context, this.state);
        this.enterRule(localContext, 10, MangleParser.RULE_descrBlock);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 92;
            this.match(MangleParser.T__2);
            this.state = 93;
            this.atoms();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public boundsBlock(): BoundsBlockContext {
        let localContext = new BoundsBlockContext(this.context, this.state);
        this.enterRule(localContext, 12, MangleParser.RULE_boundsBlock);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 95;
            this.match(MangleParser.BOUND);
            this.state = 96;
            this.match(MangleParser.LBRACKET);
            this.state = 102;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 97;
                    this.term();
                    this.state = 98;
                    this.match(MangleParser.COMMA);
                    }
                    }
                }
                this.state = 104;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            }
            this.state = 106;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                {
                this.state = 105;
                this.term();
                }
            }

            this.state = 108;
            this.match(MangleParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public constraintsBlock(): ConstraintsBlockContext {
        let localContext = new ConstraintsBlockContext(this.context, this.state);
        this.enterRule(localContext, 14, MangleParser.RULE_constraintsBlock);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 110;
            this.match(MangleParser.T__3);
            this.state = 111;
            this.atoms();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public clause(): ClauseContext {
        let localContext = new ClauseContext(this.context, this.state);
        this.enterRule(localContext, 16, MangleParser.RULE_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 113;
            this.atom();
            this.state = 115;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 34) {
                {
                this.state = 114;
                this.temporalAnnotation();
                }
            }

            this.state = 119;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 31) {
                {
                this.state = 117;
                _la = this.tokenStream.LA(1);
                if(!(_la === 10 || _la === 31)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 118;
                this.clauseBody();
                }
            }

            this.state = 121;
            this.match(MangleParser.T__1);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public temporalAnnotation(): TemporalAnnotationContext {
        let localContext = new TemporalAnnotationContext(this.context, this.state);
        this.enterRule(localContext, 18, MangleParser.RULE_temporalAnnotation);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 123;
            this.match(MangleParser.AT);
            this.state = 124;
            this.match(MangleParser.LBRACKET);
            this.state = 125;
            this.temporalBound();
            this.state = 128;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 25) {
                {
                this.state = 126;
                this.match(MangleParser.COMMA);
                this.state = 127;
                this.temporalBound();
                }
            }

            this.state = 130;
            this.match(MangleParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public temporalBound(): TemporalBoundContext {
        let localContext = new TemporalBoundContext(this.context, this.state);
        this.enterRule(localContext, 20, MangleParser.RULE_temporalBound);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 132;
            _la = this.tokenStream.LA(1);
            if(!(_la === 5 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 19) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public clauseBody(): ClauseBodyContext {
        let localContext = new ClauseBodyContext(this.context, this.state);
        this.enterRule(localContext, 22, MangleParser.RULE_clauseBody);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 134;
            this.literalOrFml();
            this.state = 139;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 15, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 135;
                    this.match(MangleParser.COMMA);
                    this.state = 136;
                    this.literalOrFml();
                    }
                    }
                }
                this.state = 141;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 15, this.context);
            }
            this.state = 143;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 25) {
                {
                this.state = 142;
                this.match(MangleParser.COMMA);
                }
            }

            this.state = 149;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 33) {
                {
                {
                this.state = 145;
                this.match(MangleParser.PIPEGREATER);
                this.state = 146;
                this.transform();
                }
                }
                this.state = 151;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public transform(): TransformContext {
        let localContext = new TransformContext(this.context, this.state);
        this.enterRule(localContext, 24, MangleParser.RULE_transform);
        let _la: number;
        try {
            this.state = 173;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MangleParser.DO:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 152;
                this.match(MangleParser.DO);
                this.state = 153;
                this.term();
                this.state = 163;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 25) {
                    {
                    this.state = 154;
                    this.match(MangleParser.COMMA);
                    this.state = 155;
                    this.letStmt();
                    this.state = 160;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 25) {
                        {
                        {
                        this.state = 156;
                        this.match(MangleParser.COMMA);
                        this.state = 157;
                        this.letStmt();
                        }
                        }
                        this.state = 162;
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
                this.state = 165;
                this.letStmt();
                this.state = 170;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 25) {
                    {
                    {
                    this.state = 166;
                    this.match(MangleParser.COMMA);
                    this.state = 167;
                    this.letStmt();
                    }
                    }
                    this.state = 172;
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
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public letStmt(): LetStmtContext {
        let localContext = new LetStmtContext(this.context, this.state);
        this.enterRule(localContext, 26, MangleParser.RULE_letStmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 175;
            this.match(MangleParser.LET);
            this.state = 176;
            this.match(MangleParser.VARIABLE);
            this.state = 177;
            this.match(MangleParser.EQ);
            this.state = 178;
            this.term();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literalOrFml(): LiteralOrFmlContext {
        let localContext = new LiteralOrFmlContext(this.context, this.state);
        this.enterRule(localContext, 28, MangleParser.RULE_literalOrFml);
        let _la: number;
        try {
            this.state = 193;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MangleParser.LBRACKET:
            case MangleParser.LBRACE:
            case MangleParser.DIAMONDMINUS:
            case MangleParser.DIAMONDPLUS:
            case MangleParser.BOXMINUS:
            case MangleParser.BOXPLUS:
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
                this.state = 181;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 15) !== 0)) {
                    {
                    this.state = 180;
                    this.temporalOperator();
                    }
                }

                this.state = 183;
                this.term();
                this.state = 185;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 34) {
                    {
                    this.state = 184;
                    this.temporalAnnotation();
                    }
                }

                this.state = 189;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2038431744) !== 0)) {
                    {
                    this.state = 187;
                    _la = this.tokenStream.LA(1);
                    if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 2038431744) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 188;
                    this.term();
                    }
                }

                }
                break;
            case MangleParser.BANG:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 191;
                this.match(MangleParser.BANG);
                this.state = 192;
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
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public temporalOperator(): TemporalOperatorContext {
        let localContext = new TemporalOperatorContext(this.context, this.state);
        this.enterRule(localContext, 30, MangleParser.RULE_temporalOperator);
        try {
            this.state = 223;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MangleParser.DIAMONDMINUS:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 195;
                this.match(MangleParser.DIAMONDMINUS);
                this.state = 196;
                this.match(MangleParser.LBRACKET);
                this.state = 197;
                this.temporalBound();
                this.state = 198;
                this.match(MangleParser.COMMA);
                this.state = 199;
                this.temporalBound();
                this.state = 200;
                this.match(MangleParser.RBRACKET);
                }
                break;
            case MangleParser.BOXMINUS:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 202;
                this.match(MangleParser.BOXMINUS);
                this.state = 203;
                this.match(MangleParser.LBRACKET);
                this.state = 204;
                this.temporalBound();
                this.state = 205;
                this.match(MangleParser.COMMA);
                this.state = 206;
                this.temporalBound();
                this.state = 207;
                this.match(MangleParser.RBRACKET);
                }
                break;
            case MangleParser.DIAMONDPLUS:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 209;
                this.match(MangleParser.DIAMONDPLUS);
                this.state = 210;
                this.match(MangleParser.LBRACKET);
                this.state = 211;
                this.temporalBound();
                this.state = 212;
                this.match(MangleParser.COMMA);
                this.state = 213;
                this.temporalBound();
                this.state = 214;
                this.match(MangleParser.RBRACKET);
                }
                break;
            case MangleParser.BOXPLUS:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 216;
                this.match(MangleParser.BOXPLUS);
                this.state = 217;
                this.match(MangleParser.LBRACKET);
                this.state = 218;
                this.temporalBound();
                this.state = 219;
                this.match(MangleParser.COMMA);
                this.state = 220;
                this.temporalBound();
                this.state = 221;
                this.match(MangleParser.RBRACKET);
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
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public term(): TermContext {
        let localContext = new TermContext(this.context, this.state);
        this.enterRule(localContext, 32, MangleParser.RULE_term);
        let _la: number;
        try {
            let alternative: number;
            this.state = 311;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                localContext = new VarContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 225;
                this.match(MangleParser.VARIABLE);
                }
                break;
            case 2:
                localContext = new ConstContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 226;
                this.match(MangleParser.CONSTANT);
                }
                break;
            case 3:
                localContext = new NumContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 227;
                this.match(MangleParser.NUMBER);
                }
                break;
            case 4:
                localContext = new FloatContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 228;
                this.match(MangleParser.FLOAT);
                }
                break;
            case 5:
                localContext = new StrContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 229;
                this.match(MangleParser.STRING);
                }
                break;
            case 6:
                localContext = new BStrContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 230;
                this.match(MangleParser.BYTESTRING);
                }
                break;
            case 7:
                localContext = new ListContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 231;
                this.match(MangleParser.LBRACKET);
                this.state = 237;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 27, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 232;
                        this.term();
                        this.state = 233;
                        this.match(MangleParser.COMMA);
                        }
                        }
                    }
                    this.state = 239;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 27, this.context);
                }
                this.state = 241;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                    {
                    this.state = 240;
                    this.term();
                    }
                }

                this.state = 243;
                this.match(MangleParser.RBRACKET);
                }
                break;
            case 8:
                localContext = new MapContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 244;
                this.match(MangleParser.LBRACKET);
                this.state = 252;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 29, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 245;
                        this.term();
                        this.state = 246;
                        this.match(MangleParser.T__5);
                        this.state = 247;
                        this.term();
                        this.state = 248;
                        this.match(MangleParser.COMMA);
                        }
                        }
                    }
                    this.state = 254;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 29, this.context);
                }
                this.state = 259;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                    {
                    this.state = 255;
                    this.term();
                    this.state = 256;
                    this.match(MangleParser.T__5);
                    this.state = 257;
                    this.term();
                    }
                }

                this.state = 261;
                this.match(MangleParser.RBRACKET);
                }
                break;
            case 9:
                localContext = new StructContext(localContext);
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 262;
                this.match(MangleParser.LBRACE);
                this.state = 270;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 31, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 263;
                        this.term();
                        this.state = 264;
                        this.match(MangleParser.T__5);
                        this.state = 265;
                        this.term();
                        this.state = 266;
                        this.match(MangleParser.COMMA);
                        }
                        }
                    }
                    this.state = 272;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 31, this.context);
                }
                this.state = 277;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                    {
                    this.state = 273;
                    this.term();
                    this.state = 274;
                    this.match(MangleParser.T__5);
                    this.state = 275;
                    this.term();
                    }
                }

                this.state = 279;
                this.match(MangleParser.RBRACE);
                }
                break;
            case 10:
                localContext = new DotTypeContext(localContext);
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 280;
                this.match(MangleParser.DOT_TYPE);
                this.state = 281;
                this.match(MangleParser.LESS);
                this.state = 287;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 282;
                        this.member();
                        this.state = 283;
                        this.match(MangleParser.COMMA);
                        }
                        }
                    }
                    this.state = 289;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
                }
                this.state = 294;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2621568) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & 495) !== 0)) {
                    {
                    this.state = 290;
                    this.member();
                    this.state = 292;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 25) {
                        {
                        this.state = 291;
                        this.match(MangleParser.COMMA);
                        }
                    }

                    }
                }

                this.state = 296;
                this.match(MangleParser.GREATER);
                }
                break;
            case 11:
                localContext = new ApplContext(localContext);
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 297;
                this.match(MangleParser.NAME);
                this.state = 298;
                this.match(MangleParser.LPAREN);
                this.state = 304;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 36, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 299;
                        this.term();
                        this.state = 300;
                        this.match(MangleParser.COMMA);
                        }
                        }
                    }
                    this.state = 306;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 36, this.context);
                }
                this.state = 308;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                    {
                    this.state = 307;
                    this.term();
                    }
                }

                this.state = 310;
                this.match(MangleParser.RPAREN);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public member(): MemberContext {
        let localContext = new MemberContext(this.context, this.state);
        this.enterRule(localContext, 34, MangleParser.RULE_member);
        let _la: number;
        try {
            this.state = 323;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MangleParser.LBRACKET:
            case MangleParser.LBRACE:
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
                this.state = 313;
                this.term();
                this.state = 316;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 6) {
                    {
                    this.state = 314;
                    this.match(MangleParser.T__5);
                    this.state = 315;
                    this.term();
                    }
                }

                }
                break;
            case MangleParser.T__6:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 318;
                this.match(MangleParser.T__6);
                this.state = 319;
                this.term();
                this.state = 320;
                this.match(MangleParser.T__5);
                this.state = 321;
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
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public atom(): AtomContext {
        let localContext = new AtomContext(this.context, this.state);
        this.enterRule(localContext, 36, MangleParser.RULE_atom);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 325;
            this.term();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public atoms(): AtomsContext {
        let localContext = new AtomsContext(this.context, this.state);
        this.enterRule(localContext, 38, MangleParser.RULE_atoms);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 327;
            this.match(MangleParser.LBRACKET);
            this.state = 333;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 41, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 328;
                    this.atom();
                    this.state = 329;
                    this.match(MangleParser.COMMA);
                    }
                    }
                }
                this.state = 335;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 41, this.context);
            }
            this.state = 337;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 19)) & ~0x1F) === 0 && ((1 << (_la - 19)) & 2076180485) !== 0)) {
                {
                this.state = 336;
                this.atom();
                }
            }

            this.state = 339;
            this.match(MangleParser.RBRACKET);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
        4,1,49,342,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,1,0,
        1,0,1,0,1,1,3,1,45,8,1,1,1,5,1,48,8,1,10,1,12,1,51,9,1,1,1,1,1,5,
        1,55,8,1,10,1,12,1,58,9,1,1,2,1,2,1,2,3,2,63,8,2,1,2,1,2,1,3,1,3,
        1,3,3,3,70,8,3,1,3,1,3,1,4,1,4,1,4,3,4,77,8,4,1,4,3,4,80,8,4,1,4,
        5,4,83,8,4,10,4,12,4,86,9,4,1,4,3,4,89,8,4,1,4,1,4,1,5,1,5,1,5,1,
        6,1,6,1,6,1,6,1,6,5,6,101,8,6,10,6,12,6,104,9,6,1,6,3,6,107,8,6,
        1,6,1,6,1,7,1,7,1,7,1,8,1,8,3,8,116,8,8,1,8,1,8,3,8,120,8,8,1,8,
        1,8,1,9,1,9,1,9,1,9,1,9,3,9,129,8,9,1,9,1,9,1,10,1,10,1,11,1,11,
        1,11,5,11,138,8,11,10,11,12,11,141,9,11,1,11,3,11,144,8,11,1,11,
        1,11,5,11,148,8,11,10,11,12,11,151,9,11,1,12,1,12,1,12,1,12,1,12,
        1,12,5,12,159,8,12,10,12,12,12,162,9,12,3,12,164,8,12,1,12,1,12,
        1,12,5,12,169,8,12,10,12,12,12,172,9,12,3,12,174,8,12,1,13,1,13,
        1,13,1,13,1,13,1,14,3,14,182,8,14,1,14,1,14,3,14,186,8,14,1,14,1,
        14,3,14,190,8,14,1,14,1,14,3,14,194,8,14,1,15,1,15,1,15,1,15,1,15,
        1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,
        1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,3,15,224,8,15,
        1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,5,16,236,8,16,
        10,16,12,16,239,9,16,1,16,3,16,242,8,16,1,16,1,16,1,16,1,16,1,16,
        1,16,1,16,5,16,251,8,16,10,16,12,16,254,9,16,1,16,1,16,1,16,1,16,
        3,16,260,8,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,5,16,269,8,16,10,
        16,12,16,272,9,16,1,16,1,16,1,16,1,16,3,16,278,8,16,1,16,1,16,1,
        16,1,16,1,16,1,16,5,16,286,8,16,10,16,12,16,289,9,16,1,16,1,16,3,
        16,293,8,16,3,16,295,8,16,1,16,1,16,1,16,1,16,1,16,1,16,5,16,303,
        8,16,10,16,12,16,306,9,16,1,16,3,16,309,8,16,1,16,3,16,312,8,16,
        1,17,1,17,1,17,3,17,317,8,17,1,17,1,17,1,17,1,17,1,17,3,17,324,8,
        17,1,18,1,18,1,19,1,19,1,19,1,19,5,19,332,8,19,10,19,12,19,335,9,
        19,1,19,3,19,338,8,19,1,19,1,19,1,19,0,0,20,0,2,4,6,8,10,12,14,16,
        18,20,22,24,26,28,30,32,34,36,38,0,3,2,0,10,10,31,31,3,0,5,5,39,
        40,43,43,2,0,23,24,27,30,375,0,40,1,0,0,0,2,44,1,0,0,0,4,59,1,0,
        0,0,6,66,1,0,0,0,8,73,1,0,0,0,10,92,1,0,0,0,12,95,1,0,0,0,14,110,
        1,0,0,0,16,113,1,0,0,0,18,123,1,0,0,0,20,132,1,0,0,0,22,134,1,0,
        0,0,24,173,1,0,0,0,26,175,1,0,0,0,28,193,1,0,0,0,30,223,1,0,0,0,
        32,311,1,0,0,0,34,323,1,0,0,0,36,325,1,0,0,0,38,327,1,0,0,0,40,41,
        3,2,1,0,41,42,5,0,0,1,42,1,1,0,0,0,43,45,3,4,2,0,44,43,1,0,0,0,44,
        45,1,0,0,0,45,49,1,0,0,0,46,48,3,6,3,0,47,46,1,0,0,0,48,51,1,0,0,
        0,49,47,1,0,0,0,49,50,1,0,0,0,50,56,1,0,0,0,51,49,1,0,0,0,52,55,
        3,8,4,0,53,55,3,16,8,0,54,52,1,0,0,0,54,53,1,0,0,0,55,58,1,0,0,0,
        56,54,1,0,0,0,56,57,1,0,0,0,57,3,1,0,0,0,58,56,1,0,0,0,59,60,5,11,
        0,0,60,62,5,44,0,0,61,63,3,38,19,0,62,61,1,0,0,0,62,63,1,0,0,0,63,
        64,1,0,0,0,64,65,5,26,0,0,65,5,1,0,0,0,66,67,5,12,0,0,67,69,5,44,
        0,0,68,70,3,38,19,0,69,68,1,0,0,0,69,70,1,0,0,0,70,71,1,0,0,0,71,
        72,5,26,0,0,72,7,1,0,0,0,73,74,5,13,0,0,74,76,3,36,18,0,75,77,5,
        1,0,0,76,75,1,0,0,0,76,77,1,0,0,0,77,79,1,0,0,0,78,80,3,10,5,0,79,
        78,1,0,0,0,79,80,1,0,0,0,80,84,1,0,0,0,81,83,3,12,6,0,82,81,1,0,
        0,0,83,86,1,0,0,0,84,82,1,0,0,0,84,85,1,0,0,0,85,88,1,0,0,0,86,84,
        1,0,0,0,87,89,3,14,7,0,88,87,1,0,0,0,88,89,1,0,0,0,89,90,1,0,0,0,
        90,91,5,2,0,0,91,9,1,0,0,0,92,93,5,3,0,0,93,94,3,38,19,0,94,11,1,
        0,0,0,95,96,5,14,0,0,96,102,5,19,0,0,97,98,3,32,16,0,98,99,5,25,
        0,0,99,101,1,0,0,0,100,97,1,0,0,0,101,104,1,0,0,0,102,100,1,0,0,
        0,102,103,1,0,0,0,103,106,1,0,0,0,104,102,1,0,0,0,105,107,3,32,16,
        0,106,105,1,0,0,0,106,107,1,0,0,0,107,108,1,0,0,0,108,109,5,20,0,
        0,109,13,1,0,0,0,110,111,5,4,0,0,111,112,3,38,19,0,112,15,1,0,0,
        0,113,115,3,36,18,0,114,116,3,18,9,0,115,114,1,0,0,0,115,116,1,0,
        0,0,116,119,1,0,0,0,117,118,7,0,0,0,118,120,3,22,11,0,119,117,1,
        0,0,0,119,120,1,0,0,0,120,121,1,0,0,0,121,122,5,2,0,0,122,17,1,0,
        0,0,123,124,5,34,0,0,124,125,5,19,0,0,125,128,3,20,10,0,126,127,
        5,25,0,0,127,129,3,20,10,0,128,126,1,0,0,0,128,129,1,0,0,0,129,130,
        1,0,0,0,130,131,5,20,0,0,131,19,1,0,0,0,132,133,7,1,0,0,133,21,1,
        0,0,0,134,139,3,28,14,0,135,136,5,25,0,0,136,138,3,28,14,0,137,135,
        1,0,0,0,138,141,1,0,0,0,139,137,1,0,0,0,139,140,1,0,0,0,140,143,
        1,0,0,0,141,139,1,0,0,0,142,144,5,25,0,0,143,142,1,0,0,0,143,144,
        1,0,0,0,144,149,1,0,0,0,145,146,5,33,0,0,146,148,3,24,12,0,147,145,
        1,0,0,0,148,151,1,0,0,0,149,147,1,0,0,0,149,150,1,0,0,0,150,23,1,
        0,0,0,151,149,1,0,0,0,152,153,5,16,0,0,153,163,3,32,16,0,154,155,
        5,25,0,0,155,160,3,26,13,0,156,157,5,25,0,0,157,159,3,26,13,0,158,
        156,1,0,0,0,159,162,1,0,0,0,160,158,1,0,0,0,160,161,1,0,0,0,161,
        164,1,0,0,0,162,160,1,0,0,0,163,154,1,0,0,0,163,164,1,0,0,0,164,
        174,1,0,0,0,165,170,3,26,13,0,166,167,5,25,0,0,167,169,3,26,13,0,
        168,166,1,0,0,0,169,172,1,0,0,0,170,168,1,0,0,0,170,171,1,0,0,0,
        171,174,1,0,0,0,172,170,1,0,0,0,173,152,1,0,0,0,173,165,1,0,0,0,
        174,25,1,0,0,0,175,176,5,15,0,0,176,177,5,43,0,0,177,178,5,23,0,
        0,178,179,3,32,16,0,179,27,1,0,0,0,180,182,3,30,15,0,181,180,1,0,
        0,0,181,182,1,0,0,0,182,183,1,0,0,0,183,185,3,32,16,0,184,186,3,
        18,9,0,185,184,1,0,0,0,185,186,1,0,0,0,186,189,1,0,0,0,187,188,7,
        2,0,0,188,190,3,32,16,0,189,187,1,0,0,0,189,190,1,0,0,0,190,194,
        1,0,0,0,191,192,5,26,0,0,192,194,3,32,16,0,193,181,1,0,0,0,193,191,
        1,0,0,0,194,29,1,0,0,0,195,196,5,35,0,0,196,197,5,19,0,0,197,198,
        3,20,10,0,198,199,5,25,0,0,199,200,3,20,10,0,200,201,5,20,0,0,201,
        224,1,0,0,0,202,203,5,37,0,0,203,204,5,19,0,0,204,205,3,20,10,0,
        205,206,5,25,0,0,206,207,3,20,10,0,207,208,5,20,0,0,208,224,1,0,
        0,0,209,210,5,36,0,0,210,211,5,19,0,0,211,212,3,20,10,0,212,213,
        5,25,0,0,213,214,3,20,10,0,214,215,5,20,0,0,215,224,1,0,0,0,216,
        217,5,38,0,0,217,218,5,19,0,0,218,219,3,20,10,0,219,220,5,25,0,0,
        220,221,3,20,10,0,221,222,5,20,0,0,222,224,1,0,0,0,223,195,1,0,0,
        0,223,202,1,0,0,0,223,209,1,0,0,0,223,216,1,0,0,0,224,31,1,0,0,0,
        225,312,5,43,0,0,226,312,5,47,0,0,227,312,5,41,0,0,228,312,5,42,
        0,0,229,312,5,48,0,0,230,312,5,49,0,0,231,237,5,19,0,0,232,233,3,
        32,16,0,233,234,5,25,0,0,234,236,1,0,0,0,235,232,1,0,0,0,236,239,
        1,0,0,0,237,235,1,0,0,0,237,238,1,0,0,0,238,241,1,0,0,0,239,237,
        1,0,0,0,240,242,3,32,16,0,241,240,1,0,0,0,241,242,1,0,0,0,242,243,
        1,0,0,0,243,312,5,20,0,0,244,252,5,19,0,0,245,246,3,32,16,0,246,
        247,5,6,0,0,247,248,3,32,16,0,248,249,5,25,0,0,249,251,1,0,0,0,250,
        245,1,0,0,0,251,254,1,0,0,0,252,250,1,0,0,0,252,253,1,0,0,0,253,
        259,1,0,0,0,254,252,1,0,0,0,255,256,3,32,16,0,256,257,5,6,0,0,257,
        258,3,32,16,0,258,260,1,0,0,0,259,255,1,0,0,0,259,260,1,0,0,0,260,
        261,1,0,0,0,261,312,5,20,0,0,262,270,5,21,0,0,263,264,3,32,16,0,
        264,265,5,6,0,0,265,266,3,32,16,0,266,267,5,25,0,0,267,269,1,0,0,
        0,268,263,1,0,0,0,269,272,1,0,0,0,270,268,1,0,0,0,270,271,1,0,0,
        0,271,277,1,0,0,0,272,270,1,0,0,0,273,274,3,32,16,0,274,275,5,6,
        0,0,275,276,3,32,16,0,276,278,1,0,0,0,277,273,1,0,0,0,277,278,1,
        0,0,0,278,279,1,0,0,0,279,312,5,22,0,0,280,281,5,46,0,0,281,287,
        5,28,0,0,282,283,3,34,17,0,283,284,5,25,0,0,284,286,1,0,0,0,285,
        282,1,0,0,0,286,289,1,0,0,0,287,285,1,0,0,0,287,288,1,0,0,0,288,
        294,1,0,0,0,289,287,1,0,0,0,290,292,3,34,17,0,291,293,5,25,0,0,292,
        291,1,0,0,0,292,293,1,0,0,0,293,295,1,0,0,0,294,290,1,0,0,0,294,
        295,1,0,0,0,295,296,1,0,0,0,296,312,5,30,0,0,297,298,5,44,0,0,298,
        304,5,17,0,0,299,300,3,32,16,0,300,301,5,25,0,0,301,303,1,0,0,0,
        302,299,1,0,0,0,303,306,1,0,0,0,304,302,1,0,0,0,304,305,1,0,0,0,
        305,308,1,0,0,0,306,304,1,0,0,0,307,309,3,32,16,0,308,307,1,0,0,
        0,308,309,1,0,0,0,309,310,1,0,0,0,310,312,5,18,0,0,311,225,1,0,0,
        0,311,226,1,0,0,0,311,227,1,0,0,0,311,228,1,0,0,0,311,229,1,0,0,
        0,311,230,1,0,0,0,311,231,1,0,0,0,311,244,1,0,0,0,311,262,1,0,0,
        0,311,280,1,0,0,0,311,297,1,0,0,0,312,33,1,0,0,0,313,316,3,32,16,
        0,314,315,5,6,0,0,315,317,3,32,16,0,316,314,1,0,0,0,316,317,1,0,
        0,0,317,324,1,0,0,0,318,319,5,7,0,0,319,320,3,32,16,0,320,321,5,
        6,0,0,321,322,3,32,16,0,322,324,1,0,0,0,323,313,1,0,0,0,323,318,
        1,0,0,0,324,35,1,0,0,0,325,326,3,32,16,0,326,37,1,0,0,0,327,333,
        5,19,0,0,328,329,3,36,18,0,329,330,5,25,0,0,330,332,1,0,0,0,331,
        328,1,0,0,0,332,335,1,0,0,0,333,331,1,0,0,0,333,334,1,0,0,0,334,
        337,1,0,0,0,335,333,1,0,0,0,336,338,3,36,18,0,337,336,1,0,0,0,337,
        338,1,0,0,0,338,339,1,0,0,0,339,340,5,20,0,0,340,39,1,0,0,0,43,44,
        49,54,56,62,69,76,79,84,88,102,106,115,119,128,139,143,149,160,163,
        170,173,181,185,189,193,223,237,241,252,259,270,277,287,292,294,
        304,308,311,316,323,333,337
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!MangleParser.__ATN) {
            MangleParser.__ATN = new antlr.ATNDeserializer().deserialize(MangleParser._serializedATN);
        }

        return MangleParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(MangleParser.literalNames, MangleParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return MangleParser.vocabulary;
    }

    private static readonly decisionsToDFA = MangleParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class StartContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public program(): ProgramContext {
        return this.getRuleContext(0, ProgramContext)!;
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(MangleParser.EOF, 0)!;
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_start;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterStart) {
             listener.enterStart(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitStart) {
             listener.exitStart(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitStart) {
            return visitor.visitStart(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ProgramContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public packageDecl(): PackageDeclContext | null {
        return this.getRuleContext(0, PackageDeclContext);
    }
    public useDecl(): UseDeclContext[];
    public useDecl(i: number): UseDeclContext | null;
    public useDecl(i?: number): UseDeclContext[] | UseDeclContext | null {
        if (i === undefined) {
            return this.getRuleContexts(UseDeclContext);
        }

        return this.getRuleContext(i, UseDeclContext);
    }
    public decl(): DeclContext[];
    public decl(i: number): DeclContext | null;
    public decl(i?: number): DeclContext[] | DeclContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclContext);
        }

        return this.getRuleContext(i, DeclContext);
    }
    public clause(): ClauseContext[];
    public clause(i: number): ClauseContext | null;
    public clause(i?: number): ClauseContext[] | ClauseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ClauseContext);
        }

        return this.getRuleContext(i, ClauseContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_program;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterProgram) {
             listener.enterProgram(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitProgram) {
             listener.exitProgram(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitProgram) {
            return visitor.visitProgram(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PackageDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PACKAGE(): antlr.TerminalNode {
        return this.getToken(MangleParser.PACKAGE, 0)!;
    }
    public NAME(): antlr.TerminalNode {
        return this.getToken(MangleParser.NAME, 0)!;
    }
    public BANG(): antlr.TerminalNode {
        return this.getToken(MangleParser.BANG, 0)!;
    }
    public atoms(): AtomsContext | null {
        return this.getRuleContext(0, AtomsContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_packageDecl;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterPackageDecl) {
             listener.enterPackageDecl(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitPackageDecl) {
             listener.exitPackageDecl(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitPackageDecl) {
            return visitor.visitPackageDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UseDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public USE(): antlr.TerminalNode {
        return this.getToken(MangleParser.USE, 0)!;
    }
    public NAME(): antlr.TerminalNode {
        return this.getToken(MangleParser.NAME, 0)!;
    }
    public BANG(): antlr.TerminalNode {
        return this.getToken(MangleParser.BANG, 0)!;
    }
    public atoms(): AtomsContext | null {
        return this.getRuleContext(0, AtomsContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_useDecl;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterUseDecl) {
             listener.enterUseDecl(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitUseDecl) {
             listener.exitUseDecl(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitUseDecl) {
            return visitor.visitUseDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DECL(): antlr.TerminalNode {
        return this.getToken(MangleParser.DECL, 0)!;
    }
    public atom(): AtomContext {
        return this.getRuleContext(0, AtomContext)!;
    }
    public descrBlock(): DescrBlockContext | null {
        return this.getRuleContext(0, DescrBlockContext);
    }
    public boundsBlock(): BoundsBlockContext[];
    public boundsBlock(i: number): BoundsBlockContext | null;
    public boundsBlock(i?: number): BoundsBlockContext[] | BoundsBlockContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BoundsBlockContext);
        }

        return this.getRuleContext(i, BoundsBlockContext);
    }
    public constraintsBlock(): ConstraintsBlockContext | null {
        return this.getRuleContext(0, ConstraintsBlockContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_decl;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterDecl) {
             listener.enterDecl(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitDecl) {
             listener.exitDecl(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitDecl) {
            return visitor.visitDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DescrBlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public atoms(): AtomsContext {
        return this.getRuleContext(0, AtomsContext)!;
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_descrBlock;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterDescrBlock) {
             listener.enterDescrBlock(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitDescrBlock) {
             listener.exitDescrBlock(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitDescrBlock) {
            return visitor.visitDescrBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BoundsBlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public BOUND(): antlr.TerminalNode {
        return this.getToken(MangleParser.BOUND, 0)!;
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_boundsBlock;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterBoundsBlock) {
             listener.enterBoundsBlock(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitBoundsBlock) {
             listener.exitBoundsBlock(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitBoundsBlock) {
            return visitor.visitBoundsBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConstraintsBlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public atoms(): AtomsContext {
        return this.getRuleContext(0, AtomsContext)!;
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_constraintsBlock;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterConstraintsBlock) {
             listener.enterConstraintsBlock(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitConstraintsBlock) {
             listener.exitConstraintsBlock(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitConstraintsBlock) {
            return visitor.visitConstraintsBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public atom(): AtomContext {
        return this.getRuleContext(0, AtomContext)!;
    }
    public temporalAnnotation(): TemporalAnnotationContext | null {
        return this.getRuleContext(0, TemporalAnnotationContext);
    }
    public clauseBody(): ClauseBodyContext | null {
        return this.getRuleContext(0, ClauseBodyContext);
    }
    public COLONDASH(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.COLONDASH, 0);
    }
    public LONGLEFTDOUBLEARROW(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.LONGLEFTDOUBLEARROW, 0);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_clause;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterClause) {
             listener.enterClause(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitClause) {
             listener.exitClause(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitClause) {
            return visitor.visitClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemporalAnnotationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public AT(): antlr.TerminalNode {
        return this.getToken(MangleParser.AT, 0)!;
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public temporalBound(): TemporalBoundContext[];
    public temporalBound(i: number): TemporalBoundContext | null;
    public temporalBound(i?: number): TemporalBoundContext[] | TemporalBoundContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TemporalBoundContext);
        }

        return this.getRuleContext(i, TemporalBoundContext);
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.COMMA, 0);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_temporalAnnotation;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterTemporalAnnotation) {
             listener.enterTemporalAnnotation(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitTemporalAnnotation) {
             listener.exitTemporalAnnotation(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitTemporalAnnotation) {
            return visitor.visitTemporalAnnotation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemporalBoundContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public TIMESTAMP(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.TIMESTAMP, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.DURATION, 0);
    }
    public VARIABLE(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.VARIABLE, 0);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_temporalBound;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterTemporalBound) {
             listener.enterTemporalBound(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitTemporalBound) {
             listener.exitTemporalBound(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitTemporalBound) {
            return visitor.visitTemporalBound(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClauseBodyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literalOrFml(): LiteralOrFmlContext[];
    public literalOrFml(i: number): LiteralOrFmlContext | null;
    public literalOrFml(i?: number): LiteralOrFmlContext[] | LiteralOrFmlContext | null {
        if (i === undefined) {
            return this.getRuleContexts(LiteralOrFmlContext);
        }

        return this.getRuleContext(i, LiteralOrFmlContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public PIPEGREATER(): antlr.TerminalNode[];
    public PIPEGREATER(i: number): antlr.TerminalNode | null;
    public PIPEGREATER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.PIPEGREATER);
    	} else {
    		return this.getToken(MangleParser.PIPEGREATER, i);
    	}
    }
    public transform(): TransformContext[];
    public transform(i: number): TransformContext | null;
    public transform(i?: number): TransformContext[] | TransformContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TransformContext);
        }

        return this.getRuleContext(i, TransformContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_clauseBody;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterClauseBody) {
             listener.enterClauseBody(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitClauseBody) {
             listener.exitClauseBody(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitClauseBody) {
            return visitor.visitClauseBody(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TransformContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DO(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.DO, 0);
    }
    public term(): TermContext | null {
        return this.getRuleContext(0, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public letStmt(): LetStmtContext[];
    public letStmt(i: number): LetStmtContext | null;
    public letStmt(i?: number): LetStmtContext[] | LetStmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(LetStmtContext);
        }

        return this.getRuleContext(i, LetStmtContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_transform;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterTransform) {
             listener.enterTransform(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitTransform) {
             listener.exitTransform(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitTransform) {
            return visitor.visitTransform(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LetStmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LET, 0)!;
    }
    public VARIABLE(): antlr.TerminalNode {
        return this.getToken(MangleParser.VARIABLE, 0)!;
    }
    public EQ(): antlr.TerminalNode {
        return this.getToken(MangleParser.EQ, 0)!;
    }
    public term(): TermContext {
        return this.getRuleContext(0, TermContext)!;
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_letStmt;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterLetStmt) {
             listener.enterLetStmt(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitLetStmt) {
             listener.exitLetStmt(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitLetStmt) {
            return visitor.visitLetStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralOrFmlContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public temporalOperator(): TemporalOperatorContext | null {
        return this.getRuleContext(0, TemporalOperatorContext);
    }
    public temporalAnnotation(): TemporalAnnotationContext | null {
        return this.getRuleContext(0, TemporalAnnotationContext);
    }
    public EQ(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.EQ, 0);
    }
    public BANGEQ(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.BANGEQ, 0);
    }
    public LESS(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.LESS, 0);
    }
    public LESSEQ(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.LESSEQ, 0);
    }
    public GREATER(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.GREATER, 0);
    }
    public GREATEREQ(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.GREATEREQ, 0);
    }
    public BANG(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.BANG, 0);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_literalOrFml;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterLiteralOrFml) {
             listener.enterLiteralOrFml(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitLiteralOrFml) {
             listener.exitLiteralOrFml(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitLiteralOrFml) {
            return visitor.visitLiteralOrFml(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemporalOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DIAMONDMINUS(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.DIAMONDMINUS, 0);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public temporalBound(): TemporalBoundContext[];
    public temporalBound(i: number): TemporalBoundContext | null;
    public temporalBound(i?: number): TemporalBoundContext[] | TemporalBoundContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TemporalBoundContext);
        }

        return this.getRuleContext(i, TemporalBoundContext);
    }
    public COMMA(): antlr.TerminalNode {
        return this.getToken(MangleParser.COMMA, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public BOXMINUS(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.BOXMINUS, 0);
    }
    public DIAMONDPLUS(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.DIAMONDPLUS, 0);
    }
    public BOXPLUS(): antlr.TerminalNode | null {
        return this.getToken(MangleParser.BOXPLUS, 0);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_temporalOperator;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterTemporalOperator) {
             listener.enterTemporalOperator(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitTemporalOperator) {
             listener.exitTemporalOperator(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitTemporalOperator) {
            return visitor.visitTemporalOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TermContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_term;
    }
    public override copyFrom(ctx: TermContext): void {
        super.copyFrom(ctx);
    }
}
export class StrContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(MangleParser.STRING, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterStr) {
             listener.enterStr(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitStr) {
             listener.exitStr(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitStr) {
            return visitor.visitStr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class BStrContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public BYTESTRING(): antlr.TerminalNode {
        return this.getToken(MangleParser.BYTESTRING, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterBStr) {
             listener.enterBStr(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitBStr) {
             listener.exitBStr(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitBStr) {
            return visitor.visitBStr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FloatContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public FLOAT(): antlr.TerminalNode {
        return this.getToken(MangleParser.FLOAT, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterFloat) {
             listener.enterFloat(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitFloat) {
             listener.exitFloat(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitFloat) {
            return visitor.visitFloat(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ApplContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public NAME(): antlr.TerminalNode {
        return this.getToken(MangleParser.NAME, 0)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(MangleParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(MangleParser.RPAREN, 0)!;
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterAppl) {
             listener.enterAppl(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitAppl) {
             listener.exitAppl(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitAppl) {
            return visitor.visitAppl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class VarContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public VARIABLE(): antlr.TerminalNode {
        return this.getToken(MangleParser.VARIABLE, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterVar) {
             listener.enterVar(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitVar) {
             listener.exitVar(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitVar) {
            return visitor.visitVar(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ConstContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public CONSTANT(): antlr.TerminalNode {
        return this.getToken(MangleParser.CONSTANT, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterConst) {
             listener.enterConst(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitConst) {
             listener.exitConst(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitConst) {
            return visitor.visitConst(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class NumContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public NUMBER(): antlr.TerminalNode {
        return this.getToken(MangleParser.NUMBER, 0)!;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterNum) {
             listener.enterNum(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitNum) {
             listener.exitNum(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitNum) {
            return visitor.visitNum(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ListContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterList) {
             listener.enterList(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitList) {
             listener.exitList(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitList) {
            return visitor.visitList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class MapContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterMap) {
             listener.enterMap(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitMap) {
             listener.exitMap(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitMap) {
            return visitor.visitMap(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class StructContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACE, 0)!;
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterStruct) {
             listener.enterStruct(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitStruct) {
             listener.exitStruct(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitStruct) {
            return visitor.visitStruct(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class DotTypeContext extends TermContext {
    public constructor(ctx: TermContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public DOT_TYPE(): antlr.TerminalNode {
        return this.getToken(MangleParser.DOT_TYPE, 0)!;
    }
    public LESS(): antlr.TerminalNode {
        return this.getToken(MangleParser.LESS, 0)!;
    }
    public GREATER(): antlr.TerminalNode {
        return this.getToken(MangleParser.GREATER, 0)!;
    }
    public member(): MemberContext[];
    public member(i: number): MemberContext | null;
    public member(i?: number): MemberContext[] | MemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MemberContext);
        }

        return this.getRuleContext(i, MemberContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterDotType) {
             listener.enterDotType(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitDotType) {
             listener.exitDotType(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitDotType) {
            return visitor.visitDotType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_member;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterMember) {
             listener.enterMember(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitMember) {
             listener.exitMember(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitMember) {
            return visitor.visitMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AtomContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public term(): TermContext {
        return this.getRuleContext(0, TermContext)!;
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_atom;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterAtom) {
             listener.enterAtom(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitAtom) {
             listener.exitAtom(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitAtom) {
            return visitor.visitAtom(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AtomsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.LBRACKET, 0)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(MangleParser.RBRACKET, 0)!;
    }
    public atom(): AtomContext[];
    public atom(i: number): AtomContext | null;
    public atom(i?: number): AtomContext[] | AtomContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AtomContext);
        }

        return this.getRuleContext(i, AtomContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MangleParser.COMMA);
    	} else {
    		return this.getToken(MangleParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return MangleParser.RULE_atoms;
    }
    public override enterRule(listener: MangleListener): void {
        if(listener.enterAtoms) {
             listener.enterAtoms(this);
        }
    }
    public override exitRule(listener: MangleListener): void {
        if(listener.exitAtoms) {
             listener.exitAtoms(this);
        }
    }
    public override accept<Result>(visitor: MangleVisitor<Result>): Result | null {
        if (visitor.visitAtoms) {
            return visitor.visitAtoms(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
