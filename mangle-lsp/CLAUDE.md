# mangle-lsp Package Instructions

This package contains the Language Server Protocol (LSP) implementation for Mangle.

## Required Skill

**Always use the `mangle-lsp` skill when working in this package.**

The skill is located at: `.claude/skills/mangle-lsp/`

To invoke: Reference the skill or use `/mangle-lsp`

## What the Skill Provides

- LSP protocol fundamentals and message types
- Mangle AST analysis for LSP features
- Diagnostic implementation (syntax and semantic errors)
- Hover and completion providers
- Navigation features (go-to-definition, find references)
- Code formatting implementation
- Error recovery strategies for robust editing
- Architecture and implementation roadmap

## Key Implementation Notes

- Depends on `@mangle/mangle-ts` for parsing and analysis
- Uses `vscode-languageserver` library
- Entry point: `src/server.ts`
- Must handle incomplete/invalid code gracefully
- Source locations required on all AST nodes

## LSP Capabilities to Implement

| Capability | LSP Method | Priority |
|------------|-----------|----------|
| Diagnostics | `textDocument/publishDiagnostics` | P0 |
| Hover | `textDocument/hover` | P1 |
| Completion | `textDocument/completion` | P1 |
| Go to Definition | `textDocument/definition` | P1 |
| Find References | `textDocument/references` | P2 |
| Document Symbols | `textDocument/documentSymbol` | P2 |
| Formatting | `textDocument/formatting` | P3 |

## Skill References

The `mangle-lsp` skill contains detailed references:
- `000-ORIENTATION.md` - Navigation guide
- `100-LSP_FUNDAMENTALS.md` - LSP protocol basics
- `200-MANGLE_AST_ANALYSIS.md` - AST and parsing
- `300-DIAGNOSTICS.md` - Error reporting
- `400-HOVER_COMPLETION.md` - Intelligence features
- `500-NAVIGATION.md` - Go-to-definition, references
- `600-FORMATTING.md` - Code formatting
- `700-ERROR_RECOVERY.md` - Robust parsing
- `800-ARCHITECTURE.md` - System design
- `900-IMPLEMENTATION_ROADMAP.md` - Development plan

## Related Skills

- `mangle-typescript-port` - Core mangle-ts implementation this depends on
- `mangle-programming` - Mangle language semantics reference
