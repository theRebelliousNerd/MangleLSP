# Mangle LSP

Language Server Protocol (LSP) implementation for the [Mangle](https://github.com/google/mangle) declarative programming language.

## Features

- **Diagnostics**: Real-time syntax and semantic error reporting
- **Hover**: Information on predicates, builtins, and variables
- **Completion**: Auto-completion for predicates, builtins, variables, and keywords
- **Go to Definition**: Navigate to predicate definitions
- **Find References**: Find all usages of predicates and variables
- **Document Symbols**: Outline view of declarations and clauses
- **Formatting**: Code formatting for Mangle files
- **Rename**: Safe renaming of predicates across the file

## Installation

### VS Code Extension

The easiest way to use the Mangle LSP is through the VS Code extension:

1. Clone this repository
2. Open `packages/mangle-vscode` in VS Code
3. Run `npm install` and `npm run compile`
4. Press F5 to launch the extension in a new VS Code window

### Standalone Server

```bash
cd packages/mangle-lsp
npm install
npm run build
node dist/server.js --stdio
```

## Supported Error Codes

| Code | Description |
|------|-------------|
| E001 | Variables in facts must be ground |
| E002 | Range restriction - head variables must be bound |
| E003 | Variables in negation must be bound elsewhere |
| E004 | Variables in comparisons must be bound |
| E005-E009 | Built-in predicate/function errors |
| E011-E013 | Transform errors |
| E023 | Stratification warning (negation cycles) |
| E024 | Stratification error (unresolvable cycles) |
| E030-E038 | Semantic validation errors |
| E039 | Wildcard in head warning |
| E041 | Private predicate access error |
| E043-E046 | Declaration and arity errors |

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

- 685 passing tests
- Parser, validation, stratification, and all LSP services covered

## License

MIT
