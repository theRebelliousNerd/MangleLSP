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
} from './ast';

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
 */
function getRangeFromContext(ctx: ParserRuleContext): SourceRange {
    const startToken = ctx.start;
    const stopToken = ctx.stop ?? startToken;

    return {
        start: {
            line: startToken?.line ?? 1,
            column: (startToken?.column ?? 0),
            offset: startToken?.start ?? 0,
        },
        end: {
            line: stopToken?.line ?? 1,
            column: (stopToken?.column ?? 0) + ((stopToken?.text?.length ?? 1)),
            offset: (stopToken?.stop ?? 0) + 1,
        },
    };
}

/**
 * Get source range from a token.
 */
function getRangeFromToken(token: Token): SourceRange {
    const text = token.text ?? '';
    return {
        start: {
            line: token.line,
            column: token.column,
            offset: token.start,
        },
        end: {
            line: token.line,
            column: token.column + text.length,
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
 */
export class MangleASTVisitor extends AbstractParseTreeVisitor<any> {
    protected defaultResult(): any {
        return null;
    }

    visitStart(ctx: StartContext): SourceUnit {
        return this.visitProgram(ctx.program());
    }

    visitProgram(ctx: ProgramContext): SourceUnit {
        const packageDecl = ctx.packageDecl()
            ? this.visitPackageDecl(ctx.packageDecl()!)
            : null;

        const useDecls = ctx.useDecl().map(u => this.visitUseDecl(u));
        const decls = ctx.decl().map(d => this.visitDecl(d));
        const clauses = ctx.clause().map(c => this.visitClause(c));

        return { packageDecl, useDecls, decls, clauses };
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

        // For other cases, create an error placeholder
        throw new Error(`Expected atom but got ${term?.type ?? 'null'}`);
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
            throw new Error('Expected term in let statement');
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
                throw new Error('Expected term after negation');
            }
            const term = this.visitTerm(termCtx);
            if (term && term.type === 'Atom') {
                return {
                    type: 'NegAtom',
                    atom: term,
                    range: getRangeFromContext(ctx),
                } as NegAtom;
            }
            throw new Error('Negation must be applied to an atom');
        }

        // Get the terms
        const termCtxs = ctx.term();
        if (termCtxs.length === 1) {
            const termCtx = termCtxs[0];
            if (!termCtx) {
                throw new Error('Expected term');
            }
            // Just a single term (atom, variable, etc.)
            return this.visitTerm(termCtx);
        }

        // Binary comparison: term op term
        const leftCtx = termCtxs[0];
        const rightCtx = termCtxs[1];
        if (!leftCtx || !rightCtx) {
            throw new Error('Expected two terms for comparison');
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
        if (ctx.LESS()) {
            return { type: 'Lt', left, right, range } as Lt;
        }
        if (ctx.LESSEQ()) {
            return { type: 'Le', left, right, range } as Le;
        }
        if (ctx.GREATER()) {
            return { type: 'Gt', left, right, range } as Gt;
        }
        if (ctx.GREATEREQ()) {
            return { type: 'Ge', left, right, range } as Ge;
        }

        // Fallback: just the first term
        const firstTermCtx = termCtxs[0];
        if (!firstTermCtx) {
            throw new Error('Expected at least one term');
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

    visitList(ctx: ListContext): Constant {
        const termCtxs = ctx.term();
        const items = termCtxs.map(t => this.visitTerm(t) as Constant);

        if (items.length === 0) {
            return {
                type: 'Constant',
                constantType: 'list',
                range: getRangeFromContext(ctx),
            };
        }

        // Build cons-list from end
        let result: Constant = {
            type: 'Constant',
            constantType: 'list',
            range: getRangeFromContext(ctx),
        };

        for (let i = items.length - 1; i >= 0; i--) {
            result = {
                type: 'Constant',
                constantType: 'list',
                fst: items[i],
                snd: result,
                range: getRangeFromContext(ctx),
            };
        }

        return result;
    }

    visitMap(ctx: MapContext): Constant {
        // Map is [key:value, ...]
        const termCtxs = ctx.term();
        // Terms come in pairs: key, value, key, value, ...

        if (termCtxs.length === 0) {
            return {
                type: 'Constant',
                constantType: 'map',
                range: getRangeFromContext(ctx),
            };
        }

        // Build map entries
        let result: Constant = {
            type: 'Constant',
            constantType: 'map',
            range: getRangeFromContext(ctx),
        };

        for (let i = termCtxs.length - 2; i >= 0; i -= 2) {
            const keyCtx = termCtxs[i];
            const valueCtx = termCtxs[i + 1];
            if (!keyCtx || !valueCtx) continue;
            const key = this.visitTerm(keyCtx) as Constant;
            const value = this.visitTerm(valueCtx) as Constant;

            const entry: Constant = {
                type: 'Constant',
                constantType: 'pair',
                fst: key,
                snd: value,
                range: getRangeFromContext(ctx),
            };

            result = {
                type: 'Constant',
                constantType: 'map',
                fst: entry,
                snd: result,
                range: getRangeFromContext(ctx),
            };
        }

        return result;
    }

    visitStruct(ctx: StructContext): Constant {
        // Struct is {field:value, ...}
        const termCtxs = ctx.term();

        if (termCtxs.length === 0) {
            return {
                type: 'Constant',
                constantType: 'struct',
                range: getRangeFromContext(ctx),
            };
        }

        // Build struct fields
        let result: Constant = {
            type: 'Constant',
            constantType: 'struct',
            range: getRangeFromContext(ctx),
        };

        for (let i = termCtxs.length - 2; i >= 0; i -= 2) {
            const fieldCtx = termCtxs[i];
            const valueCtx = termCtxs[i + 1];
            if (!fieldCtx || !valueCtx) continue;
            const field = this.visitTerm(fieldCtx) as Constant;
            const value = this.visitTerm(valueCtx) as Constant;

            const entry: Constant = {
                type: 'Constant',
                constantType: 'pair',
                fst: field,
                snd: value,
                range: getRangeFromContext(ctx),
            };

            result = {
                type: 'Constant',
                constantType: 'struct',
                fst: entry,
                snd: result,
                range: getRangeFromContext(ctx),
            };
        }

        return result;
    }

    visitDotType(ctx: DotTypeContext): Constant {
        // .TypeName<member, ...>
        const typeToken = ctx.DOT_TYPE();
        const typeName = typeToken!.getText();

        // For now, treat as a special constant
        return {
            type: 'Constant',
            constantType: 'name',
            symbol: typeName,
            range: getRangeFromContext(ctx),
        };
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
