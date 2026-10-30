# Graphs and closure: where recursion earns its keep

Recursion over a graph is where Mangle is strongest. The Mangle-specific
twist is what you can carry along the path (lists, structs, costs, time
intervals) and how you can prune it (lattices) while it's still being
computed.

## Patterns

- **Permission inheritance (Zanzibar-style)**: `relation(Object, Rel,
  Subject)`, group membership closed recursively, objects inheriting from
  parents, and roles implying roles (owner ⊇ editor ⊇ viewer). codeNERD's
  `permitted(...)` is a policy closure, and this is the scalable shape for
  it: shard ⊂ campaign ⊂ session scopes, and tools inheriting from tool
  classes.
- **Connected components with leader election**: link nodes symmetrically,
  close, and name each component by its smallest member. Seed
  `comp(U, U)`, or a node misses itself, and elect over numeric IDs:
  `fn:min` over names derives `/number` (LSP E071) and `<` is integers-only.
  `leader(U, L) :- comp(U, P), user(P, Id) |> do fn:group_by(U), let L = fn:min(Id).`
  A `min` merge lattice (`lattices-and-merge.md`) labels while closing,
  which is label-propagation without iteration code. Measure both.
- **Taint**: propagate over single steps and cut at sanitizers:
  `tainted(B) :- tainted(A), step(A, B), !sanitizer_out(B).` Propagating
  over a *transitive* `flows_to` jumps past a sanitizer in the middle.
- **Levels and topological order**: the longest distance from the sources,
  as a max lattice. `level(N, L) :- dep(N, D), level(D, LD), L = fn:plus(LD, 1).`
  keeps one level per node. On a DAG it settles; on a cycle the level
  grows until the fact limit, so derive `cycle(N) :- reach(N, N)` first and
  gate on it. (Strict analysis passes; termination is for the lab.)
- **Bags through graphs (bill of materials)**: quantity products along
  different paths can be equal, and a set collapses them. Carry the path
  as a witness (`bom_path(Top, Path, Part, Qty)`), then
  `fn:sum` per `(Top, Part)`.
- **Weighted shortest paths**: often listed as a Mangle limit, and for
  plain Datalog it is: summing costs around cycles never
  stops. A `fundep` plus `merge` keeping the cheaper cost per (source,
  target) changes that. The engine's `shortest_path.mg` does it for hop
  count. Do it for real costs, with a cycle in the graph, and confirm it
  terminates and matches Dijkstra in Go.
- **Path witnesses**: carry `[X, Y, ...]` as a list so the answer includes
  the route. Cut cycles with `!:list:member(C, P)` (a negated built-in
  analyzes fine once `C` and `P` are bound), then extend with
  `fn:list:cons(C, P)`. Or use a lattice, so cycles don't keep producing
  new lists.
- **Cycle detection**: `reach(X, X)` over dependency, wait-for or import
  edges. Report the cycle with a witness path.
- **Temporal reachability**: edges valid over intervals. A path exists only
  where its edges' intervals overlap (`examples/temporal_graph_intervals.mg`).
  Example: which shard could have influenced this file during this
  campaign phase.
- **Same-generation and set relations**: `examples/reversesamegen.mg` and
  `ancestor.mg` are the classics. They're useful for "siblings in the task
  tree" questions.

## Liveness: a least fixpoint without negation inside it

"Can this rule ever fire?" needs every positive premise live, which reads as
a universal and tempts a negation inside the recursion (not stratifiable).
Chain over the premise index instead: `chain(R, 0) :- rule(R).`,
`chain(R, K1) :- chain(R, K), premise(R, K, P), live(P), K1 = fn:plus(K, 1).`,
`live(P) :- head(R, P), len(R, N), chain(R, N).`, plus the base producers.
All of it is positive recursion bounded by the premise table; "starved" is
`!live(P)` taken once afterwards, and a rule is blocked at the premise where
its chain stops. mangle-oracle's boundary program uses it (B013), and the
same shape with edges reversed answers "is this read by anything that
reaches a query" (B014). Join on `(R, K)` needs an indexed store.

## Cost control

- Close only in the direction the question needs. A symmetric closure
  over a dense graph is quadratic however elegant the rule.
- Restrict both ends: `reach(S, T)` for the 3 starts you care about, not
  all pairs. Seed recursion with a selective base case.
- Path lists in a recursive head grow the universe of values. A lattice,
  a depth bound carried as a number, or a cycle check must cut them off.
  Remember that termination isn't guaranteed by analysis
  (`verified-traps.md`).
- Cone evaluation in the kernel limits re-evaluation to predicates that
  depend on what changed. Recursion that fans out across unrelated
  predicates defeats it.

## Experiments to push

1. Weighted shortest path with a merge lattice on a cyclic graph:
   termination, correctness against Go Dijkstra, and time at 100k edges.
2. Model codeNERD's permission scopes as inheritance and diff the result
   against today's `permitted` facts over a real session EDB.
3. Leader election with a `min` lattice versus closure plus `fn:min`, at
   100k nodes.
