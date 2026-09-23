/**
 * Semantic validation for Mangle.
 *
 * Performs semantic analysis on parsed Mangle source and reports errors.
 * Ported from upstream Go implementation (analysis/validation.go).
 */

import {
    SourceUnit,
    SourceRange,
    Clause,
    Atom,
    NegAtom,
    Term,
    Variable,
    ApplyFn,
    Transform,
    TransformStmt,
    Constant,
    Decl,
    TemporalLiteral,
    TemporalAtom,
    TemporalInterval,
    BaseTerm,
    isComparisonAtom,
    isTemporalLiteral,
    isTemporalAtom,
    isEternalInterval,
    isDeclTemporal,
    isDeclMaybeTemporal,
    DESCRIPTORS,
} from '../parser/ast';
import {
    isBuiltinPredicate,
    getBuiltinPredicate,
    getBuiltinPredicateNames,
    formatPredicateSignature,
    ArgMode,
} from '../builtins/predicates';
import {
    isBuiltinFunction,
    getBuiltinFunction,
    isReducerFunction,
    getBuiltinFunctionNames,
    formatFunctionSignature,
    TIME_CIVIL_UNITS,
} from '../builtins/functions';
import { SymbolTable, buildSymbolTable } from './symbols';
import { UnionFind } from './unionfind';
import { rewriteClauseWithInfo } from './rewrite';
import { checkWellformedBound } from './types';
import { suggestSimilar, didYouMean } from './diagnostics';
import { checkBounds } from './boundscheck';
import { checkClauseLints } from './lints';

/**
 * A machine-applicable edit that fixes (part of) a diagnostic.
 * Surfaced as LSP quick fixes and in CLI JSON output.
 */
export interface QuickFix {
    /** Human readable title, e.g. "Replace with 'fn:sum'" */
    title: string;
    /** Range to replace */
    range: SourceRange;
    /** Replacement text */
    newText: string;
}

/**
 * Semantic error with location.
 */
export interface SemanticError {
    /** Error code for categorization (see analysis/diagnostics.ts) */
    code: string;
    /** Error message */
    message: string;
    /** Source location */
    range: SourceRange;
    /** Error severity */
    severity: 'error' | 'warning' | 'info';
    /** Instance-specific, actionable suggestion ("help:" line) */
    hint?: string;
    /** Machine-applicable fixes */
    fixes?: QuickFix[];
}

/**
 * Validation result.
 */
export interface ValidationResult {
    /** List of semantic errors */
    errors: SemanticError[];
    /** Symbol table built during analysis */
    symbolTable: SymbolTable;
}

/**
 * Predicates that require their second argument to be a constant.
 */
const STRING_CONSTANT_PREDICATES = new Set([
    ':match_prefix',
    ':string:starts_with',
    ':string:ends_with',
    ':string:contains',
]);

/**
 * Predicates that require arguments 2 and 3 to be variables (for destructuring).
 */
const DESTRUCTURING_PREDICATES = new Set([
    ':match_pair',
    ':match_cons',
]);

/**
 * Predicates that require argument 2 to be a constant (field/key selector).
 */
const FIELD_SELECTOR_PREDICATES = new Set([
    ':match_field',
    ':match_entry',
]);

/**
 * Valid string escape sequences.
 */
const VALID_ESCAPES = new Set(['n', 't', 'r', '\\', '"', "'"]);

/**
 * Validate a source unit and return semantic errors.
 */
export function validate(unit: SourceUnit): ValidationResult {
    const errors: SemanticError[] = [];
    const symbolTable = buildSymbolTable(unit);

    // E044: Check for duplicate declarations
    const declaredPredicates = new Map<string, Decl>();
    for (const decl of unit.decls) {
        const key = `${decl.declaredAtom.predicate.symbol}/${decl.declaredAtom.predicate.arity}`;
        if (declaredPredicates.has(key)) {
            const first = declaredPredicates.get(key)!;
            errors.push({
                code: 'E044',
                message: `Predicate '${key}' declared more than once (first declaration on line ${first.range.start.line})`,
                range: decl.range,
                severity: 'error',
                hint: 'merge the declarations into one Decl; alternative type signatures are written as several bound [...] lists on the same Decl',
            });
            continue;
        }
        declaredPredicates.set(key, decl);
    }

    // Validate declarations first
    for (const decl of unit.decls) {
        validateDeclaration(decl, errors);
    }

    // Validate each clause
    for (const clause of unit.clauses) {
        validateClause(clause, symbolTable, errors, declaredPredicates);
    }

    // EnsureDecl temporal consistency (upstream validation.go:239-270)
    // Check that temporal annotations match declarations
    for (const clause of unit.clauses) {
        const pred = clause.head.predicate;
        const predKey = `${pred.symbol}/${pred.arity}`;
        const decl = declaredPredicates.get(predKey);

        if (decl && clause.headTime && !isEternalInterval(clause.headTime)) {
            // Clause uses temporal annotation on head, but decl is not temporal
            if (!isDeclTemporal(decl) && !isDeclMaybeTemporal(decl)) {
                errors.push({
                    code: 'E058',
                    message: `Predicate '${pred.symbol}' is not declared temporal but used with temporal annotation`,
                    range: clause.head.range,
                    severity: 'error',
                });
            }
        }

        if (decl && (isDeclTemporal(decl) || isDeclMaybeTemporal(decl))) {
            // Temporal predicate but clause doesn't have headTime
            if (!clause.headTime && clause.premises && clause.premises.length > 0) {
                errors.push({
                    code: 'E059',
                    message: `Temporal predicate '${pred.symbol}' defined without temporal annotation`,
                    range: clause.head.range,
                    severity: 'error',
                });
            }
        }
    }

    // E046: Check arity mismatches between declarations and clauses
    validateArityConsistency(unit, errors);

    // Advice lints (singleton variables, duplicate premises, collect+len)
    checkClauseLints(unit, errors);

    // Conservative bounds (type) checking, upstream analysis/boundscheck.go
    checkBounds(unit, declaredPredicates, errors);

    return { errors, symbolTable };
}

// ============================================================================
// Modes (upstream ast.Decl.Modes / analysis.unifyModes)
// ============================================================================

const MODE_SYMBOLS: ReadonlyMap<string, ArgMode> = new Map([
    ['+', 'input'],
    ['-', 'output'],
    ['?', 'input_output'],
]);

/**
 * Returns the well-formed modes declared by `mode(...)` descriptors.
 * Malformed mode atoms are ignored, exactly like upstream convertMode.
 */
export function getDeclaredModes(decl: Decl): ArgMode[][] {
    const modes: ArgMode[][] = [];
    for (const d of decl.descr ?? []) {
        if (d.predicate.symbol !== 'mode') continue;
        const mode: ArgMode[] = [];
        let ok = d.args.length > 0;
        for (const a of d.args) {
            const m = a.type === 'Constant' && a.constantType === 'string' ? MODE_SYMBOLS.get(a.symbol ?? '') : undefined;
            if (!m) {
                ok = false;
                break;
            }
            mode.push(m);
        }
        if (ok) modes.push(mode);
    }
    return modes;
}

/**
 * Unifies several modes into one: positions that differ become input_output
 * (upstream analysis.unifyModes). Returns [] if there are no modes.
 */
export function unifyModes(modes: ArgMode[][]): ArgMode[] {
    if (modes.length === 0) return [];
    const first = modes[0]!;
    return first.map((m, i) => (modes.every(other => other[i] === m) ? m : 'input_output'));
}

/** Package of a predicate symbol: the part before the last '.' (upstream Decl.PackageID). */
function packageOf(symbol: string): string {
    const lastDot = symbol.lastIndexOf('.');
    return lastDot === -1 ? '' : symbol.slice(0, lastDot);
}

/** Known descriptor atoms (upstream ast/decl.go Descr* constants). */
const KNOWN_DESCRIPTORS = new Set<string>(Object.values(DESCRIPTORS));

/**
 * Validate a declaration (CheckDecl equivalent from upstream).
 *
 * Ported from upstream Go implementation (analysis/declcheck.go).
 */
function validateDeclaration(
    decl: Decl,
    errors: SemanticError[]
): void {
    const declAtom = decl.declaredAtom;
    const descriptors = decl.descr || [];

    // Build expected args map (all args must be variables)
    const expectedArgs = new Map<string, Variable>();
    for (let i = 0; i < declAtom.args.length; i++) {
        const arg = declAtom.args[i];
        if (arg && arg.type !== 'Variable') {
            errors.push({
                code: 'E024',
                message: `Declaration argument ${i + 1} must be a variable, got ${arg.type}`,
                range: arg.range,
                severity: 'error',
            });
        } else if (arg && arg.type === 'Variable') {
            expectedArgs.set((arg as Variable).symbol, arg as Variable);
        }
    }

    // Check bounds count matches arity (if bounds exist)
    if (decl.bounds && decl.bounds.length > 0) {
        for (const boundDecl of decl.bounds) {
            if (boundDecl.bounds.length !== declAtom.args.length) {
                errors.push({
                    code: 'E025',
                    message: `Declaration has ${declAtom.args.length} arguments but ${boundDecl.bounds.length} bounds`,
                    range: declAtom.range,
                    severity: 'error',
                });
            }
            // E061: Well-formed bound expression checking (upstream declcheck.go checkBound
            // -> symbols.WellformedBound). Checked recursively: constructor names, arities,
            // struct field shapes, tagged unions, function types.
            for (let i = 0; i < boundDecl.bounds.length; i++) {
                const bound = boundDecl.bounds[i];
                if (!bound) continue;
                for (const problem of checkWellformedBound(bound)) {
                    const hint = bound.type === 'ApplyFn' || problem.message.includes('type constructor')
                        ? typeConstructorHint(problem.message)
                        : undefined;
                    errors.push({
                        code: 'E061',
                        message: `In bound declaration (argument ${i + 1}): ${problem.message}`,
                        range: problem.range,
                        severity: 'error',
                        hint,
                    });
                }
            }
        }
    }

    // E078: unknown descriptors are silently ignored upstream - flag them.
    for (const descrAtom of descriptors) {
        const sym = descrAtom.predicate.symbol;
        if (!KNOWN_DESCRIPTORS.has(sym)) {
            const hint = didYouMean(suggestSimilar(sym, KNOWN_DESCRIPTORS));
            errors.push({
                code: 'E078',
                message: `Unknown descriptor '${sym}' in descr[...] is ignored by Mangle`,
                range: descrAtom.range,
                severity: 'warning',
                hint: hint ?? `known descriptors: ${[...KNOWN_DESCRIPTORS].filter(d => !d.startsWith('internal:')).join(', ')}`,
            });
        }
    }

    // E079: malformed mode(...) descriptors are silently ignored upstream.
    for (const descrAtom of descriptors) {
        if (descrAtom.predicate.symbol !== 'mode') continue;
        const bad = descrAtom.args.filter(a =>
            !(a.type === 'Constant' && a.constantType === 'string' && MODE_SYMBOLS.has(a.symbol ?? '')));
        if (bad.length > 0 || descrAtom.args.length !== declAtom.args.length) {
            const example = `mode(${declAtom.args.map(() => "'+'").join(', ')})`;
            errors.push({
                code: 'E079',
                message: bad.length > 0
                    ? `Invalid mode declaration: each argument must be the string '+', '-' or '?'`
                    : `Invalid mode declaration: expected ${declAtom.args.length} modes (one per argument), got ${descrAtom.args.length}`,
                range: descrAtom.range,
                severity: 'warning',
                hint: `write the modes as quoted strings, one per argument, e.g. ${example}; '+' = input (must be bound), '-' = output, '?' = either`,
            });
        }
    }

    // Validate doc() and arg() descriptor atoms (Feature G)
    let seenDoc = false;
    const expectedArgsForArgCheck = new Map<string, Variable>(expectedArgs);
    let hasAnyArgDescr = false;

    for (const descrAtom of descriptors) {
        const sym = descrAtom.predicate.symbol;

        if (sym === 'doc') {
            // Upstream: at most one doc atom
            if (seenDoc) {
                errors.push({
                    code: 'E051',
                    message: `descr[] can only have one doc atom`,
                    range: descrAtom.range,
                    severity: 'error',
                });
            }
            seenDoc = true;

            // Upstream: doc atom must have at least one argument
            if (descrAtom.args.length === 0) {
                errors.push({
                    code: 'E052',
                    message: `descr atom must not be empty`,
                    range: descrAtom.range,
                    severity: 'error',
                });
                continue;
            }

            // Upstream: all doc args must be string constants
            for (const docArg of descrAtom.args) {
                if (docArg.type !== 'Constant' ||
                    (docArg as Constant).constantType !== 'string') {
                    errors.push({
                        code: 'E053',
                        message: `expected string constant in doc(), got ${docArg.type}`,
                        range: docArg.range,
                        severity: 'error',
                    });
                }
            }
        } else if (sym === 'arg') {
            hasAnyArgDescr = true;

            // Upstream: arg atom must have at least 2 args
            if (descrAtom.args.length < 2) {
                errors.push({
                    code: 'E054',
                    message: `arg atom must have at least 2 args`,
                    range: descrAtom.range,
                    severity: 'error',
                });
                continue;
            }

            // Upstream: first arg must be a variable
            const firstArg = descrAtom.args[0];
            if (firstArg.type !== 'Variable') {
                errors.push({
                    code: 'E055',
                    message: `arg atom must have variable as first arg, got ${firstArg.type}`,
                    range: firstArg.range,
                    severity: 'error',
                });
                continue;
            }

            // Upstream: variable must match a declared atom argument
            const varName = (firstArg as Variable).symbol;
            if (!expectedArgsForArgCheck.has(varName)) {
                errors.push({
                    code: 'E056',
                    message: `arg atom for an unknown variable ${varName}`,
                    range: firstArg.range,
                    severity: 'error',
                });
                continue;
            }
            expectedArgsForArgCheck.delete(varName);

            // Upstream: remaining args must be string constants
            for (let i = 1; i < descrAtom.args.length; i++) {
                const argArg = descrAtom.args[i];
                if (argArg.type !== 'Constant' ||
                    (argArg as Constant).constantType !== 'string') {
                    errors.push({
                        code: 'E053',
                        message: `expected string constant in arg(), got ${argArg.type}`,
                        range: argArg.range,
                        severity: 'error',
                    });
                }
            }
        }
    }

    // Check for external predicates requiring exactly one mode
    const isExternal = descriptors.some(d =>
        d.predicate.symbol === 'external'
    );
    if (isExternal) {
        const modeCount = descriptors.filter(d =>
            d.predicate.symbol === 'mode'
        ).length;
        if (modeCount !== 1) {
            errors.push({
                code: 'E026',
                message: `External predicate must have exactly one mode declaration, got ${modeCount}`,
                range: declAtom.range,
                severity: 'error',
                hint: `add exactly one descriptor such as mode(${declAtom.args.map((_, i) => (i === 0 ? "'+'" : "'-'")).join(', ')}) to tell the host which arguments are inputs`,
            });
        }
    }

    // Upstream: check partial arg coverage (if some but not all args have arg() descriptors)
    const isSynthetic = descriptors.some(d => d.predicate.symbol === 'synthetic');
    if (!isSynthetic && hasAnyArgDescr && expectedArgsForArgCheck.size > 0 &&
        expectedArgsForArgCheck.size !== declAtom.args.length) {
        const missingVars = [...expectedArgsForArgCheck.keys()].join(', ');
        errors.push({
            code: 'E057',
            message: `missing arg atoms for arguments: ${missingVars}`,
            range: declAtom.range,
            severity: 'warning',
        });
    }

    // E031: Package name must be lowercase (upstream: name descriptor validation)
    const nameDescr = descriptors.find(d => d.predicate.symbol === 'name');
    if (nameDescr && nameDescr.args.length > 0) {
        const nameArg = nameDescr.args[0];
        if (nameArg && nameArg.type === 'Constant') {
            const nameVal = (nameArg as Constant).symbol ?? '';
            if (nameVal !== nameVal.toLowerCase()) {
                errors.push({
                    code: 'E031',
                    message: `Package name '${nameVal}' must be lowercase`,
                    range: nameArg.range,
                    severity: 'error',
                });
            }
        }
    }
}

/**
 * Per-clause validation context.
 */
interface ClauseCtx {
    readonly symbolTable: SymbolTable;
    readonly errors: SemanticError[];
    readonly decls: Map<string, Decl>;
    readonly uf: UnionFind;
    /** Package of the clause head (upstream checkVisibility). */
    readonly headPackage: string;
    /**
     * Variables seen in input ('+') positions of mode-declared user predicates
     * that were not bound at that point, with their first location.
     */
    readonly inputPositionVars: Map<string, SourceRange>;
}

/** Range covering only the name at the start of an expression. */
function nameRangeOf(range: SourceRange, name: string): SourceRange {
    return {
        start: range.start,
        end: {
            line: range.start.line,
            column: range.start.column + name.length,
            offset: range.start.offset + name.length,
        },
    };
}

/**
 * Validate a single clause.
 */
function validateClause(
    clause: Clause,
    symbolTable: SymbolTable,
    errors: SemanticError[],
    declaredPredicates?: Map<string, Decl>
): void {
    const decls = declaredPredicates ?? new Map<string, Decl>();

    // Upstream CheckRule: head arguments declared as input ('+') are bound on
    // entry; for negation delay (RewriteClause) '+' and '?' both count.
    const headKey = `${clause.head.predicate.symbol}/${clause.head.predicate.arity}`;
    const headDecl = decls.get(headKey);
    const headMode = headDecl ? unifyModes(getDeclaredModes(headDecl)) : [];
    const inputHeadVars: string[] = [];
    const preBoundForRewrite: string[] = [];
    headMode.forEach((m, i) => {
        const arg = clause.head.args[i];
        if (arg && arg.type === 'Variable' && arg.symbol !== '_') {
            if (m === 'input') inputHeadVars.push(arg.symbol);
            if (m === 'input' || m === 'input_output') preBoundForRewrite.push(arg.symbol);
        }
    });

    // Apply clause rewriting (negation delay) before validation
    // Upstream: RewriteClause is called before CheckRule
    const { clause: rewritten, droppedNegations } = rewriteClauseWithInfo(clause, preBoundForRewrite);

    // Collect bound variables
    const boundVars = new Set<string>(inputHeadVars);
    const headVars = new Set<string>();

    // Create union-find for variable equivalence (Feature E)
    const uf = UnionFind.create();

    const ctx: ClauseCtx = {
        symbolTable,
        errors,
        decls,
        uf,
        headPackage: packageOf(clause.head.predicate.symbol),
        inputPositionVars: new Map(),
    };

    // Collect variables from head
    collectAtomVariables(rewritten.head, headVars);

    // Collect variables from headTime (temporal annotation on head)
    // Upstream: headTime variables are treated as head variables that must be bound
    if (rewritten.headTime) {
        if (rewritten.headTime.start.boundType === 'variable' && rewritten.headTime.start.variable) {
            headVars.add(rewritten.headTime.start.variable.symbol);
        }
        if (rewritten.headTime.end.boundType === 'variable' && rewritten.headTime.end.variable) {
            headVars.add(rewritten.headTime.end.variable.symbol);
        }
    }

    // Warn about wildcards in head (unusual, usually a mistake)
    for (const arg of rewritten.head.args) {
        if (arg.type === 'Variable' && (arg as Variable).symbol === '_') {
            errors.push({
                code: 'E039',
                message: `Wildcard '_' in head is unusual - this argument will be unbound in derived facts`,
                range: arg.range,
                severity: 'warning',
                hint: 'use a variable that is bound in the body, or remove this column from the head predicate',
            });
        }
    }

    // E045: Check for transform without body
    if (rewritten.transform && (!rewritten.premises || rewritten.premises.length === 0)) {
        errors.push({
            code: 'E045',
            message: `Cannot have a transform without a body`,
            range: rewritten.transform.range,
            severity: 'error',
            hint: 'a transform (|> ...) post-processes the rows of a rule body; add a body or compute the value directly',
        });
    }

    // If this is a fact (no premises), all head variables must be ground
    if (!clause.premises || clause.premises.length === 0) {
        for (const v of headVars) {
            if (v !== '_') {
                errors.push({
                    code: 'E001',
                    message: `Variable '${v}' in fact head must be ground (facts cannot have variables)`,
                    range: rewritten.head.range,
                    severity: 'error',
                    hint: `replace '${v}' with a constant, or add a body that binds it: ${clause.head.predicate.symbol}(...) :- source(${v}).`,
                });
            }
        }
        return;
    }

    // Process premises to determine bound variables
    for (const premise of rewritten.premises ?? []) {
        validatePremise(premise, boundVars, ctx);
    }

    // E003: negated atoms whose variables are never bound. Upstream silently
    // drops them from the rule (changing its meaning), so report them.
    for (const dropped of droppedNegations) {
        const negAtom = (dropped.type === 'NegAtom' ? dropped : null) as NegAtom | null;
        if (!negAtom) continue;
        const negVars = new Set<string>();
        collectAtomVariables(negAtom.atom, negVars);
        const unbound = [...negVars].filter(v => !boundVars.has(v));
        for (const v of unbound) {
            errors.push({
                code: 'E003',
                message: `Variable '${v}' in negated atom '!${negAtom.atom.predicate.symbol}(...)' is never bound by a positive premise; upstream Mangle silently drops this negation`,
                range: negAtom.range,
                severity: 'error',
                hint: `bind '${v}' with a positive atom, or if you mean "no ${negAtom.atom.predicate.symbol} with any ${v}", replace '${v}' with '_' (and project the columns you need through a helper predicate)`,
            });
        }
        validateAtom(negAtom.atom, boundVars, ctx, { suppressUnbound: true });
    }

    // Collect body variables for transform redefinition check (E043)
    const bodyVars = new Set<string>();
    for (const premise of clause.premises) {
        collectPremiseVariables(premise, bodyVars);
    }

    // Validate transform if present (this also binds let-variables)
    if (rewritten.transform) {
        // E048: Reject multiple transforms (upstream validation.go:720-721)
        if (rewritten.transform.next) {
            errors.push({
                code: 'E048',
                message: 'Composing multiple transforms is not supported',
                range: rewritten.transform.next.range,
                severity: 'error',
                hint: 'split the computation into two rules: the first derives a helper predicate with one transform, the second applies the next transform to it',
            });
        }
        validateTransform(rewritten.transform, boundVars, errors, bodyVars, headVars);
    }

    // Check that all head variables are bound (after processing transform)
    // Upstream: uses union-find to resolve variable equivalences
    for (const v of headVars) {
        if (v === '_') continue;
        if (boundVars.has(v)) continue;

        // Check union-find: variable might be unified with a bound variable or constant
        const dummyVar: Variable = { type: 'Variable', symbol: v, range: rewritten.head.range };
        if (uf.isBound(dummyVar, boundVars)) continue;

        const similar = suggestSimilar(v, [...bodyVars].filter(b => !headVars.has(b)), 1);
        const headArg = rewritten.head.args.find(a => a.type === 'Variable' && a.symbol === v);
        errors.push({
            code: 'E002',
            message: `Variable '${v}' in head is not bound in the body (range restriction violation)`,
            range: rewritten.head.range,
            severity: 'error',
            hint: similar.length > 0
                ? `the body has a similarly named variable '${similar[0]}' - is '${v}' a typo? Otherwise bind '${v}' with a positive body atom, an equality or a |> let transform`
                : `bind '${v}' with a positive body atom (e.g. source(${v})), an equality (${v} = ...), or a |> let transform`,
            fixes: similar.length > 0 && headArg
                ? [{ title: `Rename '${v}' to '${similar[0]}'`, range: headArg.range, newText: similar[0]! }]
                : undefined,
        });
    }

    // E066: variables that only ever appear in input ('+') positions of
    // mode-declared predicates are never assigned a value.
    for (const [v, range] of ctx.inputPositionVars) {
        if (boundVars.has(v) || headVars.has(v)) continue;
        const dummyVar: Variable = { type: 'Variable', symbol: v, range };
        if (uf.isBound(dummyVar, boundVars)) continue;
        errors.push({
            code: 'E066',
            message: `Variable '${v}' is never bound: it only appears in input ('+') positions of mode-declared predicates`,
            range,
            severity: 'error',
            hint: `bind '${v}' with a positive atom or an equality before this premise`,
        });
    }
}

/**
 * Validate a premise and update bound variables.
 */
function validatePremise(
    premise: Term,
    boundVars: Set<string>,
    ctx: ClauseCtx
): void {
    const errors = ctx.errors;
    // Check the type field to determine how to handle this premise
    switch (premise.type) {
        case 'Atom': {
            const atom = premise as Atom;
            // Check if this is a comparison atom (:lt, :le, :gt, :ge)
            if (isComparisonAtom(atom)) {
                // Comparison atoms require all arguments to be bound (they don't bind variables)
                const unbound = new Set<string>();
                for (const arg of atom.args) {
                    const argVars = new Set<string>();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) unbound.add(v);
                    }
                }
                for (const v of unbound) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: atom.range,
                        severity: 'error',
                        hint: `comparisons only test values; move this comparison after the premise that binds '${v}', or bind '${v}' with a positive atom`,
                    });
                }
                // Also validate arity and other builtin checks (E006, etc.)
                validateAtom(atom, boundVars, ctx, { suppressUnbound: unbound.size > 0 });
            } else {
                // Regular atom - validate and bind variables
                validateAtom(atom, boundVars, ctx);
                bindAtomVariables(atom, boundVars, ctx);
            }
            break;
        }
        case 'NegAtom': {
            const negAtom = premise as NegAtom;
            // Negated atoms don't bind variables, but all their variables must be bound
            const negVars = new Set<string>();
            collectAtomVariables(negAtom.atom, negVars);
            let anyUnbound = false;
            for (const v of negVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    anyUnbound = true;
                    errors.push({
                        code: 'E003',
                        message: `Variable '${v}' in negated atom must be bound before the negation`,
                        range: negAtom.range,
                        severity: 'error',
                        hint: `bind '${v}' with a positive atom of the same rule; use '_' for "any value"`,
                    });
                }
            }
            validateAtom(negAtom.atom, boundVars, ctx, { suppressUnbound: anyUnbound });
            break;
        }
        case 'Eq': {
            const eq = premise as { type: 'Eq'; left: Term; right: Term; range: SourceRange };
            // Equality can bind a variable if the other side is bound
            handleEquality(eq.left, eq.right, boundVars, errors, eq.range, ctx.uf);
            break;
        }
        case 'Ineq': {
            // Inequality requires both sides to be bound
            const ineq = premise as { left: Term; right: Term; range: SourceRange };
            const vars = new Set<string>();
            collectTermVariables(ineq.left, vars);
            collectTermVariables(ineq.right, vars);
            for (const v of vars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: ineq.range,
                        severity: 'error',
                        hint: `'!=' only tests values; move it after the premise that binds '${v}'`,
                    });
                }
            }
            for (const side of [ineq.left, ineq.right]) {
                if (side.type === 'ApplyFn') {
                    validateApplyFn(side as ApplyFn, boundVars, errors, { reportUnbound: false });
                } else if (side.type === 'Constant') {
                    validateNameConstant(side as Constant, errors);
                }
            }
            break;
        }
        default:
            // Handle TemporalLiteral
            if (isTemporalLiteral(premise)) {
                const temporal = premise as TemporalLiteral;
                // Validate the inner literal
                validatePremise(temporal.literal, boundVars, ctx);
                // Temporal interval variables become bound
                if (temporal.interval) {
                    if (temporal.interval.start.boundType === 'variable' && temporal.interval.start.variable) {
                        boundVars.add(temporal.interval.start.variable.symbol);
                    }
                    if (temporal.interval.end.boundType === 'variable' && temporal.interval.end.variable) {
                        boundVars.add(temporal.interval.end.variable.symbol);
                    }
                }
                // Temporal operator interval variables also become bound
                if (temporal.operator && temporal.operator.interval) {
                    if (temporal.operator.interval.start.boundType === 'variable' && temporal.operator.interval.start.variable) {
                        boundVars.add(temporal.operator.interval.start.variable.symbol);
                    }
                    if (temporal.operator.interval.end.boundType === 'variable' && temporal.operator.interval.end.variable) {
                        boundVars.add(temporal.operator.interval.end.variable.symbol);
                    }
                }
                break;
            }
            // Handle TemporalAtom - normalize to TemporalLiteral or bare Atom
            // Upstream: validation.go lines 323-337
            if (isTemporalAtom(premise)) {
                const ta = premise as TemporalAtom;
                validatePremise(ta.atom, boundVars, ctx);
                if (ta.interval) {
                    if (ta.interval.start.boundType === 'variable' && ta.interval.start.variable) {
                        boundVars.add(ta.interval.start.variable.symbol);
                    }
                    if (ta.interval.end.boundType === 'variable' && ta.interval.end.variable) {
                        boundVars.add(ta.interval.end.variable.symbol);
                    }
                }
                break;
            }
            // Other term types (Variable, Constant, etc.) are not valid premises by themselves
            // This would be a parse error, so we don't report it here
            break;
    }
}

/**
 * Bind the variables of a positive atom (upstream CheckRule):
 * - user predicates with declared modes bind only their output ('-') and
 *   input/output ('?') positions;
 * - other atoms bind all their variables.
 */
function bindAtomVariables(atom: Atom, boundVars: Set<string>, ctx: ClauseCtx): void {
    const sym = atom.predicate.symbol;
    if (!sym.startsWith(':')) {
        const decl = ctx.decls.get(`${sym}/${atom.predicate.arity}`);
        const modes = decl ? getDeclaredModes(decl) : [];
        if (modes.length > 0) {
            const mode = unifyModes(modes);
            atom.args.forEach((arg, i) => {
                const m = mode[i];
                if (arg.type !== 'Variable' || arg.symbol === '_') return;
                if (m === 'output' || m === 'input_output') {
                    boundVars.add(arg.symbol);
                } else if (m === 'input' && !boundVars.has(arg.symbol) && !ctx.inputPositionVars.has(arg.symbol)) {
                    ctx.inputPositionVars.set(arg.symbol, arg.range);
                }
            });
            return;
        }
    }
    collectAtomVariables(atom, boundVars);
}

/**
 * Options for atom validation.
 */
interface AtomCheckOptions {
    /** Do not report unbound-variable errors (already reported by the caller). */
    suppressUnbound?: boolean;
}

/**
 * Validate an atom.
 */
function validateAtom(
    atom: Atom,
    boundVars: Set<string>,
    ctx: ClauseCtx,
    opts: AtomCheckOptions = {}
): void {
    const errors = ctx.errors;
    const symbolTable = ctx.symbolTable;
    const predName = atom.predicate.symbol;
    const arity = atom.predicate.arity;

    // Check built-in predicate
    if (predName.startsWith(':')) {
        if (!isBuiltinPredicate(predName)) {
            const suggestions = suggestSimilar(predName, getBuiltinPredicateNames());
            const nameRange = nameRangeOf(atom.range, predName);
            errors.push({
                code: 'E005',
                message: `Unknown built-in predicate '${predName}'`,
                range: atom.range,
                severity: 'error',
                hint: didYouMean(suggestions) ?? 'names starting with ":" are reserved for built-in predicates; user predicates start with a lowercase letter',
                fixes: suggestions.slice(0, 1).map(sug => ({ title: `Replace with '${sug}'`, range: nameRange, newText: sug })),
            });
            return;
        }

        const builtin = getBuiltinPredicate(predName);
        if (builtin && builtin.arity !== arity) {
            errors.push({
                code: 'E006',
                message: `Built-in predicate '${predName}' expects ${builtin.arity} arguments, got ${arity}`,
                range: atom.range,
                severity: 'error',
                hint: `signature: ${formatPredicateSignature(builtin)}`,
            });
        }

        // Check mode requirements for built-in predicates (upstream ast.Mode.Check)
        if (builtin) {
            for (let i = 0; i < builtin.mode.length && i < atom.args.length; i++) {
                const mode = builtin.mode[i];
                const arg = atom.args[i];
                if (!arg) continue;
                if (mode === 'input') {
                    if (opts.suppressUnbound) continue;
                    // Input arguments must be bound
                    const argVars = new Set<string>();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) {
                            errors.push({
                                code: 'E007',
                                message: `Argument ${i + 1} of '${predName}' requires bound variable, but '${v}' is unbound`,
                                range: arg.range,
                                severity: 'error',
                                hint: `built-ins cannot enumerate values: move '${predName}(...)' to the right of the premise that binds '${v}'`,
                            });
                        }
                    }
                } else if (mode === 'output') {
                    // Output arguments must be fresh variables.
                    if (arg.type === 'Variable') {
                        const v = arg.symbol;
                        if (v !== '_' && boundVars.has(v)) {
                            errors.push({
                                code: 'E065',
                                message: `Argument ${i + 1} of '${predName}' is an output and must be a fresh variable, but '${v}' is already bound`,
                                range: arg.range,
                                severity: 'error',
                                hint: `use a new variable and compare afterwards, e.g. ${predName}(..., ${v}2, ...), ${v}2 = ${v}`,
                            });
                        }
                    } else if (!DESTRUCTURING_PREDICATES.has(predName)) {
                        errors.push({
                            code: 'E065',
                            message: `Argument ${i + 1} of '${predName}' is an output and must be a variable, got ${arg.type}`,
                            range: arg.range,
                            severity: 'error',
                            hint: `bind a variable and compare it: ${predName}(..., V, ...), V = <value>`,
                        });
                    }
                }
            }
        }

        // Check that string predicates have a constant as second argument
        if (STRING_CONSTANT_PREDICATES.has(predName) && atom.args.length >= 2) {
            const secondArg = atom.args[1];
            if (secondArg && secondArg.type !== 'Constant') {
                errors.push({
                    code: 'E030',
                    message: `Second argument of '${predName}' must be a constant pattern, not a ${secondArg.type}`,
                    range: secondArg.range,
                    severity: 'error',
                    hint: predName === ':match_prefix'
                        ? 'write the prefix as a name constant, e.g. :match_prefix(X, /users)'
                        : `write the pattern as a string literal, e.g. ${predName}(S, "abc")`,
                });
            }
        }

        // Check destructuring predicates (:match_pair, :match_cons) - args 2&3 must be variables
        if (DESTRUCTURING_PREDICATES.has(predName) && atom.args.length >= 3) {
            const arg2 = atom.args[1];
            const arg3 = atom.args[2];
            if (arg2 && arg2.type !== 'Variable') {
                errors.push({
                    code: 'E033',
                    message: `Second argument of '${predName}' must be a variable for destructuring, got ${arg2.type}`,
                    range: arg2.range,
                    severity: 'error',
                    hint: `destructure into a variable and constrain it afterwards, e.g. ${predName}(X, A, B), A = <value>`,
                });
            }
            if (arg3 && arg3.type !== 'Variable') {
                errors.push({
                    code: 'E033',
                    message: `Third argument of '${predName}' must be a variable for destructuring, got ${arg3.type}`,
                    range: arg3.range,
                    severity: 'error',
                    hint: `destructure into a variable and constrain it afterwards, e.g. ${predName}(X, A, B), B = <value>`,
                });
            }
        }

        // Check field selector predicates (:match_field, :match_entry) - arg 2 must be constant
        if (FIELD_SELECTOR_PREDICATES.has(predName) && atom.args.length >= 2) {
            const fieldArg = atom.args[1];
            if (fieldArg && fieldArg.type !== 'Constant') {
                errors.push({
                    code: 'E034',
                    message: `Field selector (argument 2) of '${predName}' must be a constant, got ${fieldArg.type}`,
                    range: fieldArg.range,
                    severity: 'error',
                    hint: predName === ':match_field' ? 'struct fields are name constants, e.g. :match_field(S, /name, N)' : 'use a constant key, e.g. :match_entry(M, /key, V)',
                });
            }
        }
    }

    // Check user-defined predicates
    if (!predName.startsWith(':') && !predName.startsWith('fn:')) {
        // Build the full predicate key (name/arity)
        const predKey = `${predName}/${arity}`;
        // Check if predicate exists in symbol table
        const predInfo = symbolTable.getPredicateInfo(predKey);
        // Check if the predicate has actual definitions or a declaration (not just references)
        const hasDefs = predInfo && (predInfo.definitions.length > 0 || predInfo.declLocation);
        if (!hasDefs) {
            // Check if there's a predicate with same name but different arity
            const availableArities = symbolTable.getPredicateArities(predName);
            // Filter to only arities that have definitions or declarations
            const definedArities = availableArities?.filter(a => {
                const info = symbolTable.getPredicateInfo(`${predName}/${a}`);
                return info && (info.definitions.length > 0 || info.declLocation);
            });
            if (definedArities && definedArities.length > 0 && !definedArities.includes(arity)) {
                errors.push({
                    code: 'E040',
                    message: `Predicate '${predName}' called with ${arity} arguments, but available arities are: ${definedArities.join(', ')}`,
                    range: atom.range,
                    severity: 'error',
                    hint: `predicates are identified by name and arity; call ${predName}/${definedArities[0]} with ${definedArities[0]} arguments (use '_' for columns you do not need)`,
                });
            } else if (!definedArities || definedArities.length === 0) {
                reportUndefinedPredicate(atom, ctx);
            }
        } else {
            // Check visibility - private predicates are only visible within their package
            // (upstream analysis/rulecheck.go checkVisibility).
            if (predInfo.isPrivate && packageOf(predName) !== ctx.headPackage) {
                errors.push({
                    code: 'E041',
                    message: `Predicate '${predName}' is private to package '${packageOf(predName) || '(root)'}' and not visible from '${ctx.headPackage || '(root)'}'`,
                    range: atom.range,
                    severity: 'error',
                    hint: `use a public predicate of that package, or remove private() from the declaration of '${predName}'`,
                });
            }
        }
    }

    // Validate function applications in arguments
    for (const arg of atom.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg as ApplyFn, boundVars, errors, { reportUnbound: !opts.suppressUnbound });
        }
        // Validate name constants
        if (arg.type === 'Constant') {
            validateNameConstant(arg as Constant, errors);
        }
    }
}

/**
 * E075: a body predicate that is neither defined nor declared in this unit.
 */
function reportUndefinedPredicate(atom: Atom, ctx: ClauseCtx): void {
    const predName = atom.predicate.symbol;
    // Package-qualified predicates from another package live in other files.
    const pkg = packageOf(predName);
    if (pkg !== '' && pkg !== ctx.headPackage) return;
    const known = new Set<string>();
    for (const info of ctx.symbolTable.getAllPredicates()) {
        if (info.definitions.length > 0 || info.declLocation) known.add(info.symbol.symbol);
    }
    const suggestions = suggestSimilar(predName, known);
    const nameRange = nameRangeOf(atom.range, predName);
    ctx.errors.push({
        code: 'E075',
        message: `Predicate '${predName}/${atom.predicate.arity}' is not defined or declared in this file`,
        range: nameRange,
        severity: 'warning',
        hint: didYouMean(suggestions)
            ?? `define it with facts or rules, or declare it (Decl ${predName}(${atom.args.map((_, i) => `A${i + 1}`).join(', ')}) descr [extensional()].) if its facts are loaded from elsewhere`,
        fixes: suggestions.slice(0, 1).map(sug => ({ title: `Replace with '${sug}'`, range: nameRange, newText: sug })),
    });
}

/**
 * Validate a function application.
 */
/**
 * Common function name casing mistakes (AI hallucinations).
 * Maps wrong casing -> correct casing
 */
const COMMON_FUNCTION_CASING_ERRORS: Map<string, string> = new Map([
    ['fn:Sum', 'fn:sum'],
    ['fn:Count', 'fn:count'],
    ['fn:Max', 'fn:max'],
    ['fn:Min', 'fn:min'],
    ['fn:Avg', 'fn:avg'],
    ['fn:Plus', 'fn:plus'],
    ['fn:Minus', 'fn:minus'],
    ['fn:Mult', 'fn:mult'],
    ['fn:Div', 'fn:div'],
    ['fn:Collect', 'fn:collect'],
    ['fn:Group_by', 'fn:group_by'],
    ['fn:GROUP_BY', 'fn:group_by'],
    ['fn:GroupBy', 'fn:group_by'],
    ['fn:groupBy', 'fn:group_by'],
    ['fn:groupby', 'fn:group_by'],
]);

/**
 * Commonly hallucinated functions that DO NOT EXIST in Mangle.
 * Maps hallucinated name -> suggestion
 */
const HALLUCINATED_FUNCTIONS: Map<string, string> = new Map([
    // String functions that don't exist
    ['fn:string_contains', 'Use the predicate :string:contains(Str, "sub") in the rule body'],
    ['fn:string:contains', 'String matching is done with predicates, not functions: use :string:contains(Str, "sub") in the rule body'],
    ['fn:string:starts_with', 'Use the predicate :string:starts_with(Str, "prefix") in the rule body'],
    ['fn:string:ends_with', 'Use the predicate :string:ends_with(Str, "suffix") in the rule body'],
    ['fn:contains', 'For strings use the predicate :string:contains(Str, "sub"); for lists use :list:member(X, List) or fn:list:contains(List, X)'],
    ['fn:substring', 'Mangle has no substring function; test with :string:starts_with / :string:ends_with / :string:contains, or extract substrings in host code before loading facts'],
    ['fn:substr', 'Mangle has no substring function; test with :string:starts_with / :string:ends_with / :string:contains'],
    ['fn:match', 'Mangle has no regex matching; use :string:contains, :string:starts_with, :string:ends_with or :match_prefix (names)'],
    ['fn:regex', 'Mangle has no regex support; use :string:contains / :string:starts_with / :string:ends_with, or pre-process in host code'],
    ['fn:lower', 'Mangle has no case conversion; normalize strings in host code before loading facts'],
    ['fn:upper', 'Mangle has no case conversion; normalize strings in host code before loading facts'],
    ['fn:trim', 'Mangle has no trim function; clean strings in host code before loading facts'],
    ['fn:split', 'Mangle has no split function; parse strings in host code, or model the parts as separate facts'],
    ['fn:startswith', 'Use the predicate :string:starts_with(Str, "prefix") for strings or :match_prefix(Name, /prefix) for names'],
    ['fn:endswith', 'Use the predicate :string:ends_with(Str, "suffix")'],
    ['fn:join', 'Use fn:string:concat(A, B, ...) for concatenation'],
    ['fn:concat', 'Use fn:string:concat(...) for strings or fn:list:append(List, X) for lists'],
    ['fn:format', 'Use fn:string:concat(...); for times use fn:time:format(T, /unit)'],
    ['fn:to_string', 'Use fn:number:to_string, fn:float64:to_string or fn:name:to_string (or fn:string:concat, which converts its arguments)'],
    ['fn:str', 'Use fn:number:to_string, fn:float64:to_string or fn:name:to_string'],
    ['fn:string', 'Use fn:number:to_string, fn:float64:to_string or fn:name:to_string'],

    // Arithmetic
    ['fn:modulo', 'Use fn:mod(X, Y)'],
    ['fn:rem', 'Use fn:mod(X, Y)'],
    ['fn:remainder', 'Use fn:mod(X, Y)'],
    ['fn:abs', 'Mangle has no fn:abs; write two rules (one for X >= 0, one for X < 0 using fn:minus(X)), or use :within_distance(X, Y, D) for |X - Y| < D'],
    ['fn:round', 'Mangle has no rounding functions; integer division fn:div truncates, or round in host code'],
    ['fn:floor', 'Mangle has no fn:floor; integer division fn:div truncates towards zero'],
    ['fn:ceil', 'Mangle has no fn:ceil; compute with fn:div and fn:mod'],
    ['fn:pow', 'Mangle has no power function; use fn:mult repeatedly or precompute in host code'],

    // Lists / maps
    ['fn:len', 'Use fn:list:len(List) for lists'],
    ['fn:length', 'Use fn:list:len(List) for lists'],
    ['fn:size', 'Use fn:list:len(List) for lists'],
    ['fn:append', 'Use fn:list:append(List, X)'],
    ['fn:first', 'Use :match_cons(List, Head, _) or fn:list:get(List, 0)'],
    ['fn:head', 'Use :match_cons(List, Head, _) or fn:list:get(List, 0)'],
    ['fn:get', 'Use fn:list:get(List, I), fn:map:get(Map, K) or fn:struct:get(S, /field)'],
    ['fn:keys', 'Mangle has no fn:keys; enumerate entries with :match_entry or keep keys as separate facts'],
    ['fn:distinct', 'Use the reducers fn:collect_distinct(X) or fn:count_distinct() after do fn:group_by(...)'],

    // Time
    ['fn:now', 'Use fn:time:now()'],
    ['fn:date', 'Use fn:time:parse_rfc3339("2024-01-15T00:00:00Z") or fn:time:parse_civil(S, TimeZone)'],
    ['fn:weekday', 'Use fn:time:weekday_civil(T, "UTC") (Monday = 1 ... Sunday = 7)'],
    ['fn:time:weekday', 'Use fn:time:weekday_civil(T, "UTC") (Monday = 1 ... Sunday = 7)'],
    ['fn:dayofweek', 'Use fn:time:weekday_civil(T, "UTC") (Monday = 1 ... Sunday = 7)'],
    ['fn:time:diff', 'Use fn:time:sub(T1, T2), which returns a /duration'],

    // SQL-style aggregates
    ['sum', 'Use fn:sum (with fn: prefix) inside a |> let transform'],
    ['count', 'Use fn:count (with fn: prefix) inside a |> let transform'],
    ['max', 'Use fn:max (with fn: prefix) inside a |> let transform'],
    ['min', 'Use fn:min (with fn: prefix) inside a |> let transform'],
    ['avg', 'Use fn:avg (with fn: prefix) inside a |> let transform'],
    ['group_by', 'Use fn:group_by inside a |> do transform'],
    ['fn:mean', 'Use the reducer fn:avg(X) after do fn:group_by(...)'],
    ['fn:average', 'Use the reducer fn:avg(X) after do fn:group_by(...)'],
    ['fn:group', 'Use do fn:group_by(Keys...) to start an aggregation'],

    // Other hallucinations
    ['fn:filter', 'Filtering is done with body premises (comparisons, negation) or the predicate :filter(BoolExpr), not fn:filter'],
    ['fn:if', 'Mangle has no conditionals. Use multiple rules instead'],
    ['fn:case', 'Mangle has no case expressions. Use multiple rules instead'],
    ['fn:when', 'Mangle has no when expressions. Use multiple rules instead'],
    ['fn:otherwise', 'Mangle has no otherwise. Use multiple rules with negation'],
    ['fn:null', 'Mangle has no NULL. Use closed-world assumption with negation'],
    ['fn:coalesce', 'Mangle has no coalesce. Handle missing data with multiple rules'],
    ['fn:not', 'Negation is written on atoms: !pred(X)'],
    ['fn:exists', 'Existence is a positive body atom pred(X, _); non-existence is !pred(X, _) via a helper predicate'],
]);

/**
 * Options for function application validation.
 */
interface ApplyFnCheckOptions {
    /** Report unbound variables (E010). The caller may already report them (E004/E014). */
    reportUnbound?: boolean;
}

/** Hint for E061 problems mentioning an unknown constructor. */
function typeConstructorHint(message: string): string | undefined {
    const m = /'(fn:[A-Za-z_:]+)'/.exec(message);
    if (!m) return undefined;
    const name = m[1]!;
    const constructors = ['fn:Union', 'fn:Singleton', 'fn:List', 'fn:Option', 'fn:Pair', 'fn:Tuple', 'fn:Map', 'fn:Struct', 'fn:TaggedUnion', 'fn:Fun', 'fn:Rel'];
    const sug = suggestSimilar(name, constructors);
    return didYouMean(sug) ?? `type constructors are: ${constructors.map(c => '.' + c.slice(3)).join(', ')}`;
}

function validateApplyFn(
    applyFn: ApplyFn,
    boundVars: Set<string>,
    errors: SemanticError[],
    opts: ApplyFnCheckOptions = {}
): void {
    const reportUnbound = opts.reportUnbound ?? true;
    const fnName = applyFn.function.symbol;
    const arity = applyFn.function.arity;
    const nameRange = nameRangeOf(applyFn.range, fnName);

    // Check for common casing errors first
    const correctCasing = COMMON_FUNCTION_CASING_ERRORS.get(fnName)
        ?? (!isBuiltinFunction(fnName) && isBuiltinFunction(fnName.toLowerCase()) ? fnName.toLowerCase() : undefined);
    if (correctCasing) {
        errors.push({
            code: 'E018',
            message: `Function '${fnName}' has wrong casing. Use '${correctCasing}' instead (all lowercase after 'fn:')`,
            range: applyFn.range,
            severity: 'error',
            hint: `built-in function names are lowercase; only type constructors in bound [...] are capitalized`,
            fixes: [{ title: `Replace with '${correctCasing}'`, range: nameRange, newText: correctCasing }],
        });
        return;
    }

    // Check for commonly hallucinated functions
    const hallucination = HALLUCINATED_FUNCTIONS.get(fnName);
    if (hallucination) {
        errors.push({
            code: 'E020',
            message: `Function '${fnName}' does not exist in Mangle. ${hallucination}`,
            range: applyFn.range,
            severity: 'error',
            hint: hallucination,
        });
        return;
    }

    if (!isBuiltinFunction(fnName)) {
        const suggestions = suggestSimilar(fnName, getBuiltinFunctionNames());
        errors.push({
            code: 'E008',
            message: `Unknown built-in function '${fnName}'`,
            range: applyFn.range,
            severity: 'error',
            hint: didYouMean(suggestions) ?? 'Mangle has a fixed library of fn: functions and no user-defined functions; hover a fn: name or run `mangle-cli explain E008`',
            fixes: suggestions.slice(0, 1).map(sug => ({ title: `Replace with '${sug}'`, range: nameRange, newText: sug })),
        });
        return;
    }

    const builtin = getBuiltinFunction(fnName);
    const actualArity = arity === -1 ? applyFn.args.length : arity;
    if (builtin && builtin.arity !== -1 && builtin.arity !== actualArity && arity !== -1) {
        errors.push({
            code: 'E009',
            message: `Built-in function '${fnName}' expects ${builtin.arity} arguments, got ${arity}`,
            range: applyFn.range,
            severity: 'error',
            hint: `signature: ${formatFunctionSignature(builtin)}${builtin.example ? `; example: ${builtin.example}` : ''}`,
        });
    }

    // Check struct and map require even number of arguments
    if (fnName === 'fn:struct' || fnName === 'fn:map') {
        if (applyFn.args.length % 2 !== 0) {
            const syntax = fnName === 'fn:struct' ? '{ /key: value, ... }' : '[ key: value, ... ]';
            errors.push({
                code: 'E027',
                message: `${fnName} requires even number of arguments (key-value pairs). Use ${syntax} syntax`,
                range: applyFn.range,
                severity: 'error',
                hint: `write the literal form ${syntax}`,
            });
        }
    }

    // Check for division by zero (fn:div / fn:float:div divide by every later argument)
    if (fnName === 'fn:div' || fnName === 'fn:float:div' || fnName === 'fn:mod') {
        const divisors = applyFn.args.length === 1 && fnName !== 'fn:mod' ? applyFn.args : applyFn.args.slice(1);
        for (const divisor of divisors) {
            if (divisor.type === 'Constant') {
                const constant = divisor as Constant;
                if (constant.numValue === 0 || constant.floatValue === 0) {
                    errors.push({
                        code: 'E035',
                        message: fnName === 'fn:mod' ? `Modulo by zero: divisor is constant 0` : `Division by zero: divisor is constant 0`,
                        range: divisor.range,
                        severity: 'error',
                        hint: 'evaluation always fails; use a non-zero divisor (guard variable divisors with D != 0 first)',
                    });
                }
            }
        }
    }

    // E067: unit arguments of time functions must be supported name constants.
    if (builtin?.unitArg) {
        const unitArg = applyFn.args[builtin.unitArg.index];
        if (unitArg && unitArg.type === 'Constant') {
            const units = builtin.unitArg.units;
            const c = unitArg as Constant;
            if (c.constantType === 'name' && c.symbol !== undefined && !units.includes(c.symbol)) {
                const civil = (TIME_CIVIL_UNITS as readonly string[]).includes(c.symbol);
                let hint = `supported units for ${fnName}: ${units.join(', ')}`;
                if (fnName === 'fn:time:trunc' && civil) {
                    hint = `${c.symbol} is a calendar unit; use fn:time:trunc_civil(T, "UTC", ${c.symbol}) (or another IANA timezone)`;
                } else if (fnName === 'fn:time:add_civil' && ['/hour', '/minute', '/second'].includes(c.symbol)) {
                    hint = `for fixed durations use fn:time:add(T, fn:duration:from_${c.symbol.slice(1)}s(N))`;
                } else {
                    const sug = suggestSimilar(c.symbol, units, 1);
                    if (sug.length > 0) hint = `did you mean '${sug[0]}'? ${hint}`;
                }
                errors.push({
                    code: 'E067',
                    message: `Unit '${c.symbol}' is not supported by ${fnName}`,
                    range: unitArg.range,
                    severity: 'error',
                    hint,
                });
            } else if (c.constantType === 'string') {
                const asName = `/${(c.symbol ?? '').replace(/^\//, '')}`;
                const valid = units.includes(asName);
                errors.push({
                    code: 'E067',
                    message: `Units are name constants, not strings: ${fnName} expects one of ${units.join(', ')}`,
                    range: unitArg.range,
                    severity: 'error',
                    hint: valid ? `write ${asName} instead of "${c.symbol}"` : `supported units: ${units.join(', ')}`,
                    fixes: valid ? [{ title: `Replace with ${asName}`, range: unitArg.range, newText: asName }] : undefined,
                });
            }
        }
    }

    // Check that reducer functions are only used in appropriate contexts
    // (This is a warning since context detection is imperfect here)
    if (isReducerFunction(fnName)) {
        // E060: Var-arity reducer min-args check (upstream validation.go:942-944)
        // Variable-arity reducers like fn:collect must have at least one argument.
        const reducerDef = getBuiltinFunction(fnName);
        if (reducerDef && reducerDef.arity === -1 && applyFn.args.length === 0) {
            errors.push({
                code: 'E060',
                message: `Reducer function '${fnName}' expects at least one argument`,
                range: applyFn.range,
                severity: 'error',
                hint: `pass what to collect, e.g. ${fnName}(X); to count rows use fn:count()`,
            });
        }
    }

    // All variables in function arguments must be bound
    if (reportUnbound) {
        for (const arg of applyFn.args) {
            const argVars = new Set<string>();
            collectTermVariables(arg, argVars);
            for (const v of argVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E010',
                        message: `Variable '${v}' in function '${fnName}' must be bound`,
                        range: arg.range,
                        severity: 'error',
                        hint: `functions are evaluated, never solved: bind '${v}' in an earlier premise`,
                    });
                }
            }
        }
    }

    // Recurse into nested function applications and validate constants
    for (const arg of applyFn.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg as ApplyFn, boundVars, errors, { reportUnbound: false });
        }
        if (arg.type === 'Constant') {
            validateNameConstant(arg as Constant, errors);
        }
    }
}

/**
 * Validate a transform.
 */
function validateTransform(
    transform: Transform,
    boundVars: Set<string>,
    errors: SemanticError[],
    bodyVars?: Set<string>,
    headVars?: Set<string>
): void {
    // E043: Check transform doesn't redefine body variables
    if (bodyVars) {
        let checkTransform: Transform | null = transform;
        while (checkTransform) {
            for (const stmt of checkTransform.statements) {
                if (stmt.variable && bodyVars.has(stmt.variable.symbol)) {
                    errors.push({
                        code: 'E043',
                        message: `Transform redefines variable '${stmt.variable.symbol}' from rule body`,
                        range: stmt.variable.range,
                        severity: 'error',
                        hint: `let introduces a new variable; pick a fresh name such as '${stmt.variable.symbol}2' (and use it in the head)`,
                    });
                }
            }
            checkTransform = checkTransform.next;
        }
    }

    let current: Transform | null = transform;
    let hasGroupBy = false;

    while (current) {
        for (const stmt of current.statements) {
            // Check if this is a "do" statement (variable is null) or "let" statement
            if (stmt.variable === null) {
                // do-statement
                const fnName = stmt.fn.function.symbol;
                if (fnName === 'fn:group_by') {
                    hasGroupBy = true;

                    // Check that all group_by arguments are distinct variables
                    const groupByVars = new Set<string>();
                    for (const arg of stmt.fn.args) {
                        if (arg.type !== 'Variable') {
                            errors.push({
                                code: 'E036',
                                message: `Arguments to fn:group_by must be variables, got ${arg.type}`,
                                range: arg.range,
                                severity: 'error',
                                hint: 'compute the key in the rule body (K = ...) and group by K',
                            });
                        } else {
                            const v = (arg as Variable).symbol;
                            if (groupByVars.has(v)) {
                                errors.push({
                                    code: 'E037',
                                    message: `Duplicate variable '${v}' in fn:group_by - all arguments must be distinct`,
                                    range: arg.range,
                                    severity: 'error',
                                    hint: `remove the repeated '${v}'`,
                                });
                            }
                            groupByVars.add(v);
                        }
                    }
                } else if (!hasGroupBy) {
                    errors.push({
                        code: 'E011',
                        message: `Transform must start with 'do fn:group_by(...)', found '${fnName}'`,
                        range: stmt.fn.range,
                        severity: 'error',
                        hint: "aggregations are written '|> do fn:group_by(Keys...), let V = fn:reducer(...)'; for per-row values use 'let' without 'do'",
                    });
                }

                // Check that group_by variables are bound
                for (const arg of stmt.fn.args) {
                    const argVars = new Set<string>();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) {
                            errors.push({
                                code: 'E012',
                                message: `Variable '${v}' in group_by must be bound in the body`,
                                range: arg.range,
                                severity: 'error',
                                hint: `group by variables that appear in positive body atoms`,
                            });
                        }
                    }
                }
            } else {
                // let-statement - binds a variable
                if (stmt.variable.symbol !== '_') {
                    boundVars.add(stmt.variable.symbol);
                }

                // After group_by, non-reducer functions are allowed if their variables
                // are from the group_by key or defined by earlier transform statements.
                // This matches upstream behavior from commit a77833b.
                const fnName = stmt.fn.function.symbol;
                if (hasGroupBy && !isReducerFunction(fnName) && fnName !== 'fn:group_by') {
                    // Check that all variables used in this function are either
                    // in the group_by key or defined by previous let-statements in the transform.
                    const groupByVars = new Set<string>();
                    // Find group_by vars from first statement
                    for (const s of current!.statements) {
                        if (s.variable === null && s.fn.function.symbol === 'fn:group_by') {
                            for (const arg of s.fn.args) {
                                if (arg.type === 'Variable') {
                                    groupByVars.add((arg as Variable).symbol);
                                }
                            }
                            break;
                        }
                    }
                    // Collect transform-defined variables (before this statement)
                    const transformDefs = new Set<string>();
                    for (const s of current!.statements) {
                        if (s === stmt) break;
                        if (s.variable && s.variable.symbol !== '_') {
                            transformDefs.add(s.variable.symbol);
                        }
                    }
                    // Check all variables used in this function application
                    const usedVars = new Set<string>();
                    collectTermVariables(stmt.fn, usedVars);
                    for (const v of usedVars) {
                        if (!groupByVars.has(v) && !transformDefs.has(v)) {
                            errors.push({
                                code: 'E047',
                                message: `Variable '${v}' in function '${fnName}' must be either part of group_by or defined in the transform`,
                                range: stmt.fn.range,
                                severity: 'error',
                                hint: `'${fnName}' is not a reducer, so after grouping it cannot see per-row values: add '${v}' to fn:group_by(...), or aggregate it first (e.g. let S = fn:sum(${v}), let ${stmt.variable.symbol} = ${fnName}(S, ...))`,
                            });
                        }
                    }
                }

                // Validate the function application
                validateApplyFn(stmt.fn, boundVars, errors);
            }
        }
        current = current.next;
    }

    // E049: Head variable vs group_by completeness check (upstream validation.go:750-758)
    // After group_by, all head variables must be in group_by key or defined by transform let-statements.
    if (hasGroupBy && headVars) {
        const groupByVarSet = new Set();
        const transformDefSet = new Set();
        // Collect group_by vars
        for (const stmt of transform.statements) {
            if (stmt.variable === null && stmt.fn.function.symbol === 'fn:group_by') {
                for (const arg of stmt.fn.args) {
                    if (arg.type === 'Variable') {
                        groupByVarSet.add((arg as Variable).symbol);
                    }
                }
            }
            // Collect transform-defined variables
            if (stmt.variable && stmt.variable.symbol !== '_') {
                transformDefSet.add(stmt.variable.symbol);
            }
        }
        for (const v of headVars) {
            if (v === '_') continue;
            if (groupByVarSet.has(v)) continue;
            if (transformDefSet.has(v)) continue;
            errors.push({
                code: 'E049',
                message: `Head variable '${v}' is neither part of group_by nor defined in the transform`,
                range: transform.range,
                severity: 'error',
                hint: `add '${v}' to fn:group_by(...), aggregate it (let ${v}s = fn:collect(${v})), or drop it from the head`,
            });
        }
    }

    // E050: Reducer in let-transform rejection (upstream validation.go:761-768)
    // A let-transform is one where the first statement has a variable (not a do-statement).
    // Reducer functions are not allowed in let-transforms.
    if (!hasGroupBy && transform.statements.length > 0 && transform.statements[0].variable !== null) {
        for (const stmt of transform.statements.slice(1)) {
            if (stmt.variable === null) {
                errors.push({
                    code: 'E050',
                    message: 'All statements in a let-transform must be let-statements',
                    range: stmt.fn.range,
                    severity: 'error',
                    hint: "a 'do' statement is only valid as the first statement: '|> do fn:group_by(...), let ...'",
                });
            } else if (isReducerFunction(stmt.fn.function.symbol)) {
                errors.push({
                    code: 'E050',
                    message: `Reducer function '${stmt.fn.function.symbol}' is not allowed in a let-transform`,
                    range: stmt.fn.range,
                    severity: 'error',
                    hint: "start the transform with 'do fn:group_by(Keys...)' (or 'do fn:group_by()' for the whole relation) to aggregate",
                });
            }
        }
    }
}

/**
 * Handle equality for variable binding.
 * Now uses union-find for X = Y where both are unbound variables (Feature E).
 */
function handleEquality(
    left: Term,
    right: Term,
    boundVars: Set<string>,
    errors: SemanticError[],
    range: SourceRange,
    uf?: UnionFind
): void {
    // If left is a single variable and right is ground or bound, bind left
    if (left.type === 'Variable' && (left as Variable).symbol !== '_') {
        const v = (left as Variable).symbol;
        if (right.type === 'Constant' || isGroundOrBound(right, boundVars)) {
            boundVars.add(v);
        }
    }

    // If right is a single variable and left is ground or bound, bind right
    if (right.type === 'Variable' && (right as Variable).symbol !== '_') {
        const v = (right as Variable).symbol;
        if (left.type === 'Constant' || isGroundOrBound(left, boundVars)) {
            boundVars.add(v);
        }
    }

    // If left is a function application, all its variables must be bound
    if (left.type === 'ApplyFn') {
        const leftVars = new Set<string>();
        collectTermVariables(left, leftVars);
        for (const v of leftVars) {
            if (v !== '_' && !boundVars.has(v)) {
                errors.push({
                    code: 'E014',
                    message: `Variable '${v}' in function application must be bound`,
                    range: range,
                    severity: 'error',
                    hint: `functions are evaluated left to right, never solved: bind '${v}' in an earlier premise`,
                });
            }
        }
        // Validate the function application itself (E008, E009, E018, E020, E027, E035);
        // unbound variables are already reported as E014.
        validateApplyFn(left as ApplyFn, boundVars, errors, { reportUnbound: false });
        // The right side variable becomes bound
        if (right.type === 'Variable' && (right as Variable).symbol !== '_') {
            boundVars.add((right as Variable).symbol);
        }
    }

    // Same for right side
    if (right.type === 'ApplyFn') {
        const rightVars = new Set<string>();
        collectTermVariables(right, rightVars);
        for (const v of rightVars) {
            if (v !== '_' && !boundVars.has(v)) {
                errors.push({
                    code: 'E014',
                    message: `Variable '${v}' in function application must be bound`,
                    range: range,
                    severity: 'error',
                    hint: `functions are evaluated left to right, never solved: bind '${v}' in an earlier premise`,
                });
            }
        }
        // Validate the function application itself (E008, E009, E018, E020, E027, E035);
        // unbound variables are already reported as E014.
        validateApplyFn(right as ApplyFn, boundVars, errors, { reportUnbound: false });
        // The left side variable becomes bound
        if (left.type === 'Variable' && (left as Variable).symbol !== '_') {
            boundVars.add((left as Variable).symbol);
        }
    }

    // Validate name constants in equality contexts (E032)
    if (left.type === 'Constant') {
        validateNameConstant(left as Constant, errors);
    }
    if (right.type === 'Constant') {
        validateNameConstant(right as Constant, errors);
    }

    // Feature E: If both sides are variables and neither is bound yet,
    // use union-find to record their equivalence (upstream validation.go:514-522)
    if (uf && left.type === 'Variable' && right.type === 'Variable') {
        const leftVar = left as Variable;
        const rightVar = right as Variable;
        if (leftVar.symbol !== '_' && rightVar.symbol !== '_') {
            uf.unify(leftVar, rightVar);
        }
    }
}

/**
 * Check if a term is ground or all its variables are bound.
 */
function isGroundOrBound(term: Term, boundVars: Set<string>): boolean {
    if (term.type === 'Constant') {
        return true;
    }
    if (term.type === 'Variable') {
        const v = (term as Variable).symbol;
        return v === '_' || boundVars.has(v);
    }
    if (term.type === 'ApplyFn') {
        const applyFn = term as ApplyFn;
        return applyFn.args.every(arg => isGroundOrBound(arg, boundVars));
    }
    return false;
}

/**
 * Validate name constant format.
 * Name constants must start with '/' and have no empty parts.
 */
function validateNameConstant(
    constant: Constant,
    errors: SemanticError[]
): void {
    // Name constants have constantType === 'name' and symbol starts with '/'
    if (constant.constantType === 'name' && constant.symbol) {
        const name = constant.symbol;
        // Check for empty parts (// or trailing /)
        if (name.includes('//')) {
            errors.push({
                code: 'E032',
                message: `Name constant '${name}' contains empty part (double slash)`,
                range: constant.range,
                severity: 'error',
            });
        }
        if (name.length > 1 && name.endsWith('/')) {
            errors.push({
                code: 'E032',
                message: `Name constant '${name}' has trailing slash`,
                range: constant.range,
                severity: 'error',
            });
        }
        if (name === '/') {
            errors.push({
                code: 'E032',
                message: `Name constant must be non-empty after '/'`,
                range: constant.range,
                severity: 'error',
            });
        }
    }

    // Validate string constants for escape sequences
    if (constant.constantType === 'string' && constant.symbol) {
        validateStringEscapes(constant.symbol, constant.range, errors);
    }
}

/**
 * Validate string escape sequences.
 */
function validateStringEscapes(
    str: string,
    range: SourceRange,
    errors: SemanticError[]
): void {
    let i = 0;
    while (i < str.length) {
        if (str[i] === '\\') {
            if (i + 1 >= str.length) {
                errors.push({
                    code: 'E038',
                    message: `Invalid escape sequence: backslash at end of string`,
                    range: range,
                    severity: 'error',
                });
                break;
            }
            const next = str[i + 1] as string;
            if (next === 'x') {
                // Hex escape \xHH
                if (i + 3 >= str.length) {
                    errors.push({
                        code: 'E038',
                        message: `Invalid hex escape: \\x requires two hex digits`,
                        range: range,
                        severity: 'error',
                    });
                }
                i += 4;
            } else if (next === 'u') {
                // Unicode escape \u{...}
                if (i + 2 >= str.length || str[i + 2] !== '{') {
                    errors.push({
                        code: 'E038',
                        message: `Invalid unicode escape: \\u must be followed by {hex}`,
                        range: range,
                        severity: 'error',
                    });
                }
                // Skip to closing brace
                let j = i + 3;
                while (j < str.length && str[j] !== '}') j++;
                if (j >= str.length) {
                    errors.push({
                        code: 'E038',
                        message: `Invalid unicode escape: missing closing brace`,
                        range: range,
                        severity: 'error',
                    });
                }
                i = j + 1;
            } else if (VALID_ESCAPES.has(next)) {
                i += 2;
            } else {
                errors.push({
                    code: 'E038',
                    message: `Invalid escape sequence: \\${next}`,
                    range: range,
                    severity: 'error',
                });
                i += 2;
            }
        } else {
            i++;
        }
    }
}

/**
 * Collect variables from an atom.
 */
function collectAtomVariables(atom: Atom, vars: Set<string>): void {
    for (const arg of atom.args) {
        collectTermVariables(arg, vars);
    }
}

/**
 * Collect variables from a term.
 */
function collectTermVariables(term: Term, vars: Set<string>): void {
    switch (term.type) {
        case 'Variable': {
            const v = term as Variable;
            if (v.symbol !== '_') {
                vars.add(v.symbol);
            }
            break;
        }
        case 'ApplyFn': {
            const applyFn = term as ApplyFn;
            for (const arg of applyFn.args) {
                collectTermVariables(arg, vars);
            }
            break;
        }
        case 'Constant':
            // Constants have no variables
            break;
    }
}

/**
 * Collect variables from a premise.
 */
function collectPremiseVariables(premise: Term, vars: Set<string>): void {
    switch (premise.type) {
        case 'Atom': {
            const atom = premise as Atom;
            collectAtomVariables(atom, vars);
            break;
        }
        case 'NegAtom': {
            const negAtom = premise as NegAtom;
            collectAtomVariables(negAtom.atom, vars);
            break;
        }
        case 'Eq': {
            const eq = premise as { type: 'Eq'; left: Term; right: Term };
            collectTermVariables(eq.left, vars);
            collectTermVariables(eq.right, vars);
            break;
        }
        case 'Ineq': {
            const ineq = premise as { type: 'Ineq'; left: Term; right: Term };
            collectTermVariables(ineq.left, vars);
            collectTermVariables(ineq.right, vars);
            break;
        }
        default:
            // Handle TemporalLiteral
            if (isTemporalLiteral(premise)) {
                const temporal = premise as TemporalLiteral;
                collectPremiseVariables(temporal.literal, vars);
                if (temporal.interval) {
                    if (temporal.interval.start.variable) {
                        vars.add(temporal.interval.start.variable.symbol);
                    }
                    if (temporal.interval.end.variable) {
                        vars.add(temporal.interval.end.variable.symbol);
                    }
                }
                if (temporal.operator && temporal.operator.interval) {
                    if (temporal.operator.interval.start.variable) {
                        vars.add(temporal.operator.interval.start.variable.symbol);
                    }
                    if (temporal.operator.interval.end.variable) {
                        vars.add(temporal.operator.interval.end.variable.symbol);
                    }
                }
                break;
            }
            // Handle TemporalAtom
            if (isTemporalAtom(premise)) {
                const ta = premise as TemporalAtom;
                collectAtomVariables(ta.atom, vars);
                if (ta.interval) {
                    if (ta.interval.start.variable) {
                        vars.add(ta.interval.start.variable.symbol);
                    }
                    if (ta.interval.end.variable) {
                        vars.add(ta.interval.end.variable.symbol);
                    }
                }
                break;
            }
            // For other term types, try to collect from them directly
            collectTermVariables(premise, vars);
            break;
    }
}

/**
 * Validate arity consistency between declarations and clauses (E046).
 */
function validateArityConsistency(
    unit: SourceUnit,
    errors: SemanticError[]
): void {
    // Collect all arities used for each predicate name in clauses
    const predicateArities = new Map<string, Set<number>>();
    for (const clause of unit.clauses) {
        const name = clause.head.predicate.symbol;
        const arity = clause.head.predicate.arity;
        if (!predicateArities.has(name)) {
            predicateArities.set(name, new Set());
        }
        predicateArities.get(name)!.add(arity);
    }

    // Check declarations match clause arities
    for (const decl of unit.decls) {
        const name = decl.declaredAtom.predicate.symbol;
        const arity = decl.declaredAtom.predicate.arity;
        const arities = predicateArities.get(name);
        if (arities && !arities.has(arity)) {
            errors.push({
                code: 'E046',
                message: `Declaration arity ${arity} doesn't match clause arities: ${[...arities].join(', ')}`,
                range: decl.range,
                severity: 'error',
            });
        }
    }
}
