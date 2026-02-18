"use strict";
/**
 * Semantic validation for Mangle.
 *
 * Performs semantic analysis on parsed Mangle source and reports errors.
 * Ported from upstream Go implementation (analysis/validation.go).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const ast_1 = require("../parser/ast");
const predicates_1 = require("../builtins/predicates");
const functions_1 = require("../builtins/functions");
const symbols_1 = require("./symbols");
const unionfind_1 = require("./unionfind");
const rewrite_1 = require("./rewrite");
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
 * Reducer functions that can only appear in transforms.
 */
const REDUCER_FUNCTIONS = new Set([
    'fn:sum',
    'fn:count',
    'fn:max',
    'fn:min',
    'fn:avg',
    'fn:collect',
    'fn:collect_distinct',
    'fn:collect_to_map',
    'fn:pick_any',
    'fn:float:sum',
    'fn:float:max',
    'fn:float:min',
]);
/**
 * Valid string escape sequences.
 */
const VALID_ESCAPES = new Set(['n', 't', 'r', '\\', '"', "'"]);
/**
 * Validate a source unit and return semantic errors.
 */
function validate(unit) {
    const errors = [];
    const symbolTable = (0, symbols_1.buildSymbolTable)(unit);
    // E044: Check for duplicate declarations
    const declaredPredicates = new Map();
    for (const decl of unit.decls) {
        const key = `${decl.declaredAtom.predicate.symbol}/${decl.declaredAtom.predicate.arity}`;
        if (declaredPredicates.has(key)) {
            errors.push({
                code: 'E044',
                message: `Predicate '${key}' declared more than once`,
                range: decl.range,
                severity: 'error',
            });
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
        if (decl && clause.headTime && !(0, ast_1.isEternalInterval)(clause.headTime)) {
            // Clause uses temporal annotation on head, but decl is not temporal
            if (!(0, ast_1.isDeclTemporal)(decl) && !(0, ast_1.isDeclMaybeTemporal)(decl)) {
                errors.push({
                    code: 'E058',
                    message: `Predicate '${pred.symbol}' is not declared temporal but used with temporal annotation`,
                    range: clause.head.range,
                    severity: 'error',
                });
            }
        }
        if (decl && ((0, ast_1.isDeclTemporal)(decl) || (0, ast_1.isDeclMaybeTemporal)(decl))) {
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
    return { errors, symbolTable };
}
/**
 * Validate a declaration (CheckDecl equivalent from upstream).
 *
 * Ported from upstream Go implementation (analysis/declcheck.go).
 */
function validateDeclaration(decl, errors) {
    const declAtom = decl.declaredAtom;
    const descriptors = decl.descr || [];
    // Build expected args map (all args must be variables)
    const expectedArgs = new Map();
    for (let i = 0; i < declAtom.args.length; i++) {
        const arg = declAtom.args[i];
        if (arg && arg.type !== 'Variable') {
            errors.push({
                code: 'E024',
                message: `Declaration argument ${i + 1} must be a variable, got ${arg.type}`,
                range: arg.range,
                severity: 'error',
            });
        }
        else if (arg && arg.type === 'Variable') {
            expectedArgs.set(arg.symbol, arg);
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
        }
    }
    // Validate doc() and arg() descriptor atoms (Feature G)
    let seenDoc = false;
    const expectedArgsForArgCheck = new Map(expectedArgs);
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
                    docArg.constantType !== 'string') {
                    errors.push({
                        code: 'E053',
                        message: `expected string constant in doc(), got ${docArg.type}`,
                        range: docArg.range,
                        severity: 'error',
                    });
                }
            }
        }
        else if (sym === 'arg') {
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
            const varName = firstArg.symbol;
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
                    argArg.constantType !== 'string') {
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
    const isExternal = descriptors.some(d => d.predicate.symbol === 'external');
    if (isExternal) {
        const modeCount = descriptors.filter(d => d.predicate.symbol === 'mode').length;
        if (modeCount !== 1) {
            errors.push({
                code: 'E026',
                message: `External predicate must have exactly one mode declaration, got ${modeCount}`,
                range: declAtom.range,
                severity: 'error',
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
            const nameVal = nameArg.symbol ?? '';
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
 * Validate a single clause.
 */
function validateClause(clause, symbolTable, errors, declaredPredicates) {
    // Apply clause rewriting (negation delay) before validation
    // Upstream: RewriteClause is called before CheckRule
    const rewritten = (0, rewrite_1.rewriteClause)(clause);
    // Collect bound variables
    const boundVars = new Set();
    const headVars = new Set();
    // Create union-find for variable equivalence (Feature E)
    const uf = unionfind_1.UnionFind.create();
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
        if (arg.type === 'Variable' && arg.symbol === '_') {
            errors.push({
                code: 'E039',
                message: `Wildcard '_' in head is unusual - this argument will be unbound in derived facts`,
                range: arg.range,
                severity: 'warning',
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
        });
    }
    // If this is a fact (no premises), all head variables must be ground
    if (!rewritten.premises || rewritten.premises.length === 0) {
        for (const v of headVars) {
            if (v !== '_') {
                errors.push({
                    code: 'E001',
                    message: `Variable '${v}' in fact head must be ground (facts cannot have variables)`,
                    range: rewritten.head.range,
                    severity: 'error',
                });
            }
        }
        return;
    }
    // Process premises to determine bound variables
    for (const premise of rewritten.premises) {
        validatePremise(premise, boundVars, symbolTable, errors, uf);
    }
    // Collect body variables for transform redefinition check (E043)
    const bodyVars = new Set();
    for (const premise of rewritten.premises) {
        collectPremiseVariables(premise, bodyVars);
    }
    // Validate transform if present (this also binds let-variables)
    if (rewritten.transform) {
        validateTransform(rewritten.transform, boundVars, errors, bodyVars);
    }
    // Check that all head variables are bound (after processing transform)
    // Upstream: uses union-find to resolve variable equivalences
    for (const v of headVars) {
        if (v === '_')
            continue;
        if (boundVars.has(v))
            continue;
        // Check union-find: variable might be unified with a bound variable or constant
        const dummyVar = { type: 'Variable', symbol: v, range: rewritten.head.range };
        if (uf.isBound(dummyVar, boundVars))
            continue;
        errors.push({
            code: 'E002',
            message: `Variable '${v}' in head is not bound in the body (range restriction violation)`,
            range: rewritten.head.range,
            severity: 'error',
        });
    }
}
/**
 * Validate a premise and update bound variables.
 */
function validatePremise(premise, boundVars, symbolTable, errors, uf) {
    // Check the type field to determine how to handle this premise
    switch (premise.type) {
        case 'Atom': {
            const atom = premise;
            // Check if this is a comparison atom (:lt, :le, :gt, :ge)
            if ((0, ast_1.isComparisonAtom)(atom)) {
                // Comparison atoms require all arguments to be bound (they don't bind variables)
                for (const arg of atom.args) {
                    const argVars = new Set();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) {
                            errors.push({
                                code: 'E004',
                                message: `Variable '${v}' must be bound before comparison`,
                                range: atom.range,
                                severity: 'error',
                            });
                        }
                    }
                }
                // Also validate arity and other builtin checks (E006, etc.)
                validateAtom(atom, boundVars, symbolTable, errors);
            }
            else {
                // Regular atom - validate and bind variables
                validateAtom(atom, boundVars, symbolTable, errors);
                // Positive atoms bind all their variables
                collectAtomVariables(atom, boundVars);
            }
            break;
        }
        case 'NegAtom': {
            const negAtom = premise;
            // Negated atoms don't bind variables, but all their variables must be bound
            const negVars = new Set();
            collectAtomVariables(negAtom.atom, negVars);
            for (const v of negVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E003',
                        message: `Variable '${v}' in negated atom must be bound before the negation`,
                        range: negAtom.range,
                        severity: 'error',
                    });
                }
            }
            validateAtom(negAtom.atom, boundVars, symbolTable, errors);
            break;
        }
        case 'Eq': {
            const eq = premise;
            // Equality can bind a variable if the other side is bound
            handleEquality(eq.left, eq.right, boundVars, errors, eq.range, uf);
            break;
        }
        case 'Ineq': {
            // Inequality requires both sides to be bound
            const ineq = premise;
            const leftVars = new Set();
            const rightVars = new Set();
            collectTermVariables(ineq.left, leftVars);
            collectTermVariables(ineq.right, rightVars);
            for (const v of leftVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: ineq.range,
                        severity: 'error',
                    });
                }
            }
            for (const v of rightVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: ineq.range,
                        severity: 'error',
                    });
                }
            }
            break;
        }
        default:
            // Handle TemporalLiteral
            if ((0, ast_1.isTemporalLiteral)(premise)) {
                const temporal = premise;
                // Validate the inner literal
                validatePremise(temporal.literal, boundVars, symbolTable, errors);
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
            if ((0, ast_1.isTemporalAtom)(premise)) {
                const ta = premise;
                if (!ta.interval) {
                    // Demote to bare Atom
                    validatePremise(ta.atom, boundVars, symbolTable, errors);
                }
                else {
                    // Wrap as TemporalLiteral equivalent
                    validatePremise(ta.atom, boundVars, symbolTable, errors);
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
 * Validate an atom.
 */
function validateAtom(atom, boundVars, symbolTable, errors) {
    const predName = atom.predicate.symbol;
    const arity = atom.predicate.arity;
    // Check built-in predicate
    if (predName.startsWith(':')) {
        if (!(0, predicates_1.isBuiltinPredicate)(predName)) {
            errors.push({
                code: 'E005',
                message: `Unknown built-in predicate '${predName}'`,
                range: atom.range,
                severity: 'error',
            });
            return;
        }
        const builtin = (0, predicates_1.getBuiltinPredicate)(predName);
        if (builtin && builtin.arity !== arity) {
            errors.push({
                code: 'E006',
                message: `Built-in predicate '${predName}' expects ${builtin.arity} arguments, got ${arity}`,
                range: atom.range,
                severity: 'error',
            });
        }
        // Check mode requirements for built-in predicates
        if (builtin) {
            for (let i = 0; i < builtin.mode.length && i < atom.args.length; i++) {
                const mode = builtin.mode[i];
                const arg = atom.args[i];
                if (mode === 'input' && arg) {
                    // Input arguments must be bound
                    const argVars = new Set();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) {
                            errors.push({
                                code: 'E007',
                                message: `Argument ${i + 1} of '${predName}' requires bound variable, but '${v}' is unbound`,
                                range: arg.range,
                                severity: 'error',
                            });
                        }
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
                });
            }
            if (arg3 && arg3.type !== 'Variable') {
                errors.push({
                    code: 'E033',
                    message: `Third argument of '${predName}' must be a variable for destructuring, got ${arg3.type}`,
                    range: arg3.range,
                    severity: 'error',
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
                });
            }
            // If no info, we can't check visibility
        }
        else {
            // Check visibility - predicates marked private cannot be accessed from other packages
            if (predInfo.isPrivate) {
                // Private predicate access is an error
                errors.push({
                    code: 'E041',
                    message: `Predicate '${predName}' is marked private and may not be accessible from other packages`,
                    range: atom.range,
                    severity: 'error',
                });
            }
        }
    }
    // Validate function applications in arguments
    for (const arg of atom.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg, boundVars, errors);
        }
        // Validate name constants
        if (arg.type === 'Constant') {
            validateNameConstant(arg, errors);
        }
    }
}
/**
 * Validate a function application.
 */
/**
 * Common function name casing mistakes (AI hallucinations).
 * Maps wrong casing -> correct casing
 */
const COMMON_FUNCTION_CASING_ERRORS = new Map([
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
    ['fn:Pair', 'fn:pair'],
    ['fn:List', 'fn:list'],
    ['fn:Map', 'fn:map'],
    ['fn:Struct', 'fn:struct'],
]);
/**
 * Commonly hallucinated functions that DO NOT EXIST in Mangle.
 * Maps hallucinated name -> suggestion
 */
const HALLUCINATED_FUNCTIONS = new Map([
    // String functions that don't exist
    ['fn:string_contains', 'Mangle has no substring search. Use :match_prefix or implement in Go'],
    ['fn:contains', 'Mangle has no contains function. Use :match_prefix for prefix matching'],
    ['fn:substring', 'Mangle has no substring function. Process strings in Go'],
    ['fn:match', 'Mangle has no regex matching. Use :match_prefix or implement in Go'],
    ['fn:regex', 'Mangle has no regex support. Implement pattern matching in Go'],
    ['fn:lower', 'Mangle has no case conversion. Normalize strings in Go before loading'],
    ['fn:upper', 'Mangle has no case conversion. Normalize strings in Go before loading'],
    ['fn:trim', 'Mangle has no trim function. Clean strings in Go before loading'],
    ['fn:split', 'Mangle has no split function. Parse strings in Go before loading'],
    ['fn:startswith', 'Use the :match_prefix built-in predicate instead'],
    ['fn:endswith', 'Mangle has no endswith. Implement in Go or reverse string matching'],
    ['fn:join', 'Use fn:string:concat for concatenation'],
    ['fn:format', 'Mangle has no format function. Use fn:string:concat or format in Go'],
    // SQL-style aggregates
    ['sum', 'Use fn:sum (with fn: prefix) inside a |> let transform'],
    ['count', 'Use fn:count (with fn: prefix) inside a |> let transform'],
    ['max', 'Use fn:max (with fn: prefix) inside a |> let transform'],
    ['min', 'Use fn:min (with fn: prefix) inside a |> let transform'],
    ['avg', 'Use fn:avg (with fn: prefix) inside a |> let transform'],
    ['group_by', 'Use fn:group_by inside a |> do transform'],
    // Other hallucinations
    ['fn:filter', 'Filtering is done with body predicates, not fn:filter'],
    ['fn:if', 'Mangle has no conditionals. Use multiple rules instead'],
    ['fn:case', 'Mangle has no case expressions. Use multiple rules instead'],
    ['fn:when', 'Mangle has no when expressions. Use multiple rules instead'],
    ['fn:otherwise', 'Mangle has no otherwise. Use multiple rules with negation'],
    ['fn:null', 'Mangle has no NULL. Use closed-world assumption with negation'],
    ['fn:coalesce', 'Mangle has no coalesce. Handle missing data with multiple rules'],
]);
function validateApplyFn(applyFn, boundVars, errors) {
    const fnName = applyFn.function.symbol;
    const arity = applyFn.function.arity;
    // Check for common casing errors first
    const correctCasing = COMMON_FUNCTION_CASING_ERRORS.get(fnName);
    if (correctCasing) {
        errors.push({
            code: 'E018',
            message: `Function '${fnName}' has wrong casing. Use '${correctCasing}' instead (all lowercase after 'fn:')`,
            range: applyFn.range,
            severity: 'error',
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
        });
        return;
    }
    if (!(0, functions_1.isBuiltinFunction)(fnName)) {
        errors.push({
            code: 'E008',
            message: `Unknown built-in function '${fnName}'`,
            range: applyFn.range,
            severity: 'error',
        });
        return;
    }
    const builtin = (0, functions_1.getBuiltinFunction)(fnName);
    if (builtin && builtin.arity !== -1 && builtin.arity !== arity) {
        errors.push({
            code: 'E009',
            message: `Built-in function '${fnName}' expects ${builtin.arity} arguments, got ${arity}`,
            range: applyFn.range,
            severity: 'error',
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
            });
        }
    }
    // Check for division by zero
    if ((fnName === 'fn:div' || fnName === 'fn:float:div') && applyFn.args.length >= 2) {
        const divisor = applyFn.args[1];
        if (divisor && divisor.type === 'Constant') {
            const constant = divisor;
            if (constant.numValue === 0 || constant.floatValue === 0) {
                errors.push({
                    code: 'E035',
                    message: `Division by zero: divisor is constant 0`,
                    range: divisor.range,
                    severity: 'error',
                });
            }
        }
    }
    // Check that reducer functions are only used in appropriate contexts
    // (This is a warning since context detection is imperfect here)
    if (REDUCER_FUNCTIONS.has(fnName)) {
        // We'll mark this but the actual context check happens in transform validation
        // Here we just note that reducers require aggregation context
    }
    // All variables in function arguments must be bound
    for (const arg of applyFn.args) {
        const argVars = new Set();
        collectTermVariables(arg, argVars);
        for (const v of argVars) {
            if (v !== '_' && !boundVars.has(v)) {
                errors.push({
                    code: 'E010',
                    message: `Variable '${v}' in function '${fnName}' must be bound`,
                    range: arg.range,
                    severity: 'error',
                });
            }
        }
    }
    // Recurse into nested function applications and validate constants
    for (const arg of applyFn.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg, boundVars, errors);
        }
        if (arg.type === 'Constant') {
            validateNameConstant(arg, errors);
        }
    }
}
/**
 * Validate a transform.
 */
function validateTransform(transform, boundVars, errors, bodyVars) {
    // E043: Check transform doesn't redefine body variables
    if (bodyVars) {
        let checkTransform = transform;
        while (checkTransform) {
            for (const stmt of checkTransform.statements) {
                if (stmt.variable && bodyVars.has(stmt.variable.symbol)) {
                    errors.push({
                        code: 'E043',
                        message: `Transform redefines variable '${stmt.variable.symbol}' from rule body`,
                        range: stmt.variable.range,
                        severity: 'error',
                    });
                }
            }
            checkTransform = checkTransform.next;
        }
    }
    let current = transform;
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
                    const groupByVars = new Set();
                    for (const arg of stmt.fn.args) {
                        if (arg.type !== 'Variable') {
                            errors.push({
                                code: 'E036',
                                message: `Arguments to fn:group_by must be variables, got ${arg.type}`,
                                range: arg.range,
                                severity: 'error',
                            });
                        }
                        else {
                            const v = arg.symbol;
                            if (groupByVars.has(v)) {
                                errors.push({
                                    code: 'E037',
                                    message: `Duplicate variable '${v}' in fn:group_by - all arguments must be distinct`,
                                    range: arg.range,
                                    severity: 'error',
                                });
                            }
                            groupByVars.add(v);
                        }
                    }
                }
                else if (!hasGroupBy) {
                    errors.push({
                        code: 'E011',
                        message: `Transform must start with 'do fn:group_by(...)', found '${fnName}'`,
                        range: stmt.fn.range,
                        severity: 'error',
                    });
                }
                // Check that group_by variables are bound
                for (const arg of stmt.fn.args) {
                    const argVars = new Set();
                    collectTermVariables(arg, argVars);
                    for (const v of argVars) {
                        if (v !== '_' && !boundVars.has(v)) {
                            errors.push({
                                code: 'E012',
                                message: `Variable '${v}' in group_by must be bound in the body`,
                                range: arg.range,
                                severity: 'error',
                            });
                        }
                    }
                }
            }
            else {
                // let-statement - binds a variable
                if (stmt.variable.symbol !== '_') {
                    boundVars.add(stmt.variable.symbol);
                }
                // After group_by, non-reducer functions are allowed if their variables
                // are from the group_by key or defined by earlier transform statements.
                // This matches upstream behavior from commit a77833b.
                const fnName = stmt.fn.function.symbol;
                if (hasGroupBy && !(0, functions_1.isReducerFunction)(fnName) && fnName !== 'fn:group_by') {
                    // Check that all variables used in this function are either
                    // in the group_by key or defined by previous let-statements in the transform.
                    const groupByVars = new Set();
                    // Find group_by vars from first statement
                    for (const s of current.statements) {
                        if (s.variable === null && s.fn.function.symbol === 'fn:group_by') {
                            for (const arg of s.fn.args) {
                                if (arg.type === 'Variable') {
                                    groupByVars.add(arg.symbol);
                                }
                            }
                            break;
                        }
                    }
                    // Collect transform-defined variables (before this statement)
                    const transformDefs = new Set();
                    for (const s of current.statements) {
                        if (s === stmt)
                            break;
                        if (s.variable && s.variable.symbol !== '_') {
                            transformDefs.add(s.variable.symbol);
                        }
                    }
                    // Check all variables used in this function application
                    const usedVars = new Set();
                    collectTermVariables(stmt.fn, usedVars);
                    for (const v of usedVars) {
                        if (!groupByVars.has(v) && !transformDefs.has(v)) {
                            errors.push({
                                code: 'E047',
                                message: `Variable '${v}' in function '${fnName}' must be either part of group_by or defined in the transform`,
                                range: stmt.fn.range,
                                severity: 'error',
                            });
                        }
                    }
                }
                if (hasGroupBy && !fnName.startsWith('fn:')) {
                    errors.push({
                        code: 'E013',
                        message: `Function '${fnName}' in let-statement must be a built-in function (fn:...)`,
                        range: stmt.fn.range,
                        severity: 'warning',
                    });
                }
                // Validate the function application
                validateApplyFn(stmt.fn, boundVars, errors);
            }
        }
        current = current.next;
    }
}
/**
 * Handle equality for variable binding.
 * Now uses union-find for X = Y where both are unbound variables (Feature E).
 */
function handleEquality(left, right, boundVars, errors, range, uf) {
    // If left is a single variable and right is ground or bound, bind left
    if (left.type === 'Variable' && left.symbol !== '_') {
        const v = left.symbol;
        if (right.type === 'Constant' || isGroundOrBound(right, boundVars)) {
            boundVars.add(v);
        }
    }
    // If right is a single variable and left is ground or bound, bind right
    if (right.type === 'Variable' && right.symbol !== '_') {
        const v = right.symbol;
        if (left.type === 'Constant' || isGroundOrBound(left, boundVars)) {
            boundVars.add(v);
        }
    }
    // If left is a function application, all its variables must be bound
    if (left.type === 'ApplyFn') {
        const leftVars = new Set();
        collectTermVariables(left, leftVars);
        for (const v of leftVars) {
            if (v !== '_' && !boundVars.has(v)) {
                errors.push({
                    code: 'E014',
                    message: `Variable '${v}' in function application must be bound`,
                    range: range,
                    severity: 'error',
                });
            }
        }
        // Validate the function application itself (E008, E009, E018, E020, E027, E035)
        validateApplyFn(left, boundVars, errors);
        // The right side variable becomes bound
        if (right.type === 'Variable' && right.symbol !== '_') {
            boundVars.add(right.symbol);
        }
    }
    // Same for right side
    if (right.type === 'ApplyFn') {
        const rightVars = new Set();
        collectTermVariables(right, rightVars);
        for (const v of rightVars) {
            if (v !== '_' && !boundVars.has(v)) {
                errors.push({
                    code: 'E014',
                    message: `Variable '${v}' in function application must be bound`,
                    range: range,
                    severity: 'error',
                });
            }
        }
        // Validate the function application itself (E008, E009, E018, E020, E027, E035)
        validateApplyFn(right, boundVars, errors);
        // The left side variable becomes bound
        if (left.type === 'Variable' && left.symbol !== '_') {
            boundVars.add(left.symbol);
        }
    }
    // Validate name constants in equality contexts (E032)
    if (left.type === 'Constant') {
        validateNameConstant(left, errors);
    }
    if (right.type === 'Constant') {
        validateNameConstant(right, errors);
    }
    // Feature E: If both sides are variables and neither is bound yet,
    // use union-find to record their equivalence (upstream validation.go:514-522)
    if (uf && left.type === 'Variable' && right.type === 'Variable') {
        const leftVar = left;
        const rightVar = right;
        if (leftVar.symbol !== '_' && rightVar.symbol !== '_') {
            uf.unify(leftVar, rightVar);
        }
    }
}
/**
 * Check if a term is ground or all its variables are bound.
 */
function isGroundOrBound(term, boundVars) {
    if (term.type === 'Constant') {
        return true;
    }
    if (term.type === 'Variable') {
        const v = term.symbol;
        return v === '_' || boundVars.has(v);
    }
    if (term.type === 'ApplyFn') {
        const applyFn = term;
        return applyFn.args.every(arg => isGroundOrBound(arg, boundVars));
    }
    return false;
}
/**
 * Validate name constant format.
 * Name constants must start with '/' and have no empty parts.
 */
function validateNameConstant(constant, errors) {
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
function validateStringEscapes(str, range, errors) {
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
            const next = str[i + 1];
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
            }
            else if (next === 'u') {
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
                while (j < str.length && str[j] !== '}')
                    j++;
                if (j >= str.length) {
                    errors.push({
                        code: 'E038',
                        message: `Invalid unicode escape: missing closing brace`,
                        range: range,
                        severity: 'error',
                    });
                }
                i = j + 1;
            }
            else if (VALID_ESCAPES.has(next)) {
                i += 2;
            }
            else {
                errors.push({
                    code: 'E038',
                    message: `Invalid escape sequence: \\${next}`,
                    range: range,
                    severity: 'error',
                });
                i += 2;
            }
        }
        else {
            i++;
        }
    }
}
/**
 * Collect variables from an atom.
 */
function collectAtomVariables(atom, vars) {
    for (const arg of atom.args) {
        collectTermVariables(arg, vars);
    }
}
/**
 * Collect variables from a term.
 */
function collectTermVariables(term, vars) {
    switch (term.type) {
        case 'Variable': {
            const v = term;
            if (v.symbol !== '_') {
                vars.add(v.symbol);
            }
            break;
        }
        case 'ApplyFn': {
            const applyFn = term;
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
function collectPremiseVariables(premise, vars) {
    switch (premise.type) {
        case 'Atom': {
            const atom = premise;
            collectAtomVariables(atom, vars);
            break;
        }
        case 'NegAtom': {
            const negAtom = premise;
            collectAtomVariables(negAtom.atom, vars);
            break;
        }
        case 'Eq': {
            const eq = premise;
            collectTermVariables(eq.left, vars);
            collectTermVariables(eq.right, vars);
            break;
        }
        case 'Ineq': {
            const ineq = premise;
            collectTermVariables(ineq.left, vars);
            collectTermVariables(ineq.right, vars);
            break;
        }
        default:
            // Handle TemporalLiteral
            if ((0, ast_1.isTemporalLiteral)(premise)) {
                const temporal = premise;
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
            if ((0, ast_1.isTemporalAtom)(premise)) {
                const ta = premise;
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
function validateArityConsistency(unit, errors) {
    // Collect all arities used for each predicate name in clauses
    const predicateArities = new Map();
    for (const clause of unit.clauses) {
        const name = clause.head.predicate.symbol;
        const arity = clause.head.predicate.arity;
        if (!predicateArities.has(name)) {
            predicateArities.set(name, new Set());
        }
        predicateArities.get(name).add(arity);
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
//# sourceMappingURL=validation.js.map