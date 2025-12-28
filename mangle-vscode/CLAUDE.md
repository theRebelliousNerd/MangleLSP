# mangle-vscode Package Instructions

VS Code extension for Mangle language support.

## Architecture

```
mangle-vscode/
├── src/extension.ts    # Extension entry point (client)
├── out/                # Compiled extension (client)
├── server/             # Bundled LSP server (copied from mangle-lsp/dist)
├── syntaxes/           # TextMate grammar for syntax highlighting
└── language-configuration.json  # Bracket matching, comments, etc.
```

## Critical: Module Format

**The LSP server MUST be CommonJS, not ES modules.**

- `mangle-lsp/package.json` must NOT have `"type": "module"`
- `mangle-lsp/tsconfig.json` must have `"module": "CommonJS"`
- The vscode-languageclient/node requires CommonJS format

If you see the extension activate but no diagnostics appear, check:
1. Is `mangle-lsp/package.json` missing `"type": "module"`? (correct)
2. Are the server files in `mangle-vscode/server/` up to date?

## Build & Deploy Process

```bash
# 1. Build the LSP server
cd packages/mangle-lsp
npm run build

# 2. Copy server to extension
rm -rf ../mangle-vscode/server
cp -r dist ../mangle-vscode/server

# 3. Build extension client
cd ../mangle-vscode
npm run compile

# 4. Package as VSIX
./node_modules/.bin/vsce package --allow-missing-repository

# 5. Install
code --install-extension mangle-vscode-1.0.0.vsix --force
```

## Critical: Runtime Dependencies

**The VSIX must include node_modules for the server.**

The LSP server requires these runtime dependencies:
- `vscode-languageserver` - LSP server library
- `vscode-languageserver-textdocument` - Text document handling
- `vscode-languageserver-protocol` - LSP protocol types
- `vscode-languageserver-types` - LSP type definitions
- `vscode-jsonrpc` - JSON-RPC communication
- `antlr4ng` - Parser runtime

These must be in `mangle-vscode/node_modules/` and NOT excluded by `.vscodeignore`.

The `.vscodeignore` should:
- **NOT** exclude `node_modules/**` entirely
- Exclude only dev deps: `node_modules/@types/**`, `node_modules/@vscode/**`

## Common Issues

### Extension loads but no squiggles/diagnostics

1. **Missing runtime dependencies**: Check that node_modules is included in VSIX
   - Run `vsce ls --tree` to verify node_modules/* is listed
2. **Module format conflict**: Check `mangle-lsp/package.json` doesn't have `"type": "module"`
3. **Stale server files**: Re-copy from `mangle-lsp/dist` to `mangle-vscode/server`
4. **Reload VS Code**: Use "Developer: Reload Window" after installing

### VSIX packaging errors

- **"invalid relative path"**: Update `.vscodeignore` to exclude parent paths
- **"Both .vscodeignore and files"**: Remove `"files"` from package.json, use .vscodeignore only
- **Duplicate workspace names**: Check no other package has same name in monorepo

### Extension fails to start

Check Output panel → "Mangle Language Server" for errors:
- Missing dependencies in server/
- Syntax errors in server code
- Wrong Node.js version

## Server Communication

- Transport: IPC (inter-process communication)
- Debug port: 6009 (when running in debug mode)
- Document selector: `{ scheme: 'file', language: 'mangle' }`

## Files to Update Together

When changing LSP functionality:
1. `mangle-lsp/src/**` - Server implementation
2. `mangle-vscode/server/` - Must re-copy after build
3. `mangle-vscode/package.json` - If adding new capabilities

When changing syntax highlighting:
1. `mangle-vscode/syntaxes/mangle.tmLanguage.json`

When changing language config:
1. `mangle-vscode/language-configuration.json`

## Testing the Extension

1. Open VS Code in `packages/mangle-vscode`
2. Press F5 to launch Extension Development Host
3. Open a `.mg` file
4. Check Output panel for server logs

## Version Sync

Keep versions in sync:
- `mangle-lsp/package.json` version
- `mangle-vscode/package.json` version
- Git tags for releases
