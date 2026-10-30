# Changelog

All notable changes to the Mangle language server (`mangle-lsp`), CLI (`mangle-cli`)
and VS Code extension (`mangle-vscode`).

## Unreleased

### Review false positives

- Go Fact literals count as assertions only when their values flow to an
  assertion call. The scan follows aliases, slices, function parameters and
  return slots, closures and struct fields. Routing envelopes, returned
  visualization fixtures and retraction keys no longer trigger B004 solely
  because they share a Fact type with stored relations. Real assertions still
  receive arity and constant-type checks, including values used for both routing
  and assertion.
- Review discovers programs at host load calls, following concatenated embeds,
  source-returning helpers, embedded-filesystem reads and string builders.
  Loads on the same engine receiver accumulate into one program, including
  schema loads in helpers passed that engine. Receiver aliases and return slots
  retain identity; separate engines and constructor invocations retain separate
  program contexts. Files follow host call order, including helper loads. An
  embedded filesystem's unused policies are not added to a schema-only load.
  A fragment included in a discovered program is no longer judged separately
  when that program covers its embed group. Profiles can configure
  `programLoadMethods`.
- Retire E046's name-only declaration/clause comparison: name and arity identify
  independent predicates, and an input Decl needs no defining rule. E040 still
  reports body calls whose exact predicate is undefined. Keep E046 reserved in
  the diagnostic catalog for consumers of older reports.
- Add Go flow, program-assembly and engine regression cases, plus validator and
  CLI review regressions. Existing producer fixtures now explicitly assert
  their returned facts.

## 1.3.0 — 2026-10-29

### A file is diagnosed in its program

A `.mg` file is rarely a program of its own, so diagnosing it alone reported false errors
(a comparator rule next to the `Decl` that gives it modes: 4 E002 and 4 E004). The editor,
`mangle-cli check`, `batch` and `review` now analyze a file in the context the host loads
it with, and still report only that file's problems, in its own lines:

- **embed:** the `.mg` files a Go package `//go:embed`s together (several files, same
  variable) are one program, analyzed whole, exactly as `review` always did. The embed
  directives are read in TypeScript the way the Go toolchain reads them (globs per path
  element, directories walked without dot and underscore entries, `all:`), from the
  package of the file up to its `go.mod`.
- **directory:** a file no embed groups with others sees the `Decl`s (modes, bounds, merge,
  deferred, external) of the `.mg` files beside it. Rules do not leak across files that may
  be unrelated; a `Decl` the file repeats wins over the neighbour's.
- **alone:** nothing else to see. `check --isolated` (and `review --isolated`) restores the
  old behaviour.
- Each file is parsed on its own and the units are merged by line range, so a syntax error
  in one file can no longer swallow the first statement of the next (the concatenated text
  used to). Open buffers are used instead of saved files, parse trees of neighbours are
  cached, one analysis of a program serves every file in it, and every cache is keyed by
  file signatures: a changed neighbour, a new file in an embedded directory or an edited
  `go:embed` line invalidates exactly what read it. The open files of a program are checked
  again when one of them changes. On a 167-file, 1.5 MB embed program an edit re-analyzes
  in about 0.4 s.

### Excluding deliberately invalid Mangle

- **`.mangleignore`** (gitignore syntax; patterns relative to the file's directory, a nearer
  file overrides a farther one) and the file-level comment **`# mangle-ignore-file`**. Both
  are honoured by the server, `check` (`--no-ignore` overrides; the summary counts
  `ignoredFiles`), `batch` and `review`. An ignored file keeps syntax highlighting and
  navigation, gets no problems, and is never used as context for its neighbours.

### Rules that can never fire, conclusions nothing reads (B013, B014)

`mangle-oracle`'s boundary program now computes two least fixpoints on the engine: a
predicate is **live** when a fact of it can exist (Go asserts it, a callback answers it, Go
names it as a possible producer) or a rule for it can fire, and a rule fires when every
positive body atom is live; a predicate is **needed** when Go queries it or a needed rule
reads it. Both are positive recursion over a `chain(Rule, Index)` relation, with the
complement taken once afterwards (no negation inside the fixpoint).

- **B013** a rule that can never fire because a positive premise is starved, directly or
  through rules that are themselves blocked. Names the blocking premise; the proof lists the
  absences it rests on. Negated premises never block.
- **B014** a predicate derived by rules that no rule premise (positive or negated) of a
  needed predicate reads and no Go query names. A bare string literal elsewhere does not
  count as a read; ground-fact tables are not conclusions.
- The editor shows the findings anchored at `.mg` files as warnings, from a background scan
  of the enclosing Go module (child process, one scan per module at a time, debounced;
  setting `mangle.enableBoundaryAnalysis`); `review` already lists every B-code.
- The boundary program runs on an indexed fact store (the plain store scanned every row per
  join: the new rules did not finish on a 20k-rule repository, and finish in seconds with it).
- The `codenerd` profile lists that project's query helpers.

### Also

- `check` JSON output: `summary.ignoredFiles` (additive).
- `mangle-lsp` depends on `ignore`.

## 1.2.0 — 2026-10-28

Tracks the tagged upstream release **v0.7.0** (`7cd2543`, 2026-10-15) of
<https://codeberg.org/TauCeti/mangle-go>. The LSP now names the release first and the
commit second, because a host pins the release in `go.mod`. The engine itself is now
ground truth: **mangle-oracle** (`mangle-oracle/`, a standalone Go module) runs it, and
the test suite holds the LSP to its verdicts.

### Ground truth: differential conformance with the engine

- **`mangle-cli conformance`** puts the LSP's verdict next to the engine's (parse, loose
  analysis, strict bounds, evaluation), per file or for one assembled program, and
  classifies each case (agree, LSP warns with the reason, false positive, miss).
- **The suite runs it.** `test/fixtures/conformance/engine-verdicts.json` holds the
  engine's verdict on 48 programs: the v0.7 `examples/` and `analysis/test_cases/`
  (vendored again: a root-level `upstream/` ignore rule had kept them out of git), and 22
  probe programs that pin v0.7 behaviour. 46 agree; the 2 known disagreements are listed
  with reasons. With Go installed the verdicts are recomputed live.
- `npm run conformance:refresh` re-records the verdicts after an engine bump.

### v0.7 alignment

- **`!=` waits for its variables, as negation does** (v0.7 `RewriteClause`), so its
  position in the body no longer matters: no more E004 on `R != /x, p(X, R)`. A `!=` or
  negation that nothing binds is kept at the end and rejected, as in v0.7 (it used to be
  dropped silently).
- **E003 covers `_` in a negation.** v0.7 replaces each `_` with a fresh variable, so
  `!r(X, _)` is rejected ("variable X0 is not bound"). The quick fix writes the
  projection (`has_r(X) :- r(X, _).`) and negates it. The old hint that suggested `_`
  is gone.
- **E030 reports only real pattern errors.** A string-test pattern may be a variable
  bound earlier or a function (v0.7 substitutes and evaluates it); a constant of another
  type is a run-time error and is still reported. `:match_prefix` still needs a name
  constant (a variable prefix fails strict type checking).
- **`:string:matches`** (new in v0.7) is known.
- **Syntax-error recovery.** Clauses and Decls with a syntax error inside them, or with
  holes left by recovery, are marked malformed: analysis skips them (no crashes, no
  follow-on noise), while formatting and other editor services still see them. A name
  constant that swallowed the clause's final `.` (`X = /a.`) gets its own error at the
  right place.
- **New diagnostics, each verified on v0.7:**
  - **E081** a negated external predicate never calls its Go callback
    (`engine/premise.go`); quick fix: call it positively in a helper rule built from the
    rule's own premises, and negate the helper.
  - **E082** a bound strict checking can never satisfy: `fn:Singleton` unions (the checker
    types `/high` as `/name`) and `/bool`, which in a bound is the name-prefix type of
    `/bool/...` names.
  - **E083** a zero-arity Decl without `bound []` fails strict bounds checking
    ("no bound decls"); quick fix adds `bound []`.
  - **E084** `:string:matches` has no type signature in v0.7.0, so strict checking
    rejects it.

### Where .mg meets Go: `mangle-cli boundary`

- mangle-oracle scans the Go module with go/ast (Fact literals, Assert/AddFact calls,
  helpers whose parameter becomes the predicate, facts written as text, queries,
  external-callback registrations, `//go:embed` program sets) and the .mg files with the
  engine's own parser. A Mangle program, `mangle-oracle/boundary.mg`, analyzed with strict
  bounds, judges the facts; every finding carries its proof (the facts it rests on and
  the facts whose absence it rests on).
- **B001–B012:** a rule reads a predicate nothing produces (B001, or B012 when Go only
  mentions the name); dead Decls (B002); Go asserts an undeclared predicate (B003) or the
  wrong arity (B004); Go queries an undefined predicate (B005); asserted but never read
  (B006); Go builds the wrong constant type for a column (B007: float64 for /number,
  `MangleAtom` or a "/x" literal for /string, a plain literal for /name); external Decl
  without callback (B008), callback without Decl (B009), modes disagree (B010), negated
  external with the callback that never runs (B011).
- **Host profiles** say how a host's Go builds facts; built-ins `generic` and `codenerd`,
  or a project's `.mangle/oracle-profile.json`.
- **Engine version follows the project.** The oracle is built against the
  `codeberg.org/TauCeti/mangle-go` version the project's go.mod requires, else the
  pinned v0.7.0 (and the output says why).

### Advice: what Mangle could do here (A-codes, `mangle-cli advise`)

- **A001** `fn:max`/`fn:min` per group joined back to the source: a `fundep` + `merge`
  lattice (quick fix writes it; same winners on the engine).
- **A002** three or more `*_event`-style predicates: one `fn:TaggedUnion` relation.
- **A003** a premise tests a constant no writer of that column produces (a typo such as
  `/hihg`), with the closest written value as the fix and an invariant relation as the
  contract (union-of-singleton bounds cannot do it in v0.7: E082).
- **A004** freshness by comparing timestamps with a clock fact: temporal facts and
  `<-[0s, 24h]`.
- **A005** `fn:collect(fn:pair(K, V))`: `fn:collect_to_map(K, V)` (quick fix).
- **A006** all paths, then `fn:min`/`fn:max`: a merge lattice. On a 5-edge cycle the
  all-paths version runs 38 s to the 100k fact limit; the lattice version terminates.

### Agent-grade CLI

- **`mangle-cli review`**: a whole repository in one JSON document: programs assembled
  from `//go:embed` and analyzed as one program each (cross-file Decls, externals and
  stratification), the engine's verdict per program, the boundary findings, and a
  numbered plan, most severe first, with edits when unambiguous and a verify command.
- **`mangle-cli run`** evaluates on the engine and explains a fact with its proof, through
  let/do transforms (recorder mode). **`mangle-cli whynot`** says why a goal is not
  derived: it writes one probe rule per body prefix, evaluates once, and reports the rows
  that survive each premise, naming the first that leaves none.
- Multi-edit quick fixes (`additionalEdits`) in the LSP, CLI JSON and plans.
- **Fixed: piped output was truncated at 64 KiB.** The CLI called `process.exit()` while
  stdout was a pipe; commands now return exit codes.

## 1.1.0 — 2026-09-23

Synced with upstream Mangle **`77780a5` (2026-09-19)**
(<https://codeberg.org/TauCeti/mangle-go>, mirrored at <https://github.com/google/mangle>).
The previous sync was mid-February 2026. The grammar is unchanged upstream; the
changes are in built-ins, type expressions and analysis.

### Upstream parity

- **New built-ins:** `fn:mod`; `fn:time:add_civil`, `fn:time:trunc_civil` and
  `fn:time:weekday_civil`; the `fn:duration:{min,max,sum}` and `fn:time:{min,max}`
  reducers; the `:float:{lt,le,gt,ge}` comparisons; and the `fn:TaggedUnion` /
  `.TaggedUnion<...>` type constructor.
- **`:list:member` is now mode `(?, +)`.** The element may already be bound (upstream #94).
- **Every built-in carries its upstream type signature, parameter names, an example
  and related built-ins.** These show in hover, completion and diagnostics. The docs
  are fixed where they were wrong, e.g. `fn:time:format_civil` takes
  `(Time, TimeZone, Unit)`, and `fn:time:trunc` no longer accepts calendar units.
- **Declared modes are honoured, as in upstream `rulecheck.go`:**
  - `'+'` head arguments count as bound.
  - Mode-declared body atoms bind only their `-`/`?` positions.
  - Output arguments of built-ins must be fresh variables (**E065**).
  - Variables that are never bound are reported (**E066**).
  - This removes false positives on upstream `examples/shortest_path.mg` and
    `analysis/test_cases/fun.mg`.
- **Full recursive well-formedness of `bound [...]` type expressions (E061).** This
  covers constructor arities, struct field shapes, function types and tagged-union
  rules. It removes false positives on `examples/tagged_union.mg`.
- **A conservative bounds (type) checker ported from upstream `boundscheck.go`** and
  `infercontext.go`. It reports only provable mismatches:
  - built-in function argument (**E068**),
  - built-in or declared predicate argument (**E069**),
  - fact vs declaration (**E070**),
  - rule head vs declaration (**E071**),
  - conflicting variable types (**E072**),
  - equality between disjoint types (**E073**).

  It catches upstream's `neg_plusarg.mg` and `neg_polymorphic_match.mg`.
- **E041 fires only for cross-package use of `private()` predicates**, matching
  upstream `checkVisibility`.
- **Negations whose variables are never bound are now reported as E003.** Upstream
  `RewriteClause` silently drops such a negation, e.g. `orphan(X) :- person(X),
  !parent(Y, X).` quietly derives every person.

### Diagnostics built for readers new to Mangle

- **A diagnostic catalog (`src/analysis/diagnostics.ts`).** Every code has a title,
  category, explanation, fix and a before/after example.
  [`docs/DIAGNOSTICS.md`](docs/DIAGNOSTICS.md) is generated from it.
- **Diagnostics carry an instance-specific `hint`** and, where possible,
  machine-applicable `fixes`. Hints include:
  - "did you mean" suggestions for predicates, functions, built-in predicates,
    descriptors and time units,
  - conversions for type errors (`fn:duration:from_seconds(N)`, `:float:lt`, …),
  - concrete reorder suggestions for performance lints,
  - Prolog/SQL-habit hints on syntax errors (`not`, `;`, `\+`, lowercase variables,
    missing `.`).
- **New advice lints:**
  - **E074** — singleton variables, with typo detection.
  - **E075** — undefined predicates, reported once each, with suggestions.
  - **E076** — `fn:collect` + `fn:list:len` → `fn:count()`.
  - **E077** — duplicate premises.
  - **E078** — unknown `descr` atoms, which upstream silently ignores.
  - **E079** — malformed `mode(...)`, which upstream silently ignores.
  - **E080** — `_` in a multi-premise aggregation body. Upstream drops those columns
    before aggregating, so rows that differ only there are merged and under-counted.
  - E074 is not reported in aggregating rules, where a single-use variable keeps rows
    apart.
- **The performance lints E019, E021 and E022 are binding-aware.** They account for
  variables bound by built-ins and equalities, and name the premise to move. This
  removes false positives on upstream `flow_checking.mg`.
- **Hallucinated-function hints are updated to today's built-in library** (e.g.
  `fn:contains` → `:string:contains`, `fn:modulo` → `fn:mod`). Many common
  cross-language mistakes are added.
- **Duplicate reports for one problem are removed** (e.g. E004 + E007 + E010 on the
  same unbound variable).
- **Diagnostic codes are unique again.** The temporal recursion codes are renumbered
  **E048/E049/E050 → E062/E063/E064**; they collided with the transform codes.
  **E013 is retired:** its reducer advice is now part of E047's hint.

### Language server

- **One shared analysis pipeline** for the server, `mangle-cli check` and batch
  queries, so the editor and CI report the same diagnostics.
- **Diagnostics carry more metadata:**
  - LSP diagnostics include `help:` text and a `codeDescription` link to the code's
    documentation.
  - **Quick-fix code actions** apply the fixes.
  - A new `mangle/explain` request returns the catalog entry for a code.
- **Fixed:**
  - `mangle/batchLookup` (diagnostics), `mangle/getFileInfo`, `mangle/checkAll` and
    `mangle/checkFiles` sent `mangle/getDiagnostics` to the *client* instead of
    computing it, so they never worked.
  - Hover now works on functions inside equalities (`X = fn:...`).
- **Hover and completion show typed signatures**, units, examples and related
  built-ins. Completion snippets use real parameter names.

### CLI

- **New `mangle-cli explain <CODE>` command**, plus `--list`, `--all` and
  `--markdown`.
- **`check --explain`** includes the full explanation of every code.
- **Richer output:** text output prints `= help:` and `= fix:` lines, and JSON
  output carries `title`, `category`, `hint`, `fixes` and `docs`. The result schema
  is now `version: "1.1"`, and the change is additive.
- **SARIF rules come from the catalog.** They include the full description, help
  text with an example, `helpUri` and a category. SARIF results carry `fixes`.
- **Fixed:** boolean flags (`--check`, `--diff`, `--write`, `--include-declaration`,
  …) no longer swallow the file argument that follows them.

### VS Code extension

- **New command "Mangle: Explain Diagnostic Code"**, plus `mangle.api.explain`.
- **Syntax highlighting** for `fn:List`-style type constructors, base types
  (`/number`, `/time`, …), more descriptor keywords and `⟸`.
- **The server and CLI bundles are built with esbuild directly from
  `mangle-lsp/src`.** Previously they were built from a hand-copied `server/` tree
  that no script refreshed. That stale tree of per-file compiled output is removed;
  only the two bundles are committed.

### Tests

- **940 tests** (up from 809).
- **An upstream conformance suite.** Upstream's `examples/*.mg` and
  `analysis/test_cases/*.mg` are vendored under `mangle-lsp/test/fixtures/upstream`
  (Apache-2.0). Programs upstream accepts must have no errors, and programs it
  rejects must have errors.
- **A catalog invariant test:** every emitted code is documented, and
  `docs/DIAGNOSTICS.md` must match the generated reference.

## 1.0.0

Initial release: parser, semantic validation, stratification, hover, completion,
definition, references, symbols, formatting, rename, CLI and VS Code extension.
