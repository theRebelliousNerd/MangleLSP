/**
 * Union-Find data structure for variable unification.
 *
 * Ported from upstream Go implementation (unionfind/unionfind.go).
 * Uses path compression (grandparent-pointer halving) and biased union
 * (constants become canonical representatives).
 */
import { BaseTerm, Variable } from '../parser/ast';
/**
 * Union-Find data structure for fast unification of variables.
 *
 * Upstream Go equivalent: unionfind.UnionFind
 */
export declare class UnionFind {
    private parent;
    private terms;
    /**
     * Create a new empty UnionFind.
     */
    static create(): UnionFind;
    /**
     * Create a copy of this UnionFind.
     */
    copy(): UnionFind;
    /**
     * Find the representative element from the set of s.
     * Uses path compression (grandparent-pointer halving).
     *
     * Upstream Go equivalent: unionfind.UnionFind.find()
     */
    private find;
    /**
     * Adds an edge, making one root point to the other.
     * Constants are preferred as roots (biased union).
     *
     * Upstream Go equivalent: unionfind.UnionFind.union()
     */
    private union;
    /**
     * Returns true if variable v can be unified with term t.
     * Updates the union-find sets.
     *
     * Upstream Go equivalent: unionfind.UnionFind.unify()
     */
    unify(v: Variable, t: BaseTerm): boolean;
    /**
     * Get the representative for a variable.
     * Returns the variable itself if not in the union-find.
     *
     * Upstream Go equivalent: unionfind.UnionFind.Get()
     */
    get(v: Variable): BaseTerm;
    /**
     * Check if a variable is bound (has a representative that is either
     * a constant or a bound variable).
     */
    isBound(v: Variable, boundVars: Set<string>): boolean;
}
/**
 * Initialize a UnionFind with given variable-to-term bindings.
 *
 * Upstream Go equivalent: unionfind.InitVars()
 */
export declare function initVars(vars: Variable[], ts: BaseTerm[]): UnionFind;
/**
 * Unify two same-length lists of terms.
 *
 * Upstream Go equivalent: unionfind.UnifyTerms()
 */
export declare function unifyTerms(xs: BaseTerm[], ys: BaseTerm[]): UnionFind;
/**
 * Unify two same-length lists of terms, extending a base UnionFind.
 *
 * Upstream Go equivalent: unionfind.UnifyTermsExtend()
 */
export declare function unifyTermsExtend(xs: BaseTerm[], ys: BaseTerm[], base: UnionFind): UnionFind;
//# sourceMappingURL=unionfind.d.ts.map