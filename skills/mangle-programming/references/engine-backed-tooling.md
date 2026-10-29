# Engine-backed tooling: mangle-cli and mangle-oracle

MangleLSP (this plugin: `mangle-cli` on PATH, and the `.mg` language
server in Claude Code) can now ask the
real engine. `mangle-oracle/` is a standalone Go module on TauCeti
mangle-go; the CLI builds it on demand against the engine version the
project's go.mod pins, or its own pinned release otherwise. Use it before a lab when the
question is "what does the engine say about this file?".

## Commands

| Need | Command |
| --- | --- |
| Everything wrong in the repo, as one plan | `mangle-cli review --root .` |
| Where .mg meets Go (dead inputs, arity, shapes, externals) | `mangle-cli boundary --root .` |
| What Mangle feature this file could use | `mangle-cli advise file.mg` |
| Does the LSP agree with the engine here? | `mangle-cli conformance --program a.mg b.mg` |
| Facts of a predicate, and a proof of one | `mangle-cli run f.mg --query p --why 'p(/a)'` |
| Why a goal is not derived | `mangle-cli whynot f.mg --goal 'p(X)'` |

`--format text` for people; JSON (default) for agents. `run --at
2024-01-01T00:00:00Z` pins `now` for temporal rules.

## What each one does that check-mangle doesn't

- **review** assembles each `//go:embed` set into one program (the kernel's
  `coreLogic` is 156 files), so cross-file Decls, externals and negation
  cycles are seen, then lists every strict-bounds mismatch at once. The
  engine stops at the first.
- **boundary** scans Go with go/ast and judges with a Mangle program
  (`mangle-oracle/boundary.mg`, strictly typed itself). Each finding comes
  with its proof, including the absences it rests on. Codes: B001 a rule
  reads something nothing produces; B004 wrong arity; B007 wrong constant
  type; B008-B011 externals. Host conventions come from a profile
  (`mangle-oracle/profiles/codenerd.json`): `types.Fact` uses the
  name-looking-string heuristic, `mangle.Fact` coerces to the Decl's type.
- **whynot** turns the program into data: one probe rule per body prefix
  (in RewriteClause order), one evaluation, and a row funnel per rule:
  `3 rows after user(U,R), 1 after R = /admin, 0 after !banned(U)`.
- **run --why** proves through `let`/`do` transforms (recorder mode), so an
  arg-max answer shows the aggregate and the facts that fed it.

## Rules of thumb

- A claim about engine behaviour is a probe in
  `mangle-lsp/test/fixtures/conformance/probes/` plus
  `npm run conformance:refresh`, not a sentence.
- A B001 says no static producer exists. A producer that builds the
  predicate name at run time is invisible; B012 lists Go mentions to check.
