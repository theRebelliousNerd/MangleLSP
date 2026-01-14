# MangleLSP

[![Open VSX](https://img.shields.io/open-vsx/v/theRebelliousNerd/mangle-vscode)](https://open-vsx.org/extension/theRebelliousNerd/mangle-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Language Server Protocol (LSP) implementation and VS Code extension for the [Mangle](https://github.com/google/mangle) declarative programming language.

## Features

- **Syntax Highlighting** - Full TextMate grammar support for `.mg` files
- **Diagnostics** - Real-time syntax and semantic error reporting
- **Semantic Analysis** - Variable binding, arity checking, and safety validation
- **CLI Tools** - Command-line interface for CI/CD integration (SARIF output support)

## Project Structure

```
MangleLSP/
├── mangle-lsp/           # Standalone LSP server library
│   ├── src/              # TypeScript source
│   │   ├── parser/       # ANTLR-based parser
│   │   ├── analysis/     # Semantic analysis
│   │   └── cli.ts        # CLI entry point
│   └── Mangle.g4         # ANTLR grammar
└── mangle-vscode/        # VS Code extension
    ├── src/              # Extension client source
    ├── server/           # Bundled LSP server
    └── syntaxes/         # TextMate grammar
```

## Installation

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
```

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

- [Mangle](https://github.com/google/mangle) - The original Mangle language by Google
