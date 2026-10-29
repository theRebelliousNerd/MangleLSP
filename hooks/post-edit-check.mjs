#!/usr/bin/env node
// Engine check around .mg edits, for the Mangle Claude Code plugin.
//
//   pre   (PreToolUse):  the first time a session edits a .mg file in a
//                        project, snapshot `mangle-cli review` errors.
//   post  (PostToolUse): after a .mg edit, review again and report to
//                        Claude only the errors the edit introduced, then
//                        roll the snapshot forward.
//
// It reports by exiting 2 with the findings on stderr (Claude reads them).
// It never blocks on its own failure: no node, no Go or a timeout means a
// silent exit 0.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] === 'pre' ? 'pre' : 'post';
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.CLAUDE_PLUGIN_DATA ?? join(process.env.HOME ?? '/tmp', '.cache', 'mangle-plugin');
const cli = join(pluginRoot, 'mangle-vscode', 'server', 'cli.bundle.js');

let input;
try { input = JSON.parse(readFileSync(0, 'utf-8')); } catch { process.exit(0); }
const file = input?.tool_input?.file_path;
if (typeof file !== 'string' || !file.endsWith('.mg') || !existsSync(cli)) process.exit(0);

const git = spawnSync('git', ['-C', dirname(resolve(file)), 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' });
const root = git.status === 0 ? git.stdout.trim() : (process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? dirname(file));

const key = createHash('sha256').update(`${input.session_id ?? ''}\0${root}`).digest('hex').slice(0, 16);
const snapDir = join(dataDir, 'snapshots');
const snapPath = join(snapDir, `${key}.json`);

/** Error-level review items, keyed without line numbers so edits above don't shift them. */
function review() {
    const res = spawnSync('node', [cli, 'review', '--root', root, '--severity', 'error', '--format', 'json'], {
        cwd: root, encoding: 'utf-8', timeout: 80_000, maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, MANGLE_ORACLE_CACHE: process.env.MANGLE_ORACLE_CACHE ?? join(dataDir, 'oracle') },
    });
    if (res.error || !res.stdout) return undefined;
    try {
        const plan = JSON.parse(res.stdout).plan ?? [];
        return plan.filter(i => i.severity === 'error');
    } catch { return undefined; }
}
const identity = i => `${i.code}\0${i.file}\0${i.message}`;
const save = items => { mkdirSync(snapDir, { recursive: true }); writeFileSync(snapPath, JSON.stringify(items.map(identity))); };

if (mode === 'pre') {
    if (!existsSync(snapPath)) { const items = review(); if (items) save(items); }
    process.exit(0);
}

const after = review();
if (!after) process.exit(0);
const before = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf-8')) : [];
const seen = new Map();
for (const id of before) seen.set(id, (seen.get(id) ?? 0) + 1);
const fresh = after.filter(i => {
    const n = seen.get(identity(i)) ?? 0;
    if (n > 0) { seen.set(identity(i), n - 1); return false; }
    return true;
});
save(after);
if (fresh.length === 0) process.exit(0);

const rel = relative(root, resolve(file));
const lines = fresh.slice(0, 12).map(i =>
    `  ${i.file}:${i.line ?? '?'} [${i.code}] ${i.message}${i.hint ? `\n    fix: ${i.hint}` : ''}`);
process.stderr.write(
    `Mangle engine check after editing ${rel}: ${fresh.length} new error(s) across the assembled programs\n` +
    `${lines.join('\n')}${fresh.length > 12 ? `\n  ... and ${fresh.length - 12} more` : ''}\n` +
    `Explain a code: mangle-cli explain <code>. Full plan: mangle-cli review --root .\n`);
process.exit(2);
