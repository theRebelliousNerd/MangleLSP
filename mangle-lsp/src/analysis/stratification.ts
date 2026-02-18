/**
 * Stratification analysis for Mangle.
 *
 * Detects negation cycles that would make the program unstratifiable.
 * Ported from upstream Go implementation (analysis/stratification.go).
 */

import {
    SourceUnit,
    SourceRange,
    Clause,
    Atom,
    NegAtom,
    Term,
    PredicateSym,
    Variable,
    ApplyFn,
    Transform,
    Decl,
    TemporalLiteral,
    isComparisonAtom,
    isTemporalLiteral,
    DESCRIPTORS,
} from '../parser/ast';

/**
 * Stratification error.
 */
export interface StratificationError {
    code: string;
    message: string;
    range: SourceRange;
    severity: 'error' | 'warning';
    /** Predicates involved in the cycle */
    cycle: string[];
}

/**
 * Edge in the dependency graph.
 */
interface DependencyEdge {
    from: string;
    to: string;
    isNegative: boolean;
    range: SourceRange;
}

/**
 * Check stratification of a source unit.
 * Returns errors for any negation cycles detected.
 */
export function checkStratification(unit: SourceUnit): StratificationError[] {
    const errors: StratificationError[] = [];

    // Build dependency graph
    const edges = buildDependencyGraph(unit);

    // Find strongly connected components (SCCs)
    const sccs = findSCCs(edges);

    // Check each SCC for negative edges
    for (const scc of sccs) {
        const firstNode = scc[0];
        if (!firstNode) continue;
        if (scc.length > 1 || hasSelfLoop(firstNode, edges)) {
            // Check if this SCC has any negative edges
            const negativeEdge = findNegativeEdgeInSCC(scc, edges);
            if (negativeEdge) {
                errors.push({
                    code: 'E015',
                    message: `Stratification violation: negation cycle detected involving predicates: ${scc.join(' -> ')}`,
                    range: negativeEdge.range,
                    severity: 'error',
                    cycle: scc,
                });
            }
        }
    }

    return errors;
}

/**
 * Build dependency graph from clauses.
 */
function buildDependencyGraph(unit: SourceUnit): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const clause of unit.clauses) {
        const headPred = predicateKey(clause.head.predicate);

        if (clause.premises) {
            for (const premise of clause.premises) {
                addEdgesFromPremise(headPred, premise, clause.head.range, edges, clause);
            }
        }
    }

    return edges;
}

/**
 * Check if a transform is a let-transform (as opposed to a do-transform).
 * A let-transform has at least one statement with a variable assignment.
 * A do-transform has all statements with variable === null.
 *
 * Per upstream Go (stratification.go lines 54-61), recursion through a
 * do-transform is not permitted and should be treated as a negation.
 */
function isLetTransform(transform: Transform | null): boolean {
    if (!transform) {
        return true; // No transform is treated like let-transform (positive edge)
    }
    // Check if first statement has a variable (let) or not (do)
    // A let-transform has variable !== null on the first statement
    const firstStmt = transform.statements[0];
    return firstStmt?.variable !== null;
}

/**
 * Add dependency edges from a premise.
 *
 * Per upstream Go (stratification.go lines 54-61):
 * - If the clause has no transform, or has a let-transform, atoms create positive edges
 * - If the clause has a do-transform, atoms create negative edges (recursion not permitted)
 */
function addEdgesFromPremise(
    headPred: string,
    premise: Term,
    range: SourceRange,
    edges: DependencyEdge[],
    clause: Clause
): void {
    switch (premise.type) {
        case 'Atom': {
            const atom = premise as Atom;
            const bodyPred = predicateKey(atom.predicate);
            // Skip built-in predicates
            if (!atom.predicate.symbol.startsWith(':')) {
                // Check if this is a do-transform clause
                // Recursion through a do-transform is not permitted
                // We treat this as if it was a negation (negative edge)
                const isNegative = !isLetTransform(clause.transform);
                edges.push({
                    from: headPred,
                    to: bodyPred,
                    isNegative,
                    range: atom.range,
                });
            }
            break;
        }
        case 'NegAtom': {
            const negAtom = premise as NegAtom;
            const bodyPred = predicateKey(negAtom.atom.predicate);
            // Skip built-in predicates
            if (!negAtom.atom.predicate.symbol.startsWith(':')) {
                edges.push({
                    from: headPred,
                    to: bodyPred,
                    isNegative: true,
                    range: negAtom.range,
                });
            }
            break;
        }
        default: {
            // Handle TemporalLiteral premises
            if (isTemporalLiteral(premise)) {
                const temporal = premise as TemporalLiteral;
                // Extract the inner literal and recurse
                addEdgesFromPremise(headPred, temporal.literal, range, edges, clause);
            }
            break;
        }
    }
}

/**
 * Get unique key for a predicate.
 */
function predicateKey(pred: PredicateSym): string {
    return `${pred.symbol}/${pred.arity}`;
}

/**
 * Find strongly connected components using Tarjan's algorithm.
 */
function findSCCs(edges: DependencyEdge[]): string[][] {
    // Build adjacency list
    const adj = new Map<string, string[]>();
    const allNodes = new Set<string>();

    for (const edge of edges) {
        allNodes.add(edge.from);
        allNodes.add(edge.to);

        const neighbors = adj.get(edge.from) || [];
        neighbors.push(edge.to);
        adj.set(edge.from, neighbors);
    }

    // Tarjan's algorithm
    let index = 0;
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];

    function strongConnect(node: string): void {
        indices.set(node, index);
        lowlinks.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);

        const neighbors = adj.get(node) || [];
        for (const neighbor of neighbors) {
            if (!indices.has(neighbor)) {
                strongConnect(neighbor);
                lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(neighbor)!));
            } else if (onStack.has(neighbor)) {
                lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(neighbor)!));
            }
        }

        // If node is a root node, pop the SCC
        if (lowlinks.get(node) === indices.get(node)) {
            const scc: string[] = [];
            let w: string;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                scc.push(w);
            } while (w !== node);
            sccs.push(scc);
        }
    }

    for (const node of allNodes) {
        if (!indices.has(node)) {
            strongConnect(node);
        }
    }

    return sccs;
}

/**
 * Check if a node has a self-loop.
 */
function hasSelfLoop(node: string, edges: DependencyEdge[]): boolean {
    return edges.some(e => e.from === node && e.to === node);
}

/**
 * Find a negative edge within an SCC.
 */
function findNegativeEdgeInSCC(
    scc: string[],
    edges: DependencyEdge[]
): DependencyEdge | null {
    const sccSet = new Set(scc);

    for (const edge of edges) {
        if (edge.isNegative && sccSet.has(edge.from) && sccSet.has(edge.to)) {
            return edge;
        }
    }

    return null;
}

/**
 * Check for potentially unbounded recursion.
 * Returns warnings for recursive rules that may not terminate.
 */
export function checkUnboundedRecursion(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    // Build map of predicate definitions
    const predicateClauses = new Map<string, Clause[]>();
    for (const clause of unit.clauses) {
        const key = predicateKey(clause.head.predicate);
        const clauses = predicateClauses.get(key) || [];
        clauses.push(clause);
        predicateClauses.set(key, clauses);
    }

    // Check each predicate for unbounded recursion patterns
    for (const [predKey, clauses] of predicateClauses) {
        // Check if any clause is recursive
        const recursiveClauses = clauses.filter(c => isRecursive(c, predKey));

        if (recursiveClauses.length > 0) {
            const firstRecursive = recursiveClauses[0];
            if (!firstRecursive) continue;

            // Check if there's a base case (non-recursive clause)
            const hasBaseCase = clauses.some(c => !isRecursive(c, predKey));

            if (!hasBaseCase) {
                warnings.push({
                    code: 'E016',
                    message: `Predicate '${predKey}' has recursive rules but no base case - may not terminate`,
                    range: firstRecursive.head.range,
                    severity: 'warning',
                    cycle: [predKey],
                });
            }

            // Check for value-generating recursion (counter pattern)
            for (const clause of recursiveClauses) {
                if (hasUnboundedGeneration(clause, predKey)) {
                    warnings.push({
                        code: 'E017',
                        message: `Recursive rule may generate unbounded values - ensure termination condition exists`,
                        range: clause.head.range,
                        severity: 'warning',
                        cycle: [predKey],
                    });
                }
            }
        }
    }

    return warnings;
}

/**
 * Check if a clause is recursive (references its own predicate in body).
 */
function isRecursive(clause: Clause, predKey: string): boolean {
    if (!clause.premises) return false;

    for (const premise of clause.premises) {
        if (premise.type === 'Atom') {
            const atom = premise as Atom;
            if (predicateKey(atom.predicate) === predKey) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if a recursive clause has unbounded value generation.
 * Pattern: recursive call + arithmetic that increases a value without bound.
 */
function hasUnboundedGeneration(clause: Clause, predKey: string): boolean {
    if (!clause.premises) return false;

    // Look for pattern: pred(..., N) :- pred(..., M), N = fn:plus(M, 1)
    // where the incrementing variable appears in head but is computed in body

    let hasArithmeticIncrement = false;

    for (const premise of clause.premises) {
        if (premise.type === 'Eq') {
            const eq = premise as { left: Term; right: Term };
            // Check if right side is fn:plus or similar
            if (eq.right.type === 'ApplyFn') {
                const fn = eq.right as { function: { symbol: string } };
                if (fn.function.symbol === 'fn:plus' || fn.function.symbol === 'fn:minus') {
                    hasArithmeticIncrement = true;
                }
            }
        }
    }

    // If we have arithmetic increment and no clear termination condition, warn
    // This is a heuristic - not perfect but catches common mistakes
    if (hasArithmeticIncrement) {
        // Check if there's a comparison that might limit recursion
        // Comparisons are now represented as Atoms with :lt/:le/:gt/:ge predicates
        const hasComparison = clause.premises.some(p => isComparisonAtom(p));

        if (!hasComparison) {
            return true;
        }
    }

    return false;
}

/**
 * Check for potential Cartesian explosion patterns.
 * Returns warnings when multiple body predicates don't share variables.
 */
export function checkCartesianExplosion(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    for (const clause of unit.clauses) {
        if (!clause.premises || clause.premises.length < 2) {
            continue;
        }

        // Collect atoms (predicates) from premises
        const atoms: { atom: Atom; vars: Set<string> }[] = [];

        for (const premise of clause.premises) {
            if (premise.type === 'Atom') {
                const atom = premise as Atom;
                // Skip built-in predicates
                if (atom.predicate.symbol.startsWith(':')) {
                    continue;
                }
                const vars = new Set<string>();
                for (const arg of atom.args) {
                    collectVarsFromTerm(arg, vars);
                }
                atoms.push({ atom, vars });
            }
        }

        // Check consecutive atoms for shared variables
        for (let i = 0; i < atoms.length - 1; i++) {
            const current = atoms[i];
            const next = atoms[i + 1];

            if (!current || !next) continue;

            // Check if there are any shared variables
            let hasSharedVar = false;
            for (const v of current.vars) {
                if (v !== '_' && next.vars.has(v)) {
                    hasSharedVar = true;
                    break;
                }
            }

            if (!hasSharedVar && current.vars.size > 0 && next.vars.size > 0) {
                warnings.push({
                    code: 'E019',
                    message: `Potential Cartesian explosion: predicates '${current.atom.predicate.symbol}' and '${next.atom.predicate.symbol}' have no shared variables. Consider reordering body atoms to join on shared variables first.`,
                    range: next.atom.range,
                    severity: 'warning',
                    cycle: [current.atom.predicate.symbol, next.atom.predicate.symbol],
                });
            }
        }
    }

    return warnings;
}

/**
 * Helper to collect variables from a term.
 */
function collectVarsFromTerm(term: Term, vars: Set<string>): void {
    switch (term.type) {
        case 'Variable': {
            const v = term as Variable;
            vars.add(v.symbol);
            break;
        }
        case 'ApplyFn': {
            const fn = term as ApplyFn;
            for (const arg of fn.args) {
                collectVarsFromTerm(arg, vars);
            }
            break;
        }
    }
}

/**
 * Check for late filtering anti-pattern.
 * Detects when comparisons appear after multiple predicates that don't share variables.
 */
export function checkLateFiltering(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    for (const clause of unit.clauses) {
        if (!clause.premises || clause.premises.length < 3) {
            continue;
        }

        // Track predicates before we see a comparison
        let predicateCount = 0;
        let allVarsSoFar = new Set<string>();

        for (const premise of clause.premises) {
            // Check if this is a comparison (Ineq or comparison atom :lt/:le/:gt/:ge)
            if (premise.type === 'Ineq') {
                // If we have 2+ predicates before this comparison, warn
                if (predicateCount >= 2) {
                    const cmp = premise as { left: Term; right: Term; range: SourceRange };
                    warnings.push({
                        code: 'E021',
                        message: `Late filtering: comparison appears after ${predicateCount} predicates. Consider moving filters earlier to reduce intermediate result size.`,
                        range: cmp.range,
                        severity: 'warning',
                        cycle: [],
                    });
                }
            } else if (premise.type === 'Atom') {
                const atom = premise as Atom;
                // Check if this is a comparison atom (:lt, :le, :gt, :ge)
                const predSymbol = atom.predicate.symbol;
                if (predSymbol === ':lt' || predSymbol === ':le' || predSymbol === ':gt' || predSymbol === ':ge') {
                    // If we have 2+ predicates before this comparison, warn
                    if (predicateCount >= 2) {
                        warnings.push({
                            code: 'E021',
                            message: `Late filtering: comparison appears after ${predicateCount} predicates. Consider moving filters earlier to reduce intermediate result size.`,
                            range: atom.range,
                            severity: 'warning',
                            cycle: [],
                        });
                    }
                } else if (!predSymbol.startsWith(':')) {
                    predicateCount++;
                }
            }
        }
    }

    return warnings;
}

/**
 * Check for late negation anti-pattern.
 * Detects when negation appears after multiple predicates when it could filter earlier.
 */
export function checkLateNegation(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    for (const clause of unit.clauses) {
        if (!clause.premises || clause.premises.length < 3) {
            continue;
        }

        let predicateCount = 0;

        for (const premise of clause.premises) {
            if (premise.type === 'NegAtom') {
                // If negation appears after 2+ predicates, check if it could be moved earlier
                if (predicateCount >= 2) {
                    const negAtom = premise as NegAtom;
                    const negVars = new Set<string>();
                    for (const arg of negAtom.atom.args) {
                        collectVarsFromTerm(arg, negVars);
                    }

                    // Check if negation's variables were bound early
                    // This is a heuristic - if first predicate binds all negation vars, suggest moving earlier
                    const firstPremise = clause.premises[0];
                    if (firstPremise && firstPremise.type === 'Atom') {
                        const firstAtom = firstPremise as Atom;
                        const firstVars = new Set<string>();
                        for (const arg of firstAtom.args) {
                            collectVarsFromTerm(arg, firstVars);
                        }

                        let allBound = true;
                        for (const v of negVars) {
                            if (v !== '_' && !firstVars.has(v)) {
                                allBound = false;
                                break;
                            }
                        }

                        if (allBound) {
                            warnings.push({
                                code: 'E022',
                                message: `Late negation: '!${negAtom.atom.predicate.symbol}' appears after ${predicateCount} predicates but its variables are bound by the first predicate. Consider moving negation earlier to filter sooner.`,
                                range: negAtom.range,
                                severity: 'warning',
                                cycle: [],
                            });
                        }
                    }
                }
            } else if (premise.type === 'Atom') {
                const atom = premise as Atom;
                if (!atom.predicate.symbol.startsWith(':')) {
                    predicateCount++;
                }
            }
        }
    }

    return warnings;
}

/**
 * Check for multiple independent variables anti-pattern.
 * Detects when 3+ predicates have no shared variables, creating huge Cartesian products.
 */
export function checkMultipleIndependentVars(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    for (const clause of unit.clauses) {
        if (!clause.premises || clause.premises.length < 3) {
            continue;
        }

        // Collect all predicates with their variables
        const predicates: { atom: Atom; vars: Set<string> }[] = [];

        for (const premise of clause.premises) {
            if (premise.type === 'Atom') {
                const atom = premise as Atom;
                if (!atom.predicate.symbol.startsWith(':')) {
                    const vars = new Set<string>();
                    for (const arg of atom.args) {
                        collectVarsFromTerm(arg, vars);
                    }
                    predicates.push({ atom, vars });
                }
            }
        }

        if (predicates.length < 3) continue;

        // Check first 3 predicates for independence
        const first = predicates[0];
        const second = predicates[1];
        const third = predicates[2];

        if (!first || !second || !third) continue;

        // Check if first and second share no variables
        let firstSecondShare = false;
        for (const v of first.vars) {
            if (v !== '_' && second.vars.has(v)) {
                firstSecondShare = true;
                break;
            }
        }

        // Check if (first ∪ second) and third share no variables
        let thirdShares = false;
        const firstTwoVars = new Set([...first.vars, ...second.vars]);
        for (const v of third.vars) {
            if (v !== '_' && firstTwoVars.has(v)) {
                thirdShares = true;
                break;
            }
        }

        if (!firstSecondShare && !thirdShares && first.vars.size > 0 && second.vars.size > 0 && third.vars.size > 0) {
            warnings.push({
                code: 'E023',
                message: `Massive Cartesian product: predicates '${first.atom.predicate.symbol}', '${second.atom.predicate.symbol}', and '${third.atom.predicate.symbol}' have no shared variables. This creates N×M×K combinations. Reorder to use joining predicates first.`,
                range: third.atom.range,
                severity: 'warning',  // Performance warning, not a semantic error
                cycle: [first.atom.predicate.symbol, second.atom.predicate.symbol, third.atom.predicate.symbol],
            });
        }
    }

    return warnings;
}

/**
 * Check for problematic temporal recursion patterns.
 * Matches upstream CheckTemporalRecursion from analysis/temporal.go.
 *
 * Returns warnings about:
 * - Self-recursive temporal predicates (interval explosion risk)
 * - Mutual recursion through temporal predicates (non-termination risk)
 * - Future operators in recursive temporal rules (unbounded fact generation)
 */
export function checkTemporalRecursion(unit: SourceUnit): StratificationError[] {
    const warnings: StratificationError[] = [];

    // Build set of temporal predicates (predicates with temporal() descriptor)
    const temporalPreds = new Set<string>();
    for (const decl of unit.decls) {
        if (decl.descr?.some(d => d.predicate.symbol === DESCRIPTORS.TEMPORAL)) {
            temporalPreds.add(predicateKey(decl.declaredAtom.predicate));
        }
    }

    // Also check clauses with headTime annotation
    for (const clause of unit.clauses) {
        if (clause.headTime) {
            temporalPreds.add(predicateKey(clause.head.predicate));
        }
    }

    if (temporalPreds.size === 0) {
        return warnings;
    }

    // Build dependency graph
    const edges = buildDependencyGraph(unit);
    const sccs = findSCCs(edges);

    // Check each SCC for problematic temporal patterns
    for (const scc of sccs) {
        if (scc.length === 1) {
            const pred = scc[0]!;
            // Self-recursive temporal predicate
            if (temporalPreds.has(pred) && hasSelfLoop(pred, edges)) {
                warnings.push({
                    code: 'E048',
                    message: `Self-recursive temporal predicate '${pred}' may cause interval explosion; ensure coalescing or use interval limits`,
                    range: findPredicateRange(unit, pred),
                    severity: 'warning',
                    cycle: [pred],
                });
            }
        } else {
            // Multi-predicate SCC - check for mutual recursion through temporal predicates
            const hasTemporalPred = scc.some(p => temporalPreds.has(p));
            if (hasTemporalPred) {
                const temporalPredInScc = scc.find(p => temporalPreds.has(p)) ?? scc[0]!;
                warnings.push({
                    code: 'E049',
                    message: `Mutual recursion through temporal predicates may cause non-termination; ${scc.length} predicates in cycle: ${scc.join(' -> ')}`,
                    range: findPredicateRange(unit, temporalPredInScc),
                    severity: 'error',
                    cycle: scc,
                });
            }
        }
    }

    // Check for future operators in recursive temporal rules
    for (const clause of unit.clauses) {
        const headKey = predicateKey(clause.head.predicate);
        if (!temporalPreds.has(headKey) || !clause.premises) continue;

        for (const premise of clause.premises) {
            if (isTemporalLiteral(premise)) {
                const temporal = premise as TemporalLiteral;
                if (temporal.operator) {
                    const opType = temporal.operator.operatorType;
                    if (opType === 'diamondPlus' || opType === 'boxPlus') {
                        // Check if this references a predicate in the same SCC
                        let litPredKey: string | null = null;
                        if (temporal.literal.type === 'Atom') {
                            litPredKey = predicateKey(temporal.literal.predicate);
                        } else if (temporal.literal.type === 'NegAtom') {
                            litPredKey = predicateKey(temporal.literal.atom.predicate);
                        }
                        if (litPredKey && isInSameSCC(headKey, litPredKey, sccs)) {
                            warnings.push({
                                code: 'E050',
                                message: `Future operator in recursive temporal rule may cause unbounded fact generation`,
                                range: temporal.range,
                                severity: 'error',
                                cycle: [headKey, litPredKey],
                            });
                        }
                    }
                }
            }
        }
    }

    return warnings;
}

/**
 * Check if two predicates are in the same SCC.
 */
function isInSameSCC(pred1: string, pred2: string, sccs: string[][]): boolean {
    for (const scc of sccs) {
        if (scc.includes(pred1) && scc.includes(pred2)) {
            return true;
        }
    }
    return false;
}

/**
 * Find the source range of the first clause defining a predicate.
 */
function findPredicateRange(unit: SourceUnit, predKey: string): SourceRange {
    for (const clause of unit.clauses) {
        if (predicateKey(clause.head.predicate) === predKey) {
            return clause.head.range;
        }
    }
    // Fallback
    return { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };
}
