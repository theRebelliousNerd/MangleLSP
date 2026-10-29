# Lattices: relations that keep only the best fact

In plain Datalog a relation is a set, and every derivation adds a row.
Mangle can instead declare that a relation keeps one winning value per key,
chosen by a merge predicate you write. That's a custom lattice: "best so
far" computed inside the fixpoint, not afterwards in Go.

## The shape (from the engine's shortest-path example)

```mangle
Decl shortest_path(Source, Target, Path)
  descr [fundep([Source, Target], [Path]), merge([Path], "shorter")].
Decl shorter(P1, P2, Best) descr [mode('+', '+', '-'), deferred()].

shorter(P1, P2, P1) :- fn:list:len(P1) < fn:list:len(P2).
shorter(P1, P2, P2) :- fn:list:len(P2) <= fn:list:len(P1).
```

The rules for `shortest_path` look exactly like an all-paths closure. The
Decl makes the store replace a longer path with a shorter one as it goes,
so the recursion explores far less than the full path set.

## How the engine applies it (read from `engine/seminaivebottomup.go`)

- When a new fact arrives with the same key, the engine evaluates the merge
  predicate top-down on (old value, new value) and keeps the result.
- If the merge predicate gives no answer, the two values are incomparable
  and **both are kept**. A partial order is allowed.
- Exactly one `fundep` and exactly one target column per predicate.
  Anything else is an error ("not implemented").
- The existing fact is matched on the **leading** argument positions, one
  per source key. Put the key columns first. (Inferred from the code;
  confirm in a lab.)
- The old fact is removed only when the store implements
  `factstore.FactStoreWithRemove`; otherwise it stays. Verified on v0.7:
  every in-memory store does, the kernel's `SimpleInMemoryStore` included;
  the temporal-store adapter does **not**, so a lattice evaluated on it
  keeps every fact. The lab harness now evaluates on a
  `SimpleInMemoryStore` beside its temporal store.
- On a cyclic graph a lattice shortest path terminates; the all-paths
  closure doesn't (verified: 5-edge cycle, 16 facts vs the 100k limit).

## Hosting a lattice (verified on v0.7 in codeNERD's first production lattice)

- The engine runs merge and `deferred()` predicates top-down from the rules
  of the program it is handed. An embedder that evaluates a subset (an
  incremental pass, a dependency cone) must hand it the merge and deferred
  rules too; otherwise every row counts as incomparable and is kept. Pin
  this with a differential test of the subset against full evaluation.
- Analysis stratifies by rule bodies only and never reads a merge
  predicate. If the merge reads a derived predicate (a rank table), name
  that predicate in the lattice rule's body so it is computed first;
  otherwise ties survive, and the result can flake with stratum order.
- A merge must be a total preorder: one answer for every pair. A merge that
  answers both ways keeps whichever row arrived last.
- `fn:Pair(/string, /number)` passes strict checks as the lattice column,
  and a higher row replaces two tied ones in any arrival order. The engine
  mutates the incoming fact in place, so don't reuse it from Go.
- Make ties data: derive `x_tied` when two rows survive, and have consumers
  require the top alone.

## Why this beats the usual workaround

There is no arg-max reducer. The usual pattern computes `fn:max` in one
stratum and joins it back in the next. That costs two strata and needs the
full relation first. A lattice keeps the winner continuously, works inside
recursion, and can rank with any rule-defined comparison, not just numbers.

## codeNERD seams to try

- **Route or model choice**: per task, keep the cheapest route that
  satisfies the constraints, with cost as a struct of
  (latency, tokens, risk) and a merge rule that encodes the trade-off.
- **Freshest evidence**: per (file, claim), keep the observation with the
  latest timestamp. This replaces "sort by time and take the first" in Go.
- **Highest-confidence classification**: per item, keep the label with the
  best Jev probability (see `go-as-oracle.md`). A tie is incomparable, so
  both labels are kept and the tie is visible.
- **Minimal blast radius**: per change, keep the smallest affected set
  (`fn:list:len`), the way shortest paths does.
- **Budget closure**: propagate a remaining budget down a plan graph and
  keep the max remaining per node.

## Open questions for experiments

- Does merging stay monotone enough that semi-naive evaluation still gives
  the same answer as a naive run? Compare the two on the same EDB.
- How do provenance proofs look for a fact that replaced another? Is the
  loser's derivation still visible?
- What's the speedup over the max-then-join-back pattern at 100k+ rows?
