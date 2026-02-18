/**
 * Union-Find data structure for variable unification.
 *
 * Ported from upstream Go implementation (unionfind/unionfind.go).
 * Uses path compression (grandparent-pointer halving) and biased union
 * (constants become canonical representatives).
 */

import { BaseTerm, Variable, Constant } from '../parser/ast';

/**
 * Key function for BaseTerm identity in the union-find map.
 * Returns a unique string key for each BaseTerm.
 */
function termKey(t: BaseTerm): string {
    switch (t.type) {
        case 'Variable':
            return `var:${(t as Variable).symbol}`;
        case 'Constant': {
            const c = t as Constant;
            if (c.constantType === 'number') return `num:${c.numValue}`;
            if (c.constantType === 'float64') return `float:${c.floatValue}`;
            if (c.constantType === 'string') return `str:${c.symbol}`;
            if (c.constantType === 'bytes') return `bytes:${c.symbol}`;
            return `name:${c.symbol}`;
        }
        case 'ApplyFn':
            // For ApplyFn, use a stringified representation
            return `fn:${JSON.stringify(t)}`;
        default:
            return `unknown:${JSON.stringify(t)}`;
    }
}

/**
 * Check if two BaseTerms are equal.
 */
function termsEqual(a: BaseTerm, b: BaseTerm): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'Variable' && b.type === 'Variable') {
        return (a as Variable).symbol === (b as Variable).symbol;
    }
    if (a.type === 'Constant' && b.type === 'Constant') {
        const ac = a as Constant;
        const bc = b as Constant;
        if (ac.constantType !== bc.constantType) return false;
        if (ac.constantType === 'number') return ac.numValue === bc.numValue;
        if (ac.constantType === 'float64') return ac.floatValue === bc.floatValue;
        return ac.symbol === bc.symbol;
    }
    return termKey(a) === termKey(b);
}

/**
 * Union-Find data structure for fast unification of variables.
 *
 * Upstream Go equivalent: unionfind.UnionFind
 */
export class UnionFind {
    private parent: Map<string, BaseTerm> = new Map();
    private terms: Map<string, BaseTerm> = new Map(); // key -> original term

    /**
     * Create a new empty UnionFind.
     */
    static create(): UnionFind {
        return new UnionFind();
    }

    /**
     * Create a copy of this UnionFind.
     */
    copy(): UnionFind {
        const uf = new UnionFind();
        for (const [k, v] of this.parent) {
            uf.parent.set(k, v);
        }
        for (const [k, v] of this.terms) {
            uf.terms.set(k, v);
        }
        return uf;
    }

    /**
     * Find the representative element from the set of s.
     * Uses path compression (grandparent-pointer halving).
     *
     * Upstream Go equivalent: unionfind.UnionFind.find()
     */
    private find(s: BaseTerm): BaseTerm | null {
        const sKey = termKey(s);
        let child = s;
        let childKey = sKey;
        const parentTerm = this.parent.get(childKey);
        if (parentTerm === undefined) {
            return null;
        }
        let parent = parentTerm;
        let parentKey = termKey(parent);
        while (childKey !== parentKey) {
            const grandparent = this.parent.get(parentKey);
            if (grandparent === undefined) break;
            // Path compression: point child to grandparent
            this.parent.set(childKey, grandparent);
            child = grandparent;
            childKey = termKey(child);
            parent = this.parent.get(childKey)!;
            parentKey = termKey(parent);
        }
        return parent;
    }

    /**
     * Adds an edge, making one root point to the other.
     * Constants are preferred as roots (biased union).
     *
     * Upstream Go equivalent: unionfind.UnionFind.union()
     */
    private union(s: BaseTerm, t: BaseTerm): void {
        const sroot = this.find(s);
        const troot = this.find(t);
        if (!sroot || !troot) return;
        if (sroot.type === 'Constant') {
            this.parent.set(termKey(troot), sroot);
        } else {
            this.parent.set(termKey(sroot), troot);
        }
    }

    /**
     * Returns true if variable v can be unified with term t.
     * Updates the union-find sets.
     *
     * Upstream Go equivalent: unionfind.UnionFind.unify()
     */
    unify(v: Variable, t: BaseTerm): boolean {
        let vroot = this.find(v);
        if (vroot === null) {
            vroot = v;
        }
        let troot = this.find(t);
        if (troot === null) {
            troot = t;
        }
        if (termsEqual(vroot, troot)) {
            return true;
        }
        const vconst = vroot.type === 'Constant';
        const tconst = troot.type === 'Constant';
        if (vconst && tconst) {
            return false;
        }
        const vKey = termKey(v);
        const tKey = termKey(t);
        this.parent.set(vKey, vroot);
        this.terms.set(vKey, v);
        this.parent.set(tKey, troot);
        this.terms.set(tKey, t);
        this.union(vroot, troot);
        return true;
    }

    /**
     * Get the representative for a variable.
     * Returns the variable itself if not in the union-find.
     *
     * Upstream Go equivalent: unionfind.UnionFind.Get()
     */
    get(v: Variable): BaseTerm {
        const res = this.find(v);
        if (res !== null) {
            return res;
        }
        return v;
    }

    /**
     * Check if a variable is bound (has a representative that is either
     * a constant or a bound variable).
     */
    isBound(v: Variable, boundVars: Set<string>): boolean {
        const rep = this.get(v);
        if (rep.type === 'Constant') {
            return true;
        }
        if (rep.type === 'Variable') {
            const repVar = rep as Variable;
            if (repVar.symbol !== v.symbol && boundVars.has(repVar.symbol)) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Initialize a UnionFind with given variable-to-term bindings.
 *
 * Upstream Go equivalent: unionfind.InitVars()
 */
export function initVars(vars: Variable[], ts: BaseTerm[]): UnionFind {
    if (vars.length !== ts.length) {
        throw new Error('not of equal size');
    }
    const uf = UnionFind.create();
    for (let i = 0; i < vars.length; i++) {
        const v = vars[i];
        const t = ts[i];
        const tKey = termKey(t);
        const vKey = termKey(v);
        // Access private parent through the unify mechanism
        uf.unify(v, t);
    }
    return uf;
}

/**
 * Unify two same-length lists of terms.
 *
 * Upstream Go equivalent: unionfind.UnifyTerms()
 */
export function unifyTerms(xs: BaseTerm[], ys: BaseTerm[]): UnionFind {
    if (xs.length !== ys.length) {
        throw new Error('not of equal size');
    }
    const uf = UnionFind.create();
    for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        const y = ys[i];
        // Skip wildcards
        if (x.type === 'Variable' && (x as Variable).symbol === '_') continue;
        if (y.type === 'Variable' && (y as Variable).symbol === '_') continue;

        if (x.type === 'Variable') {
            if (!uf.unify(x as Variable, y)) {
                throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
            }
        } else if (y.type === 'Variable') {
            if (!uf.unify(y as Variable, x)) {
                throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
            }
        } else if (!termsEqual(x, y)) {
            throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
        }
    }
    return uf;
}

/**
 * Unify two same-length lists of terms, extending a base UnionFind.
 *
 * Upstream Go equivalent: unionfind.UnifyTermsExtend()
 */
export function unifyTermsExtend(
    xs: BaseTerm[],
    ys: BaseTerm[],
    base: UnionFind
): UnionFind {
    if (xs.length !== ys.length) {
        throw new Error('not of equal size');
    }
    const uf = base.copy();
    for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        const y = ys[i];
        // Skip wildcards
        if (x.type === 'Variable' && (x as Variable).symbol === '_') continue;
        if (y.type === 'Variable' && (y as Variable).symbol === '_') continue;

        if (x.type === 'Variable') {
            if (!uf.unify(x as Variable, y)) {
                throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
            }
        } else if (y.type === 'Variable') {
            if (!uf.unify(y as Variable, x)) {
                throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
            }
        } else if (!termsEqual(x, y)) {
            throw new Error(`cannot unify ${termKey(x)} ${termKey(y)}`);
        }
    }
    return uf;
}
