/**
 * The Go <-> .mg boundary findings (B-codes) for the editor.
 *
 * The scan reads a whole Go module (an engine run that takes seconds on a big
 * repository), so the editor never waits for it: a scan runs in a child
 * process, one per Go module at a time, debounced, started when a file of the
 * module opens and again after the module changes on disk. The findings of the
 * last finished scan are shown on the files they are anchored at, and the open
 * files are checked again when a scan finishes.
 */

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { BoundaryDiagnostic, BoundaryReport } from '../cli/commands/boundary';
import { moduleRootOf } from './embed';
import { nodeFs, WorkspaceFs } from './fs';

export type BoundaryRunner = (root: string) => Promise<BoundaryReport>;

/** Runs the CLI's `boundary` command (the sibling bundle of this server) in a child process. */
export function cliBoundaryRunner(cli: string = defaultCli()): BoundaryRunner {
    return root => new Promise((resolveRun, reject) => {
        execFile(process.execPath, [cli, 'boundary', '--root', root, '--format', 'json'],
            { maxBuffer: 512 * 1024 * 1024, cwd: root, env: process.env },
            (err, stdout, stderr) => {
                // Findings of severity error make the command exit 1 with a full report on stdout.
                if (stdout.trim().startsWith('{')) {
                    try { resolveRun(JSON.parse(stdout) as BoundaryReport); return; } catch { /* fall through */ }
                }
                reject(new Error(stderr.trim() || (err ? err.message : 'boundary produced no report')));
            });
    });
}

/** The CLI next to this module: the esbuild bundle of the extension, or the tsc output. */
function defaultCli(): string {
    for (const name of ['cli.bundle.js', 'cli.js']) {
        const p = join(__dirname, name);
        if (existsSync(p)) return p;
    }
    return join(__dirname, 'cli.js');
}

export interface BoundaryServiceOptions {
    run?: BoundaryRunner;
    fs?: WorkspaceFs;
    /** Called with the module root when a scan finished (or failed: `failed`). */
    onScan?: (root: string, failed?: Error) => void;
    debounceMs?: number;
}

interface ModuleState {
    report?: BoundaryReport;
    running: boolean;
    again: boolean;
    /** A scan was requested at least once (a failed first scan is not retried by `ensure`). */
    attempted: boolean;
    timer?: ReturnType<typeof setTimeout>;
}

export class BoundaryService {
    private readonly modules = new Map<string, ModuleState>();
    private readonly run: BoundaryRunner;
    private readonly fs: WorkspaceFs;
    private readonly onScan: (root: string, failed?: Error) => void;
    private readonly debounceMs: number;

    constructor(options: BoundaryServiceOptions = {}) {
        this.run = options.run ?? cliBoundaryRunner();
        this.fs = options.fs ?? nodeFs;
        this.onScan = options.onScan ?? (() => undefined);
        this.debounceMs = options.debounceMs ?? 1500;
    }

    /** The Go module a file belongs to. */
    rootOf(path: string): string | undefined {
        return moduleRootOf(this.fs, resolve(path, '..'));
    }

    /** Ask for a scan of the module of `path` (no-op outside a Go module). `soon` skips the debounce. */
    request(path: string, soon = false): void {
        const root = this.rootOf(path);
        if (root === undefined) return;
        const state = this.modules.get(root) ?? { running: false, again: false, attempted: false };
        this.modules.set(root, state);
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => { state.timer = undefined; void this.scan(root, state); }, soon ? 0 : this.debounceMs);
    }

    /** Asks for the first scan of a module only when there is no report yet. */
    ensure(path: string): void {
        const root = this.rootOf(path);
        if (root !== undefined && !this.modules.get(root)?.attempted && !this.modules.get(root)?.timer) this.request(path, true);
    }

    private async scan(root: string, state: ModuleState): Promise<void> {
        if (state.running) { state.again = true; return; }
        state.running = true;
        state.attempted = true;
        try {
            state.report = await this.run(root);
            this.onScan(root);
        } catch (e) {
            this.onScan(root, e instanceof Error ? e : new Error(String(e)));
        } finally {
            state.running = false;
            if (state.again) { state.again = false; void this.scan(root, state); }
        }
    }

    /** Findings of the last scan anchored at a .mg file. */
    findingsFor(path: string): BoundaryDiagnostic[] {
        const root = this.rootOf(path);
        const report = root === undefined ? undefined : this.modules.get(root)?.report;
        if (!root || !report) return [];
        const rel = resolve(path).slice(root.length + 1).split('\\').join('/');
        return report.diagnostics.filter(d => d.file === rel);
    }

    /** True while no scan of the module has finished. */
    pending(path: string): boolean {
        const root = this.rootOf(path);
        return root !== undefined && !this.modules.get(root)?.report;
    }

    dispose(): void {
        for (const s of this.modules.values()) if (s.timer) clearTimeout(s.timer);
    }
}
