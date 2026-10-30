/**
 * Version of the Mangle LSP / CLI and the upstream Mangle release whose
 * semantics (grammar, builtins, validation, evaluation) it tracks.
 *
 * Upstream is codeberg.org/TauCeti/mangle-go, maintained by Mangle's author
 * (mirrored at github.com/google/mangle). The LSP names the tagged release
 * first, because that is what a host pins in go.mod, and the commit second.
 */
export const VERSION = '1.3.0';

/** Upstream module and release whose semantics this release follows. */
export const UPSTREAM_MANGLE_MODULE = 'codeberg.org/TauCeti/mangle-go';
export const UPSTREAM_MANGLE_VERSION = 'v0.7.0';

/** Commit of that release (refs/tags/v0.7.0) and its date. */
export const UPSTREAM_MANGLE_REVISION = '7cd2543 (2026-10-15)';

/** One line for --version and usage: "codeberg.org/TauCeti/mangle-go v0.7.0 (7cd2543, 2026-10-15)". */
export const UPSTREAM_MANGLE = `${UPSTREAM_MANGLE_MODULE} ${UPSTREAM_MANGLE_VERSION} (${UPSTREAM_MANGLE_REVISION.replace(' (', ', ').replace(')', '')})`;
