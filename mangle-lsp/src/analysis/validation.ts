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
    isComparisonAtom,
} from '../parser/ast';
import { isBuiltinPredicate, getBuiltinPredicate } from '../builtins/predicates';
import { isBuiltinFunction, getBuiltinFunction } from '../builtins/functions';
import { SymbolTable, buildSymbolTable } from './symbols';

/**
 * Semantic error with location.
 */
export interface SemanticError {
    /** Error code for categorization */
    code: string;
    /** Error message */
    message: string;
    /** Source location */
    range: SourceRange;
    /** Error severity */
    severity: 'error' | 'warning' | 'info';
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
export function validate(unit: SourceUnit): ValidationResult {
    const errors: SemanticError[] = [];
    const symbolTable = buildSymbolTable(unit);

    // E044: Check for duplicate declarations
    const declaredPredicates = new Map<string, Decl>();
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
        validateClause(clause, symbolTable, errors);
    }

    // E046: Check arity mismatches between declarations and clauses
    validateArityConsistency(unit, errors);

    return { errors, symbolTable };
}

/**
 * Validate a declaration (CheckDecl equivalent from upstream).
 */
function validateDeclaration(
    decl: Decl,
    errors: SemanticError[]
): void {
    const declAtom = decl.declaredAtom;
    const descriptors = decl.descr || [];

    // Check that all declaration arguments are variables
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
    }

    // Check bounds count matches arity (if bounds exist)
    if (decl.bounds && decl.bounds.length > 0) {
        if (decl.bounds.length !== declAtom.args.length) {
            errors.push({
                code: 'E025',
                message: `Declaration has ${declAtom.args.length} arguments but ${decl.bounds.length} bounds`,
                range: declAtom.range,
                severity: 'error',
            });
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
            });
        }
    }

    // Check package name case (if this is a Package declaration)
    if (declAtom.predicate.symbol === 'Package') {
        // Look for name descriptor
        for (const desc of descriptors) {
            if (desc.predicate.symbol === 'name' && desc.args.length > 0) {
                const nameArg = desc.args[0];
                if (nameArg && nameArg.type === 'Constant') {
                    const constant = nameArg as Constant;
                    if (constant.symbol && constant.symbol !== constant.symbol.toLowerCase()) {
                        errors.push({
                            code: 'E031',
                            message: `Package names must be lowercase: '${constant.symbol}'`,
                            range: nameArg.range,
                            severity: 'error',
                        });
                    }
                }
            }
        }
    }
}

/**
 * Validate a single clause.
 */
function validateClause(
    clause: Clause,
    symbolTable: SymbolTable,
    errors: SemanticError[]
): void {
    // Collect bound variables
    const boundVars = new Set<string>();
    const headVars = new Set<string>();

    // Collect variables from head
    collectAtomVariables(clause.head, headVars);

    // Warn about wildcards in head (unusual, usually a mistake)
    for (const arg of clause.head.args) {
        if (arg.type === 'Variable' && (arg as Variable).symbol === '_') {
            errors.push({
                code: 'E039',
                message: `Wildcard '_' in head is unusual - this argument will be unbound in derived facts`,
                range: arg.range,
                severity: 'warning',
            });
        }
    }

    // E045: Check for transform without body
    if (clause.transform && (!clause.premises || clause.premises.length === 0)) {
        errors.push({
            code: 'E045',
            message: `Cannot have a transform without a body`,
            range: clause.transform.range,
            severity: 'error',
        });
    }

    // If this is a fact (no premises), all head variables must be ground
    if (!clause.premises || clause.premises.length === 0) {
        for (const v of headVars) {
            if (v !== '_') {
                errors.push({
                    code: 'E001',
                    message: `Variable '${v}' in fact head must be ground (facts cannot have variables)`,
                    range: clause.head.range,
                    severity: 'error',
                });
            }
        }
        return;
    }

    // Process premises to determine bound variables
    for (const premise of clause.premises) {
        validatePremise(premise, boundVars, symbolTable, errors);
    }

    // Collect body variables for transform redefinition check (E043)
    const bodyVars = new Set<string>();
    for (const premise of clause.premises) {
        collectPremiseVariables(premise, bodyVars);
    }

    // Validate transform if present (this also binds let-variables)
    if (clause.transform) {
        validateTransform(clause.transform, boundVars, errors, bodyVars);
    }

    // Check that all head variables are bound (after processing transform)
    for (const v of headVars) {
        if (v !== '_' && !boundVars.has(v)) {
            errors.push({
                code: 'E002',
                message: `Variable '${v}' in head is not bound in the body (range restriction violation)`,
                range: clause.head.range,
                severity: 'error',
            });
        }
    }
}

/**
 * Validate a premise and update bound variables.
 */
function validatePremise(
    premise: Term,
    boundVars: Set<string>,
    symbolTable: SymbolTable,
    errors: SemanticError[]
): void {
    // Check the type field to determine how to handle this premise
    switch (premise.type) {
        case 'Atom': {
            const atom = premise as Atom;
            // Check if this is a comparison atom (:lt, :le, :gt, :ge)
            if (isComparisonAtom(atom)) {
                // Comparison atoms require all arguments to be bound (they don't bind variables)
                for (const arg of atom.args) {
                    const argVars = new Set<string>();
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
            } else {
                // Regular atom - validate and bind variables
                validateAtom(atom, boundVars, symbolTable, errors);
                // Positive atoms bind all their variables
                collectAtomVariables(atom, boundVars);
            }
            break;
        }
        case 'NegAtom': {
            const negAtom = premise as NegAtom;
            // Negated atoms don't bind variables, but all their variables must be bound
            const negVars = new Set<string>();
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
            const eq = premise as { type: 'Eq'; left: Term; right: Term; range: SourceRange };
            // Equality can bind a variable if the other side is bound
            handleEquality(eq.left, eq.right, boundVars, errors, eq.range);
            break;
        }
        case 'Ineq': {
            // Inequality requires both sides to be bound
            const ineq = premise as { left: Term; right: Term; range: SourceRange };
            const leftVars = new Set<string>();
            const rightVars = new Set<string>();
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
            // Other term types (Variable, Constant, etc.) are not valid premises by themselves
            // This would be a parse error, so we don't report it here
            break;
    }
}

/**
 * Validate an atom.
 */
function validateAtom(
    atom: Atom,
    boundVars: Set<string>,
    symbolTable: SymbolTable,
    errors: SemanticError[]
): void {
    const predName = atom.predicate.symbol;
    const arity = atom.predicate.arity;

    // Check built-in predicate
    if (predName.startsWith(':')) {
        if (!isBuiltinPredicate(predName)) {
            errors.push({
                code: 'E005',
                message: `Unknown built-in predicate '${predName}'`,
                range: atom.range,
                severity: 'error',
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
            });
        }

        // Check mode requirements for built-in predicates
        if (builtin) {
            for (let i = 0; i < builtin.mode.length && i < atom.args.length; i++) {
                const mode = builtin.mode[i];
                const arg = atom.args[i];
                if (mode === 'input' && arg) {
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
        if (!predInfo) {
            // Check if there's a predicate with same name but different arity
            const availableArities = symbolTable.getPredicateArities(predName);
            if (availableArities && availableArities.length > 0 && !availableArities.includes(arity)) {
                errors.push({
                    code: 'E040',
                    message: `Predicate '${predName}' called with ${arity} arguments, but available arities are: ${availableArities.join(', ')}`,
                    range: atom.range,
                    severity: 'error',
                });
            }
            // If no info, we can't check visibility
        } else {
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
            validateApplyFn(arg as ApplyFn, boundVars, errors);
        }
        // Validate name constants
        if (arg.type === 'Constant') {
            validateNameConstant(arg as Constant, errors);
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
    ['fn:Pair', 'fn:pair'],
    ['fn:List', 'fn:list'],
    ['fn:Map', 'fn:map'],
    ['fn:Struct', 'fn:struct'],
]);

/**
 * Commonly hallucinated functions that DO NOT EXIST in Mangle.
 * Maps hallucinated name -> suggestion
 */
const HALLUCINATED_FUNCTIONS: Map<string, string> = new Map([
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

function validateApplyFn(
    applyFn: ApplyFn,
    boundVars: Set<string>,
    errors: SemanticError[]
): void {
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

    if (!isBuiltinFunction(fnName)) {
        errors.push({
            code: 'E008',
            message: `Unknown built-in function '${fnName}'`,
            range: applyFn.range,
            severity: 'error',
        });
        return;
    }

    const builtin = getBuiltinFunction(fnName);
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
    if (fnName === 'fn:div' && applyFn.args.length >= 2) {
        const divisor = applyFn.args[1];
        if (divisor && divisor.type === 'Constant') {
            const constant = divisor as Constant;
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
        const argVars = new Set<string>();
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
            validateApplyFn(arg as ApplyFn, boundVars, errors);
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
    bodyVars?: Set<string>
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
                            });
                        } else {
                            const v = (arg as Variable).symbol;
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
                } else if (!hasGroupBy) {
                    errors.push({
                        code: 'E011',
                        message: `Transform must start with 'do fn:group_by(...)', found '${fnName}'`,
                        range: stmt.fn.range,
                        severity: 'error',
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
                            });
                        }
                    }
                }
            } else {
                // let-statement - binds a variable
                if (stmt.variable.symbol !== '_') {
                    boundVars.add(stmt.variable.symbol);
                }

                // Check that the function is a reducer if in a let-transform after group_by
                const fnName = stmt.fn.function.symbol;
                if (hasGroupBy && !fnName.startsWith('fn:')) {
                    errors.push({
                        code: 'E013',
                        message: `Function '${fnName}' in let-statement must be a reducer function`,
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
 */
function handleEquality(
    left: Term,
    right: Term,
    boundVars: Set<string>,
    errors: SemanticError[],
    range: SourceRange
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
                });
            }
        }
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
                });
            }
        }
        // The left side variable becomes bound
        if (left.type === 'Variable' && (left as Variable).symbol !== '_') {
            boundVars.add((left as Variable).symbol);
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
