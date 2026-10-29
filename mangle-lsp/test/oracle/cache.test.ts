import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { oracleFor } from '../../src/oracle/client';

const hasGo = spawnSync('go', ['version']).status === 0;

describe('oracle binary cache', () => {
    const saved = process.env['MANGLE_ORACLE_CACHE'];
    let dir: string | undefined;
    afterEach(() => {
        if (saved === undefined) delete process.env['MANGLE_ORACLE_CACHE'];
        else process.env['MANGLE_ORACLE_CACHE'] = saved;
        if (dir) rmSync(dir, { recursive: true, force: true });
    });

    it.skipIf(!hasGo)('builds into MANGLE_ORACLE_CACHE when it is set', () => {
        dir = mkdtempSync(join(tmpdir(), 'oracle-cache-'));
        process.env['MANGLE_ORACLE_CACHE'] = dir;
        const bin = oracleFor();
        expect(bin.path.startsWith(dir)).toBe(true);
        expect(existsSync(bin.path)).toBe(true);
    }, 180_000);
});
