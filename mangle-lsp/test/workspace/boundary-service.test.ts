/**
 * The editor's view of the Go boundary: scans run in the background, once at a
 * time per module, debounced, and their findings land on the file they name.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BoundaryService } from '../../src/workspace/boundary-service';
import type { BoundaryReport } from '../../src/cli/commands/boundary';

let root: string;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mangle-bsvc-'));
    mkdirSync(join(root, 'core'));
    writeFileSync(join(root, 'go.mod'), 'module x\n');
    writeFileSync(join(root, 'core', 'a.mg'), 'p(1).\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const report = (file: string): BoundaryReport => ({
    engine: 'e', profile: 'generic', root, scanned: { goFiles: 0, mgFiles: 0, assertSites: 0, querySites: 0, externalCallbacks: 0 },
    programs: [], parseErrors: {}, summary: {},
    diagnostics: [
        { code: 'B013', severity: 'warning', title: 't', predicate: 'p/1', file, line: 3, message: 'm', related: [], proof: [] },
        { code: 'B013', severity: 'warning', title: 't', predicate: 'q/1', file: 'other.mg', line: 1, message: 'm', related: [], proof: [] },
    ],
});
const settle = () => new Promise(r => setTimeout(r, 30));

describe('BoundaryService', () => {
    it('scans once for many requests, then serves the findings of the file they are anchored at', async () => {
        let runs = 0;
        const scans: string[] = [];
        const svc = new BoundaryService({ debounceMs: 5, run: async () => { runs++; return report('core/a.mg'); }, onScan: r => scans.push(r) });
        const file = join(root, 'core', 'a.mg');
        expect(svc.findingsFor(file)).toEqual([]);
        expect(svc.pending(file)).toBe(true);
        svc.request(file); svc.request(file); svc.request(file);
        await settle();
        expect(runs).toBe(1);
        expect(scans).toEqual([root]);
        expect(svc.findingsFor(file).map(d => d.predicate)).toEqual(['p/1']);
        expect(svc.pending(file)).toBe(false);
        svc.dispose();
    });

    it('queues one more scan when asked during a scan, and never overlaps two', async () => {
        let running = 0, maxRunning = 0, runs = 0;
        const svc = new BoundaryService({
            debounceMs: 0,
            run: async () => { runs++; running++; maxRunning = Math.max(maxRunning, running); await new Promise(r => setTimeout(r, 25)); running--; return report('core/a.mg'); },
        });
        const file = join(root, 'core', 'a.mg');
        svc.request(file, true);
        await new Promise(r => setTimeout(r, 10));
        svc.request(file, true);
        svc.request(file, true);
        await new Promise(r => setTimeout(r, 120));
        expect(runs).toBe(2);
        expect(maxRunning).toBe(1);
    });

    it('does not retry a failed first scan by itself, and reports the failure', async () => {
        let runs = 0;
        const failures: string[] = [];
        const svc = new BoundaryService({ debounceMs: 0, run: async () => { runs++; throw new Error('no go'); }, onScan: (_r, e) => { if (e) failures.push(e.message); } });
        const file = join(root, 'core', 'a.mg');
        svc.ensure(file);
        await settle();
        svc.ensure(file);
        await settle();
        expect(runs).toBe(1);
        expect(failures).toEqual(['no go']);
        expect(svc.findingsFor(file)).toEqual([]);
    });

    it('ignores files outside a Go module', async () => {
        const stray = mkdtempSync(join(tmpdir(), 'mangle-nomod-'));
        writeFileSync(join(stray, 'a.mg'), 'p(1).\n');
        let runs = 0;
        const svc = new BoundaryService({ debounceMs: 0, run: async () => { runs++; return report('a.mg'); } });
        svc.request(join(stray, 'a.mg'), true);
        await settle();
        // a go.mod may exist above the temp directory on odd machines; the point is that nothing throws
        expect(runs === 0 || svc.rootOf(join(stray, 'a.mg')) !== undefined).toBe(true);
        rmSync(stray, { recursive: true, force: true });
    });
});
