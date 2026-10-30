/**
 * The slice of the file system the workspace layer reads, and a recorder that
 * lets a cached answer say what it depended on. A cache entry is fresh while
 * every path it touched still has the signature it had (mtime and size, or
 * absence), so a changed sibling, a new .mg file in an embedded directory or
 * an edited go:embed line invalidates exactly the answers that read it, with
 * no file watcher required.
 */

import { readdirSync, readFileSync, statSync } from 'fs';

export interface WorkspaceFs {
    /** A signature that changes whenever the path, or a directory's entry list, changes; undefined when absent. */
    signature(path: string): string | undefined;
    isDirectory(path: string): boolean;
    readDir(path: string): string[] | undefined;
    readFile(path: string): string | undefined;
}

export const nodeFs: WorkspaceFs = {
    signature(path) {
        try {
            const st = statSync(path);
            return `${st.isDirectory() ? 'd' : 'f'}:${st.mtimeMs}:${st.size}`;
        } catch {
            return undefined;
        }
    },
    isDirectory(path) {
        try { return statSync(path).isDirectory(); } catch { return false; }
    },
    readDir(path) {
        try { return readdirSync(path); } catch { return undefined; }
    },
    readFile(path) {
        try { return readFileSync(path, 'utf-8'); } catch { return undefined; }
    },
};

/** What a computation read: path to the signature it had (absent paths map to ''). */
export type Dependencies = Map<string, string>;

/** Wraps a file system and records the signature of every path read through it. */
export class RecordingFs implements WorkspaceFs {
    readonly deps: Dependencies = new Map();
    constructor(private readonly inner: WorkspaceFs) {}

    private note(path: string): void {
        if (!this.deps.has(path)) this.deps.set(path, this.inner.signature(path) ?? '');
    }
    signature(path: string): string | undefined { this.note(path); return this.inner.signature(path); }
    isDirectory(path: string): boolean { this.note(path); return this.inner.isDirectory(path); }
    readDir(path: string): string[] | undefined { this.note(path); return this.inner.readDir(path); }
    readFile(path: string): string | undefined { this.note(path); return this.inner.readFile(path); }
}

export function dependenciesFresh(fs: WorkspaceFs, deps: Dependencies): boolean {
    for (const [path, sig] of deps) {
        if ((fs.signature(path) ?? '') !== sig) return false;
    }
    return true;
}
