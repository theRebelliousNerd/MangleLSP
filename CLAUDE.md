# Project Intent

This repository exists to contribute to the Google Mangle project:
https://github.com/google/mangle

Primary goals:
- Create TypeScript and Python implementations of Mangle.
- Build a Language Server Protocol (LSP) server and linter for the language.

# Upstream Reference

The most current reference version of Mangle is located at:
`C:\CodeProjects\MangleTSandPython\upstream\mangle`

Use it as the source of truth for parser/AST behavior, semantic analysis,
evaluation, builtins, diagnostics, and tests.

Key upstream files:
| Component | Path | Purpose |
|-----------|------|---------|
| Grammar | `upstream/mangle/parse/gen/Mangle.g4` | ANTLR4 grammar (source of truth) |
| Parser | `upstream/mangle/parse/parse.go` | Visitor-based AST construction |
| AST | `upstream/mangle/ast/ast.go` | Core type definitions (~1400 lines) |
| Analysis | `upstream/mangle/analysis/validation.go` | Semantic validation (~1450 lines) |
| Stratification | `upstream/mangle/analysis/stratification.go` | Negation cycle detection |
| Builtins | `upstream/mangle/builtin/builtin.go` | Built-in predicates/functions |
| Examples | `upstream/mangle/examples/*.mg` | Test files for parser validation |

# Package Structure

The `packages/` directory contains a monorepo with four packages:

```
packages/
├── mangle-ts/      # TypeScript implementation (core)
├── mangle-py/      # Python implementation (standalone)
├── mangle-lsp/     # Language Server Protocol (depends on mangle-ts)
└── mangle-lint/    # CLI linter (depends on mangle-ts)
```

## Dependency Graph

```
mangle-ts (standalone)
    ↓
    ├── mangle-lsp (depends on mangle-ts)
    └── mangle-lint (depends on mangle-ts)

mangle-py (standalone, mirrors mangle-ts structure)
```

## Package Details

### mangle-ts (TypeScript Core)

**Location:** `packages/mangle-ts`
**Status:** Scaffolding only (empty module stubs)
**Package:** `@mangle/mangle-ts`

Module structure mirrors upstream Go:
- `analysis/` - Semantic validation
- `ast/` - AST type definitions
- `builtin/` - Built-in predicates/functions
- `engine/` - Query engine
- `factstore/` - Fact storage
- `functional/` - Functional utilities
- `interpreter/` - Mangle interpreter
- `parse/` - Parser (ANTLR-generated code goes in `parse/gen/`)
- `symbols/` - Symbol management
- `unionfind/` - Union-find data structure

Build: `npm run build` (TypeScript → ES2022)

### mangle-py (Python Core)

**Location:** `packages/mangle-py`
**Status:** Scaffolding only (empty `__init__.py` files)
**Package:** `mangle-py` (PyPI)

Module structure mirrors mangle-ts:
- `src/mangle_py/` - Main package
- Same submodules as mangle-ts
- `parse/gen/` - ANTLR-generated parser output

Build: Uses hatchling (`python -m build`)
Runtime dependency: `antlr4-python3-runtime==4.13.1`

### mangle-lsp (Language Server)

**Location:** `packages/mangle-lsp`
**Status:** Stub (throws "not implemented")
**Package:** `@mangle/mangle-lsp`

Dependencies:
- `@mangle/mangle-ts` (workspace)
- `vscode-languageserver` ^9.0.0
- `vscode-languageserver-textdocument` ^1.0.11

Entry point: `src/server.ts` (currently throws error)

Planned features:
- Syntax error diagnostics
- Semantic error diagnostics (unbound vars, unknown predicates)
- Hover information for predicates/builtins
- Code completion
- Go-to-definition
- Find references
- Document formatting

### mangle-lint (CLI Linter)

**Location:** `packages/mangle-lint`
**Status:** Stub (prints "not implemented", exits 1)
**Package:** `@mangle/mangle-lint`

Binary: `mangle-lint` → `dist/cli.js`
Dependency: `@mangle/mangle-ts` (workspace)

Entry point: `src/cli.ts` (currently exits with error)

Planned features:
- CLI interface for linting `.mg` files
- CI-friendly output formats
- Rule IDs for error categorization

## Implementation Priority

1. **mangle-ts** - Must be implemented first (core parser, AST, analysis)
2. **mangle-lsp** - Depends on mangle-ts for parsing/analysis
3. **mangle-lint** - Depends on mangle-ts, simpler than LSP
4. **mangle-py** - Can be developed in parallel, independent of TS

## Building the Monorepo

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build --workspace=@mangle/mangle-ts
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
