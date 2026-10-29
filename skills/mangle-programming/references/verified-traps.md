# Verified traps on the pinned engine (v0.7.0)

Each line below was checked on the engine in this repo, not recalled from
memory. Re-run a lab before trusting anything not listed here, and add
every new trap you find.

## Names and functions

- Reducers are lowercase: `fn:count()`, `fn:sum(V)`, `fn:max(V)`.
  `fn:Count()` is rejected as an unknown function.
- There is no `fn:pair:fst` / `fn:pair:snd`. Destructure with
  `:match_pair(P, First, Second)`.
- Pattern built-ins: `:match_cons`, `:match_nil`, `:match_pair`,
  `:match_entry`, `:match_field`, `:match_prefix`, `:list:member(Elem, List)`
  (enumerates or checks). List functions: `fn:list:get/len/append/contains/cons`.
  `fn:map:get` is evaluated at run time but missing from the type table, so
  analysis rejects it as unknown: use `:match_entry`. Strict bounds checking
  **panics** (`boundscheck.go:357`) on `:match_entry` over an `/any` column:
  bound it `fn:Map(K, V)`. There is no API to register custom `fn:` functions.
- The output slot of a `:match_*` premise must be a free variable.
  `:match_field(E, /kind, /login)` is rejected. Bind the variable, then
  compare: `:match_field(E, /kind, K), K = /login`.

## Negation

- Negation is `!p(X)`. There is no `not`, and `!` is not a Prolog cut.
- A negated literal must be fully bound. `!r(X, _)` is an analysis error
  ("variable X0 is not bound"). Project first:
  `has_r(X) :- r(X, Y).` then `!has_r(X)`.
- `!` and `!=` wait for their variables (v0.7 `RewriteClause`), so their
  position doesn't matter: `q(X) :- R != /y, p(X, R).` works. `<`,
  `:float:lt`, string tests and `fn:` arguments do not wait: their inputs
  need an earlier binder. An older engine (v0.5.1 pseudo-version) does not
  delay `!=`: that same rule derives nothing there.

## Types and termination

- Decl bounds are **not checked** by `analysis.AnalyzeOneUnit`, which is
  the entry point most embedders use (codeNERD's kernel among them). A
  rule can put `/medium` into a `/number` column and analysis says nothing.
  Only `AnalyzeAndCheckBounds(..., ErrorForBoundsMismatch)` checks bounds.
  In codeNERD that runs only for generated candidate rules
  (`internal/core/kernel_rule_bounds.go`). The lab harness turns it on;
  `mangle-cli review` reports every mismatch, where the engine stops at the first.
- **Singleton bounds are unusable in v0.7.** Under strict checking every
  constant is typed by its base type (`/high` is `/name`), so a
  `fn:Singleton` or union-of-singletons column rejects *correct* facts and
  rules too; loose checking ignores it. Enforce a vocabulary with a
  `valid_x` relation and a `bad_x(V) :- x(V), !valid_x(V).` invariant.
  `fn:TaggedUnion` is fine: its tags are typed `/name`.
- `/bool` in a bound is the name-prefix type of `/bool/...` names, not a
  boolean: `b(/true)` fails strict checking. Declare `/name`.
- A zero-arity Decl needs `bound []`: `Decl ok().` fails strict checking
  ("no bound decls"). `:string:matches` (new in v0.7) has no type signature
  in `symbols.go`, so strict checking rejects every use of it.
- Termination is **not** guaranteed by analysis. `n(Y) :- n(X), Y = fn:plus(X, 1).`
  analyzes fine and runs until the fact limit
  ("fact size limit reached 100001 > 100000"). Once a program has
  functions, keeping it finite is your job.

## Time and tooling

- Temporal programs analyze fine but need a temporal store at evaluation
  time. An embedder without one fails ("temporal literal encountered but no
  temporal store configured"). Use the lab harness or `mangle-cli run --at`.
- `mangle-cli run file.mg --query p` is the fast engine probe. Add
  `--why 'p(/a)'` for a proof, or use `mangle-cli whynot` for a missing fact.
- Post-hoc proofs (`provenance.Explain`) find no proof for a fact that
  came out of a `do` transform; recorder mode (`BuildFromRecording`) does.

## Built-ins and syntax

- A string-test pattern may be a variable bound earlier or a function: v0.7
  substitutes and evaluates it. A name pattern (`/ab`) is a run-time error.
  `:match_prefix` needs a literal name; a variable prefix fails strict checks.
- A name constant may contain `.`, so `X = /a.` at the end of a rule eats
  the clause's period. Write `X = /a .` or put another premise last.
- Timestamp literals (`2024-01-09T12:00:00Z`) are only legal inside `@[...]`.

## Stores and lattices

- Every in-memory store implements `Remove`, so merge lattices replace
  facts; the temporal-store adapter doesn't, so there both facts stay.
- Hosting a lattice: hand the engine the merge and deferred rules (subset
  evaluation drops them), name the merge's inputs in the lattice rule's body,
  and keep merges total preorders (`lattices-and-merge.md`).
- A lattice shortest path on a cyclic graph terminates (5 edges: 16
  facts, instant); all paths + `fn:min` runs 38 s to the 100k fact limit.

## Aggregation

- A `do` head variable must be a group key or an aggregate. Anything else
  is rejected ("neither part of group_by nor aggregated").
- `let` without `do` is a per-row transform: `|> let P2 = fn:list:append(P, Z).`
- The upstream aggregation tutorial has bugs: `fn:sum(TotalHours)` where it
  means `Hours`, and a stray `.` mid-rule. Upstream prose is evidence, not
  ground truth. Probe it.
