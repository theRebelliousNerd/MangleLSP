/**
 * Bounds that upstream v0.7's strict bounds checker can never satisfy.
 *
 * The checker infers the base type of a constant (`/name` for `/high`), and
 * `/name` conforms neither to `fn:Singleton(/high)` nor to a union of
 * singletons. Verified on v0.7.0: every fact and rule writing such a column is
 * rejected under `ErrorForBoundsMismatch`, correct ones included. Tagged
 * unions are exempt: `symbols.expandTaggedUnionForBounds` types their tags as
 * `/name`.
 *
 * `/bool` is a related trap: Decl bounds have no boolean base type, so `/bool`
 * is the name-prefix type of names under `/bool/`, and `/true` is not one.
 */

import { ApplyFn, BaseTerm, Constant } from '../parser/ast';

/** Why a bound can never be satisfied under strict checking, if it cannot. */
export type StrictBoundTrap = 'singleton' | 'bool';

/** The first trap inside a bound, or undefined when the bound is satisfiable. */
export function strictBoundTrap(term: BaseTerm): StrictBoundTrap | undefined {
    if (term.type === 'Constant') {
        const c = term as Constant;
        return c.constantType === 'name' && c.symbol === '/bool' ? 'bool' : undefined;
    }
    if (rejectsEveryValueUnderStrictBounds(term)) return 'singleton';
    if (term.type !== 'ApplyFn') return undefined;
    for (const arg of (term as ApplyFn).args as BaseTerm[]) {
        const inner = strictBoundTrap(arg);
        if (inner === 'bool') return inner;
    }
    return undefined;
}

/** True when no value can pass strict checking against this bound (singletons). */
export function rejectsEveryValueUnderStrictBounds(term: BaseTerm): boolean {
    if (term.type !== 'ApplyFn') return false;
    const fn = term as ApplyFn;
    const args = fn.args as BaseTerm[];
    switch (fn.function.symbol) {
        case 'fn:Singleton':
            return true;
        case 'fn:TaggedUnion':
            return false;
        case 'fn:Union':
            return args.length > 0 && args.every(rejectsEveryValueUnderStrictBounds);
        default:
            // A constructed type is unsatisfiable when one of its parts is.
            return args.some(rejectsEveryValueUnderStrictBounds);
    }
}
