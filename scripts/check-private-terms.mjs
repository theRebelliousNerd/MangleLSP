// Fails when content headed for this public repo names a private project.
// The denylist stays outside the repo, since committing it would publish it:
// one case-insensitive regex per line in $MANGLE_PRIVATE_TERMS, default
// ~/.config/mangle-lsp/private-terms.txt; `#` starts a comment line.
//
//   node scripts/check-private-terms.mjs            every tracked file
//   node scripts/check-private-terms.mjs staged     the staged files (pre-commit)
//   node scripts/check-private-terms.mjs message F  a commit message file (commit-msg)
//   node scripts/check-private-terms.mjs push       pushed commits, refs on stdin (pre-push)
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ZERO_SHA = /^0+$/;

export function denylistPath(env = process.env) {
    return env.MANGLE_PRIVATE_TERMS || join(homedir(), '.config', 'mangle-lsp', 'private-terms.txt');
}

export function loadPatterns(path) {
    return readFileSync(path, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => new RegExp(line, 'i'));
}

function lineHits(where, line, patterns) {
    return patterns.filter(re => re.test(line)).map(re => `${where}: matches /${re.source}/`);
}

export function findHits(label, text, patterns) {
    return text.split('\n').flatMap((line, i) => lineHits(`${label}:${i + 1}`, line, patterns));
}

const git = (args, opts = {}) => execFileSync('git', args, { maxBuffer: 1 << 28, ...opts });
const isText = buf => !buf.subarray(0, 8000).includes(0);

function scanBlobs(paths, read, patterns) {
    return paths.flatMap(path => {
        const buf = read(path);
        return isText(buf) ? findHits(path, buf.toString('utf8'), patterns) : [];
    });
}

function nulList(buf) {
    return buf.toString('utf8').split('\0').filter(Boolean);
}

export function scanTracked(patterns) {
    const paths = nulList(git(['ls-files', '-z']));
    return scanBlobs(paths.filter(existsSync), path => readFileSync(path), patterns);
}

export function scanStaged(patterns) {
    const paths = nulList(git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']));
    return scanBlobs(paths, path => git(['show', `:${path}`]), patterns);
}

export function scanMessage(file, patterns) {
    const text = readFileSync(file, 'utf8').split('\n').filter(line => !line.startsWith('#')).join('\n');
    return findHits('commit message', text, patterns);
}

// One commit's message and the lines it adds.
function scanCommit(sha, patterns) {
    const short = sha.slice(0, 7);
    const hits = findHits(`${short} message`, git(['show', '-s', '--format=%B', sha], { encoding: 'utf8' }), patterns);
    const patch = git(['show', '--format=', '--no-color', '--unified=0', '--diff-merges=first-parent', sha], {
        encoding: 'utf8',
    });
    let file = '';
    let lineNo = 0;
    let inHeader = false;
    for (const line of patch.split('\n')) {
        const hunk = /^@@ -\S+ \+(\d+)/.exec(line);
        if (line.startsWith('diff --git ')) inHeader = true;
        else if (hunk) [inHeader, lineNo] = [false, Number(hunk[1])];
        else if (inHeader && line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '');
        else if (!inHeader && line.startsWith('+')) hits.push(...lineHits(`${short} ${file}:${lineNo++}`, line.slice(1), patterns));
    }
    return hits;
}

// stdin lines: <local ref> <local sha> <remote ref> <remote sha>
export function scanPush(refLines, patterns) {
    const shas = new Set();
    for (const line of refLines.split('\n')) {
        const [, local, , remote] = line.trim().split(/\s+/);
        if (!local || ZERO_SHA.test(local)) continue;
        let range = ['--not', '--remotes'];
        if (remote && !ZERO_SHA.test(remote)) {
            try {
                git(['cat-file', '-e', `${remote}^{commit}`], { stdio: 'ignore' });
                range = [`^${remote}`];
            } catch {
                // A remote tip this clone has never fetched (a force push): check everything not on a remote.
            }
        }
        for (const sha of git(['rev-list', local, ...range], { encoding: 'utf8' }).split('\n')) {
            if (sha) shas.add(sha);
        }
    }
    return [...shas].flatMap(sha => scanCommit(sha, patterns));
}

function main([mode = 'tracked', arg]) {
    const path = denylistPath();
    if (!existsSync(path)) {
        console.error(`check-private-terms: no denylist at ${path}; skipped`);
        return 0;
    }
    const patterns = loadPatterns(path);
    const hits =
        mode === 'tracked' ? scanTracked(patterns)
        : mode === 'staged' ? scanStaged(patterns)
        : mode === 'message' ? scanMessage(arg, patterns)
        : mode === 'push' ? scanPush(readFileSync(0, 'utf8'), patterns)
        : null;
    if (hits === null) {
        console.error(`check-private-terms: unknown mode ${mode}`);
        return 2;
    }
    if (hits.length === 0) return 0;
    console.error('Private-project terms found in content bound for this public repo:');
    for (const hit of hits) console.error(`  ${hit}`);
    console.error(`Remove them, or restate the lesson without the project (denylist: ${path}).`);
    return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main(process.argv.slice(2));
}
