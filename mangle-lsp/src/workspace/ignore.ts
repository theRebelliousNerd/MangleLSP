/**
 * Excluding deliberately invalid Mangle from diagnostics.
 *
 * Two forms, both honoured by the language server and the CLI:
 *  - `.mangleignore`: gitignore syntax, patterns relative to the directory
 *    holding the file; applies to every file below it, and a nearer file
 *    overrides a farther one.
 *  - a comment line `# mangle-ignore-file` anywhere in a .mg file.
 * An ignored file is still parsed, highlighted and navigable; it only gets no
 * problems, and it is never used as context for its neighbours.
 */

import ignore, { Ignore } from 'ignore';
import { dirname, join, relative, sep } from 'path';
import { nodeFs, WorkspaceFs } from './fs';

export const IGNORE_FILE = '.mangleignore';
const DIRECTIVE = /^[ \t]*#[ \t]*mangle-ignore-file\b/m;

/** True when the text carries the file-level ignore directive. */
export function hasIgnoreDirective(text: string): boolean {
    return DIRECTIVE.test(text);
}

interface Loaded { sig: string; rules: Ignore | null }

export class IgnoreRules {
    private readonly cache = new Map<string, Loaded>();
    constructor(private readonly fs: WorkspaceFs = nodeFs) {}

    private rulesIn(dir: string): Ignore | null {
        const file = join(dir, IGNORE_FILE);
        const sig = this.fs.signature(file) ?? '';
        const hit = this.cache.get(dir);
        if (hit && hit.sig === sig) return hit.rules;
        const text = sig === '' ? undefined : this.fs.readFile(file);
        const rules = text === undefined ? null : ignore().add(text);
        this.cache.set(dir, { sig, rules });
        return rules;
    }

    /** Whether a `.mangleignore` above the file excludes it (nearest file with an opinion wins). */
    matches(path: string): boolean {
        for (let dir = dirname(path); ; dir = dirname(dir)) {
            const rules = this.rulesIn(dir);
            if (rules) {
                const rel = relative(dir, path).split(sep).join('/');
                if (rel !== '' && !rel.startsWith('..')) {
                    const r = rules.test(rel);
                    if (r.ignored) return true;
                    if (r.unignored) return false;
                }
            }
            if (dirname(dir) === dir) return false;
        }
    }

    /** Pattern match, or the directive in `text` (read from disk when not given). */
    isIgnored(path: string, text?: string): boolean {
        if (this.matches(path)) return true;
        const body = text ?? this.fs.readFile(path);
        return body !== undefined && hasIgnoreDirective(body);
    }
}
