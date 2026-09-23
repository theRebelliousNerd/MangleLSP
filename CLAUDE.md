# Project Intent

This repository exists to contribute to the Mangle project:
https://codeberg.org/TauCeti/mangle-go (mirror: https://github.com/google/mangle)

Primary goals:
- Create TypeScript and Python implementations of Mangle.
- Build a Language Server Protocol (LSP) server and linter for the language.

# Upstream Reference

Upstream Mangle is developed at **https://codeberg.org/TauCeti/mangle-go**
(module `codeberg.org/TauCeti/mangle-go`, mirrored at https://github.com/google/mangle).
This repository is synced with upstream commit **`77780a5` (2026-09-19)**; the revision is
recorded in `mangle-lsp/src/version.ts` (`UPSTREAM_MANGLE_REVISION`) and `CHANGELOG.md`.

A local copy may exist at `C:\CodeProjects\MangleTSandPython\upstream\mangle`; otherwise
clone upstream. Use it as the source of truth for parser/AST behavior, semantic analysis,
evaluation, builtins, diagnostics, and tests.

Key upstream files:
| Component | Path | Purpose |
|-----------|------|---------|
| Grammar | `parse/gen/Mangle.g4` | ANTLR4 grammar (source of truth; identical to `mangle-lsp/Mangle.g4`) |
| Parser | `parse/parse.go` | Visitor-based AST construction |
| AST | `ast/ast.go`, `ast/decl.go`, `ast/temporal.go` | Core types, modes, temporal types |
| Rule checks | `analysis/rulecheck.go` | Binding/mode checks (CheckRule) |
| Bounds checking | `analysis/boundscheck.go`, `analysis/infercontext.go` | Type (bounds) inference and checking |
| Decl checks | `analysis/declcheck.go` | Declaration well-formedness |
| Rewriting | `analysis/rewriteclause.go` | Negation delay |
| Stratification | `analysis/stratification.go` | Negation cycle detection |
| Symbols & types | `symbols/symbols.go`, `symbols/typeexprs.go` | Builtin names/arities, type expressions |
| Builtins | `builtin/builtin.go`, `functional/functional.go` | Modes, type signatures, runtime behavior |
| Examples | `examples/*.mg`, `analysis/test_cases/*.mg` | Vendored as conformance fixtures in `mangle-lsp/test/fixtures/upstream/` |

# Repository Structure

```
mangle-lsp/        # LSP server + CLI (TypeScript, implemented)
  src/parser/      # ANTLR parser and AST (gen/ is generated from Mangle.g4)
  src/analysis/    # validation, bounds checking (boundscheck.ts), lints, stratification,
                   # type expressions (types.ts), diagnostic catalog (diagnostics.ts),
                   # shared pipeline (pipeline.ts)
  src/builtins/    # typed catalog of upstream builtin functions and predicates
  src/services/    # hover, completion, definition, references, symbols, formatting, rename
  src/cli/         # mangle-cli commands and formatters (json/text/sarif)
  test/            # vitest suites, incl. test/conformance (upstream examples)
mangle-vscode/     # VS Code extension; server/*.bundle.js are esbuild bundles of mangle-lsp/src
docs/              # DIAGNOSTICS.md (generated), CLI-API.md
```

`packages/` (mangle-ts / mangle-py ports) is a separate, gitignored monorepo and is not part
of this repository.

## Rules for changes

- Every diagnostic code must be in `mangle-lsp/src/analysis/diagnostics.ts` with an
  explanation and fix (plus a bad/good example where useful); regenerate `docs/DIAGNOSTICS.md` with
  `node mangle-vscode/server/cli.bundle.js explain --markdown > docs/DIAGNOSTICS.md`
  (a test fails if it is stale). Never reuse a code for a different meaning.
- Diagnostics should carry a `hint` (and `fixes` when the edit is unambiguous): they are read by
  people and coding agents who do not know Mangle.
- Type checks must only report provable mismatches (`isDisjoint`), never unknowns.
- After changing `mangle-lsp/src`, run `npm run build` at the root so the committed bundles in
  `mangle-vscode/server/` stay in sync.

## Building and testing

```bash
npm install          # root (npm workspaces: mangle-lsp, mangle-vscode)
npm run build        # regenerate parser, tsc, bundle extension + server + CLI
npm test             # vitest in mangle-lsp
```

# Skills

Skills are located in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| `mangle-programming` | Mangle language reference (encyclopedic) |
| `mangle-lsp` | LSP implementation guidance |
| `skill-creator` | Guide for creating new skills |

# Communication Guidance for Agents

When creating or updating Codex skills in this repository, be verbose in your
output. Include the reasoning, steps taken, and the files changed or added.

# Skill Authoring Guidance

When authoring skills for this repository, prefer encyclopedic coverage in
`references/` with progressive disclosure from `SKILL.md`. Err on the side of
completeness: capture edge cases, error messages, upstream behavior notes, file
maps, and parity details. Create many focused reference files rather than
leaving gaps, and make `SKILL.md` a concise map that points to those references.
