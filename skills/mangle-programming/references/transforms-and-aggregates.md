# Transforms: computing over relations, not rows

Plain Datalog can't count. Mangle adds two transforms after the rule
body: `let` (per row: compute a new column) and `do` (per group: reduce a
whole closed relation). The second is a relation boundary. It runs only
once its inputs are complete, so the engine puts it in a later layer,
just as it does for negation.

## Shapes

```mangle
# per row: extend a path
step(X, Z, P2) :- path(X, Y, P), edge(Y, Z) |> let P2 = fn:list:append(P, Z).
# per group: one fact per key
load(Shard, N, Tokens) :- turn(Shard, _, T)
  |> do fn:group_by(Shard), let N = fn:count(), let Tokens = fn:sum(T).
# whole relation into one payload for Go
risk_map(M) :- file_risk(F, R) |> do fn:group_by(), let M = fn:collect_to_map(F, R).
```

Reducers: `count`, `sum`, `min`, `max`, `avg`, `collect`,
`collect_distinct`, `collect_to_map`, `pick_any`, plus float, time and
duration variants. There is no arg-max, percentile or mode. A `do` head may
only hold group keys and aggregates.

## Patterns that use what's distinctive

- **Answer-shaped output**: end a pipeline with `collect_to_map` or
  `collect` so Go gets one fact holding the finished structure. That beats
  N queries and assembly in Go.
- **Arg-max two ways**: (a) `fn:max` per group in one layer, joined back on
  equality in the next. Ties surface as several rows, which is honest.
  (b) A merge lattice (`lattices-and-merge.md`) that keeps the winner
  during the fixpoint. Measure both.
- **Witness relations**: aggregating early destroys members. Keep
  `member_of_group(G, X)` beside `group_size(G, N)` when explanations or
  later joins need the members.
- **Counting distinct**: project to the distinct columns first (facts are
  a set), then `fn:count()`. `fn:count_distinct` is rejected at analysis.
- **Budgets and thresholds** belong in rules: `config_param` facts plus
  `do` sums give "over budget" as a derived fact Go obeys, not a Go `if`.
- **Proofs of aggregates**: in recorder mode, provenance explains a `do`
  result with its group key and transform text (`proofs-as-data.md`).
- **Window functions as self-joins**: a rank is 1 plus the count of rows
  above. The top row has nothing above it, so it needs its own rule:
  `above(I, N) :- item(I, V), item(J, W), W > V |> do fn:group_by(I), let N = fn:count().`
  `rank(I, 1) :- item(I, V), !has_above(I).`, with `has_above(I) :- above(I, N).`
  A running total or budget cut is a prefix sum: join each row with the
  rows ordered at or before it, then `fn:sum` (see `prompt-assembly.md`).
  Both are quadratic, which is fine for hundreds of rows. For more, compute
  in Go and assert the result.

## Traps

- A list literal as a reducer argument inside `group_by` is a type error
  in v0.7. Reducing a list-valued column also fails to type-check. Unnest
  first with `:match_cons` recursion or a narrow relation.
- Float reducers are typed `/float64`. Compare their results with
  `:float:` predicates, not `<`.
- An aggregate that feeds its own input (subtree size, say) is a cycle
  through a relation boundary, and v0.7 rejects it: "program cannot be
  stratified". Redesign it as closure first and aggregate after, or as a
  lattice.
- **Anonymous columns are dropped before aggregating.** In
  `boost(A, _, B) |> do fn:group_by(A), let S = fn:sum(B)`, two different
  boosts of equal value merge into one row. Name every column that keeps
  rows distinct. LSP E080 flags it.
- `fn:group_by` is the only `do` transform, and a rule has one transform.
  `|> do ... |> let ...` chains and `do fn:filter(...)` are rejected. Filter
  in the body and chain through a second rule.
- Pin every aggregate with a test that queries the aggregated head, not
  only one that checks the program loads.
