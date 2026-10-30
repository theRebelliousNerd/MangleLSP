# Verified traps: evaluation, hosting and cleanup (v0.7.0)

Companion to [verified-traps](verified-traps.md). Each item was run on the
pinned engine (`mangle-cli run`, or `mangle-cli conformance` for the stage
that rejects a program). Programs are small enough to paste.

## Lattices and cycles

- A recursive merge-lattice relation over a graph that contains a
  **self-loop** edge does not terminate, and `WithCreatedFactLimit` does not
  stop it (`mangle-cli run` was still going at 25 s with the 100k limit on).
  With `cost(S,D,C)` keeping the minimum under `fundep` and `merge`, and
  `cost(S,D,C) :- cost(S,M,C1), edge(M,D,C2), C = fn:plus(C1,C2).`: the edges
  `a->b 1, b->c 2, a->c 5` finish (3 rows), the 3-cycle `a->b, b->c, c->a`
  finishes (9 rows), and any program that adds `edge(/a,/a,1)` hangs, alone
  or with the cycle. Drop self-loops from the EDB before the fixpoint (a
  self-loop never improves a minimum). Hypothesis, not verified: the replaced
  candidate stays in the delta and re-derives a differently valued one.

## Analysis versus stratification

- `p(X) :- q(X), !p(X).` passes parse, loose analysis and strict bounds; only
  `Stratify` refuses it ("program cannot be stratified"; `conformance` reports
  stage `eval`). An embedder that installs the analyzed program before
  `Stratify` succeeds keeps a rejected rule beside the old strata: publish
  after `Stratify`, and test the metadata, not only the query results.

## Cost cliffs

- Pairing the members of a group in one self-join
  (`pair(A,B,H) :- p(A,H), p(B,H), A != B.`) costs the square of the biggest
  group: one 2000-row group stops the run with "fact size limit reached
  102000 > 100000" in 0.3 s; with the guard below the same EDB gives the 6
  pairs of the 3-row group. Count first and test the count before the join:
  `group_size(H, N) :- p(A, H) |> do fn:group_by(H), let N = fn:count().`
  then `pair(A,B,H) :- group_size(H, N), N <= 50, p(A,H), p(B,H), A != B.`
- `SimpleInMemoryStore.GetFacts` scans every row of the relation per lookup;
  `MultiIndexedArrayInMemoryStore` looks up by the first bound argument. A
  fixpoint that joins on an id (`chain(R,K), step(R,K,..)`) over ~20k rows was
  still running at 100 s on the plain store and took 6 s on the indexed one.

## Cleaning up dead rules

- A negated premise over a predicate nothing produces is **true**, so the
  rule is live: `block(F) :- modified(F), !passed(F).` with `passed` never
  asserted derives `block` for every `modified` row. Deleting the literal as
  dead code leaves the unconditional rule it already behaved as and loses the
  guard the author meant. Wire the producer, or delete the rule on purpose.
  A rule with a *positive* starved premise is the dead one.
- A starved premise blocks transitively: a rule whose premise is derived only
  by blocked rules never fires either (a least fixpoint, see
  [graphs-and-closure](graphs-and-closure.md)).

## Proofs and time

- A rule with a comparison (`N > 0`) explains as `partial` in `run --why`, and
  post-hoc `provenance.Explain` finds no proof for the fact it derives; `!=`
  explains fully. Move a measured test (`N > 0`) into the EDB when a finding
  needs its proof.
- Recency without a temporal store: pin `current_time(Now)` as a fact and
  compare `T > fn:minus(Now, fn:mult(Days, 86400))`. The fn call may sit in
  the comparison when `Now` and `Days` are bound by earlier premises (else
  "variable Now ... will not have a value yet"). Change the fact and the
  decision replays at another clock; `--at` has no effect without temporal
  facts.
