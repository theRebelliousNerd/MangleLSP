# Pushing Mangle forward: combinations and an experiment backlog

One unique feature is a technique. Two together is where Mangle does
things nothing else in codeNERD can. This file holds the combinations
worth trying and a ranked backlog. Pick from it when a mission leaves
room, add to it when a run suggests something, and strike items once a
verdict exists (and record the verdict in agent memory).

## Combinations

| Combine | To get |
| --- | --- |
| lattice + struct cost | multi-objective "best route" (latency, tokens, risk) kept inside the fixpoint |
| lattice + Jev external | per-item best label by calibrated probability, with ties visible as incomparable |
| temporal + negation | leases, cooldowns and "not seen since" without a sweeper goroutine |
| temporal + proofs | "why was this true at 10:04?" replayed by pinning `now` |
| proofs + second program | policy over reasoning: trust rules about how a decision was derived |
| tagged union + strict bounds | event vocabularies where a wrong field is a compile error |
| external + pushdown + lattice | top-k from SQLite or vectors, re-ranked by policy, never loaded whole |
| merged store + `violates` | what-if gating of destructive actions before they run |
| programs as data + diff | semantic diffs of policy changes on real EDB |
| Mangle over Mangle | the corpus auditing itself: dead rules, cones, unchecked bounds |
| `collect_to_map` + struct output | kernel results that Go renders without assembling them |

## Backlog (highest payoff first)

1. **Strict-bounds census of the real corpus.** Analyze schemas + policy
   with `ErrorForBoundsMismatch`, list every mismatch, fix them, and argue
   for strict analysis in the kernel. This makes every Decl mean something.
2. **Weighted shortest path on a cyclic graph with a merge lattice.**
   Half done: an unweighted lattice shortest path on a cycle terminates
   and all-paths doesn't; every in-memory store implements Remove. Left:
   weights (cost in a `fn:pair`), Go Dijkstra as the oracle, 100k edges.
3. **Policy semantic diff.** HEAD versus HEAD~1 policy over a recorded
   session EDB: "what does v2 permit that v1 denied?" Ship it as a test
   helper.
4. ~~Decl/producer/consumer audit with Mangle over code.~~ Shipped as
   `mangle-cli boundary` (MangleLSP `mangle-oracle/boundary.mg`): 66 rules
   read predicates nothing produces, 27 wrong-arity and 11 wrong-shape
   asserts in codeNERD. Next: fix them, and gate new ones in CI.
5. **Temporal leases for file ownership.** Expiring locks for shards, with
   time pinned in tests, compared against the current lock code for
   behavior and line count.
6. **Proof-backed "why" in the TUI.** Render `kernel_explanation.go` proofs
   as a graph, and measure recorder cost per turn.
7. **Jev as an external predicate.** One typed question (for example
   "is this user turn a bug report?") with calibrated probabilities as
   facts, a lattice choosing the label, and hard rules that override it.
   Coordinate with `codenerd-explorer` for the Jev side.
8. ~~Negated-external guard.~~ Shipped: MangleLSP E081 (per file, with
   the projection quick fix) and B011 (cross-file, names the Go callback).
   codeNERD has none today.
9. **Tagged-union tool events.** Collapse a family of flat event predicates
   into one union Decl, and measure the churn when a new tool kind is
   added.
10. **What-if gate.** A merged store plus a `violates` relation in front of
    one destructive action, compared against today's check.
11. **Packages for learned rules.** Probe whether `Package learned!` and
    `Use policy!` give learned rules a namespace they can't escape.
12. **Mutation testing for policy.** Drop one premise per rule and see
    which tests notice. The survivors show where policy is untested.
13. **Why-not as a kernel tool.** `mangle-cli whynot` adds one probe rule
    per body prefix and reads the row funnel. Put the same in
    `kernel_explanation.go` so a shard can ask why a gate stayed shut.
14. **Strict-bounds census, all at once.** The LSP's assembled-program
    check lists every mismatch (68 sites in the core program) where the
    engine stops at the first. Work through them with `mangle-cli review`.

## How to push one run further

- After the first version works, ask: what's the second unique feature
  that would make this better? Try it in the same lab.
- Scale it until it hurts (10x, then 100x the rows) and find what breaks
  first.
- Turn the near miss into a proof question: why *not*?
- Put the winning shape in front of the kernel's real data before calling
  it done.
- Write the verdict even when it's "Go is better here". That's knowledge
  too.
