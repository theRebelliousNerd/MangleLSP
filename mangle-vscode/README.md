# Mangle Language Support for VS Code

This extension provides language support for [Mangle](https://github.com/google/mangle), a Datalog-inspired declarative programming language.

## Features

- Syntax highlighting for `.mg` files
- Real-time error diagnostics
- Hover information for predicates and builtins
- Auto-completion
- Go to definition
- Find all references
- Document outline
- Code formatting
- Rename refactoring

## Installation

### From Source

1. Clone the repository
2. Run `npm install` in both `packages/mangle-lsp` and `packages/mangle-vscode`
3. Run `npm run build` in `packages/mangle-lsp`
4. Run `npm run compile` in `packages/mangle-vscode`
5. Open `packages/mangle-vscode` in VS Code and press F5

### Package as VSIX

```bash
cd packages/mangle-vscode
npm run package
```

This creates a `.vsix` file you can install with:
```bash
code --install-extension mangle-vscode-1.0.0.vsix
```

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `mangle.maxNumberOfProblems` | Maximum problems per file | 100 |
| `mangle.enableSemanticAnalysis` | Enable semantic checks | true |
| `mangle.trace.server` | LSP communication tracing | off |

## Requirements

- VS Code 1.75.0 or higher
- Node.js 18 or higher

## License

MIT
