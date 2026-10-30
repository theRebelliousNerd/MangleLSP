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
  --explain       Include explanation, general fix and example for every code
  --isolated      Analyze each file alone (default: in its program context, below)
  --no-ignore     Check files that .mangleignore or `# mangle-ignore-file` exclude
  --quiet, -q     Suppress non-essential output
```

**Program context.** A file is analyzed with what the host loads together with it, and only
its own diagnostics are reported (in its own lines). If a Go package `//go:embed`s several
`.mg` files into one variable, those files are one program (as in `review`); otherwise the
`Decl`s of the `.mg` files in the same directory are visible. The language server does the
same, with unsaved buffers.

**Ignoring files.** `.mangleignore` uses gitignore syntax, relative to its own directory
(a nearer file overrides a farther one); a comment line `# mangle-ignore-file` excludes one
file. Ignored files are skipped by `check`, `batch` and `review` (the JSON summary counts
`ignoredFiles`) and get no problems in the editor, which keeps highlighting and navigation.
An ignored file is never context for its neighbours.

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

**JSON Output Schema** (`version` `"1.1"`; fields after `context` are additive over 1.0):

```json
{
  "version": "1.1",
  "files": [{
    "path": "src/rules.mg",
    "diagnostics": [{
      "severity": "error",
      "code": "E068",
      "source": "mangle-semantic",
      "message": "argument 2 (Duration) of fn:time:add has type /number, but /duration is expected",
      "range": {
        "start": { "line": 3, "column": 40 },
        "end": { "line": 3, "column": 42 }
      },
      "context": "later(T2) :- ev(T), T2 = fn:time:add(T, 60).",
      "hint": "convert with fn:duration:from_seconds(N), fn:duration:from_minutes(N), fn:duration:from_hours(N) or fn:duration:from_nanos(N)",
      "title": "Function argument type mismatch",
      "category": "type",
      "docs": "https://github.com/theRebelliousNerd/MangleLSP/blob/main/docs/DIAGNOSTICS.md#e068"
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

- `hint` — instance-specific, actionable suggestion (present on most diagnostics).
- `fixes` — machine-applicable edits: replace `range` (1-indexed line, 0-indexed column) with `newText`.
  Present when the fix is unambiguous (e.g. `fn:Sum` → `fn:sum`, `"hour"` → `/hour`, a typo'd predicate).
- `title`, `category`, `docs` — from the diagnostic catalog.
- With `--explain`: `explanation`, `fix` and `example: { bad, good }` as well.

Text output prints the same information as `= help:` / `= fix:` lines (and `= note:` with `--explain`).

#### `explain` - Explain Diagnostic Codes

```bash
mangle-cli explain E003            # what it means, how to fix it, example
mangle-cli explain E003 E068       # several codes
mangle-cli explain --list          # one line per code
mangle-cli explain --all           # everything
mangle-cli explain --markdown      # regenerate docs/DIAGNOSTICS.md
mangle-cli explain E003 -f json    # catalog entry as JSON
```

The default output format of `explain` is text.

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
```

#### `batch` - Batch Queries (For Agents)

Run multiple queries in a single call. Designed for coding agents that need to gather multiple pieces of information efficiently.

```bash
mangle-cli batch <queries.json>
mangle-cli batch -              # Read from stdin
```

**Query Format:**

```json
[
  { "id": 1, "type": "hover", "file": "src/main.mg", "line": 10, "column": 5 },
  { "id": 2, "type": "definition", "file": "src/main.mg", "line": 15, "column": 3 },
  { "id": 3, "type": "references", "file": "src/main.mg", "line": 20, "column": 5, "includeDeclaration": true },
  { "id": 4, "type": "completion", "file": "src/main.mg", "line": 25, "column": 10 },
  { "id": 5, "type": "symbols", "file": "src/main.mg" },
  { "id": 6, "type": "diagnostics", "file": "src/main.mg" },
  { "id": 7, "type": "format", "file": "src/main.mg" },
  { "id": 8, "type": "fileInfo", "file": "src/main.mg" }
]
```

**Query Types:**

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `hover` | Get hover info at position | `file`, `line`, `column` |
| `definition` | Get definition location | `file`, `line`, `column` |
| `references` | Find all references | `file`, `line`, `column` |
| `completion` | Get completions | `file`, `line`, `column` |
| `symbols` | List document symbols | `file` |
| `diagnostics` | Get all diagnostics | `file` |
| `format` | Get formatted output | `file` |
| `fileInfo` | Get complete file analysis | `file` |

**Output:**

```json
{
  "version": "1.0",
  "results": [
    { "id": 1, "type": "hover", "file": "src/main.mg", "result": { "contents": "..." } },
    { "id": 2, "type": "definition", "file": "src/main.mg", "result": { "locations": [...] } }
  ],
  "summary": {
    "total": 2,
    "succeeded": 2,
    "failed": 0
  }
}
```

**Example Usage:**

```bash
# Create a queries file
cat > queries.json << 'EOF'
[
  {"type": "fileInfo", "file": "src/main.mg"},
  {"type": "hover", "file": "src/main.mg", "line": 10, "column": 5}
]
EOF

# Run batch
mangle-cli batch queries.json

# Or pipe directly
echo '[{"type":"diagnostics","file":"src/main.mg"}]' | mangle-cli batch -
```

#### `file-info` - Complete File Analysis

Get comprehensive information about a single file including diagnostics, symbols, predicates, and AST info.

```bash
mangle-cli file-info <file>
mangle-cli file-info --format text <file>   # Human-readable output
```

**JSON Output:**

```json
{
  "path": "src/main.mg",
  "lineCount": 50,
  "hasSyntaxErrors": false,
  "hasSemanticErrors": false,
  "diagnostics": {
    "parseErrors": [],
    "semanticErrors": [],
    "totalErrors": 0,
    "totalWarnings": 0
  },
  "symbols": [...],
  "predicates": [
    { "name": "my_pred", "arity": 2, "definitionCount": 3, "referenceCount": 5 }
  ],
  "ast": {
    "declCount": 5,
    "clauseCount": 20,
    "packageDecl": { "name": "mypackage" }
  }
}
```

#### Agent commands: `review`, `boundary`, `advise`, `conformance`, `run`, `whynot`

The engine-backed commands run **mangle-oracle** (`mangle-oracle/`, a Go module on
`codeberg.org/TauCeti/mangle-go`). The CLI builds it on first use with Go, against the
engine version the target project's `go.mod` requires (cached as
`mangle-oracle/bin/mangle-oracle-<version>`), falling back to the pinned v0.7.0 and saying
so in `engineNote`. `MANGLE_ORACLE=/path/to/binary` overrides.

```bash
# Whole repository: programs assembled at host load calls, every diagnostic,
# engine verdicts, Go <-> .mg findings, and one numbered plan with edits
mangle-cli review --root . [--severity warning] [--no-boundary] [--profile codenerd]

# Go <-> .mg boundary only (B-codes); each finding carries the facts its proof rests on
mangle-cli boundary --root . [--profile generic|codenerd|file.json]

# Mangle-feature advice only (A-codes) with rewrites
mangle-cli advise src/*.mg

# The LSP verdict next to the engine's (one case per file, or --program for one program)
mangle-cli conformance --program schema.mg policy.mg

# Evaluate on the engine: list facts, explain one with a proof (through let/do transforms)
mangle-cli run rules.mg --query latest --why 'latest(/f1, "new")' [--at 2024-01-01T00:00:00Z]

# Why is a goal not derived: rows surviving each premise of each rule, first block named
mangle-cli whynot rules.mg --goal 'grant(U)'
```

`review` plan items: `{ id, code, severity, category, title, file, line, message, hint,
why, edits?: [{file, range, newText}], related?, proof?, verify }`, most severe first.
`edits` are present only when the fix is unambiguous; `verify` is the command that shows
the item is done.

**Host profiles.** The boundary scan reads Go with a profile that says which struct is a
fact, which calls assert, query and retract, and how a Go string becomes a constant.
Built-ins: `generic` (any `Fact{Predicate, Args}`, `Assert*`/`AddFact*`/`Query*`, mangle-go
`map[ast.PredicateSym]engine.ExternalPredicateCallback` registrations) and `codenerd`.
A project file `.mangle/oracle-profile.json` (same shape as
`mangle-oracle/profiles/generic.json`) takes precedence; otherwise the profile whose
`modules` lists the go.mod module is used.

Fact construction alone is not an assertion. The scan follows values through
aliases, containers, wrappers and return slots to the profile's assertion APIs.
Extracting fields from a routing envelope to construct a different asserted Fact
does not make the envelope a store write.

`programLoadMethods` names calls whose string arguments load a program; when
omitted it defaults to `LoadSchemaString`, `LoadProgramString`, `LoadProgram` and
`LoadString`. An explicit empty list disables load-call discovery. Discovery
follows local Go functions (including imports within the module), concatenation,
string builders and reads from embedded filesystems with statically known paths.
Loads on the same engine receiver form one cumulative program, including loads
inside helpers passed that engine. Aliases, individual return slots and receiver
fields preserve identity; distinct engine values and constructor invocations
retain separate contexts. Files are deduplicated in host call order, expanding
helper loads at their call sites. Thus a helper's schema declarations are visible
to a subsequent policy load on the same engine. Unused embed groups retain their
previous fallback context. The scan does not execute Go: it unions branches and
does not model engine resets or repeated loop allocations. Loads with multiple
possible receivers stay separate; dynamic filenames, unresolved callbacks and
ambiguous receiver types can remain undiscovered.

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
| `mangle.explainDiagnostic` | Explain a diagnostic code (defaults to the diagnostic under the cursor) |

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

// BATCH OPERATIONS (new)

// Batch lookup - run multiple queries in one call
const batchResult = await vscode.commands.executeCommand('mangle.api.batchLookup', [
    { type: 'hover', uri: 'file:///path/to/file.mg', line: 10, column: 5 },
    { type: 'definition', uri: 'file:///path/to/file.mg', line: 15, column: 3 },
    { type: 'diagnostics', uri: 'file:///path/to/file.mg' }
]);

// Get complete file info
const fileInfo = await vscode.commands.executeCommand('mangle.api.getFileInfo', 'file:///path/to/file.mg');

// Check all open documents
const checkAll = await vscode.commands.executeCommand('mangle.api.checkAll');

// Get workspace summary (all predicates, files)
const summary = await vscode.commands.executeCommand('mangle.api.getWorkspaceSummary');

// Explain a diagnostic code (catalog entry as JSON)
const explanation = await vscode.commands.executeCommand('mangle.api.explain', 'E003');
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

Each semantic/stratification entry carries `code`, `title`, `category`, `severity`,
`message`, `hint`, `fixes`, `docs` and `range` (1-indexed lines). Parse errors carry a `hint`
for common syntax mistakes.

### `mangle/explain`

Explain a diagnostic code.

**Request:**
```json
{ "code": "E003" }
```

**Response:** the catalog entry (`code`, `title`, `category`, `severity`, `explanation`, `fix`,
`example`, `docs`) plus `markdown`, a rendered explanation. Unknown codes return `{ "code", "error" }`.

### Quick fixes

Diagnostics with fixes carry them in `Diagnostic.data.fixes`; the server offers each as a
`quickfix` code action (`textDocument/codeAction`). Diagnostics also set `codeDescription.href`
to the code's section in [DIAGNOSTICS.md](DIAGNOSTICS.md).

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

### `mangle/batchLookup`

Run multiple queries in a single request. Perfect for coding agents.

**Request:**
```json
{
  "queries": [
    { "id": 1, "type": "hover", "uri": "file:///path/to/file.mg", "line": 10, "column": 5 },
    { "id": 2, "type": "definition", "uri": "file:///path/to/file.mg", "line": 15, "column": 3 },
    { "id": 3, "type": "diagnostics", "uri": "file:///path/to/file.mg" }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "id": 1, "type": "hover", "uri": "...", "result": { "contents": "..." } },
    { "id": 2, "type": "definition", "uri": "...", "result": { "locations": [...] } },
    { "id": 3, "type": "diagnostics", "uri": "...", "result": { "parseErrors": [], ... } }
  ]
}
```

**Query Types:** `hover`, `definition`, `references`, `completion`, `symbols`, `diagnostics`, `format`

### `mangle/getFileInfo`

Get complete information about a file in a single request.

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
  "exists": true,
  "version": 1,
  "hasSyntaxErrors": false,
  "hasSemanticErrors": false,
  "diagnostics": { ... },
  "symbols": [...],
  "predicates": [...],
  "ast": { ... },
  "lineCount": 50
}
```

### `mangle/checkAll`

Check all open documents and get aggregated diagnostics.

**Request:**
```json
{}
```

**Response:**
```json
{
  "files": [
    { "uri": "file:///path/to/file1.mg", "parseErrors": [...], ... },
    { "uri": "file:///path/to/file2.mg", "parseErrors": [...], ... }
  ],
  "summary": {
    "totalFiles": 2,
    "totalErrors": 0,
    "totalWarnings": 3,
    "totalInfo": 1
  }
}
```

### `mangle/getWorkspaceSummary`

Get a summary of all predicates and files in the workspace.

**Request:**
```json
{}
```

**Response:**
```json
{
  "files": [
    { "uri": "...", "hasSyntaxErrors": false, "declCount": 5, "clauseCount": 20 }
  ],
  "predicates": [
    { "name": "my_pred/2", "arity": 2, "definedIn": ["file1.mg"], "referencedIn": ["file1.mg", "file2.mg"] }
  ],
  "totalFiles": 2,
  "totalPredicates": 15
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
        "version": "1.1.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

---

## Error Codes Reference

Every code, with explanation, fix and example, is listed in [DIAGNOSTICS.md](DIAGNOSTICS.md)
(generated from `mangle-lsp/src/analysis/diagnostics.ts`). Run `mangle-cli explain --list`
for a one-line summary of each code.
