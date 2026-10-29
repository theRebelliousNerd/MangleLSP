// Runs the Claude Code mod's tests (tests/*.test.tsx) with `claude plugin test`.
// The plugin root is this whole repo, whose vitest files the mod test host
// would also try to load, so the mod's own files are copied to a temp
// folder and tested there.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'mangle-mod-'));
try {
    for (const part of ['.claude-plugin/plugin.json', 'hooks', 'types', 'tests']) {
        cpSync(part, join(dir, part), { recursive: true });
    }
    const res = spawnSync('claude', ['plugin', 'test', dir], { stdio: 'inherit' });
    process.exitCode = res.status ?? 1;
} finally {
    rmSync(dir, { recursive: true, force: true });
}
