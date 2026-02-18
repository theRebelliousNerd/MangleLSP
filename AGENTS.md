# Project Intent

This repository exists to contribute to the Google Mangle project:
https://github.com/google/mangle

Primary goals:
- Create TypeScript and Python implementations of Mangle.
- Build a Language Server Protocol (LSP) server and linter for the language.

# Upstream Reference

The most current reference version of Mangle is located at:
`C:\CodeProjects\MangleTSandPython\upstream`

Use it as the source of truth for parser/AST behavior, semantic analysis,
evaluation, builtins, diagnostics, and tests.

# Communication Guidance for Agents

When creating or updating Codex skills in this repository, be verbose in your
output. Include the reasoning, steps taken, and the files changed or added.

# Skill Authoring Guidance

When authoring skills for this repository, prefer encyclopedic coverage in
`references/` with progressive disclosure from `SKILL.md`. Err on the side of
completeness: capture edge cases, error messages, upstream behavior notes, file
maps, and parity details. Create many focused reference files rather than
leaving gaps, and make `SKILL.md` a concise map that points to those references.

Checklist for Mangle skills (references/ content):
- parser and AST: grammar, token classification, precedence, AST shapes
- semantic analysis: decl checks, arity/validation, type inference, errors
- evaluation: engines, factstore layout, transforms, aggregation semantics
- builtins: signatures, behavior, corner cases, error strings
- diagnostics: error catalogs, ranges/locations, parity with upstream
- tests and examples: upstream test map, golden outputs, conformance notes
- file maps: upstream and port module maps, responsibilities, dependencies
- parity notes: known gaps, implementation deltas, TODOs, release alignment

Reference file naming and TOC template:
- names: kebab-case, one topic per file (e.g., parser-grammar.md)
- index: keep a references index file that links to all topics
- TOC: include a short table of contents at top for files over 100 lines

TOC skeleton (copy into each long reference file):
```
# <Title>

## Contents
- Summary
- Upstream sources
- Behavior and rules
- Edge cases
- Error messages
- Examples
- Open questions or TODOs
```
