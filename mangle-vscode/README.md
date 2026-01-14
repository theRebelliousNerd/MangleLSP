# Mangle Language Support for VS Code

[![Open VSX](https://img.shields.io/open-vsx/v/theRebelliousNerd/mangle-vscode)](https://open-vsx.org/extension/theRebelliousNerd/mangle-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Language support for [Mangle](https://github.com/google/mangle), a Datalog-inspired declarative programming language created by Google.

## Features

- ✨ **Syntax Highlighting** - Full TextMate grammar for `.mg` files
- 🔍 **Real-time Diagnostics** - Parse errors, semantic analysis, stratification checks
- 💡 **IntelliSense** - Auto-completion for predicates and builtins
- 📖 **Hover Information** - Predicate signatures and documentation
- 🔗 **Go to Definition** - Jump to predicate definitions
- 🔎 **Find References** - Locate all usages of a predicate
- 📋 **Document Outline** - Navigate your Mangle code structure
- ✏️ **Code Formatting** - Consistent, readable Mangle code
- 🔄 **Rename Refactoring** - Safely rename predicates across files

## Installation

### From Open VSX

Install directly from the [Open VSX Registry](https://open-vsx.org/extension/theRebelliousNerd/mangle-vscode).

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/theRebelliousNerd/MangleLSP/releases)
2. In VS Code: `Ctrl+Shift+P` → "Install from VSIX"
3. Select the downloaded file

### Build from Source

```bash
git clone https://github.com/theRebelliousNerd/MangleLSP.git
cd MangleLSP
npm install
npm run build
npm run package
```

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `mangle.maxNumberOfProblems` | Maximum problems per file | 100 |
| `mangle.enableSemanticAnalysis` | Enable semantic checks | true |
| `mangle.trace.server` | LSP communication tracing | off |
| `mangle.cli.outputFormat` | CLI output format (json/text/sarif) | json |

## Requirements

- VS Code 1.75.0 or higher

## About

<p align="center">
  <a href="https://nextgenrd.com/">
    <strong>🚀 Next-Gen Engineering and Research Development LLC (N.E.R.D.)</strong>
  </a>
  <br>
  <em>Engineering the Future. Today.</em>
</p>

This extension is developed and maintained by **[N.E.R.D.](https://nextgenrd.com/)** — a dynamic engineering company founded on the principle of bringing innovative ideas to fruition. We operate with a hybrid model, functioning as both a provider of engineering design services and as architects of next-generation developer tools.

**Creator:** Steve Moore ([@theRebelliousNerd](https://github.com/theRebelliousNerd))

---

## Related

- [Mangle](https://github.com/google/mangle) - The original Mangle language by Google
- [MangleLSP Repository](https://github.com/theRebelliousNerd/MangleLSP) - Full source code

## License

MIT © [Next-Gen Engineering and Research Development LLC](https://nextgenrd.com/)
