# Mangle LSP

Language Server Protocol (LSP) implementation and CLI for the [Mangle](https://codeberg.org/TauCeti/mangle-go) declarative programming language, synced with upstream `77780a5` (2026-09-19).

## Features

- **Diagnostics**: Syntax, safety, mode, stratification and type (bounds) checking, each with an explanation, an instance-specific hint and quick fixes where possible
- **Quick fixes**: Code actions for miscased/unknown functions, typos in predicates and variables, time units, `fn:count()` rewrites
- **Hover**: Typed signatures, examples and related built-ins for every upstream built-in; predicates and variables
- **Completion**: Predicates, built-ins (with parameter-name snippets), variables and keywords
- **Go to Definition**: Navigate to predicate definitions
- **Find References**: Find all usages of predicates and variables
- **Document Symbols**: Outline view of declarations and clauses
- **Formatting**: Code formatting for Mangle files
- **Rename**: Safe renaming of predicates across the file

## Installation

### VS Code Extension

The easiest way to use the Mangle LSP is through the VS Code extension:

1. Clone this repository
2. Run `npm install` and `npm run build` at the repository root
3. Open `mangle-vscode` in VS Code and press F5 to launch the extension

### Standalone Server

```bash
npm install
npm run build:lsp
node mangle-lsp/dist/server.js --stdio
```

## Diagnostics

Every code is documented in [docs/DIAGNOSTICS.md](../docs/DIAGNOSTICS.md) (generated from
`src/analysis/diagnostics.ts`) and on the command line:

```bash
mangle-cli explain E002        # one code
mangle-cli explain --list      # all codes
mangle-cli check --explain f.mg
```

| Range | Category |
|-------|----------|
| P001 | Syntax errors (with hints for Prolog/SQL habits) |
| E001-E004, E065, E066 | Safety: ground facts, range restriction, negation, comparisons, modes |
| E005-E010, E014, E018, E020, E030-E035, E067 | Built-in predicates and functions |
| E068-E073 | Types (bounds checking, as upstream `ErrorForBoundsMismatch`) |
| E011, E012, E036, E037, E043, E045, E047-E050, E060 | Transforms and aggregation |
| E024-E026, E031, E040, E041, E044, E046, E051-E057, E061, E075, E078, E079 | Declarations |
| E015-E017 | Stratification and recursion |
| E058, E059, E062-E064 | Temporal (DatalogMTL) |
| E019, E021-E023, E076, E077, E080 | Performance and aggregation advice |
| E027, E032, E038, E039, E074 | Style and literals |

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Generate parser from grammar
npm run generate-parser
```

## Test Coverage

- 940 passing tests
- Parser, validation, bounds checking, lints, stratification, CLI and all LSP services
- Upstream conformance: upstream's own `examples/*.mg` and `analysis/test_cases/*.mg`
  (vendored in `test/fixtures/upstream`) must be accepted/rejected exactly as upstream does

## License

MIT
