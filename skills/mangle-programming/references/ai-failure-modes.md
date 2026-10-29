# AI failure modes, rewritten for v0.7

Models write Mangle from Prolog, SQL, Soufflé and older Mangle memories.
Each row below was checked on TauCeti v0.7.0 with `mangle-cli conformance`
(the engine's own verdict) on 2026-10-28. "Parse" or "analyze" means the
engine rejects it at that stage.

## Syntax that doesn't exist

| Written | Engine says | Write instead |
| --- | --- | --- |
| `not q(X)` | parse error | `!q(X)`, fully bound |
| `Decl p(App.Type<string>)` | parse error | `Decl p(App) bound [/string].` |
| `Y = X * 2`, `X + 1` | parse error (`*`) | `fn:mult(X, 2)`, `fn:plus(X, 1)` |
| `p([1\|T])`, `[X\|Rest]` | parse error | `fn:list:cons(H, T)` to build, `:match_cons(L, H, T)` to split |
| `x \|> do ... \|> let ...` | analyze: head var unbound | one transform per rule; chain through a second rule |
| `Score = case when ... else` | not Mangle | one rule per case; the fallback negates a projection |
| `.decl`, `SELECT`, `findall` | parse error | Decls, rules, `do` transforms |

## Functions and predicates that don't exist (or don't check)

| Written | Engine says | Write instead |
| --- | --- | --- |
| `fn:len(L)` | unknown function | `fn:list:len(L)` |
| `fn:divide`, `fn:multiply` | unknown function | `fn:div`, `fn:mult` (`fn:float:div`/`mult` for floats) |
| `fn:Count()`, `fn:Sum` | unknown function | lowercase reducers |
| `fn:map:get(M, K)` | analyze: unknown function, even though `symbols.go` declares it and `functional.go` evaluates it | `:match_entry(M, K, V)` |
| `:check(fn:verify(...))`, custom `fn:` | analyze: mode error | an external predicate with `mode('+', '+')`; v0.7 has no API to register `fn:` functions |
| `do fn:filter(fn:gt(V, 10))` | unknown function (both `fn:filter` and `fn:gt`); `fn:group_by` is the only `do` transform | filter in the body before `\|>` (`V > 10`), or `:filter(fn:list:contains(L, X))` |
| `fn:pair:snd(P)` | unknown function | `:match_pair(P, F, S)` |
| `member(X, L)` (Prolog) | undeclared | `:list:member(X, L)` enumerates or checks (Member, List) |

## Accepted at analysis, wrong later

| Written | What happens | Write instead |
| --- | --- | --- |
| `S > 0.9` on `/float64` | analysis passes; evaluation fails "not a number"; LSP E069 | `:float:gt(S, 0.9)`, or integers per mille |
| `X < Y` on names | loose analysis passes; LSP E069 | integer IDs (`user(U, Id)`), compare those |
| `fn:min(P)` over names | loose pass; strict: derives `/number` (LSP E071) | aggregate numeric IDs |
| `dec(P, /allow) :- post(P), !dec(P, /block).` | stratification fails | derive `blocked(P)` in a lower stratum, then `allow` from `!blocked(P)` |
| aggregate inside its own recursion (subtree size) | stratification fails | closure first, aggregate in the next stratum, or a lattice |
| `boost(A, _, B) \|> ... fn:sum(B)` | `_` dropped before the sum: equal values merge | name the column (`Why`); LSP E080 |
| `:match_entry(M, K, V)` with `M` bounded `/any` | **strict bounds checking panics** (index out of range, `boundscheck.go:357`) | bound `M` as `fn:Map(K, V)` |

## Semantic traps models walk into

- **Bags vs sets.** Bill-of-materials quantities, path counts and votes are
  bags; Mangle relations are sets, so two derivations with equal values
  collapse. Keep a witness that makes each row unique (the path, the voter)
  and aggregate over it.
- **Transitive taint skips sanitizers.** `tainted(B) :- flows_to(A, B),
  tainted(A), !sanitized(B)` over a *transitive* `flows_to` jumps straight
  past a sanitizer in the middle. Propagate over single steps
  (`graphs-and-closure.md`).
- **Leader election misses the user.** "min over peers" excludes the user
  unless `comp(U, U)` seeds the closure.
- **Closed world, not null.** There is no NULL or `/unknown`. "Unknown" is
  `item(X), !known(X)` over a projection.
- **The DSL trap.** Taxonomy lines, intent phrase banks and prose in `.mg`
  are parse errors or dead data. A Go loader routes them: taxonomy becomes
  `subclass_of` facts, phrases go to embeddings, and only rules reach the
  parser. Then let Mangle check the taxonomy:
  `taxonomy_cycle(A) :- is_subtype(A, A).`
- **Version-stamped "current" facts.** "Latest status" is a merge lattice
  keyed by subject (`lattices-and-merge.md`) or a temporal fact, not
  `!newer(...)` over every timestamp pair.

The `mangle-cli` diagnostics catch most of the middle table live. Run
`mangle-cli conformance --program file.mg` to get the engine's verdict next
to the LSP's.
