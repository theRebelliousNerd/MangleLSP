/**
 * Which .mg files does a Go package assemble into one program? Reads
 * `//go:embed` directives the way the Go toolchain does (patterns relative to
 * the package directory, globs per path element, directories walked
 * recursively without dot and underscore entries unless `all:`), so the editor
 * knows the program a file belongs to without running Go.
 */

import { dirname, join } from 'path';
import type { WorkspaceFs } from './fs';

export interface EmbedDirective {
    variable: string;
    patterns: string[];
}

export interface EmbedGroup {
    /** `<package dir>:<variable>` */
    id: string;
    /** Absolute paths, sorted. */
    files: string[];
}

const TOKEN = /"((?:[^"\\]|\\.)*)"|`([^`]*)`|(\S+)/g;

/** The `//go:embed` directives of one Go source file, with the variable each one feeds. */
export function parseEmbedDirectives(source: string): EmbedDirective[] {
    const out: EmbedDirective[] = [];
    let pending: string[] = [];
    for (const raw of source.split('\n')) {
        const line = raw.trim();
        const embed = /^\/\/go:embed\s+(.*)$/.exec(line);
        if (embed) {
            for (const m of embed[1]!.matchAll(TOKEN)) pending.push(m[1] ?? m[2] ?? m[3]!);
            continue;
        }
        if (line === '' || line.startsWith('//') || /^var\s*\($/.test(line)) continue;
        if (pending.length > 0) {
            const name = /^(?:var\s+)?([A-Za-z_]\w*)/.exec(line);
            if (name) out.push({ variable: name[1]!, patterns: pending });
            pending = [];
        }
    }
    return out;
}

function segmentMatcher(segment: string): RegExp | undefined {
    if (!/[*?[]/.test(segment)) return undefined;
    let re = '';
    for (let i = 0; i < segment.length; i++) {
        const c = segment[i]!;
        if (c === '*') re += '[^/]*';
        else if (c === '?') re += '[^/]';
        else if (c === '[') {
            const end = segment.indexOf(']', i + 1);
            if (end < 0) { re += '\\['; continue; }
            let cls = segment.slice(i + 1, end);
            if (cls.startsWith('^')) cls = '^' + cls.slice(1);
            re += `[${cls.replace(/\\/g, '\\\\')}]`;
            i = end;
        } else if (c === '\\' && i + 1 < segment.length) re += segment[++i]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
}

function collectMangle(fs: WorkspaceFs, path: string, all: boolean, out: string[], top: boolean): void {
    if (!fs.isDirectory(path)) {
        if (path.endsWith('.mg')) out.push(path);
        return;
    }
    // A directory with its own go.mod is another module: never embedded.
    if (!top && fs.signature(join(path, 'go.mod')) !== undefined) return;
    for (const name of fs.readDir(path) ?? []) {
        if (!all && (name.startsWith('.') || name.startsWith('_'))) continue;
        collectMangle(fs, join(path, name), all, out, false);
    }
}

/** The .mg files one embed pattern selects in `dir`. */
export function expandEmbedPattern(fs: WorkspaceFs, dir: string, pattern: string): string[] {
    const all = pattern.startsWith('all:');
    const parts = (all ? pattern.slice(4) : pattern).split('/').filter(p => p !== '' && p !== '.');
    if (parts.includes('..')) return [];
    let paths = [dir];
    for (const part of parts) {
        const re = segmentMatcher(part);
        const next: string[] = [];
        for (const p of paths) {
            if (!re) {
                if (fs.signature(join(p, part)) !== undefined) next.push(join(p, part));
            } else {
                for (const name of fs.readDir(p) ?? []) if (re.test(name)) next.push(join(p, name));
            }
        }
        paths = next;
    }
    const files: string[] = [];
    for (const p of paths) collectMangle(fs, p, all, files, true);
    return files;
}

/** Every embed group of the Go package in `dir` that selects at least one .mg file. */
export function embedGroupsOfPackage(fs: WorkspaceFs, dir: string): EmbedGroup[] {
    const byId = new Map<string, Set<string>>();
    for (const name of (fs.readDir(dir) ?? []).sort()) {
        if (!name.endsWith('.go')) continue;
        const src = fs.readFile(join(dir, name));
        if (src === undefined || !src.includes('go:embed')) continue;
        for (const d of parseEmbedDirectives(src)) {
            const files = d.patterns.flatMap(p => expandEmbedPattern(fs, dir, p));
            if (files.length === 0) continue;
            const id = `${dir}:${d.variable}`;
            const set = byId.get(id) ?? new Set<string>();
            for (const f of files) set.add(f);
            byId.set(id, set);
        }
    }
    return [...byId].map(([id, files]) => ({ id, files: [...files].sort() }));
}

/** The nearest ancestor of `dir` (or `dir`) holding a go.mod. */
export function moduleRootOf(fs: WorkspaceFs, dir: string): string | undefined {
    for (let d = dir; ; d = dirname(d)) {
        if (fs.signature(join(d, 'go.mod')) !== undefined) return d;
        if (dirname(d) === d) return undefined;
    }
}

/**
 * The embed groups that can contain a file in `dir`: those of the package in
 * `dir` and of every package above it up to the module root (an embed pattern
 * reaches into subdirectories).
 */
export function embedGroupsAbove(fs: WorkspaceFs, dir: string): EmbedGroup[] {
    const root = moduleRootOf(fs, dir);
    if (root === undefined) return [];
    const groups: EmbedGroup[] = [];
    for (let d = dir; ; d = dirname(d)) {
        groups.push(...embedGroupsOfPackage(fs, d));
        if (d === root) break;
    }
    return groups;
}
