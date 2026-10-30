# MangleLSP

[![Open VSX](https://img.shields.io/open-vsx/v/theRebelliousNerd/mangle-vscode)](https://open-vsx.org/extension/theRebelliousNerd/mangle-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Language Server Protocol (LSP) implementation and VS Code extension for the [Mangle](https://github.com/google/mangle) declarative programming language.

## Features

- **Syntax Highlighting** - Full TextMate grammar support for `.mg` files
- **Diagnostics** - Real-time syntax and semantic error reporting
- **Semantic Analysis** - Variable binding, arity checking, and safety validation
- **Program context** - A file is diagnosed with the declarations of the program the host loads it in: the `.mg` files a Go package `//go:embed`s together, else the `Decl`s beside it (`mangle-cli check --isolated` turns it off)
- **Go boundary findings** - Predicates nothing produces, rules that can never fire, conclusions nothing reads, facts Go asserts with no `Decl` (B-codes, from a background scan of the Go module)
- **Excluding files** - `.mangleignore` (gitignore syntax) or a `# mangle-ignore-file` comment: no problems for deliberately invalid Mangle, highlighting and navigation stay
- **CLI Tools** - Command-line interface for CI/CD integration (SARIF output support)

## Project Structure

```
MangleLSP/
├── mangle-lsp/           # Standalone LSP server library
│   ├── src/              # TypeScript source
│   │   ├── parser/       # ANTLR-based parser
│   │   ├── analysis/     # Validation, bounds checking, lints, diagnostic catalog
│   │   ├── builtins/     # Typed catalog of upstream built-ins
│   │   ├── services/     # Hover, completion, definition, formatting, ...
│   │   └── cli.ts        # CLI entry point
│   ├── test/fixtures/upstream/  # Upstream conformance programs (Apache-2.0)
│   └── Mangle.g4         # ANTLR grammar (identical to upstream)
├── mangle-vscode/        # VS Code extension
│   ├── src/              # Extension client source
│   ├── server/           # esbuild bundles of the LSP server and CLI
│   └── syntaxes/         # TextMate grammar
└── docs/
    ├── DIAGNOSTICS.md    # Generated reference of every diagnostic code
    └── CLI-API.md        # CLI, VS Code API and custom LSP requests
```

## Installation

### Claude Code plugin

```
/plugin install mangle --marketplace theRebelliousNerd/MangleLSP
```

The `mangle` plugin brings:
- the language server for `.mg` files;
- `mangle-cli` on the shell's PATH;
- an engine check after every `.mg` edit, which reports only the errors
  the edit introduced;
- the `mangle-programming` skill;
- the `mangle-logic-architect` agent. It profiles each project into
  `.claude/mangle-project.md` on first use, then works experiment-first.

It needs Node. Engine-backed checks also need Go: the engine runner,
`mangle-oracle`, is built on first use against the engine version the
project pins.

### From Open VSX

Install from [Open VSX Registry](https://open-vsx.org/extension/theRebelliousNerd/mangle-vscode)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/theRebelliousNerd/MangleLSP.git
cd MangleLSP

# Install dependencies
npm install

# Build everything
npm run build

# Package the VS Code extension
npm run package
```

The `.vsix` file will be created in the `mangle-vscode/` directory.

### Install the Extension

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Install from VSIX"
4. Select the generated `.vsix` file

## Development

```bash
# Watch mode for development
npm run watch

# Build LSP server only
npm run build:lsp

# Build VS Code extension only
npm run build:vscode

# Run tests
npm test

# Explain a diagnostic code
node mangle-vscode/server/cli.bundle.js explain E003
```

### Syncing with upstream Mangle

1. Clone the latest upstream (`git clone https://codeberg.org/TauCeti/mangle-go`).
2. Diff `parse/gen/Mangle.g4` against `mangle-lsp/Mangle.g4`, and `symbols/symbols.go` /
   `builtin/builtin.go` against `mangle-lsp/src/builtins/`.
3. Re-copy `examples/*.mg` and `analysis/test_cases/*.mg` into
   `mangle-lsp/test/fixtures/upstream/`.
4. Bump the engine in `mangle-oracle/go.mod`, run `npm run build:lsp` and
   `npm run conformance:refresh` (writes the engine's verdict on every fixture to
   `mangle-lsp/test/fixtures/conformance/engine-verdicts.json`), then `npm test`: the
   differential suite holds the LSP to the engine's verdicts, and with Go installed it
   re-checks the verdicts live.
5. Update `UPSTREAM_MANGLE_VERSION` / `UPSTREAM_MANGLE_REVISION` in
   `mangle-lsp/src/version.ts` and the CHANGELOG.

## Requirements

- Node.js 18+
- npm 9+
- VS Code 1.75+

## About

<p align="center">
  <a href="https://nextgenrd.com/">
    <strong>🚀 Next-Gen Engineering and Research Development LLC (N.E.R.D.)</strong>
  </a>
  <br>
  <em>Engineering the Future. Today.</em>
</p>

This project is developed and maintained by **[N.E.R.D.](https://nextgenrd.com/)** — a dynamic engineering company founded on the principle of bringing innovative ideas to fruition. We operate with a hybrid model, combining engineering expertise with strategic representation, and harness future technologies through a powerful network of partnerships.

**Creator:** Steve Moore ([@theRebelliousNerd](https://github.com/theRebelliousNerd))

## License

MIT © [Next-Gen Engineering and Research Development LLC](https://nextgenrd.com/)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Related

- [Mangle](https://codeberg.org/TauCeti/mangle-go) - The Mangle language (originally developed at Google, [github.com/google/mangle](https://github.com/google/mangle))
