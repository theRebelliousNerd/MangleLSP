/**
 * Mangle-feature advice: legal code that a feature only Mangle has would
 * express better, with the rewrite. Every claim below was checked on the
 * upstream v0.7 engine (codeNERD _mangle_lab/lsp_ground_truth):
 *
 * - A001 `fn:max`/`fn:min` per group, then joined back to the source to get
 *   the winning row: a `fundep` + `merge` lattice keeps the winner inside the
 *   fixpoint (same answers; one relation instead of two strata).
 * - A002 three or more `*_event`-style predicates: one `fn:TaggedUnion` Decl
 *   (tagged unions pass strict bounds; singletons do not, see E082).
 * - A003 a body tests a constant that no writer of that column produces: the
 *   rule can never match; enforce the vocabulary with an invariant relation.
 * - A004 freshness by comparing timestamps against a clock fact: temporal
 *   facts and `<-[0s, D]` say it directly and need no clock fact.
 * - A005 `fn:collect(fn:pair(K, V))`: `fn:collect_to_map(K, V)` gives Go one
 *   answer-shaped map.
 * - A006 all paths, then `fn:min`/`fn:max` over them: a merge lattice keeps
 *   only the best path per key. On a cyclic graph the all-paths version runs
 *   to the fact limit (38 s, 100k facts on a 5-edge cycle); the lattice
 *   version terminates with the 16 shortest paths.
 */

import {
    SourceUnit,
    Clause,
    Atom,
    Term,
    BaseTerm,
    Variable,
    Constant,
    ApplyFn,
    Decl,
    termToString,
} from '../parser/ast';
import type { SemanticError } from './validation';
import { suggestSimilar } from './diagnostics';

/** Runs every advice check over a unit. */
export function checkAdvice(unit: SourceUnit, errors: SemanticError[]): void {
    adviseArgMaxJoinBack(unit, errors);
    adviseTaggedUnionFamilies(unit, errors);
    adviseNeverWrittenConstants(unit, errors);
    adviseClockComparisons(unit, errors);
    adviseCollectPairs(unit, errors);
    adviseAllPathsThenPick(unit, errors);
}

// ------------------------------------------------------------------ helpers

const predKey = (a: Atom) => `${a.predicate.symbol}/${a.predicate.arity}`;

function positiveAtoms(clause: Clause): Atom[] {
    return (clause.premises ?? []).filter((p): p is Atom => p.type === 'Atom' && !p.predicate.symbol.startsWith(':'));
}

function varName(t: BaseTerm | undefined): string | undefined {
    return t && t.type === 'Variable' && (t as Variable).symbol !== '_' ? (t as Variable).symbol : undefined;
}

function doTransform(clause: Clause): { keys: string[]; lets: { variable: string; fn: ApplyFn }[] } | undefined {
    const stmts = clause.transform?.statements;
    const first = stmts?.[0];
    if (!stmts || !first || first.variable !== null || first.fn.function.symbol !== 'fn:group_by') return undefined;
    const keys = first.fn.args.map(varName).filter((v): v is string => !!v);
    const lets = stmts.slice(1).filter(s => s.variable).map(s => ({ variable: s.variable!.symbol, fn: s.fn }));
    return { keys, lets };
}

function declFor(unit: SourceUnit, key: string): Decl | undefined {
    return unit.decls.find(d => `${d.declaredAtom.predicate.symbol}/${d.declaredAtom.predicate.arity}` === key);
}

// ------------------------------------------------------------------ A001

function adviseArgMaxJoinBack(unit: SourceUnit, errors: SemanticError[]): void {
    for (const agg of unit.clauses) {
        const t = doTransform(agg);
        const body = positiveAtoms(agg);
        if (!t || body.length !== 1 || (agg.premises ?? []).length !== 1) continue;
        const src = body[0]!;
        for (const l of t.lets) {
            const reducer = l.fn.function.symbol;
            if (reducer !== 'fn:max' && reducer !== 'fn:min') continue;
            const measured = varName(l.fn.args[0]);
            if (!measured) continue;
            const headKey = predKey(agg.head);
            // A lattice needs a key: a global max (group_by()) has none.
            if (t.keys.length === 0) continue;
            // A rule that joins the aggregate back to its source.
            const joiner = unit.clauses.find(c => c !== agg && positiveAtoms(c).some(a => predKey(a) === headKey)
                && positiveAtoms(c).some(a => predKey(a) === predKey(src)));
            if (!joiner) continue;
            // Value columns: the source's other positions, named as the join-back names them.
            const back = positiveAtoms(joiner).find(a => predKey(a) === predKey(src))!;
            const roles = src.args.map(a => varName(a));
            const values = back.args
                .map((a, i) => (roles[i] === measured || (roles[i] && t.keys.includes(roles[i]!)) ? undefined : varName(a)))
                .filter((v): v is string => !!v);
            const keys = t.keys;
            const name = `best_${src.predicate.symbol}`;
            const cmp = `${src.predicate.symbol}_${reducer === 'fn:max' ? 'later' : 'earlier'}`;
            const [win, lose] = reducer === 'fn:max' ? ['>=', '<'] : ['<=', '>'];
            const value = values.length === 1 ? values[0]! : undefined;
            const rewrite = value === undefined ? undefined : [
                `Decl ${name}(${[...keys, 'P'].join(', ')}) descr [fundep([${keys.join(', ')}], [P]), merge([P], "${cmp}")].`,
                `Decl ${cmp}(P1, P2, B) descr [mode('+', '+', '-'), deferred()].`,
                `${cmp}(P1, P2, P1) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 ${win} T2.`,
                `${cmp}(P1, P2, P2) :- :match_pair(P1, T1, _), :match_pair(P2, T2, _), T1 ${lose} T2.`,
                `${name}(${[...keys, `fn:pair(${measured}, ${value})`].join(', ')}) :- ${src.predicate.symbol}(${src.args.map((a, i) => (varName(a) ? termToString(a) : (varName(back.args[i]) === value ? value : '_'))).join(', ')}).`,
            ].join('\n');
            errors.push({
                code: 'A001',
                message: `'${termToString(agg.head)}' takes ${reducer} per group and this rule joins it back to '${src.predicate.symbol}' to find the winning row; a merge lattice keeps the winner directly`,
                range: joiner.head.range,
                severity: 'info',
                hint: rewrite
                    ? `declare a relation that keeps one value per key and merges by comparison (one relation, no second stratum, works inside recursion; ties keep the first winner instead of several rows):\n${rewrite}\nThe store must support fact removal (the engine's in-memory stores do; a temporal-store adapter does not, and then both facts stay)`
                    : 'declare a relation with descr [fundep([Key], [P]), merge([P], "better")] whose value is fn:pair(Measure, Value), and a deferred better(P1, P2, B) rule that compares with :match_pair',
                fixes: rewrite
                    ? [{ title: `Add the lattice '${name}' (then switch consumers to it)`, range: { start: joiner.range.end, end: joiner.range.end }, newText: `\n${rewrite}` }]
                    : undefined,
            });
        }
    }
}

// ------------------------------------------------------------------ A002

const VARIANT_SUFFIXES = new Set(['event', 'result', 'outcome', 'signal', 'notification', 'message', 'verdict']);

function adviseTaggedUnionFamilies(unit: SourceUnit, errors: SemanticError[]): void {
    const first = new Map<string, { range: Clause['range']; arity: number }>();
    for (const d of unit.decls) {
        first.set(d.declaredAtom.predicate.symbol, { range: d.range, arity: d.declaredAtom.predicate.arity });
    }
    for (const c of unit.clauses) {
        if (!first.has(c.head.predicate.symbol)) first.set(c.head.predicate.symbol, { range: c.head.range, arity: c.head.predicate.arity });
    }
    const families = new Map<string, string[]>();
    for (const name of first.keys()) {
        const parts = name.split('_');
        if (parts.length < 3) continue;
        const suffix = parts[parts.length - 1]!;
        if (!VARIANT_SUFFIXES.has(suffix)) continue;
        const family = `${parts[0]}_${suffix}`;
        families.set(family, [...(families.get(family) ?? []), name]);
    }
    for (const [family, members] of families) {
        if (members.length < 3) continue;
        const tags = members.map(m => `/${m.split('_').slice(1, -1).join('_')}`);
        const anchor = first.get(members[0]!)!;
        errors.push({
            code: 'A002',
            message: `${members.length} predicates (${members.join(', ')}) are variants of one '${family}': a tagged union keeps them in one relation`,
            range: anchor.range,
            severity: 'info',
            hint: `declare one relation whose value is a tagged union, so a rule can match one variant or all of them, and a new variant is one more tag:\nDecl ${family}(Id, E) bound [/name, fn:TaggedUnion(/kind, ${tags.map(t => `${t}, fn:Struct(...)`).join(', ')})].\nMatch a variant with :match_field(E, /kind, K), K = ${tags[0]}. Tagged unions pass strict bounds checking (union-of-singleton bounds do not: E082)`,
        });
    }
}

// ------------------------------------------------------------------ A003

function constantKey(t: BaseTerm): string | undefined {
    return t.type === 'Constant' && (t as Constant).constantType === 'name' ? (t as Constant).symbol : undefined;
}

function adviseNeverWrittenConstants(unit: SourceUnit, errors: SemanticError[]): void {
    // Per predicate/position: the name constants written, or undefined once a
    // writer puts anything else (a variable, a string) there.
    const written = new Map<string, Map<number, Set<string> | undefined>>();
    for (const c of unit.clauses) {
        const key = predKey(c.head);
        const cols = written.get(key) ?? new Map<number, Set<string> | undefined>();
        c.head.args.forEach((a, i) => {
            if (cols.has(i) && cols.get(i) === undefined) return;
            const k = constantKey(a);
            if (k === undefined) cols.set(i, undefined);
            else cols.set(i, new Set([...(cols.get(i) ?? []), k]));
        });
        written.set(key, cols);
    }
    for (const c of unit.clauses) {
        for (const atom of positiveAtoms(c)) {
            const key = predKey(atom);
            const cols = written.get(key);
            const decl = declFor(unit, key);
            // Only predicates the unit defines entirely: a Decl'd extensional
            // predicate may be asserted by the host with other values.
            if (!cols || decl?.descr?.some(d => d.predicate.symbol === 'extensional' || d.predicate.symbol === 'external')) continue;
            atom.args.forEach((a, i) => {
                const k = constantKey(a);
                const values = cols.get(i);
                if (k === undefined || !values || values.has(k)) return;
                const sug = suggestSimilar(k, values);
                errors.push({
                    code: 'A003',
                    message: `'${k}' is never written to argument ${i + 1} of ${key} (its writers produce only ${[...values].sort().join(', ')}), so this premise never matches`,
                    range: a.range,
                    severity: 'warning',
                    hint: `${sug.length > 0 ? `did you mean '${sug[0]}'? ` : ''}to make a closed vocabulary a checked contract, list it as a relation and derive violations a test asserts empty: valid_${atom.predicate.symbol}_${i + 1}(${[...values][0]}). ... bad_${atom.predicate.symbol}(V) :- ${atom.predicate.symbol}(${atom.args.map((_, j) => (j === i ? 'V' : '_')).join(', ')}), !valid_${atom.predicate.symbol}_${i + 1}(V). (fn:Singleton bounds cannot: E082)`,
                    fixes: sug.length > 0 ? [{ title: `Replace with '${sug[0]}'`, range: a.range, newText: sug[0]! }] : undefined,
                });
            });
        }
    }
}

// ------------------------------------------------------------------ A004

const CLOCK_PREDICATE = /^(current_time|current_timestamp|now|clock|time_now|current_unix_time)$/;
const COMPARISONS = new Set([':lt', ':le', ':gt', ':ge', ':time:lt', ':time:le', ':time:gt', ':time:ge', ':duration:lt', ':duration:le', ':duration:gt', ':duration:ge']);

function termVars(t: Term, out: Set<string>): void {
    if (t.type === 'Variable') {
        if ((t as Variable).symbol !== '_') out.add((t as Variable).symbol);
    } else if (t.type === 'ApplyFn' || t.type === 'Atom') {
        for (const a of (t as ApplyFn).args) termVars(a, out);
    } else if (t.type === 'Eq' || t.type === 'Ineq') {
        const e = t as unknown as { left: Term; right: Term };
        termVars(e.left, out);
        termVars(e.right, out);
    }
}

function adviseClockComparisons(unit: SourceUnit, errors: SemanticError[]): void {
    for (const c of unit.clauses) {
        const clock = positiveAtoms(c).find(a => CLOCK_PREDICATE.test(a.predicate.symbol));
        if (!clock) continue;
        const nowVars = new Set<string>();
        clock.args.forEach(a => { const v = varName(a); if (v) nowVars.add(v); });
        // Follow Now through equalities such as Age = fn:minus(Now, T).
        for (const p of c.premises ?? []) {
            if (p.type !== 'Eq') continue;
            const e = p as unknown as { left: Term; right: Term };
            const rhs = new Set<string>();
            termVars(e.right, rhs);
            const lhs = varName(e.left as BaseTerm);
            if (lhs && [...rhs].some(v => nowVars.has(v))) nowVars.add(lhs);
        }
        const compares = (c.premises ?? []).find(p => {
            if (p.type !== 'Atom' || !COMPARISONS.has((p as Atom).predicate.symbol)) return false;
            const vars = new Set<string>();
            termVars(p, vars);
            return [...vars].some(v => nowVars.has(v));
        });
        if (!compares) continue;
        const fact = positiveAtoms(c).find(a => a !== clock);
        const subject = fact ? fact.predicate.symbol : 'p';
        errors.push({
            code: 'A004',
            message: `This rule decides freshness by comparing timestamps against the clock fact '${clock.predicate.symbol}'; temporal facts say it directly`,
            range: compares.range,
            severity: 'info',
            hint: `declare the fact temporal and let Go assert it with its validity time; the operator reads the evaluation time, so no clock fact is needed and a replay pins it:\nDecl ${subject}(...) temporal bound [...].\nrecent(X) :- <-[0s, 24h] ${subject}(X).\nThe evaluation needs a temporal store (engine.WithTemporalStore) and the time to judge at (engine.WithEvaluationTime)`,
        });
    }
}

// ------------------------------------------------------------------ A005

function adviseCollectPairs(unit: SourceUnit, errors: SemanticError[]): void {
    for (const c of unit.clauses) {
        const t = doTransform(c);
        if (!t) continue;
        for (const l of t.lets) {
            const fn = l.fn.function.symbol;
            if (fn !== 'fn:collect' && fn !== 'fn:collect_distinct') continue;
            const arg = l.fn.args[0];
            if (!arg || arg.type !== 'ApplyFn' || (arg as ApplyFn).function.symbol !== 'fn:pair' || (arg as ApplyFn).args.length !== 2) continue;
            const [k, v] = (arg as ApplyFn).args;
            const replacement = `fn:collect_to_map(${termToString(k!)}, ${termToString(v!)})`;
            errors.push({
                code: 'A005',
                message: `'${fn}(fn:pair(...))' builds a list of pairs for Go to turn into a map; fn:collect_to_map builds the map`,
                range: l.fn.range,
                severity: 'info',
                hint: `${replacement} gives one answer-shaped value per group: Go reads it without assembling, and rules can look keys up with fn:map:get. Keys must be unique per group (a later pair wins)`,
                fixes: [{ title: `Use ${replacement}`, range: l.fn.range, newText: replacement }],
            });
        }
    }
}

// ------------------------------------------------------------------ A006

const ACCUMULATORS = new Set(['fn:list:append', 'fn:list:cons', 'fn:plus', 'fn:float:plus']);

function accumulates(c: Clause): boolean {
    let found = false;
    const visit = (t: Term) => {
        if (t.type === 'ApplyFn') {
            if (ACCUMULATORS.has((t as ApplyFn).function.symbol)) found = true;
            (t as ApplyFn).args.forEach(visit);
        } else if (t.type === 'Eq') {
            visit((t as unknown as { right: Term }).right);
            visit((t as unknown as { left: Term }).left);
        }
    };
    (c.premises ?? []).forEach(visit);
    c.head.args.forEach(visit);
    c.transform?.statements.forEach(s => visit(s.fn));
    return found;
}

function adviseAllPathsThenPick(unit: SourceUnit, errors: SemanticError[]): void {
    const recursiveAccumulating = new Set<string>();
    for (const c of unit.clauses) {
        const key = predKey(c.head);
        if (positiveAtoms(c).some(a => predKey(a) === key) && accumulates(c)) recursiveAccumulating.add(key);
    }
    for (const c of unit.clauses) {
        const t = doTransform(c);
        if (!t) continue;
        const src = positiveAtoms(c).find(a => recursiveAccumulating.has(predKey(a)));
        if (!src || declFor(unit, predKey(src))?.descr?.some(d => d.predicate.symbol === 'merge')) continue;
        const pick = t.lets.find(l => l.fn.function.symbol === 'fn:min' || l.fn.function.symbol === 'fn:max');
        if (!pick) continue;
        errors.push({
            code: 'A006',
            message: `'${src.predicate.symbol}' enumerates every path (accumulating a list or cost) and this rule keeps only the ${pick.fn.function.symbol === 'fn:min' ? 'smallest' : 'largest'}; a merge lattice keeps only the best one while recursing`,
            range: pick.fn.range,
            severity: 'info',
            hint: `declare the recursive relation with a lattice so worse paths are dropped during the fixpoint (upstream examples/shortest_path.mg):\nDecl ${src.predicate.symbol}(Source, Target, Path) descr [fundep([Source, Target], [Path]), merge([Path], "shorter")].\nDecl shorter(P1, P2, Best) descr [mode('+', '+', '-'), deferred()].\nshorter(P1, P2, S) :- fn:list:len(P1) < fn:list:len(P2), S = P1.\nshorter(P1, P2, S) :- fn:list:len(P2) <= fn:list:len(P1), S = P2.\nOn a cyclic graph the all-paths version never finishes (it runs to the fact limit); the lattice version terminates`,
        });
    }
}
