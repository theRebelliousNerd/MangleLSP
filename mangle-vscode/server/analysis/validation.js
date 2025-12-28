"use strict";
/**
 * Semantic validation for Mangle.
 *
 * Performs semantic analysis on parsed Mangle source and reports errors.
 * Ported from upstream Go implementation (analysis/validation.go).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const predicates_1 = require("../builtins/predicates");
const functions_1 = require("../builtins/functions");
const symbols_1 = require("./symbols");
/**
 * Validate a source unit and return semantic errors.
 */
function validate(unit) {
    const errors = [];
    const symbolTable = (0, symbols_1.buildSymbolTable)(unit);
    // Validate each clause
    for (const clause of unit.clauses) {
        validateClause(clause, symbolTable, errors);
    }
    return { errors, symbolTable };
}
/**
 * Validate a single clause.
 */
function validateClause(clause, symbolTable, errors) {
    // Collect bound variables
    const boundVars = new Set();
    const headVars = new Set();
    // Collect variables from head
    collectAtomVariables(clause.head, headVars);
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
    // Check that all head variables are bound
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
    // Validate transform if present
    if (clause.transform) {
        validateTransform(clause.transform, boundVars, errors);
    }
}
/**
 * Validate a premise and update bound variables.
 */
function validatePremise(premise, boundVars, symbolTable, errors) {
    // Check the type field to determine how to handle this premise
    switch (premise.type) {
        case 'Atom': {
            const atom = premise;
            validateAtom(atom, boundVars, symbolTable, errors);
            // Positive atoms bind all their variables
            collectAtomVariables(atom, boundVars);
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
            handleEquality(eq.left, eq.right, boundVars, errors, eq.range);
            break;
        }
        case 'Ineq':
        case 'Lt':
        case 'Le':
        case 'Gt':
        case 'Ge': {
            const cmp = premise;
            // Comparisons require both sides to be bound
            const leftVars = new Set();
            const rightVars = new Set();
            collectTermVariables(cmp.left, leftVars);
            collectTermVariables(cmp.right, rightVars);
            for (const v of leftVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: cmp.range,
                        severity: 'error',
                    });
                }
            }
            for (const v of rightVars) {
                if (v !== '_' && !boundVars.has(v)) {
                    errors.push({
                        code: 'E004',
                        message: `Variable '${v}' must be bound before comparison`,
                        range: cmp.range,
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
    }
    // Validate function applications in arguments
    for (const arg of atom.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg, boundVars, errors);
        }
    }
}
/**
 * Validate a function application.
 */
function validateApplyFn(applyFn, boundVars, errors) {
    const fnName = applyFn.function.symbol;
    const arity = applyFn.function.arity;
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
    // Recurse into nested function applications
    for (const arg of applyFn.args) {
        if (arg.type === 'ApplyFn') {
            validateApplyFn(arg, boundVars, errors);
        }
    }
}
/**
 * Validate a transform.
 */
function validateTransform(transform, boundVars, errors) {
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
function handleEquality(left, right, boundVars, errors, range) {
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
        // The left side variable becomes bound
        if (left.type === 'Variable' && left.symbol !== '_') {
            boundVars.add(left.symbol);
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
//# sourceMappingURL=validation.js.map