# Changelog

All notable changes to the Mangle language server (`mangle-lsp`), CLI (`mangle-cli`)
and VS Code extension (`mangle-vscode`).

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
