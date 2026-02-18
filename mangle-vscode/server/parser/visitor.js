"use strict";
/**
 * ANTLR visitor that converts parse trees to AST with source locations.
 *
 * Ported from upstream Go implementation (parse/parse.go).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangleASTVisitor = exports.ERROR_SYMBOL = void 0;
const antlr4ng_1 = require("antlr4ng");
const ast_1 = require("./ast");
/**
 * Error placeholder symbol used in broken AST nodes.
 * LSP features can check for this to identify error nodes.
 */
exports.ERROR_SYMBOL = '$$error$$';
const MangleParser_1 = require("./gen/MangleParser");
/**
 * Get source range from a parser rule context.
 * Handles multi-line stop tokens (like multi-line strings) correctly.
 */
function getRangeFromContext(ctx) {
    const startToken = ctx.start;
    const stopToken = ctx.stop ?? startToken;
    // Calculate end position, handling multi-line stop tokens
    const stopText = stopToken?.text ?? '';
    const stopLines = stopText.split('\n');
    const stopNumNewlines = stopLines.length - 1;
    let endLine = (stopToken?.line ?? 1) + stopNumNewlines;
    let endColumn;
    if (stopNumNewlines > 0) {
        // Multi-line: end column is length of last line
        const lastLine = stopLines[stopLines.length - 1];
        endColumn = lastLine?.length ?? 0;
    }
    else {
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
function getRangeFromToken(token) {
    const text = token.text ?? '';
    const lines = text.split('\n');
    const numNewlines = lines.length - 1;
    let endLine = token.line + numNewlines;
    let endColumn;
    if (numNewlines > 0) {
        // Multi-line: end column is length of last line
        const lastLine = lines[lines.length - 1];
        endColumn = lastLine?.length ?? 0;
    }
    else {
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
function unescapeString(s) {
    // Remove surrounding quotes
    let inner;
    if (s.startsWith('`')) {
        // Long string with backticks
        inner = s.slice(1, -1);
    }
    else if (s.startsWith('"') || s.startsWith("'")) {
        inner = s.slice(1, -1);
    }
    else {
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
        }
        else {
            result += inner[i];
            i++;
        }
    }
    return result;
}
/**
 * Unescape a byte string literal.
 */
function unescapeByteString(s) {
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
class MangleASTVisitor extends antlr4ng_1.AbstractParseTreeVisitor {
    constructor() {
        super(...arguments);
        /** Collected visitor errors during AST construction */
        this.errors = [];
        /** Partial unit built so far (for error recovery) */
        this.partialUnit = null;
    }
    defaultResult() {
        return null;
    }
    /**
     * Get all errors collected during AST construction.
     */
    getErrors() {
        return this.errors;
    }
    /**
     * Get the partial unit built so far (for error recovery).
     * Returns the last successfully built unit, or null if none.
     */
    getPartialUnit() {
        return this.partialUnit;
    }
    /**
     * Record an error and return a range from the context.
     */
    addError(message, ctx) {
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
    createErrorAtom(ctx) {
        return (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(exports.ERROR_SYMBOL, 0), [], getRangeFromContext(ctx));
    }
    /**
     * Create an error placeholder variable.
     */
    createErrorVariable(ctx) {
        return (0, ast_1.createVariable)(exports.ERROR_SYMBOL, getRangeFromContext(ctx));
    }
    /**
     * Create an error placeholder ApplyFn.
     */
    createErrorApplyFn(ctx) {
        return (0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)(`fn:${exports.ERROR_SYMBOL}`, 0), [], getRangeFromContext(ctx));
    }
    visitStart(ctx) {
        return this.visitProgram(ctx.program());
    }
    visitProgram(ctx) {
        // Try to get package decl, but don't fail if it's broken
        let packageDecl = null;
        const packageDeclCtx = ctx.packageDecl();
        if (packageDeclCtx) {
            try {
                packageDecl = this.visitPackageDecl(packageDeclCtx);
            }
            catch (e) {
                this.addError(`Failed to parse package declaration: ${e instanceof Error ? e.message : String(e)}`, packageDeclCtx);
            }
        }
        // Collect use decls with error recovery
        const useDecls = [];
        for (const useDeclCtx of ctx.useDecl()) {
            try {
                useDecls.push(this.visitUseDecl(useDeclCtx));
            }
            catch (e) {
                this.addError(`Failed to parse use declaration: ${e instanceof Error ? e.message : String(e)}`, useDeclCtx);
            }
        }
        // Collect decls with error recovery
        const decls = [];
        for (const declCtx of ctx.decl()) {
            try {
                decls.push(this.visitDecl(declCtx));
            }
            catch (e) {
                this.addError(`Failed to parse declaration: ${e instanceof Error ? e.message : String(e)}`, declCtx);
            }
        }
        // Collect clauses with error recovery
        const clauses = [];
        for (const clauseCtx of ctx.clause()) {
            try {
                clauses.push(this.visitClause(clauseCtx));
            }
            catch (e) {
                this.addError(`Failed to parse clause: ${e instanceof Error ? e.message : String(e)}`, clauseCtx);
            }
        }
        const unit = { packageDecl, useDecls, decls, clauses };
        // Save as partial unit for error recovery
        this.partialUnit = unit;
        return unit;
    }
    visitPackageDecl(ctx) {
        const name = ctx.NAME().getText();
        // Upstream Go (parse.go:244-246): package names must be lower-case
        if (name !== name.toLowerCase()) {
            this.addError(`package names have to be lower-case: ${name}`, ctx);
        }
        const atomsCtx = ctx.atoms();
        const atoms = atomsCtx ? this.visitAtoms(atomsCtx) : null;
        return {
            type: 'PackageDecl',
            name,
            atoms,
            range: getRangeFromContext(ctx),
        };
    }
    visitUseDecl(ctx) {
        const name = ctx.NAME().getText();
        const atomsCtx = ctx.atoms();
        const atoms = atomsCtx ? this.visitAtoms(atomsCtx) : null;
        return {
            type: 'UseDecl',
            name,
            atoms,
            range: getRangeFromContext(ctx),
        };
    }
    visitDecl(ctx) {
        const atomCtx = ctx.atom();
        const declaredAtom = this.visitAtom(atomCtx);
        const descrCtx = ctx.descrBlock();
        let descr = descrCtx ? this.visitDescrBlock(descrCtx) : null;
        // Check for 'temporal' keyword — upstream parse.go:280-282
        // The keyword 'temporal' in grammar is T__0 (first inline string token)
        // We check the text of the context for the 'temporal' keyword
        const ctxText = ctx.getText();
        if (ctxText.includes('temporal')) {
            // Look for the 'temporal' token between atom and descrBlock/boundsBlock
            // The grammar is: 'Decl' atom 'temporal'? descrBlock? boundsBlock* constraintsBlock? '.'
            const children = ctx.children ?? [];
            for (const child of children) {
                if ('getText' in child && child.getText() === 'temporal') {
                    const temporalAtom = (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(ast_1.DESCRIPTORS.TEMPORAL, 0), [], getRangeFromContext(ctx));
                    if (descr) {
                        descr = [...descr, temporalAtom];
                    }
                    else {
                        descr = [temporalAtom];
                    }
                    break;
                }
            }
        }
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
    visitDescrBlock(ctx) {
        return this.visitAtoms(ctx.atoms());
    }
    visitBoundsBlock(ctx) {
        const terms = ctx.term();
        const bounds = terms.map(t => this.visitTerm(t));
        return {
            bounds,
            range: getRangeFromContext(ctx),
        };
    }
    visitConstraintsBlock(ctx) {
        return this.visitAtoms(ctx.atoms());
    }
    visitAtoms(ctx) {
        return ctx.atom().map(a => this.visitAtom(a));
    }
    visitAtom(ctx) {
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
                predicate: (0, ast_1.createPredicateSym)(term.symbol, 0),
                args: [],
                range: term.range,
            };
        }
        // For other cases, create an error placeholder and record the error
        this.addError(`Expected atom but got ${term?.type ?? 'null'}`, ctx);
        return this.createErrorAtom(ctx);
    }
    visitClause(ctx) {
        const atomCtx = ctx.atom();
        const head = this.visitAtom(atomCtx);
        // Check for temporal annotation on head — upstream parse.go:331-334
        let headTime = null;
        const tempAnnotCtx = ctx.temporalAnnotation();
        if (tempAnnotCtx) {
            headTime = this.visitTemporalAnnotation(tempAnnotCtx);
        }
        const bodyCtx = ctx.clauseBody();
        let premises = null;
        let transform = null;
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
            headTime,
            range: getRangeFromContext(ctx),
        };
    }
    visitClauseBody(ctx) {
        const literalCtxs = ctx.literalOrFml();
        const premises = literalCtxs.map(l => this.visitLiteralOrFml(l));
        const transformCtxs = ctx.transform();
        let transform = null;
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
    visitTransform(ctx) {
        const statements = [];
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
    visitLetStmt(ctx) {
        const varToken = ctx.VARIABLE();
        const variable = {
            type: 'Variable',
            symbol: varToken.getText(),
            range: getRangeFromToken(varToken.symbol),
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
        const fn = this.visitTerm(termCtx);
        return {
            variable,
            fn,
            range: getRangeFromContext(ctx),
        };
    }
    visitLiteralOrFml(ctx) {
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
                const negAtom = {
                    type: 'NegAtom',
                    atom: term,
                    range: getRangeFromContext(ctx),
                };
                // Wrap in TemporalLiteral if temporal annotations present
                // (negated atoms can't have temporal operators in the grammar, but
                // they can't have annotations either per upstream — just return NegAtom)
                return negAtom;
            }
            // Negation applied to non-atom; wrap in NegAtom with error atom
            this.addError('Negation must be applied to an atom', ctx);
            return {
                type: 'NegAtom',
                atom: this.createErrorAtom(ctx),
                range: getRangeFromContext(ctx),
            };
        }
        // Check for temporal operator — upstream parse.go:411-414
        let tempOp = null;
        const tempOpCtx = ctx.temporalOperator();
        if (tempOpCtx) {
            tempOp = this.visitTemporalOperator(tempOpCtx);
        }
        // Check for temporal annotation — upstream parse.go:417-420
        let tempAnnot = null;
        const tempAnnotCtx = ctx.temporalAnnotation();
        if (tempAnnotCtx) {
            tempAnnot = this.visitTemporalAnnotation(tempAnnotCtx);
        }
        // Get the terms
        const termCtxs = ctx.term();
        // If there's only one term (no comparison operator)
        if (termCtxs.length === 1) {
            const termCtx = termCtxs[0];
            if (!termCtx) {
                this.addError('Expected term', ctx);
                return this.createErrorVariable(ctx);
            }
            const term = this.visitTerm(termCtx);
            // If temporal operator or annotation is present, wrap in TemporalLiteral
            // upstream parse.go:424-434
            if (term && term.type === 'Atom' && (tempOp !== null || tempAnnot !== null)) {
                return {
                    type: 'TemporalLiteral',
                    literal: term,
                    operator: tempOp,
                    interval: tempAnnot,
                    range: getRangeFromContext(ctx),
                };
            }
            return term;
        }
        // Binary comparison: term op term
        const leftCtx = termCtxs[0];
        const rightCtx = termCtxs[1];
        if (!leftCtx || !rightCtx) {
            this.addError('Expected two terms for comparison', ctx);
            const errorVar = this.createErrorVariable(ctx);
            return { type: 'Eq', left: errorVar, right: errorVar, range: getRangeFromContext(ctx) };
        }
        const left = this.visitTerm(leftCtx);
        const right = this.visitTerm(rightCtx);
        const range = getRangeFromContext(ctx);
        // Determine operator
        if (ctx.EQ()) {
            return { type: 'Eq', left, right, range };
        }
        if (ctx.BANGEQ()) {
            return { type: 'Ineq', left, right, range };
        }
        // Comparison operators are converted to Atoms with builtin predicates
        // to match upstream Go behavior (parse.go lines 457-466)
        if (ctx.LESS()) {
            return (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(':lt', 2), [left, right], range);
        }
        if (ctx.LESSEQ()) {
            return (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(':le', 2), [left, right], range);
        }
        if (ctx.GREATER()) {
            return (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(':gt', 2), [left, right], range);
        }
        if (ctx.GREATEREQ()) {
            return (0, ast_1.createAtom)((0, ast_1.createPredicateSym)(':ge', 2), [left, right], range);
        }
        // Fallback: just the first term
        const firstTermCtx = termCtxs[0];
        if (!firstTermCtx) {
            this.addError('Expected at least one term', ctx);
            return this.createErrorVariable(ctx);
        }
        return this.visitTerm(firstTermCtx);
    }
    visitTerm(ctx) {
        // Dispatch based on the specific term type
        if (ctx instanceof MangleParser_1.VarContext) {
            return this.visitVar(ctx);
        }
        if (ctx instanceof MangleParser_1.ConstContext) {
            return this.visitConst(ctx);
        }
        if (ctx instanceof MangleParser_1.NumContext) {
            return this.visitNum(ctx);
        }
        if (ctx instanceof MangleParser_1.FloatContext) {
            return this.visitFloat(ctx);
        }
        if (ctx instanceof MangleParser_1.StrContext) {
            return this.visitStr(ctx);
        }
        if (ctx instanceof MangleParser_1.BStrContext) {
            return this.visitBStr(ctx);
        }
        if (ctx instanceof MangleParser_1.ListContext) {
            return this.visitList(ctx);
        }
        if (ctx instanceof MangleParser_1.MapContext) {
            return this.visitMap(ctx);
        }
        if (ctx instanceof MangleParser_1.StructContext) {
            return this.visitStruct(ctx);
        }
        if (ctx instanceof MangleParser_1.ApplContext) {
            return this.visitAppl(ctx);
        }
        if (ctx instanceof MangleParser_1.DotTypeContext) {
            return this.visitDotType(ctx);
        }
        // Generic fallback - try to visit children
        return this.visitChildren(ctx);
    }
    visitVar(ctx) {
        const token = ctx.VARIABLE();
        return {
            type: 'Variable',
            symbol: token.getText(),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitConst(ctx) {
        const token = ctx.CONSTANT();
        return {
            type: 'Constant',
            constantType: 'name',
            symbol: token.getText(),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitNum(ctx) {
        const token = ctx.NUMBER();
        const text = token.getText();
        return {
            type: 'Constant',
            constantType: 'number',
            numValue: parseInt(text, 10),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitFloat(ctx) {
        const token = ctx.FLOAT();
        const text = token.getText();
        return {
            type: 'Constant',
            constantType: 'float64',
            floatValue: parseFloat(text),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitStr(ctx) {
        const token = ctx.STRING();
        const text = token.getText();
        return {
            type: 'Constant',
            constantType: 'string',
            symbol: unescapeString(text),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitBStr(ctx) {
        const token = ctx.BYTESTRING();
        const text = token.getText();
        return {
            type: 'Constant',
            constantType: 'bytes',
            symbol: unescapeByteString(text),
            range: getRangeFromToken(token.symbol),
        };
    }
    visitList(ctx) {
        // Upstream Go (parse.go:551-565) converts list literals to ApplyFn with fn:list
        const termCtxs = ctx.term();
        const args = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term);
            }
        }
        return (0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)('fn:list', -1), args, getRangeFromContext(ctx));
    }
    visitMap(ctx) {
        // Upstream Go (parse.go:518-533) converts map literals to ApplyFn with fn:map
        // Map is [key:value, ...] - terms come in pairs: key, value, key, value, ...
        const termCtxs = ctx.term();
        const args = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term);
            }
        }
        return (0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)('fn:map', -1), args, getRangeFromContext(ctx));
    }
    visitStruct(ctx) {
        // Upstream Go (parse.go:535-549) converts struct literals to ApplyFn with fn:struct
        // Struct is {field:value, ...} - terms come in pairs: field, value, field, value, ...
        const termCtxs = ctx.term();
        const args = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                args.push(term);
            }
        }
        return (0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)('fn:struct', -1), args, getRangeFromContext(ctx));
    }
    visitDotType(ctx) {
        // Upstream Go (parse.go:588-596) converts .TypeName<member, ...> to ApplyFn with fn:TypeName
        const typeToken = ctx.DOT_TYPE();
        const typeName = typeToken.getText().slice(1); // Remove leading '.'
        const memberCtxs = ctx.member();
        const args = [];
        for (const memberCtx of memberCtxs) {
            const memberTerms = this.visitMember(memberCtx);
            args.push(...memberTerms);
        }
        return (0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)('fn:' + typeName, -1), args, getRangeFromContext(ctx));
    }
    visitMember(ctx) {
        // Upstream Go (parse.go:598-614) returns []ast.BaseTerm from a member context
        const termCtxs = ctx.term();
        const baseterms = [];
        for (const termCtx of termCtxs) {
            const term = this.visitTerm(termCtx);
            if (term && (term.type === 'Constant' || term.type === 'Variable' || term.type === 'ApplyFn')) {
                baseterms.push(term);
            }
        }
        // Upstream Go (parse.go:610-612): opt prefix wraps member in fn:opt ApplyFn
        if (ctx.getText().startsWith('opt')) {
            return [(0, ast_1.createApplyFn)((0, ast_1.createFunctionSym)('fn:opt', -1), baseterms, getRangeFromContext(ctx))];
        }
        return baseterms;
    }
    visitAppl(ctx) {
        const nameToken = ctx.NAME();
        const name = nameToken.getText();
        const termCtxs = ctx.term();
        const args = termCtxs.map(t => this.visitTerm(t));
        const range = getRangeFromContext(ctx);
        // Check if it's a function (starts with "fn:")
        if (name.startsWith('fn:')) {
            return {
                type: 'ApplyFn',
                function: (0, ast_1.createFunctionSym)(name, args.length),
                args,
                range,
            };
        }
        // Otherwise it's a predicate application (atom)
        return {
            type: 'Atom',
            predicate: (0, ast_1.createPredicateSym)(name, args.length),
            args,
            range,
        };
    }
    // ========================================================================
    // Temporal Visitor Methods (upstream parse.go:786-896)
    // ========================================================================
    /**
     * Visit a temporal annotation: @[bound] or @[bound, bound]
     * Returns a TemporalInterval.
     * Upstream: parse.go:786-812
     */
    visitTemporalAnnotation(ctx) {
        const boundCtxs = ctx.temporalBound();
        if (boundCtxs.length === 0) {
            this.addError('temporal annotation requires at least one bound', ctx);
            // Return a default eternal interval
            return {
                start: { boundType: 'negativeInfinity', range: getRangeFromContext(ctx) },
                end: { boundType: 'positiveInfinity', range: getRangeFromContext(ctx) },
                range: getRangeFromContext(ctx),
            };
        }
        let start = this.visitTemporalBound(boundCtxs[0]);
        let end;
        if (boundCtxs.length > 1) {
            end = this.visitTemporalBound(boundCtxs[1]);
        }
        else {
            // Point interval: @[t] means @[t, t]
            end = { ...start };
        }
        // Upstream parse.go:803-808: _ variable means infinity
        if (start.boundType === 'variable' && start.variable?.symbol === '_') {
            start = { boundType: 'negativeInfinity', range: start.range };
        }
        if (end.boundType === 'variable' && end.variable?.symbol === '_') {
            end = { boundType: 'positiveInfinity', range: end.range };
        }
        return {
            start,
            end,
            range: getRangeFromContext(ctx),
        };
    }
    /**
     * Visit a temporal bound: TIMESTAMP | DURATION | VARIABLE | 'now'
     * Returns a TemporalBound.
     * Upstream: parse.go:816-849
     */
    visitTemporalBound(ctx) {
        const range = getRangeFromContext(ctx);
        // Check TIMESTAMP
        const tsToken = ctx.TIMESTAMP();
        if (tsToken) {
            const text = tsToken.getText();
            const nanos = parseTimestamp(text);
            if (nanos === null) {
                this.addError(`invalid timestamp "${text}"`, ctx);
                return { boundType: 'timestamp', value: 0, rawText: text, range };
            }
            return { boundType: 'timestamp', value: nanos, rawText: text, range };
        }
        // Check DURATION
        const durToken = ctx.DURATION();
        if (durToken) {
            const text = durToken.getText();
            const nanos = parseDuration(text);
            if (nanos === null) {
                this.addError(`invalid duration "${text}"`, ctx);
                return { boundType: 'duration', value: 0, rawText: text, range };
            }
            return { boundType: 'duration', value: nanos, rawText: text, range };
        }
        // Check VARIABLE
        const varToken = ctx.VARIABLE();
        if (varToken) {
            const text = varToken.getText();
            const variable = {
                type: 'Variable',
                symbol: text,
                range: getRangeFromToken(varToken.symbol),
            };
            return { boundType: 'variable', variable, range };
        }
        // Check 'now'
        if (ctx.getText() === 'now') {
            return { boundType: 'now', range };
        }
        this.addError('unknown temporal bound', ctx);
        return { boundType: 'timestamp', value: 0, range };
    }
    /**
     * Visit a temporal operator: <-[b,b] | [-[b,b] | <+[b,b] | [+[b,b]
     * Returns a TemporalOperator.
     * Upstream: parse.go:853-896
     */
    visitTemporalOperator(ctx) {
        const boundCtxs = ctx.temporalBound();
        if (boundCtxs.length !== 2) {
            this.addError('temporal operator requires exactly two bounds', ctx);
            return {
                operatorType: 'diamondMinus',
                interval: {
                    start: { boundType: 'duration', value: 0, range: getRangeFromContext(ctx) },
                    end: { boundType: 'duration', value: 0, range: getRangeFromContext(ctx) },
                    range: getRangeFromContext(ctx),
                },
                range: getRangeFromContext(ctx),
            };
        }
        const start = this.visitTemporalBound(boundCtxs[0]);
        const end = this.visitTemporalBound(boundCtxs[1]);
        const interval = {
            start,
            end,
            range: getRangeFromContext(ctx),
        };
        // Determine operator type
        let operatorType;
        if (ctx.DIAMONDMINUS()) {
            operatorType = 'diamondMinus';
        }
        else if (ctx.BOXMINUS()) {
            operatorType = 'boxMinus';
        }
        else if (ctx.DIAMONDPLUS()) {
            operatorType = 'diamondPlus';
        }
        else if (ctx.BOXPLUS()) {
            operatorType = 'boxPlus';
        }
        else {
            this.addError('unknown temporal operator', ctx);
            operatorType = 'diamondMinus';
        }
        return {
            operatorType,
            interval,
            range: getRangeFromContext(ctx),
        };
    }
}
exports.MangleASTVisitor = MangleASTVisitor;
// ============================================================================
// Temporal Parsing Helpers (upstream parse.go:898-935)
// ============================================================================
/**
 * Parse a timestamp string in ISO 8601 format.
 * Returns nanoseconds since Unix epoch, or null on error.
 * Upstream: parse.go:898-914
 */
function parseTimestamp(s) {
    // Try various formats
    // 2024-01-15T10:30:00Z
    // 2024-01-15T10:30:00
    // 2024-01-15
    const date = new Date(s);
    if (!isNaN(date.getTime())) {
        // Convert to nanoseconds (JS Date is milliseconds)
        return date.getTime() * 1000000;
    }
    // Try date-only format more carefully
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (dateMatch) {
        const d = new Date(Date.UTC(parseInt(dateMatch[1], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10)));
        if (!isNaN(d.getTime())) {
            return d.getTime() * 1000000;
        }
    }
    return null;
}
/**
 * Parse a duration string like "7d", "24h", "30m", "1s", "500ms".
 * Returns nanoseconds, or null on error.
 * Upstream: parse.go:921-935
 */
function parseDuration(s) {
    if (!s)
        return null;
    // Match duration pattern: digits followed by unit
    const match = /^(-?\d+)(ms|d|h|m|s)$/.exec(s);
    if (!match)
        return null;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const NS_PER_MS = 1000000;
    const NS_PER_SEC = 1000000000;
    const NS_PER_MIN = 60 * NS_PER_SEC;
    const NS_PER_HOUR = 60 * NS_PER_MIN;
    const NS_PER_DAY = 24 * NS_PER_HOUR;
    switch (unit) {
        case 'ms': return value * NS_PER_MS;
        case 's': return value * NS_PER_SEC;
        case 'm': return value * NS_PER_MIN;
        case 'h': return value * NS_PER_HOUR;
        case 'd': return value * NS_PER_DAY;
        default: return null;
    }
}
//# sourceMappingURL=visitor.js.map