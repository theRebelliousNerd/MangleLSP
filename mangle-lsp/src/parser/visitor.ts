/**
 * ANTLR visitor that converts parse trees to AST with source locations.
 *
 * Ported from upstream Go implementation (parse/parse.go).
 */

import { AbstractParseTreeVisitor, ParserRuleContext, Token } from 'antlr4ng';

import {
    SourceRange,
    SourcePosition,
    SourceUnit,
    PackageDecl,
    UseDecl,
    Decl,
    Clause,
    Atom,
    NegAtom,
    Term,
    BaseTerm,
    Variable,
    Constant,
    ApplyFn,
    Transform,
    TransformStmt,
    BoundDecl,
    Eq,
    Ineq,
    Lt,
    Le,
    Gt,
    Ge,
    PredicateSym,
    FunctionSym,
    createPredicateSym,
    createFunctionSym,
    createAtom,
    createVariable,
    createApplyFn,
} from './ast';

/**
 * Error placeholder symbol used in broken AST nodes.
 * LSP features can check for this to identify error nodes.
 */
export const ERROR_SYMBOL = '$$error$$';

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

import {
    StartContext,
    ProgramContext,
    PackageDeclContext,
    UseDeclContext,
    DeclContext,
    ClauseContext,
    ClauseBodyContext,
    TransformContext,
    LetStmtContext,
    LiteralOrFmlContext,
    AtomContext,
    AtomsContext,
    VarContext,
    ConstContext,
    NumContext,
    FloatContext,
    StrContext,
    BStrContext,
    ListContext,
    MapContext,
    StructContext,
    ApplContext,
    BoundsBlockContext,
    DescrBlockContext,
    ConstraintsBlockContext,
    DotTypeContext,
    MemberContext,
} from './gen/MangleParser';
import { MangleParser } from './gen/MangleParser';

/**
 * Get source range from a parser rule context.
 * Handles multi-line stop tokens (like multi-line strings) correctly.
 */
function getRangeFromContext(ctx: ParserRuleContext): SourceRange {
    const startToken = ctx.start;
    const stopToken = ctx.stop ?? startToken;

    // Calculate end position, handling multi-line stop tokens
    const stopText = stopToken?.text ?? '';
    const stopLines = stopText.split('\n');
    const stopNumNewlines = stopLines.length - 1;

    let endLine = (stopToken?.line ?? 1) + stopNumNewlines;
    let endColumn: number;

    if (stopNumNewlines > 0) {
        // Multi-line: end column is length of last line
        const lastLine = stopLines[stopLines.length - 1];
        endColumn = lastLine?.length ?? 0;
    } else {
        // Single line: add text length to start column
        endColumn = (stopToken?.column ?? 0) + stopText.length;
    }

    return {
        start: {
            line: startToken?.line ?? 1,
            column: (startToken?.column ?? 0),
            offset: startToken?.start ?? 0,
        },
        end: {
            line: endLine,
            column: endColumn,
            offset: (stopToken?.stop ?? 0) + 1,
        },
    };
}

/**
 * Get source range from a token.
 * Handles multi-line tokens (like multi-line strings) correctly.
 */
function getRangeFromToken(token: Token): SourceRange {
    const text = token.text ?? '';
    const lines = text.split('\n');
    const numNewlines = lines.length - 1;

    let endLine = token.line + numNewlines;
    let endColumn: number;

    if (numNewlines > 0) {
        // Multi-line: end column is length of last line
        const lastLine = lines[lines.length - 1];
        endColumn = lastLine?.length ?? 0;
    } else {
        // Single line: add text length to start column
        endColumn = token.column + text.length;
    }

    return {
        start: {
            line: token.line,
            column: token.column,
            offset: token.start,
        },
        end: {
            line: endLine,
            column: endColumn,
            offset: token.stop + 1,
        },
    };
}

/**
 * Unescape a string literal (remove quotes and process escape sequences).
 */
function unescapeString(s: string): string {
    // Remove surrounding quotes
    let inner: string;
    if (s.startsWith('`')) {
        // Long string with backticks
        inner = s.slice(1, -1);
    } else if (s.startsWith('"') || s.startsWith("'")) {
        inner = s.slice(1, -1);
    } else {
        inner = s;
    }

    // Process escape sequences
    let result = '';
    let i = 0;
    while (i < inner.length) {
        if (inner[i] === '\\' && i + 1 < inner.length) {
            const next = inner[i + 1];
            switch (next) {
                case 'n':
                    result += '\n';
                    i += 2;
                    break;
                case 't':
                    result += '\t';
                    i += 2;
                    break;
                case '"':
                    result += '"';
                    i += 2;
                    break;
                case "'":
                    result += "'";
                    i += 2;
                    break;
                case '\\':
                    result += '\\';
                    i += 2;
                    break;
                case 'x':
                    // Hex escape \xHH
                    if (i + 3 < inner.length) {
                        const hex = inner.slice(i + 2, i + 4);
                        const code = parseInt(hex, 16);
                        if (!isNaN(code)) {
                            result += String.fromCharCode(code);
                            i += 4;
                            break;
                        }
                    }
                    result += inner[i];
                    i++;
                    break;
                case 'u':
                    // Unicode escape \u{HHHHHH}
                    if (i + 4 < inner.length && inner[i + 2] === '{') {
                        const endBrace = inner.indexOf('}', i + 3);
                        if (endBrace !== -1) {
                            const hex = inner.slice(i + 3, endBrace);
                            const code = parseInt(hex, 16);
                            if (!isNaN(code)) {
                                result += String.fromCodePoint(code);
                                i = endBrace + 1;
                                break;
                            }
                        }
                    }
                    result += inner[i];
                    i++;
                    break;
                case '\n':
                    // Line continuation
                    i += 2;
                    break;
                default:
                    result += inner[i];
                    i++;
            }
        } else {
            result += inner[i];
            i++;
        }
    }

    return result;
}

/**
 * Unescape a byte string literal.
 */
function unescapeByteString(s: string): string {
    // Remove 'b' prefix and quotes
    return unescapeString(s.slice(1));
}

/**
 * Visitor that builds AST from ANTLR parse tree.
 *
 * This visitor implements error recovery: instead of throwing exceptions
 * when encountering malformed AST nodes, it records the error and returns
 * placeholder nodes. This allows the parser to produce a partial AST
 * even when there are errors, enabling LSP features to work on broken code.
 */
export class MangleASTVisitor extends AbstractParseTreeVisitor<any> {
    /** Collected visitor errors during AST construction */
    private errors: VisitorParseError[] = [];

    /** Partial unit built so far (for error recovery) */
    private partialUnit: SourceUnit | null = null;

    protected defaultResult(): any {
        return null;
    }

    /**
     * Get all errors collected during AST construction.
     */
    getErrors(): VisitorParseError[] {
        return this.errors;
    }

    /**
     * Get the partial unit built so far (for error recovery).
     * Returns the last successfully built unit, or null if none.
     */
    getPartialUnit(): SourceUnit | null {
        return this.partialUnit;
    }

    /**
     * Record an error and return a range from the context.
     */
    private addError(message: string, ctx: ParserRuleContext): void {
        const range = getRangeFromContext(ctx);
        this.errors.push({
            message,
            line: range.start.line,
            column: range.start.column,
            offset: range.start.offset,
            length: range.end.offset - range.start.offset,
        });
    }

    /**
     * Create an error placeholder atom.
     */
    private createErrorAtom(ctx: ParserRuleContext): Atom {
        return createAtom(createPredicateSym(ERROR_SYMBOL, 0), [], getRangeFromContext(ctx));
    }

    /**
     * Create an error placeholder variable.
     */
    private createErrorVariable(ctx: ParserRuleContext): Variable {
        return createVariable(ERROR_SYMBOL, getRangeFromContext(ctx));
    }

    /**
     * Create an error placeholder ApplyFn.
     */
    private createErrorApplyFn(ctx: ParserRuleContext): ApplyFn {
        return createApplyFn(createFunctionSym(`fn:${ERROR_SYMBOL}`, 0), [], getRangeFromContext(ctx));
    }

    visitStart(ctx: StartContext): SourceUnit {
        return this.visitProgram(ctx.program());
    }

    visitProgram(ctx: ProgramContext): SourceUnit {
        // Try to get package decl, but don't fail if it's broken
        let packageDecl: PackageDecl | null = null;
        const packageDeclCtx = ctx.packageDecl();
        if (packageDeclCtx) {
            try {
                packageDecl = this.visitPackageDecl(packageDeclCtx);
            } catch (e) {
                this.addError(`Failed to parse package declaration: ${e instanceof Error ? e.message : String(e)}`, packageDeclCtx);
            }
        }

        // Collect use decls with error recovery
        const useDecls: UseDecl[] = [];
        for (const useDeclCtx of ctx.useDecl()) {
            try {
                useDecls.push(this.visitUseDecl(useDeclCtx));
            } catch (e) {
                this.addError(`Failed to parse use declaration: ${e instanceof Error ? e.message : String(e)}`, useDeclCtx);
            }
        }

        // Collect decls with error recovery
        const decls: Decl[] = [];
        for (const declCtx of ctx.decl()) {
            try {
                decls.push(this.visitDecl(declCtx));
            } catch (e) {
                this.addError(`Failed to parse declaration: ${e instanceof Error ? e.message : String(e)}`, declCtx);
            }
        }

        // Collect clauses with error recovery
        const clauses: Clause[] = [];
        for (const clauseCtx of ctx.clause()) {
            try {
                clauses.push(this.visitClause(clauseCtx));
            } catch (e) {
                this.addError(`Failed to parse clause: ${e instanceof Error ? e.message : String(e)}`, clauseCtx);
            }
        }

        const unit: SourceUnit = { packageDecl, useDecls, decls, clauses };
        // Save as partial unit for error recovery
        this.partialUnit = unit;
        return unit;
    }

    visitPackageDecl(ctx: PackageDeclContext): PackageDecl {
        const name = ctx.NAME()!.getText();
        const atomsCtx = ctx.atoms();
        const atoms = atomsCtx ? this.visitAtoms(atomsCtx) : null;

        return {
            type: 'PackageDecl',
            name,
            atoms,
            range: getRangeFromContext(ctx),
        };
    }

    visitUseDecl(ctx: UseDeclContext): UseDecl {
        const name = ctx.NAME()!.getText();
        const atomsCtx = ctx.atoms();
        const atoms = atomsCtx ? this.visitAtoms(atomsCtx) : null;

        return {
            type: 'UseDecl',
            name,
            atoms,
            range: getRangeFromContext(ctx),
        };
    }

    visitDecl(ctx: DeclContext): Decl {
        const atomCtx = ctx.atom();
        const declaredAtom = this.visitAtom(atomCtx);

        const descrCtx = ctx.descrBlock();
        const descr = descrCtx ? this.visitDescrBlock(descrCtx) : null;

        const boundsCtxs = ctx.boundsBlock();
        const bounds = boundsCtxs.length > 0
            ? boundsCtxs.map(b => this.visitBoundsBlock(b))
            : null;

        const constraintsCtx = ctx.constraintsBlock();
        const constraints = constraintsCtx
            ? this.visitConstraintsBlock(constraintsCtx)
            : null;

        return {
            type: 'Decl',
            declaredAtom,
            descr,
            bounds,
            constraints,
            range: getRangeFromContext(ctx),
        };
    }

    visitDescrBlock(ctx: DescrBlockContext): Atom[] {
        return this.visitAtoms(ctx.atoms());
    }

    visitBoundsBlock(ctx: BoundsBlockContext): BoundDecl {
        const terms = ctx.term();
        const bounds = terms.map(t => this.visitTerm(t) as BaseTerm);
        return {
            bounds,
            range: getRangeFromContext(ctx),
        };
    }

    visitConstraintsBlock(ctx: ConstraintsBlockContext): Atom[] {
        return this.visitAtoms(ctx.atoms());
    }

    visitAtoms(ctx: AtomsContext): Atom[] {
        return ctx.atom().map(a => this.visitAtom(a));
    }

    visitAtom(ctx: AtomContext): Atom {
        // atom : term ; but we expect it to be an Appl (predicate application)
        const termCtx = ctx.term();
        const term = this.visitTerm(termCtx);

        // If it's already an Atom, return it
        if (term && 'predicate' in term && term.type === 'Atom') {
            return term;
        }

        // Otherwise, it might be a variable or constant used as a 0-arity predicate
        // This shouldn't happen in well-formed Mangle, but handle it gracefully
        if (term && term.type === 'Variable') {
            // Convert variable to 0-arity predicate (unusual but possible)
            return {
                type: 'Atom',
                predicate: createPredicateSym(term.symbol, 0),
                args: [],
                range: term.range,
            };
        }

        // For other cases, create an error placeholder and record the error
        this.addError(`Expected atom but got ${term?.type ?? 'null'}`, ctx);
        return this.createErrorAtom(ctx);
    }

    visitClause(ctx: ClauseContext): Clause {
        const atomCtx = ctx.atom();
        const head = this.visitAtom(atomCtx);

        const bodyCtx = ctx.clauseBody();
        let premises: Term[] | null = null;
        let transform: Transform | null = null;

        if (bodyCtx) {
            const bodyResult = this.visitClauseBody(bodyCtx);
            premises = bodyResult.premises;
            transform = bodyResult.transform;
        }

        return {
            type: 'Clause',
            head,
            premises,
            transform,
            range: getRangeFromContext(ctx),
        };
    }

    visitClauseBody(ctx: ClauseBodyContext): { premises: Term[]; transform: Transform | null } {
        const literalCtxs = ctx.literalOrFml();
        const premises = literalCtxs.map(l => this.visitLiteralOrFml(l));

        const transformCtxs = ctx.transform();
        let transform: Transform | null = null;

        if (transformCtxs.length > 0) {
            // Build transform chain from end to beginning
            for (let i = transformCtxs.length - 1; i >= 0; i--) {
                const transformCtx = transformCtxs[i];
                if (transformCtx) {
                    const t = this.visitTransform(transformCtx);
                    t.next = transform;
                    transform = t;
                }
            }
        }

        return { premises, transform };
    }

    visitTransform(ctx: TransformContext): Transform {
        const statements: TransformStmt[] = [];

        // Check if it's a do-transform
        const doToken = ctx.DO();
        if (doToken) {
            // do term (, letStmt)*
            const termCtx = ctx.term();
            if (termCtx) {
                const fn = this.visitTerm(termCtx);
                if (fn && fn.type === 'ApplyFn') {
                    statements.push({
                        variable: null,
                        fn,
                        range: getRangeFromContext(ctx),
                    });
                }
            }
        }

        // Process let statements
        const letStmts = ctx.letStmt();
        for (const letCtx of letStmts) {
            statements.push(this.visitLetStmt(letCtx));
        }

        return {
            statements,
            next: null, // Will be set by caller when building chain
            range: getRangeFromContext(ctx),
        };
    }

    visitLetStmt(ctx: LetStmtContext): TransformStmt {
        const varToken = ctx.VARIABLE();
        const variable: Variable = {
            type: 'Variable',
            symbol: varToken!.getText(),
            range: getRangeFromToken(varToken!.symbol),
        };

        const termCtx = ctx.term();
        if (!termCtx) {
            this.addError('Expected term in let statement', ctx);
            return {
                variable,
                fn: this.createErrorApplyFn(ctx),
                range: getRangeFromContext(ctx),
            };
        }
        const fn = this.visitTerm(termCtx) as ApplyFn;

        return {
            variable,
            fn,
            range: getRangeFromContext(ctx),
        };
    }

    visitLiteralOrFml(ctx: LiteralOrFmlContext): Term {
        // Check for negation
        const bangToken = ctx.BANG();
        if (bangToken) {
            const termCtx = ctx.term(0);
            if (!termCtx) {
                this.addError('Expected term after negation', ctx);
                return this.createErrorAtom(ctx);
            }
            const term = this.visitTerm(termCtx);
            if (term && term.type === 'Atom') {
                return {
                    type: 'NegAtom',
                    atom: term,
                    range: getRangeFromContext(ctx),
                } as NegAtom;
            }
            // Negation applied to non-atom; wrap in NegAtom with error atom
            this.addError('Negation must be applied to an atom', ctx);
            return {
                type: 'NegAtom',
                atom: this.createErrorAtom(ctx),
                range: getRangeFromContext(ctx),
            } as NegAtom;
        }

        // Get the terms
        const termCtxs = ctx.term();
        if (termCtxs.length === 1) {
            const termCtx = termCtxs[0];
            if (!termCtx) {
                this.addError('Expected term', ctx);
                return this.createErrorVariable(ctx);
            }
            // Just a single term (atom, variable, etc.)
            return this.visitTerm(termCtx);
        }

        // Binary comparison: term op term
        const leftCtx = termCtxs[0];
        const rightCtx = termCtxs[1];
        if (!leftCtx || !rightCtx) {
            this.addError('Expected two terms for comparison', ctx);
            const errorVar = this.createErrorVariable(ctx);
            return { type: 'Eq', left: errorVar, right: errorVar, range: getRangeFromContext(ctx) } as Eq;
        }
        const left = this.visitTerm(leftCtx) as BaseTerm;
        const right = this.visitTerm(rightCtx) as BaseTerm;
        const range = getRangeFromContext(ctx);

        // Determine operator
        if (ctx.EQ()) {
            return { type: 'Eq', left, right, range } as Eq;
        }
        if (ctx.BANGEQ()) {
            return { type: 'Ineq', left, right, range } as Ineq;
        }
        // Comparison operators are converted to Atoms with builtin predicates
        // to match upstream Go behavior (parse.go lines 413-422)
        if (ctx.LESS()) {
            return createAtom(
                createPredicateSym(':lt', 2),
                [left, right],
                range
            );
        }
        if (ctx.LESSEQ()) {
            return createAtom(
                createPredicateSym(':le', 2),
                [left, right],
                range
            );
        }
        if (ctx.GREATER()) {
            return createAtom(
                createPredicateSym(':gt', 2),
                [left, right],
                range
            );
        }
        if (ctx.GREATEREQ()) {
            return createAtom(
                createPredicateSym(':ge', 2),
                [left, right],
                range
            );
        }

        // Fallback: just the first term
        const firstTermCtx = termCtxs[0];
        if (!firstTermCtx) {
            this.addError('Expected at least one term', ctx);
            return this.createErrorVariable(ctx);
        }
        return this.visitTerm(firstTermCtx);
    }

    visitTerm(ctx: ParserRuleContext): Term {
        // Dispatch based on the specific term type
        if (ctx instanceof VarContext) {
            return this.visitVar(ctx);
        }
        if (ctx instanceof ConstContext) {
            return this.visitConst(ctx);
        }
        if (ctx instanceof NumContext) {
            return this.visitNum(ctx);
        }
        if (ctx instanceof FloatContext) {
            return this.visitFloat(ctx);
        }
        if (ctx instanceof StrContext) {
            return this.visitStr(ctx);
        }
        if (ctx instanceof BStrContext) {
            return this.visitBStr(ctx);
        }
        if (ctx instanceof ListContext) {
            return this.visitList(ctx);
        }
        if (ctx instanceof MapContext) {
            return this.visitMap(ctx);
        }
        if (ctx instanceof StructContext) {
            return this.visitStruct(ctx);
        }
        if (ctx instanceof ApplContext) {
            return this.visitAppl(ctx);
        }
        if (ctx instanceof DotTypeContext) {
            return this.visitDotType(ctx);
        }

        // Generic fallback - try to visit children
        return this.visitChildren(ctx);
    }

    visitVar(ctx: VarContext): Variable {
        const token = ctx.VARIABLE();
        return {
            type: 'Variable',
            symbol: token!.getText(),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitConst(ctx: ConstContext): Constant {
        const token = ctx.CONSTANT();
        return {
            type: 'Constant',
            constantType: 'name',
            symbol: token!.getText(),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitNum(ctx: NumContext): Constant {
        const token = ctx.NUMBER();
        const text = token!.getText();
        return {
            type: 'Constant',
            constantType: 'number',
            numValue: parseInt(text, 10),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitFloat(ctx: FloatContext): Constant {
        const token = ctx.FLOAT();
        const text = token!.getText();
        return {
            type: 'Constant',
            constantType: 'float64',
            floatValue: parseFloat(text),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitStr(ctx: StrContext): Constant {
        const token = ctx.STRING();
        const text = token!.getText();
        return {
            type: 'Constant',
            constantType: 'string',
            symbol: unescapeString(text),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitBStr(ctx: BStrContext): Constant {
        const token = ctx.BYTESTRING();
        const text = token!.getText();
        return {
            type: 'Constant',
            constantType: 'bytes',
            symbol: unescapeByteString(text),
            range: getRangeFromToken(token!.symbol),
        };
    }

    visitList(ctx: ListContext): ApplyFn {
        // Upstream Go (parse.go:551-565) converts list literals to ApplyFn with fn:list
        const termCtxs = ctx.term();
        const args: BaseTerm[] = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term as BaseTerm);
            }
        }
        return createApplyFn(
            createFunctionSym('fn:list', -1),
            args,
            getRangeFromContext(ctx)
        );
    }

    visitMap(ctx: MapContext): ApplyFn {
        // Upstream Go (parse.go:518-533) converts map literals to ApplyFn with fn:map
        // Map is [key:value, ...] - terms come in pairs: key, value, key, value, ...
        const termCtxs = ctx.term();
        const args: BaseTerm[] = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term as BaseTerm);
            }
        }
        return createApplyFn(
            createFunctionSym('fn:map', -1),
            args,
            getRangeFromContext(ctx)
        );
    }

    visitStruct(ctx: StructContext): ApplyFn {
        // Upstream Go (parse.go:535-549) converts struct literals to ApplyFn with fn:struct
        // Struct is {field:value, ...} - terms come in pairs: field, value, field, value, ...
        const termCtxs = ctx.term();
        const args: BaseTerm[] = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term as BaseTerm);
            }
        }
        return createApplyFn(
            createFunctionSym('fn:struct', -1),
            args,
            getRangeFromContext(ctx)
        );
    }

    visitDotType(ctx: DotTypeContext): ApplyFn {
        // Upstream Go (parse.go:588-596) converts .TypeName<member, ...> to ApplyFn with fn:TypeName
        const typeToken = ctx.DOT_TYPE();
        const typeName = typeToken!.getText().slice(1); // Remove leading '.'
        const memberCtxs = ctx.member();
        const args: BaseTerm[] = [];
        for (const memberCtx of memberCtxs) {
            const memberTerms = this.visitMember(memberCtx);
            args.push(...memberTerms);
        }
        return createApplyFn(
            createFunctionSym('fn:' + typeName, -1),
            args,
            getRangeFromContext(ctx)
        );
    }

    visitMember(ctx: MemberContext): BaseTerm[] {
        // Upstream Go (parse.go:598-609) returns []ast.BaseTerm from a member context
        const termCtxs = ctx.term();
        const baseterms: BaseTerm[] = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                baseterms.push(term as BaseTerm);
            }
        }
        return baseterms;
    }

    visitAppl(ctx: ApplContext): Atom | ApplyFn {
        const nameToken = ctx.NAME();
        const name = nameToken!.getText();
        const termCtxs = ctx.term();
        const args = termCtxs.map(t => this.visitTerm(t) as BaseTerm);

        const range = getRangeFromContext(ctx);

        // Check if it's a function (starts with "fn:")
        if (name.startsWith('fn:')) {
            return {
                type: 'ApplyFn',
                function: createFunctionSym(name, args.length),
                args,
                range,
            };
        }

        // Otherwise it's a predicate application (atom)
        return {
            type: 'Atom',
            predicate: createPredicateSym(name, args.length),
            args,
            range,
        };
    }
}
