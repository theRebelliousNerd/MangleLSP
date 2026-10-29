#!/usr/bin/env bash
# new-lab.sh <slug> — scaffold a Mangle+Go experiment in <project>/_mangle_lab/<slug>/.
#
# The lab is its own Go module, mangle_lab, so it works in any project:
# - it pins the engine the project pins in go.mod, or DEFAULT_ENGINE when the
#   project has none;
# - in a Go project it can import the project's own packages (a replace
#   points back at the project root);
# - _mangle_lab/ ignores itself (.gitignore "*") and nests outside the
#   project's module, so it never reaches the project's build or VCS.
# Run a lab with:  (cd _mangle_lab && go test -v ./<slug>/)
set -euo pipefail
ENGINE=codeberg.org/TauCeti/mangle-go
DEFAULT_ENGINE=v0.7.0 # the release this skill was verified on

slug="${1:?usage: new-lab.sh <slug>  (lowercase letters, digits, underscores)}"
[[ "$slug" =~ ^[a-z][a-z0-9_]*$ ]] || { echo "slug must match ^[a-z][a-z0-9_]*$" >&2; exit 2; }
command -v go >/dev/null || { echo "new-lab.sh needs the Go toolchain on PATH" >&2; exit 2; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="${MANGLE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
lab="$root/_mangle_lab"
mkdir -p "$lab/harness" "$lab/$slug"
[[ -e "$lab/.gitignore" ]] || printf '*\n' > "$lab/.gitignore"
cp "$here/lab/harness.go" "$lab/harness/harness.go"
dest="$lab/$slug/${slug}_test.go"
[[ -e "$dest" ]] || sed "s/SLUG/$slug/g" "$here/lab/template_test.go.txt" > "$dest"

version="$DEFAULT_ENGINE"
project_mod=""
if [[ -f "$root/go.mod" ]]; then
  pinned="$(awk -v m="$ENGINE" '$1==m {print $2} $1=="require" && $2==m {print $3}' "$root/go.mod" | head -1)"
  [[ -n "$pinned" ]] && version="$pinned"
  project_mod="$(awk '$1=="module" {print $2; exit}' "$root/go.mod")"
fi

engine_only() {
  printf 'module mangle_lab\n\ngo %s\n\nrequire %s %s\n' "$(go env GOVERSION | sed 's/^go//')" "$ENGINE" "$version" > "$lab/go.mod"
}

if [[ ! -f "$lab/go.mod" ]]; then
  engine_only
  [[ -n "$project_mod" ]] && printf '\nrequire %s v0.0.0\n\nreplace %s => ../\n' "$project_mod" "$project_mod" >> "$lab/go.mod"
fi

if ! (cd "$lab" && GOFLAGS=-mod=mod go mod tidy >/dev/null 2>"$lab/.tidy.log"); then
  if [[ -n "$project_mod" ]] && grep -q "replace $project_mod" "$lab/go.mod"; then
    engine_only
    (cd "$lab" && GOFLAGS=-mod=mod go mod tidy >/dev/null 2>>"$lab/.tidy.log") \
      || { echo "go mod tidy failed; see $lab/.tidy.log" >&2; exit 1; }
    echo "note: the project's own packages are not importable from this lab (see $lab/.tidy.log)" >&2
  else
    echo "go mod tidy failed; see $lab/.tidy.log" >&2; exit 1
  fi
fi
echo "$dest  (engine $ENGINE $version; run: cd $lab && go test -v ./$slug/)"
