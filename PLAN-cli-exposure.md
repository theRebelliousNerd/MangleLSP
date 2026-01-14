# Plan: CLI Exposure for LSP and VS Code Extension

## Goal
Add CLI exposure to the MangleLSP project so that outputs can be easily accessed by coding agents. This includes creating a standalone CLI tool and enhancing the VS Code extension with programmatic access to LSP features.

---

## Part 1: Standalone CLI Tool (`mangle-cli`)

### 1.1 Create CLI Entry Point
**File:** `mangle-lsp/src/cli.ts`

Create a comprehensive CLI tool with the following commands:

```
mangle-cli <command> [options] <files...>

Commands:
  check         Run diagnostics (parse, semantic, stratification)
  symbols       List document symbols (predicates, declarations)
  hover         Get hover information at position
  definition    Get definition location for symbol at position
  references    Find all references to symbol at position
  format        Format Mangle source files
  completion    Get completions at position

Global Options:
  --format, -f    Output format: json | text | sarif (default: json)
  --quiet, -q     Suppress non-essential output
  --help, -h      Show help
  --version, -v   Show version
```

### 1.2 Implement CLI Commands

#### `check` Command (Priority: High)
```bash
mangle-cli check [options] <files...>

Options:
  --severity     Minimum severity: error | warning | info (default: info)
  --format       Output format: json | text | sarif
  --fail-on      Exit non-zero on: error | warning | never (default: error)
```

**JSON Output Schema:**
```json
{
  "version": "1.0",
  "files": [{
    "path": "/path/to/file.mg",
    "diagnostics": [{
      "severity": "error",
      "code": "E001",
      "source": "mangle-semantic",
      "message": "Variables in facts must be ground",
      "range": {
        "start": { "line": 10, "column": 5 },
        "end": { "line": 10, "column": 15 }
      },
      "context": "offending_predicate(X)."
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

#### `symbols` Command
```bash
mangle-cli symbols [options] <file>

Options:
  --kind         Filter by kind: predicate | declaration | all
  --format       Output format: json | text
```

**JSON Output:**
```json
{
  "symbols": [{
    "name": "my_predicate/2",
    "kind": "predicate",
    "range": { "start": { "line": 5, "column": 0 }, "end": { "line": 5, "column": 25 } },
    "children": []
  }]
}
```

#### `hover` Command
```bash
mangle-cli hover <file> --line <n> --column <n>
```

**JSON Output:**
```json
{
  "contents": "**Predicate:** `my_predicate/2`\n\nDefined at lines 5, 12, 18",
  "range": { "start": { "line": 5, "column": 0 }, "end": { "line": 5, "column": 12 } }
}
```

#### `definition` Command
```bash
mangle-cli definition <file> --line <n> --column <n>
```

**JSON Output:**
```json
{
  "locations": [{
    "uri": "file:///path/to/file.mg",
    "range": { "start": { "line": 3, "column": 0 }, "end": { "line": 3, "column": 20 } }
  }]
}
```

#### `references` Command
```bash
mangle-cli references <file> --line <n> --column <n> [--include-declaration]
```

#### `format` Command
```bash
mangle-cli format [options] <files...>

Options:
  --write, -w    Write formatted output back to files
  --check        Check if files are formatted (exit non-zero if not)
  --diff         Show diff of formatting changes
```

#### `completion` Command (for testing/debugging)
```bash
mangle-cli completion <file> --line <n> --column <n>
```

### 1.3 Implementation Structure

**New Files:**
```
mangle-lsp/src/
├── cli.ts              # CLI entry point with argument parsing
├── cli/
│   ├── commands/
│   │   ├── check.ts    # Check command implementation
│   │   ├── symbols.ts  # Symbols command
│   │   ├── hover.ts    # Hover command
│   │   ├── definition.ts
│   │   ├── references.ts
│   │   ├── format.ts
│   │   └── completion.ts
│   ├── formatters/
│   │   ├── json.ts     # JSON output formatter
│   │   ├── text.ts     # Human-readable text formatter
│   │   └── sarif.ts    # SARIF format for GitHub Actions integration
│   └── utils.ts        # Shared utilities
```

### 1.4 Package Configuration

Update `mangle-lsp/package.json`:
```json
{
  "bin": {
    "mangle-lsp": "dist/server.js",
    "mangle-cli": "dist/cli.js"
  }
}
```

---

## Part 2: VS Code Extension Enhancements

### 2.1 Add VS Code Commands

**File:** `mangle-vscode/package.json` - Add to `contributes.commands`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "mangle.checkFile",
        "title": "Mangle: Check Current File"
      },
      {
        "command": "mangle.checkWorkspace",
        "title": "Mangle: Check All Files in Workspace"
      },
      {
        "command": "mangle.exportDiagnostics",
        "title": "Mangle: Export Diagnostics to JSON"
      },
      {
        "command": "mangle.getSymbols",
        "title": "Mangle: List Document Symbols"
      },
      {
        "command": "mangle.formatFile",
        "title": "Mangle: Format File"
      }
    ]
  }
}
```

### 2.2 Add Output Channel for Structured Output

**File:** `mangle-vscode/src/extension.ts`

```typescript
// Create dedicated output channel for structured data
const outputChannel = vscode.window.createOutputChannel('Mangle CLI', 'json');

// Command: Export diagnostics as JSON
vscode.commands.registerCommand('mangle.exportDiagnostics', async () => {
    const diagnostics = vscode.languages.getDiagnostics();
    const output = formatDiagnosticsAsJson(diagnostics);
    outputChannel.clear();
    outputChannel.appendLine(JSON.stringify(output, null, 2));
    outputChannel.show();
});
```

### 2.3 Add File-Based Output Option

**Settings to add:**
```json
{
  "mangle.cli.outputFile": {
    "type": "string",
    "default": "",
    "description": "Path to write CLI output (empty = output channel only)"
  },
  "mangle.cli.outputFormat": {
    "type": "string",
    "enum": ["json", "text", "sarif"],
    "default": "json",
    "description": "Output format for CLI commands"
  }
}
```

### 2.4 Custom Request Handlers for LSP

Add custom LSP requests that coding agents can invoke:

**Server-side (`mangle-lsp/src/server.ts`):**
```typescript
// Custom request: Get all diagnostics for a file
connection.onRequest('mangle/getDiagnostics', async (params: { uri: string }) => {
    const state = documentStates.get(params.uri);
    return {
        uri: params.uri,
        diagnostics: state?.diagnostics || [],
        parseErrors: state?.parseResult?.errors || [],
        validationErrors: state?.validationResult?.errors || [],
        stratificationErrors: state?.stratificationErrors || []
    };
});

// Custom request: Check multiple files
connection.onRequest('mangle/checkFiles', async (params: { uris: string[] }) => {
    // Batch process multiple files
});

// Custom request: Get structured symbol info
connection.onRequest('mangle/getStructuredSymbols', async (params: { uri: string }) => {
    // Return detailed symbol information
});
```

**Client-side (`mangle-vscode/src/extension.ts`):**
```typescript
// Expose via command for coding agents
vscode.commands.registerCommand('mangle.api.getDiagnostics', async (uri?: string) => {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri.toString();
    return await client.sendRequest('mangle/getDiagnostics', { uri: targetUri });
});
```

---

## Part 3: SARIF Integration for CI/CD

### 3.1 SARIF Output Format

Implement SARIF (Static Analysis Results Interchange Format) for GitHub Actions integration:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "mangle-cli",
        "version": "1.0.0",
        "rules": [{
          "id": "E001",
          "shortDescription": { "text": "Variables in facts must be ground" }
        }]
      }
    },
    "results": [{
      "ruleId": "E001",
      "level": "error",
      "message": { "text": "Variable X is not ground in fact" },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/rules.mg" },
          "region": { "startLine": 10, "startColumn": 5 }
        }
      }]
    }]
  }]
}
```

### 3.2 GitHub Action Example

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
      - run: npm install -g @mangle/mangle-lsp
      - run: mangle-cli check --format sarif --output results.sarif **/*.mg
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

---

## Part 4: Implementation Tasks

### Phase 1: Core CLI (Priority: High)
1. [ ] Create `cli.ts` entry point with argument parsing (use `commander` or built-in)
2. [ ] Implement `check` command with JSON output
3. [ ] Implement `symbols` command
4. [ ] Implement `format` command with `--write` and `--check` options
5. [ ] Add text output formatter
6. [ ] Update package.json bin configuration
7. [ ] Add CLI tests

### Phase 2: Full CLI Features (Priority: Medium)
8. [ ] Implement `hover` command
9. [ ] Implement `definition` command
10. [ ] Implement `references` command
11. [ ] Implement `completion` command
12. [ ] Implement SARIF output formatter

### Phase 3: VS Code Extension (Priority: Medium)
13. [ ] Add VS Code commands for CLI operations
14. [ ] Create output channel for structured JSON
15. [ ] Add custom LSP request handlers
16. [ ] Add settings for output configuration
17. [ ] Document command API for coding agents

### Phase 4: Documentation & Polish (Priority: Low)
18. [ ] Write CLI usage documentation
19. [ ] Create examples for coding agent integration
20. [ ] Add `--help` with detailed examples
21. [ ] Performance optimization for large codebases

---

## API Design for Coding Agents

### CLI Usage Patterns

```bash
# Quick check - get machine-readable diagnostics
mangle-cli check --format json src/**/*.mg

# Check with exit code for CI
mangle-cli check --fail-on error src/

# Get symbols for navigation
mangle-cli symbols --format json src/main.mg

# Format check without modification
mangle-cli format --check src/

# Get hover info at cursor position
mangle-cli hover src/main.mg --line 10 --column 5
```

### VS Code Command Usage

Coding agents can invoke VS Code commands:
```typescript
// Get diagnostics programmatically
const diagnostics = await vscode.commands.executeCommand('mangle.api.getDiagnostics');

// Check entire workspace
await vscode.commands.executeCommand('mangle.checkWorkspace');

// Export to file for external processing
await vscode.commands.executeCommand('mangle.exportDiagnostics');
```

### LSP Direct Access

For advanced agents that can speak LSP:
```typescript
// Connect to running LSP server
const client = new LanguageClient('mangle', serverOptions, clientOptions);
await client.start();

// Send custom requests
const result = await client.sendRequest('mangle/getDiagnostics', { uri: fileUri });
```

---

## Dependencies to Add

### mangle-lsp/package.json
```json
{
  "dependencies": {
    "commander": "^11.0.0"  // Optional: CLI argument parsing (or use minimal built-in)
  }
}
```

Note: Can also implement argument parsing without external dependencies for minimal bundle size.

---

## Success Criteria

1. **CLI Tool**: `mangle-cli check` produces valid JSON that can be parsed by coding agents
2. **Exit Codes**: Proper exit codes (0=success, 1=errors found, 2=invalid args)
3. **VS Code Commands**: Commands are registered and callable via `vscode.commands.executeCommand`
4. **SARIF**: Output can be uploaded to GitHub Security tab
5. **Documentation**: Clear examples for coding agent integration
6. **Performance**: Handles 100+ files in under 5 seconds

---

## Estimated Implementation Scope

- **Phase 1 (Core CLI)**: 7 tasks - Foundation for coding agent access
- **Phase 2 (Full CLI)**: 5 tasks - Complete feature parity with LSP
- **Phase 3 (VS Code)**: 5 tasks - In-editor programmatic access
- **Phase 4 (Docs)**: 4 tasks - Adoption enablement

Total: 21 implementation tasks
