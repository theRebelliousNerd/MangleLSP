# Project profiling: adjust to the project before touching it

The skill is general. Every project embeds Mangle differently: where the
programs live, how Go assembles and feeds them, which engine version runs,
and what "done" means. The profile, `.claude/mangle-project.md` in the
project, holds those answers. Read it first. If it's missing, build it
before the first change.

## Build it

1. Run `${CLAUDE_SKILL_DIR}/scripts/profile-project.sh > /tmp/profile.md`
   from the project. It reports:
   - `.mg` files by directory;
   - the engine module and version pinned in go.mod;
   - Go packages that import the engine;
   - analyze and evaluate call sites, and evaluation options in use;
   - `//go:embed` program sets;
   - external predicates;
   - build and test commands;
   - a `mangle-cli review` summary.
2. Read the call sites it lists until you can say how one program is
   assembled: which files, in what order, and where facts enter.
3. Run `mangle-cli boundary --root .`. If findings are noisy because Go
   builds facts in a house style, write `.mangle/oracle-profile.json`. The
   built-in `codenerd` profile is the worked example.
4. Run one test command from the report and confirm it passes before you
   record it.
5. Write the profile in the shape below. Every line should be something
   you checked, not something you inferred.

## Profile shape (`.claude/mangle-project.md`, under 100 lines)

```markdown
# Mangle in <project>
Engine: codeberg.org/TauCeti/mangle-go vX (from go.mod) | Checked: <date>

## Programs
- <name>: files <globs>, assembled by <Go function, file:line>, order <...>
## Facts in and decisions out
- EDB enters via <API>; values built with <helper> (names vs strings: <rule>)
- Decisions read by <Go call sites>; Go must not re-decide <...>
## Externals
- <pred/arity> → <Go callback, file> (mode ...)
## Analysis and evaluation
- Analyze: <AnalyzeOneUnit | strict>; store: <type>; temporal store: yes/no
- Limits: <fact limit>; provenance: <where>
## Layers and conventions
- one Decl per predicate in <files>; rules in <dirs>; generated rules: <gate>
## Commands
- check: <cmd>  test: <cmd>  rebuild after .mg change: <cmd or n/a>
## Known state
- `mangle-cli review` baseline: <counts> (<date>)
- Open traps specific to this project: <...>
```

## Keep it alive

- Update it in the same change whenever a mission learns something
  structural: a new program, a moved embedder, a new external, a command
  that changed.
- Re-run the review baseline after large `.mg` changes, and record the
  delta.
- If the profile and the code disagree, the code wins. Fix the profile and
  mention it in the report.

## Non-Go projects

With no go.mod, the profile records how Mangle runs: the interpreter, a
service, or another embedding language. It also records the engine
version to use for labs. `new-lab.sh` still gives you a lab on the
default release.
