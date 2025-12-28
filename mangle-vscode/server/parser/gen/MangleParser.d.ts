import * as antlr from "antlr4ng";
import { MangleListener } from "./MangleListener.js";
import { MangleVisitor } from "./MangleVisitor.js";
export declare class MangleParser extends antlr.Parser {
    static readonly T__0 = 1;
    static readonly T__1 = 2;
    static readonly T__2 = 3;
    static readonly T__3 = 4;
    static readonly T__4 = 5;
    static readonly T__5 = 6;
    static readonly T__6 = 7;
    static readonly WHITESPACE = 8;
    static readonly COMMENT = 9;
    static readonly LONGLEFTDOUBLEARROW = 10;
    static readonly PACKAGE = 11;
    static readonly USE = 12;
    static readonly DECL = 13;
    static readonly BOUND = 14;
    static readonly LET = 15;
    static readonly DO = 16;
    static readonly LPAREN = 17;
    static readonly RPAREN = 18;
    static readonly LBRACKET = 19;
    static readonly RBRACKET = 20;
    static readonly EQ = 21;
    static readonly BANGEQ = 22;
    static readonly COMMA = 23;
    static readonly BANG = 24;
    static readonly LESS = 25;
    static readonly LESSEQ = 26;
    static readonly GREATER = 27;
    static readonly GREATEREQ = 28;
    static readonly COLONDASH = 29;
    static readonly NEWLINE = 30;
    static readonly PIPEGREATER = 31;
    static readonly NUMBER = 32;
    static readonly FLOAT = 33;
    static readonly VARIABLE = 34;
    static readonly NAME = 35;
    static readonly TYPENAME = 36;
    static readonly DOT_TYPE = 37;
    static readonly CONSTANT = 38;
    static readonly STRING = 39;
    static readonly BYTESTRING = 40;
    static readonly RULE_start = 0;
    static readonly RULE_program = 1;
    static readonly RULE_packageDecl = 2;
    static readonly RULE_useDecl = 3;
    static readonly RULE_decl = 4;
    static readonly RULE_descrBlock = 5;
    static readonly RULE_boundsBlock = 6;
    static readonly RULE_constraintsBlock = 7;
    static readonly RULE_clause = 8;
    static readonly RULE_clauseBody = 9;
    static readonly RULE_transform = 10;
    static readonly RULE_letStmt = 11;
    static readonly RULE_literalOrFml = 12;
    static readonly RULE_term = 13;
    static readonly RULE_member = 14;
    static readonly RULE_atom = 15;
    static readonly RULE_atoms = 16;
    static readonly literalNames: (string | null)[];
    static readonly symbolicNames: (string | null)[];
    static readonly ruleNames: string[];
    get grammarFileName(): string;
    get literalNames(): (string | null)[];
    get symbolicNames(): (string | null)[];
    get ruleNames(): string[];
    get serializedATN(): number[];
    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException;
    constructor(input: antlr.TokenStream);
    start(): StartContext;
    program(): ProgramContext;
    packageDecl(): PackageDeclContext;
    useDecl(): UseDeclContext;
    decl(): DeclContext;
    descrBlock(): DescrBlockContext;
    boundsBlock(): BoundsBlockContext;
    constraintsBlock(): ConstraintsBlockContext;
    clause(): ClauseContext;
    clauseBody(): ClauseBodyContext;
    transform(): TransformContext;
    letStmt(): LetStmtContext;
    literalOrFml(): LiteralOrFmlContext;
    term(): TermContext;
    member(): MemberContext;
    atom(): AtomContext;
    atoms(): AtomsContext;
    static readonly _serializedATN: number[];
    private static __ATN;
    static get _ATN(): antlr.ATN;
    private static readonly vocabulary;
    get vocabulary(): antlr.Vocabulary;
    private static readonly decisionsToDFA;
}
export declare class StartContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    program(): ProgramContext;
    EOF(): antlr.TerminalNode;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ProgramContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    packageDecl(): PackageDeclContext | null;
    useDecl(): UseDeclContext[];
    useDecl(i: number): UseDeclContext | null;
    decl(): DeclContext[];
    decl(i: number): DeclContext | null;
    clause(): ClauseContext[];
    clause(i: number): ClauseContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class PackageDeclContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    PACKAGE(): antlr.TerminalNode;
    NAME(): antlr.TerminalNode;
    BANG(): antlr.TerminalNode;
    atoms(): AtomsContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class UseDeclContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    USE(): antlr.TerminalNode;
    NAME(): antlr.TerminalNode;
    BANG(): antlr.TerminalNode;
    atoms(): AtomsContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class DeclContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    DECL(): antlr.TerminalNode;
    atom(): AtomContext;
    descrBlock(): DescrBlockContext | null;
    boundsBlock(): BoundsBlockContext[];
    boundsBlock(i: number): BoundsBlockContext | null;
    constraintsBlock(): ConstraintsBlockContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class DescrBlockContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    atoms(): AtomsContext;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class BoundsBlockContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    BOUND(): antlr.TerminalNode;
    LBRACKET(): antlr.TerminalNode;
    RBRACKET(): antlr.TerminalNode;
    term(): TermContext[];
    term(i: number): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ConstraintsBlockContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    atoms(): AtomsContext;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ClauseContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    atom(): AtomContext;
    clauseBody(): ClauseBodyContext | null;
    COLONDASH(): antlr.TerminalNode | null;
    LONGLEFTDOUBLEARROW(): antlr.TerminalNode | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ClauseBodyContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    literalOrFml(): LiteralOrFmlContext[];
    literalOrFml(i: number): LiteralOrFmlContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    PIPEGREATER(): antlr.TerminalNode[];
    PIPEGREATER(i: number): antlr.TerminalNode | null;
    transform(): TransformContext[];
    transform(i: number): TransformContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class TransformContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    DO(): antlr.TerminalNode | null;
    term(): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    letStmt(): LetStmtContext[];
    letStmt(i: number): LetStmtContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class LetStmtContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    LET(): antlr.TerminalNode;
    VARIABLE(): antlr.TerminalNode;
    EQ(): antlr.TerminalNode;
    term(): TermContext;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class LiteralOrFmlContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    term(): TermContext[];
    term(i: number): TermContext | null;
    EQ(): antlr.TerminalNode | null;
    BANGEQ(): antlr.TerminalNode | null;
    LESS(): antlr.TerminalNode | null;
    LESSEQ(): antlr.TerminalNode | null;
    GREATER(): antlr.TerminalNode | null;
    GREATEREQ(): antlr.TerminalNode | null;
    BANG(): antlr.TerminalNode | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class TermContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    get ruleIndex(): number;
    copyFrom(ctx: TermContext): void;
}
export declare class StrContext extends TermContext {
    constructor(ctx: TermContext);
    STRING(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class BStrContext extends TermContext {
    constructor(ctx: TermContext);
    BYTESTRING(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class FloatContext extends TermContext {
    constructor(ctx: TermContext);
    FLOAT(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ApplContext extends TermContext {
    constructor(ctx: TermContext);
    NAME(): antlr.TerminalNode;
    LPAREN(): antlr.TerminalNode;
    RPAREN(): antlr.TerminalNode;
    term(): TermContext[];
    term(i: number): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class VarContext extends TermContext {
    constructor(ctx: TermContext);
    VARIABLE(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ConstContext extends TermContext {
    constructor(ctx: TermContext);
    CONSTANT(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class NumContext extends TermContext {
    constructor(ctx: TermContext);
    NUMBER(): antlr.TerminalNode;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class ListContext extends TermContext {
    constructor(ctx: TermContext);
    LBRACKET(): antlr.TerminalNode;
    RBRACKET(): antlr.TerminalNode;
    term(): TermContext[];
    term(i: number): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class MapContext extends TermContext {
    constructor(ctx: TermContext);
    LBRACKET(): antlr.TerminalNode;
    RBRACKET(): antlr.TerminalNode;
    term(): TermContext[];
    term(i: number): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class StructContext extends TermContext {
    constructor(ctx: TermContext);
    term(): TermContext[];
    term(i: number): TermContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class DotTypeContext extends TermContext {
    constructor(ctx: TermContext);
    DOT_TYPE(): antlr.TerminalNode;
    LESS(): antlr.TerminalNode;
    GREATER(): antlr.TerminalNode;
    member(): MemberContext[];
    member(i: number): MemberContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class MemberContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    term(): TermContext[];
    term(i: number): TermContext | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class AtomContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    term(): TermContext;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
export declare class AtomsContext extends antlr.ParserRuleContext {
    constructor(parent: antlr.ParserRuleContext | null, invokingState: number);
    LBRACKET(): antlr.TerminalNode;
    RBRACKET(): antlr.TerminalNode;
    atom(): AtomContext[];
    atom(i: number): AtomContext | null;
    COMMA(): antlr.TerminalNode[];
    COMMA(i: number): antlr.TerminalNode | null;
    get ruleIndex(): number;
    enterRule(listener: MangleListener): void;
    exitRule(listener: MangleListener): void;
    accept<Result>(visitor: MangleVisitor<Result>): Result | null;
}
//# sourceMappingURL=MangleParser.d.ts.map