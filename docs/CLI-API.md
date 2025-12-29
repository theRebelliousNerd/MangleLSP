# Mangle CLI & API Documentation

This document describes the CLI tool and programmatic APIs for accessing Mangle LSP features. These interfaces are designed for integration with coding agents and CI/CD pipelines.

## Table of Contents

- [CLI Tool](#cli-tool)
  - [Installation](#installation)
  - [Commands](#commands)
  - [Output Formats](#output-formats)
- [VS Code Extension API](#vs-code-extension-api)
  - [Commands](#vs-code-commands)
  - [Programmatic API](#programmatic-api)
- [LSP Custom Requests](#lsp-custom-requests)
- [SARIF Integration](#sarif-integration)

---

## CLI Tool

### Installation

```bash
# From the repository
cd mangle-lsp
npm run build
npm link

# Or run directly
npx mangle-cli <command> [options] <files...>
```

### Commands

#### `check` - Run Diagnostics

Check Mangle files for errors and warnings.

```bash
mangle-cli check [options] <files...>

Options:
  --format, -f    Output format: json | text | sarif (default: json)
  --severity      Minimum severity: error | warning | info (default: info)
  --fail-on       Exit non-zero on: error | warning | never (default: error)
  --quiet, -q     Suppress non-essential output
```

**Examples:**

```bash
# Check all files, JSON output (for coding agents)
mangle-cli check src/**/*.mg

# Human-readable output
mangle-cli check --format text src/**/*.mg

# CI mode - fail on any warning
mangle-cli check --fail-on warning src/**/*.mg

# Generate SARIF for GitHub Actions
mangle-cli check --format sarif src/**/*.mg > results.sarif
```

**JSON Output Schema:**

```json
{
  "version": "1.0",
  "files": [{
    "path": "src/rules.mg",
    "diagnostics": [{
      "severity": "error",
      "code": "E001",
      "source": "mangle-semantic",
      "message": "Variables in facts must be ground",
      "range": {
        "start": { "line": 10, "column": 5 },
        "end": { "line": 10, "column": 15 }
      },
      "context": "my_fact(X)."
    }]
  }],
  "summary": {
    "totalFiles": 1,
    "totalErrors": 1,
    "totalWarnings": 0,
    "totalInfo": 0
  }
}
```

#### `symbols` - List Document Symbols

List predicates and declarations in a file.

```bash
mangle-cli symbols [options] <file>

Options:
  --format, -f    Output format: json | text (default: json)
```

**Example:**

```bash
mangle-cli symbols src/main.mg
```

**JSON Output:**

```json
{
  "path": "src/main.mg",
  "symbols": [{
    "name": "my_predicate/2",
    "kind": "predicate",
    "range": {
      "start": { "line": 5, "column": 0 },
      "end": { "line": 5, "column": 25 }
    },
    "selectionRange": { ... }
  }]
}
```

#### `hover` - Get Hover Information

Get documentation/type information at a position.

```bash
mangle-cli hover <file> --line <n> --column <n>

Options:
  --line          Line number (1-indexed, required)
  --column        Column number (0-indexed, required)
  --format, -f    Output format: json | text (default: json)
```

**Example:**

```bash
mangle-cli hover src/main.mg --line 10 --column 5
```

**JSON Output:**

```json
{
  "contents": "**Predicate:** `my_predicate/2`\n\nDefined at lines 5, 12, 18",
  "range": {
    "start": { "line": 10, "column": 0 },
    "end": { "line": 10, "column": 12 }
  }
}
```

#### `definition` - Get Definition Location

Find where a symbol is defined.

```bash
mangle-cli definition <file> --line <n> --column <n>
```

**JSON Output:**

```json
{
  "locations": [{
    "uri": "/path/to/file.mg",
    "range": {
      "start": { "line": 3, "column": 0 },
      "end": { "line": 3, "column": 20 }
    }
  }]
}
```

#### `references` - Find All References

Find all usages of a symbol.

```bash
mangle-cli references <file> --line <n> --column <n> [--include-declaration]

Options:
  --include-declaration    Include the declaration in results
```

#### `completion` - Get Completions

Get completion suggestions at a position.

```bash
mangle-cli completion <file> --line <n> --column <n>
```

**JSON Output:**

```json
{
  "items": [{
    "label": "fn:sum",
    "kind": "function",
    "detail": "Aggregation function",
    "documentation": "Sum all values in a group"
  }]
}
```

#### `format` - Format Files

Format Mangle source files.

```bash
mangle-cli format [options] <files...>

Options:
  --write, -w     Write formatted output back to files
  --check         Check if files are formatted (exit non-zero if not)
  --diff          Show diff of formatting changes
```

**Examples:**

```bash
# Check formatting without modifying files
mangle-cli format --check src/**/*.mg

# Format files in place
mangle-cli format --write src/**/*.mg

# Show what would change
mangle-cli format --diff src/**/*.mg
```

### Output Formats

#### JSON (default)

Machine-readable JSON output. Best for programmatic parsing by coding agents.

#### Text

Human-readable colored output with context snippets.

#### SARIF

Static Analysis Results Interchange Format for GitHub Actions integration.

---

## VS Code Extension API

### VS Code Commands

These commands can be invoked via the Command Palette or programmatically:

| Command | Description |
|---------|-------------|
| `mangle.checkFile` | Check the current file and show results |
| `mangle.checkWorkspace` | Check all .mg files in the workspace |
| `mangle.exportDiagnostics` | Export diagnostics as JSON |
| `mangle.exportToFile` | Export diagnostics to a file |

### Programmatic API

Coding agents can invoke these commands programmatically:

```typescript
// Get diagnostics for a file
const result = await vscode.commands.executeCommand('mangle.api.getDiagnostics', 'file:///path/to/file.mg');

// Get symbols
const symbols = await vscode.commands.executeCommand('mangle.api.getSymbols', 'file:///path/to/file.mg');

// Get hover info at position (1-indexed line, 0-indexed column)
const hover = await vscode.commands.executeCommand('mangle.api.getHover', 'file:///path/to/file.mg', 10, 5);

// Get definition location
const definition = await vscode.commands.executeCommand('mangle.api.getDefinition', 'file:///path/to/file.mg', 10, 5);

// Find references
const refs = await vscode.commands.executeCommand('mangle.api.getReferences', 'file:///path/to/file.mg', 10, 5, true);

// Get completions
const completions = await vscode.commands.executeCommand('mangle.api.getCompletions', 'file:///path/to/file.mg', 10, 5);

// Format a file
const result = await vscode.commands.executeCommand('mangle.api.format', 'file:///path/to/file.mg');
```

### Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mangle.cli.outputFile` | string | `""` | Path to write CLI output |
| `mangle.cli.outputFormat` | enum | `"json"` | Output format: json, text, sarif |

---

## LSP Custom Requests

The Mangle LSP server supports custom requests for advanced integration:

### `mangle/getDiagnostics`

Get detailed diagnostics for a file.

**Request:**
```json
{
  "uri": "file:///path/to/file.mg"
}
```

**Response:**
```json
{
  "uri": "file:///path/to/file.mg",
  "parseErrors": [...],
  "semanticErrors": [...],
  "stratificationErrors": [...]
}
```

### `mangle/checkFiles`

Check multiple files at once.

**Request:**
```json
{
  "uris": ["file:///path/to/file1.mg", "file:///path/to/file2.mg"]
}
```

**Response:**
```json
{
  "files": [
    { "uri": "...", "parseErrors": [...], ... }
  ]
}
```

### `mangle/getStructuredSymbols`

Get detailed symbol information.

**Request:**
```json
{
  "uri": "file:///path/to/file.mg"
}
```

**Response:**
```json
{
  "uri": "file:///path/to/file.mg",
  "predicates": [{
    "name": "my_pred",
    "arity": 2,
    "isExternal": false,
    "isPrivate": false,
    "definitionCount": 3,
    "referenceCount": 5
  }],
  "declarations": [...],
  "clauses": [...]
}
```

### `mangle/getAST`

Get the parsed AST for a file.

**Request:**
```json
{
  "uri": "file:///path/to/file.mg"
}
```

**Response:**
```json
{
  "uri": "file:///path/to/file.mg",
  "ast": {
    "packageDecl": { "name": "mypackage" },
    "useDecls": [],
    "declCount": 5,
    "clauseCount": 20
  }
}
```

---

## SARIF Integration

### GitHub Actions Example

```yaml
# .github/workflows/mangle-check.yml
name: Mangle Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @mangle/mangle-lsp
      - run: mangle-cli check --format sarif src/**/*.mg > results.sarif
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

### SARIF Output Structure

The SARIF output follows the SARIF 2.1.0 specification:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "mangle-cli",
        "version": "1.0.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

---

## Error Codes Reference

| Code | Category | Description |
|------|----------|-------------|
| P001 | Parse | Syntax error |
| E001 | Semantic | Variables in facts must be ground |
| E002 | Semantic | Range restriction violation |
| E003 | Semantic | Variables in negation must be bound |
| E004 | Semantic | Variables in comparison must be bound |
| E005-E009 | Semantic | Built-in predicate/function errors |
| E015 | Stratification | Negation cycle detected |
| E023 | Stratification | Stratification warning |
| E030-E046 | Semantic | Various semantic errors |

See the full list in the SARIF formatter source code.
