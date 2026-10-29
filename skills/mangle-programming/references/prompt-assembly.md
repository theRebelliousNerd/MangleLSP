# Prompt assembly: Mangle as the linker for prompt atoms and context

Go holds the prompt text and a vector index finds candidates. Mangle links
them: what is wanted, which dependencies come along, who wins a conflict,
what fits the budget, and the order. The proofs are the manifest. The
program passes strict analysis on v0.7; its run-time behavior is a lab
hypothesis.

## Facts Go asserts (integers only, so every comparison is legal)

`atom(A, Cat, Base, Tokens)`, `ord(A, N)` (registration order, for
tie-breaks), `mandatory(A)`, `selector(A, Dim, Val)`, `context(Dim, Val)`,
`dim_boost(Dim, B)`, `recall(A, PerMille)` (similarity × 1000, so no
floats), `requires(A, D)`, `group_member(A, G)` (one winner per group),
`threshold(T)`, `budget(T)` and `cat_order(Cat, O)`. Keep the text out of
Mangle: `atom_text` lives in Go and is keyed by `A`.

## The linker

```mangle
boost(A, /base, B) :- atom(A, _, B, _).
boost(A, Dim, B) :- selector(A, Dim, V), context(Dim, V), dim_boost(Dim, B).
boost(A, /recall, B) :- recall(A, PM), B = fn:div(fn:mult(PM, 30), 1000).
score(A, S) :- boost(A, Why, B) |> do fn:group_by(A), let S = fn:sum(B).

candidate(A) :- score(A, S), threshold(T), S >= T.
candidate(A) :- mandatory(A).
wanted(A) :- candidate(A).
wanted(D) :- wanted(A), requires(A, D).          # dependencies pull themselves in
needs(A, D) :- requires(A, D).
needs(A, D) :- requires(A, M), needs(M, D).

group_best(G, Best) :- wanted(A), group_member(A, G), score(A, S)
  |> do fn:group_by(G), let Best = fn:max(S).
group_tie(G, A, N) :- group_best(G, Best), group_member(A, G), wanted(A), score(A, Best), ord(A, N).
group_first(G, First) :- group_tie(G, _, N) |> do fn:group_by(G), let First = fn:min(N).
loses(A) :- wanted(A), group_member(A, G), group_first(G, First), ord(A, N), N != First.
dep_broken(A) :- wanted(A), needs(A, D), loses(D).
final(A) :- wanted(A), !loses(A), !dep_broken(A).

order(A, O) :- final(A), atom(A, Cat, _, _), cat_order(Cat, CO), score(A, S),
  O = fn:plus(fn:mult(CO, 100000), fn:minus(99999, S)).
cum_tokens(A, C) :- order(A, OA), order(B, OB), OB <= OA, atom(B, CatB, BaseB, TB)
  |> do fn:group_by(A), let C = fn:sum(TB).
fits(A) :- cum_tokens(A, C), budget(B), C <= B.
dropped(A, /group) :- loses(A).
dropped(A, /dependency) :- dep_broken(A).
dropped(A, /budget) :- final(A), !fits(A).
missing_mandatory(A) :- mandatory(A), !fits(A).
```

## What this fixes in the usual JIT prompt-compiler design

- **"The final score is the max of all matching rules" is false.** Set
  semantics keeps every boost row, so conflict rules end up comparing
  arbitrary rows. Combine the boosts deliberately: `do fn:sum` here, or a
  max lattice when only the best boost should count.
- **Name every column you aggregate over.** `boost(A, _, B)` drops `Why`
  before `fn:sum`, so two different boosts worth 10 merge into one 10.
  `mangle-cli` flags this as E080.
- **Floats with `>=`** are integers-only. Scale to per-mille in Go, or use
  `:float:ge` and the `fn:float:` functions.
- **Ties need a total order.** "Higher score wins" lets both members of a
  tie survive. `ord/2` breaks ties deterministically.
- **Prefer exclusion groups to pairwise conflicts.** A group has an exact
  winner (max, then first by `ord`). Arbitrary pairwise conflicts are
  maximum-weight independent set, which is NP-hard. Model them as groups.
- **Dependencies pull, they don't just gate.** `wanted(D) :- wanted(A),
  requires(A, D)` includes the safety atom a tool needs. A lost
  dependency then drops its dependents transitively through `needs`.
- **The budget cut is a relation:** `cum_tokens` is a quadratic prefix sum
  over the final order. For concise variants, put each variant of an atom
  in one exclusion group.

## Context relevance (code entities instead of atoms)

Spread relevance from the focus entity over weighted links, keeping the
best score per (seed, entity). Decay is strictly multiplicative and has a
floor, so the closure terminates even on a cyclic graph:

```mangle
Decl relevance(S, E, R) descr [fundep([S, E], [R]), merge([R], "higher")] bound [/name, /name, /number].
Decl higher(A, B, C) descr [mode('+', '+', '-'), deferred()] bound [/number, /number, /number].
higher(A, B, A) :- A >= B.
higher(A, B, B) :- B > A.
relevance(S, E, W) :- focus(S), link(S, E, W).
relevance(S, E2, R) :- relevance(S, E, R1), link(E, E2, W),
  R = fn:div(fn:mult(R1, W), 1000), R >= 50.
```

Then feed `relevance` into the same linker as `recall`.

## Go side

- **The manifest is the proofs.** `dropped/2` says what happened, and
  `run --why` or recorder proofs say why. Don't build a separate recorder.
- **Cache the skeleton by context hash.** Atoms that depend only on
  `context/2` evaluate once per hash, with the turn's `recall` facts overlaid.
- **Lab questions:** `relevance` termination on cycles; `cum_tokens` cost.
