#!/usr/bin/env bash
# profile-project.sh — gather the facts a Mangle project profile is built
# from, for the project at $MANGLE_PROJECT_DIR or the current git root.
# Prints a Markdown report. The agent checks each line and writes
# .claude/mangle-project.md from it (see references/project-profiling.md).
set -uo pipefail
root="${MANGLE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$root" || exit 2
skip=(-path './.*' -o -path ./node_modules -o -path ./_mangle_lab -o -path ./vendor)
# grep skips the same: hidden folders (tool and agent copies), the lab, deps.
G=(--exclude-dir='.?*' --exclude-dir=_mangle_lab --exclude-dir=node_modules --exclude-dir=vendor)

echo "# Mangle profile facts for $root"
echo
echo "## .mg files by directory"
find . \( "${skip[@]}" \) -prune -o -name '*.mg' -print 2>/dev/null | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40
echo
echo "## Engine"
if [[ -f go.mod ]]; then
  echo "module: $(awk '$1=="module"{print $2; exit}' go.mod)"
  grep -E 'codeberg.org/TauCeti/mangle-go|github.com/google/mangle' go.mod | sed 's/^/pinned: /' || echo "pinned: (no Mangle engine in go.mod)"
else
  echo "no go.mod: not a Go module (Mangle runs elsewhere, or only .mg files live here)"
fi
echo
echo "## Go files that import the engine"
grep -rlE "${G[@]}" '"(codeberg.org/TauCeti/mangle-go|github.com/google/mangle)/' --include='*.go' . 2>/dev/null \
  | grep -v '_test.go$' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -25
echo
echo "## Entry points (analyze / evaluate calls)"
grep -rnE "${G[@]}" 'analysis\.(AnalyzeOneUnit|Analyze|AnalyzeAndCheckBounds)\(|engine\.(EvalProgram|EvalStratifiedProgramWithStats|EvalProgramWithStats)\(' \
  --include='*.go' . 2>/dev/null | grep -v '_test.go' | head -20
echo
echo "## Embedded programs (//go:embed of .mg)"
grep -rnE "${G[@]}" '//go:embed .*\.mg|//go:embed [^ ]*\*' --include='*.go' . 2>/dev/null | head -20
echo
echo "## Evaluation options in use"
grep -rhoE "${G[@]}" 'engine\.With[A-Za-z]+' --include='*.go' . 2>/dev/null | sort | uniq -c | sort -rn
echo
echo "## External predicates"
grep -rhoE "${G[@]}" 'external\(\)' --include='*.mg' . 2>/dev/null | wc -l | sed 's/^/Decls with external(): /'
grep -rlE "${G[@]}" 'ExternalPredicateCallback' --include='*.go' . 2>/dev/null | grep -v _test.go | sed 's/^/Go callbacks: /' | head -10
echo
echo "## Build and test commands (from project files)"
for f in Makefile justfile Taskfile.yml package.json CLAUDE.md AGENTS.md README.md; do
  [[ -f "$f" ]] && grep -nE '(go (test|build|vet)|npm (test|run)|make [a-z]|CGO_|-tags)' "$f" | head -8 | sed "s|^|$f:|"
done
echo
echo "## Engine-backed summary (mangle-cli review)"
if command -v mangle-cli >/dev/null; then
  mangle-cli review --root . --severity error --format text 2>/dev/null | tail -15
else
  echo "mangle-cli not on PATH"
fi
