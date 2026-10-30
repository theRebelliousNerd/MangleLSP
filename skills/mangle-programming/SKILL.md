---
name: mangle-programming
description: >
  Designs, writes, debugs and experiments with Mangle (codeberg.org/TauCeti/mangle-go
  v0.7) in any project, leading with what Mangle has beyond plain Datalog:
  structured values and tagged unions, merge lattices, temporal facts, proofs as
  data, Go-backed external predicates, checkable types and transforms, composed
  with Go. Use for any .mg file, Decl, rule, aggregation, derivation, Mangle
  analysis error, or a rule that compiles but derives nothing, and when deciding
  how Go and Mangle should split a job.
paths:
  - "**/*.mg"
metadata:
  version: 3.0.0
---

# Mangle programming: make Mangle the star

Treat Mangle as a reasoning engine that Go composes, not as a lookup
table or a Datalog dialect to keep small. A good design here uses
something only Mangle has, where it does the job better than Go would.
Hold every design to that. **TauCeti v0.7 is canon**: when this skill
and the engine disagree, the engine wins and this skill gets fixed.

## First question for any task

*What can Mangle do here that Go code and flat Datalog can't do as
clearly?* Go through the list below before writing a clause:

| If the problem has... | Reach for | Read |
| --- | --- | --- |
| records that travel together (events, tool calls, payloads) | structs, lists, maps, tagged unions | [structured-values](references/structured-values.md) |
| "keep the best / freshest / cheapest per key" | `fundep` plus `merge` lattices | [lattices-and-merge](references/lattices-and-merge.md) |
| validity windows, expiry, cooldowns, "in the last N days" | temporal facts and operators | [time-as-a-dimension](references/time-as-a-dimension.md) |
| "why did it decide that?", audit, "why not?" | proofs as Mangle facts | [proofs-as-data](references/proofs-as-data.md) |
| a question only Go, the disk, SQLite or Jev can answer | external predicates | [go-as-oracle](references/go-as-oracle.md) |
| a closed vocabulary or variants that must not drift | tagged unions with strict bounds; a `valid_x` invariant relation (not singletons: they reject everything in v0.7) | [types-as-contracts](references/types-as-contracts.md) |
| counting, budgets, rankings, answer-shaped output | `let` and `do` transforms | [transforms-and-aggregates](references/transforms-and-aggregates.md) |
| reachability, inheritance, components, shortest paths | recursion carrying values, pruned by lattices | [graphs-and-closure](references/graphs-and-closure.md) |
| rules to generate, gate, diff or mutate | programs as data | [programs-as-data](references/programs-as-data.md) |
| facts about code: wiring, taint, cycles, dead Decls | Mangle over code | [mangle-over-code](references/mangle-over-code.md) |
| several engines, what-if worlds, replay, invariants | Go composition patterns | [go-composition-patterns](references/go-composition-patterns.md) |
| choosing prompt atoms or context under a budget, with dependencies and conflicts | Mangle as the linker: scoring, pull-in, exclusion winners, prefix-sum cut | [prompt-assembly](references/prompt-assembly.md) |

If nothing on the list fits, plain Datalog with stratified negation is
fine. Say so, and keep it small.

## Think differently

- **A relation is a judgment, not a table.** Name the EDB facts Go will
  measure, the IDB judgment Mangle derives, and the consumer that obeys
  it ([relational-thinking](references/relational-thinking.md)).
- **One fact can hold a whole thing.** Stop spreading an event across five
  predicates. Destructure it only where a rule must join on a part.
- **"Best" is a lattice, not a sort.** Keep the winner inside the
  fixpoint instead of computing everything and picking afterwards in Go.
- **Time belongs to the fact.** A lease that expires stops deriving. Go
  owns the clock and pins it, so every decision can be replayed.
- **The proof is the explanation.** Proofs are data, so policy can reason
  about reasoning, and the UI can show the real derivation.
- **Go is the oracle, Mangle is the judge.** Externals bring the world in
  on demand, only for the bindings the rules reach.
- **Types are contracts you can switch on.** Most embedders analyze with
  bounds unchecked. Strict analysis in labs and tests makes Decls mean
  something.
- **Programs are values.** Rules can be generated, gated, diffed between
  versions and mutation-tested like any other Go value.
- **Cost is rows, not lines.** Estimate intermediate substitutions per
  rule ([scale-and-performance](references/scale-and-performance.md)).

## First, know the project

Before the first change in a project, read `.claude/mangle-project.md`.
If it doesn't exist, profile the project and write it: where the `.mg`
files live, which engine and version it pins, how Go loads and feeds the
programs, its external predicates, its layers and its test commands.
Keep it current as you learn. How:
[project-profiling](references/project-profiling.md); the facts come from
[scripts/profile-project.sh](scripts/profile-project.sh).

## Experiment first, then build

Every mission starts in a disposable lab that tries a Mangle-only feature
on the real problem. Then the verdict decides the production design.

```bash
${CLAUDE_SKILL_DIR}/scripts/new-lab.sh my_idea
(cd _mangle_lab && go test -v ./my_idea/)
```

- [scripts/new-lab.sh](scripts/new-lab.sh) scaffolds `_mangle_lab/<slug>/`
  in the project as its own Go module. It pins the engine the project pins,
  can import the project's packages, and ignores itself in git.
- [scripts/lab/harness.go](scripts/lab/harness.go) runs a program on the
  pinned engine with strict bounds, a temporal store, the proof recorder,
  externals and a pinned `now`.
- [scripts/lab/template_test.go.txt](scripts/lab/template_test.go.txt) is
  the experiment file: hypothesis, program, verdict.
- [lab-protocol](references/lab-protocol.md) covers the loop, what makes
  a good experiment, how to promote one, and what to remember.
- [pushing-mangle-forward](references/pushing-mangle-forward.md) lists
  feature combinations and a ranked backlog of experiments, so there is
  always a next push.

Quick probes: `mangle-cli check file.mg` (fast, static) and `mangle-cli run
--why file.mg` (the real engine, with proofs). Engine-backed answers for a file or the whole repo (review, boundary,
advise, run with proofs, whynot): [engine-backed-tooling](references/engine-backed-tooling.md).

## Ground truth (each item checked on v0.7)

- Reducers are lowercase (`fn:count()`). There is no `fn:pair:fst/snd`;
  use `:match_pair`.
- A `:match_*` output slot must be a free variable. Bind it, then compare.
- Negation is `!`, and it must be fully bound: `!r(X, _)` is an analysis
  error. Negate a projection.
- `!ext(...)` on an external predicate reads only the store and never
  calls Go. Project positively first.
- `analysis.AnalyzeOneUnit` does **not** check Decl bounds; only
  `AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)` does. Find out which
  one the project's embedder calls.
- Termination is **not** guaranteed: `fn:plus` recursion runs to the fact
  limit.
- Temporal programs need a temporal store at evaluation time. The lab
  harness has one.
- `!=` waits for its variables like `!`; `<` doesn't. Singleton-union and
  `/bool` bounds fail strict checking for every value. Lattices need a
  store with `Remove`: every in-memory store, not the temporal adapter.

Details and the rest: [verified-traps](references/verified-traps.md), and for
evaluation, hosting and cleanup (lattice self-loops, stratification, cost
cliffs, dead-rule removal, recency without a temporal store):
[verified-traps-evaluation](references/verified-traps-evaluation.md).
What models get wrong about Mangle, as v0.7 tables: [ai-failure-modes](references/ai-failure-modes.md).
How v0.7 really calls a Go external, with a correct cache and error policy:
[external-predicates-in-go](references/external-predicates-in-go.md).
Add every new trap you prove.

## Rules of the road (any project)

- Go measures, asserts and executes. Mangle decides: permission, routing,
  freshness, budgets, completion. No policy `if` in Go "just in case".
- No prose, taxonomies or fuzzy matching in `.mg`. Similarity belongs to
  embeddings or a classifier behind an external.
- Embedded programs (`//go:embed`) need a rebuild before a running binary
  sees a `.mg` change.
- Everything specific to this project (layers, assembly order, admission
  traps, commands) lives in its `.claude/mangle-project.md`.

## Showcase

Good public examples of what Mangle can really do barely exist, so
shipped features are meant to become them. codeNERD
(github.com/theRebelliousNerd/codeNERD) is the premier showcase. When a
Mangle-only feature ships in a public project, index it as
`showcase/<slug>.md` in the format in [showcase/README](showcase/README.md),
and link it here.

Entries:
- [boundary-judge](showcase/boundary-judge.md): Mangle judges the Go code
  that feeds it, and each finding's proof lists the absences it rests on;
  liveness and consumption are least fixpoints (B013, B014).
- [component-label-lattice](showcase/component-label-lattice.md): a merge
  lattice keeps one minimum label per connected component inside the fixpoint.

## Where truth lives

[canonical-sources](references/canonical-sources.md) gives the authority
order, which upstream file answers which question, and where to dig for
ideas (the engine's `examples/` and source). Upstream prose has bugs. The engine's source,
then a lab run, settle every question.

## Maintaining this skill

Anyone who edits this skill (an agent, a session, another harness's copy)
keeps these rules:
- This skill is public. Write what Mangle does, never where you learned
  it: no private project's name, paths, predicates, schemas, internals or
  bug history. Restate a private finding as an engine or language fact
  with its own lab, or leave it out. Only public projects (the engine,
  codeNERD) are named. `npm run check:private` enforces it.
- Every reference, showcase entry and project profile stays under 100
  lines. Split by idea when one grows.
- Every file in the skill is linked from this SKILL.md, in the same change
  that adds it.
- A claim about engine behavior needs a lab run, a `mangle-cli run`, or a
  line of engine source. Unchecked ideas are marked as hypotheses.
- New traps go in [verified-traps](references/verified-traps.md), and new
  ideas or struck items go in
  [pushing-mangle-forward](references/pushing-mangle-forward.md).
- Ideas over syntax: write what Mangle can do and how it composes with Go,
  not a grammar tutorial.
- The source of truth is the MangleLSP repo
  (`skills/mangle-programming/`). Installed plugin copies are read-only.
