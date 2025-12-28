# MangleLSP

Language Server Protocol (LSP) implementation and VS Code extension for the [Mangle](https://github.com/google/mangle) declarative programming language.

## Features

- **Syntax Highlighting** - Full TextMate grammar support for `.mg` files
- **Diagnostics** - Real-time syntax and semantic error reporting
- **Semantic Analysis** - Variable binding, arity checking, and safety validation

## Project Structure

```
MangleLSP/
├── server/          # LSP server implementation
│   ├── src/         # TypeScript source
│   │   ├── parser/  # ANTLR-based parser
│   │   ├── analysis/ # Semantic analysis
│   │   └── server.ts # LSP server entry point
│   └── Mangle.g4    # ANTLR grammar
└── client/          # VS Code extension
    ├── src/         # Extension source
    └── syntaxes/    # TextMate grammar
```

## Installation

### From VS Code Marketplace

*(Coming soon)*

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

The `.vsix` file will be created in the `client/` directory.

### Install the Extension

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Install from VSIX"
4. Select the generated `.vsix` file

## Development

```bash
# Watch mode for development
npm run watch

# Build server only
npm run build:server

# Build client only
npm run build:client
```

## Requirements

- Node.js 18+
- npm 9+
- VS Code 1.75+

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Related

- [Mangle](https://github.com/google/mangle) - The original Mangle language by Google
