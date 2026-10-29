// Tests for check-private-terms.mjs against throwaway git repos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./check-private-terms.mjs', import.meta.url));
const ZERO = '0'.repeat(40);

function repo(t) {
    const dir = mkdtempSync(join(tmpdir(), 'private-terms-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', '/dev/null');
    const terms = join(dir, '.terms');
    writeFileSync(terms, '# private\nsecret-?proj\ninternal/hidden\n');
    const run = (args, input) =>
        spawnSync('node', [SCRIPT, ...args], {
            cwd: dir,
            input,
            encoding: 'utf8',
            env: { ...process.env, MANGLE_PRIVATE_TERMS: terms },
        });
    const commit = (file, text, message = 'change') => {
        writeFileSync(join(dir, file), text);
        git('add', file);
        git('commit', '-q', '-m', message);
        return git('rev-parse', 'HEAD');
    };
    return { dir, git, run, commit };
}

test('tracked: reports the file and line of a match, case-insensitively', t => {
    const r = repo(t);
    r.commit('notes.md', 'fine\nlearned in Secret-Proj\n');
    const res = r.run([]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /notes\.md:2: matches \/secret-\?proj\//);
});

test('tracked: a clean tree passes', t => {
    const r = repo(t);
    r.commit('notes.md', 'nothing to see\n');
    assert.equal(r.run([]).status, 0);
});

test('staged: checks the index, not unstaged edits', t => {
    const r = repo(t);
    r.commit('a.md', 'clean\n');
    writeFileSync(join(r.dir, 'a.md'), 'see internal/hidden/x.go\n');
    assert.equal(r.run(['staged']).status, 0);
    r.git('add', 'a.md');
    const res = r.run(['staged']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /a\.md:1/);
});

test('message: ignores git comment lines', t => {
    const r = repo(t);
    const msg = join(r.dir, 'MSG');
    writeFileSync(msg, 'skill: a lesson\n# secretproj in a comment\n');
    assert.equal(r.run(['message', msg]).status, 0);
    writeFileSync(msg, 'skill: what secretproj taught\n');
    assert.match(r.run(['message', msg]).stderr, /commit message:1/);
});

test('push: checks messages and added lines of the commits being pushed', t => {
    const r = repo(t);
    const base = r.commit('a.md', 'one\ntwo\n');
    const bad = r.commit('a.md', 'one\ntwo\nthree secretproj\n');
    const res = r.run(['push'], `refs/heads/main ${bad} refs/heads/main ${base}\n`);
    assert.equal(res.status, 1);
    assert.match(res.stderr, new RegExp(`${bad.slice(0, 7)} a\\.md:3`));

    const msgOnly = r.commit('b.md', 'clean\n', 'from secretproj');
    const res2 = r.run(['push'], `refs/heads/main ${msgOnly} refs/heads/main ${bad}\n`);
    assert.equal(res2.status, 1);
    assert.match(res2.stderr, /message:1/);
});

test('push: a clean range passes, a new branch is checked against remotes, a delete is skipped', t => {
    const r = repo(t);
    const base = r.commit('a.md', 'secretproj\n');
    const clean = r.commit('a.md', 'removed\n');
    assert.equal(r.run(['push'], `refs/heads/main ${clean} refs/heads/main ${base}\n`).status, 0);
    // No remotes: a new branch pushes its whole history, including the bad first commit.
    assert.equal(r.run(['push'], `refs/heads/main ${clean} refs/heads/main ${ZERO}\n`).status, 1);
    assert.equal(r.run(['push'], `(delete) ${ZERO} refs/heads/old ${base}\n`).status, 0);
});

test('push: an unknown remote tip (force push) falls back to everything not on a remote', t => {
    const r = repo(t);
    const head = r.commit('a.md', 'secretproj\n');
    const res = r.run(['push'], `refs/heads/main ${head} refs/heads/main ${'1'.repeat(40)}\n`);
    assert.equal(res.status, 1);
});

test('no denylist: skips with a note', t => {
    const r = repo(t);
    r.commit('a.md', 'secretproj\n');
    const res = spawnSync('node', [SCRIPT], {
        cwd: r.dir,
        encoding: 'utf8',
        env: { ...process.env, MANGLE_PRIVATE_TERMS: join(r.dir, 'missing') },
    });
    assert.equal(res.status, 0);
    assert.match(res.stderr, /no denylist/);
});
