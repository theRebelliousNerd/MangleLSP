/**
 * Client for mangle-oracle, the Go helper that answers questions with the real
 * engine (codeberg.org/TauCeti/mangle-go): engine verdicts, evaluation with
 * proofs, why-not diagnosis and the Go <-> .mg boundary scan.
 *
 * Which engine: the one the target project pins. When the project's go.mod
 * requires codeberg.org/TauCeti/mangle-go at another version than the
 * oracle's own pin, an oracle is built against that version (cached as
 * bin/mangle-oracle-<version>); if that build fails, the pinned engine is used
 * and the report says so (`engine` in every output names the version that ran).
 *
 * Which binary: $MANGLE_ORACLE if set (used as is), else one built from the
 * repository's mangle-oracle/ (rebuilt when its sources are newer), else
 * mangle-oracle on PATH. Built binaries go to $MANGLE_ORACLE_CACHE when set
 * (a Claude Code plugin points it at its data directory), else mangle-oracle/bin.
 */

import { execFileSync, spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Source directory of the oracle: the repository's mangle-oracle/, found by
 * walking up from this module (mangle-lsp/dist/oracle, mangle-vscode/server).
 */
function findOracleSource(): string {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        const candidate = join(dir, 'mangle-oracle');
        if (existsSync(join(candidate, 'go.mod'))) return candidate;
        dir = resolve(dir, '..');
    }
    return join(resolve(__dirname, '..', '..', '..'), 'mangle-oracle');
}

const ORACLE_SOURCE = findOracleSource();
const ENGINE_MODULE = 'codeberg.org/TauCeti/mangle-go';
const EXE = process.platform === 'win32' ? '.exe' : '';

/** Where built oracle binaries and per-version module files live. */
function binDir(): string {
    return process.env['MANGLE_ORACLE_CACHE'] || join(ORACLE_SOURCE, 'bin');
}

export class OracleUnavailableError extends Error {}

function onPath(name: string): string | undefined {
    const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf-8' });
    const found = which.status === 0 ? which.stdout.split(/\r?\n/)[0]?.trim() : undefined;
    return found || undefined;
}

/** The engine version a go.mod requires, if it requires the engine at all. */
export function requiredEngineVersion(goModText: string): string | undefined {
    const m = goModText.match(new RegExp(`^\\s*(?:require\\s+)?${ENGINE_MODULE.replace(/[.]/g, '\\.')}\\s+(v[^\\s]+)`, 'm'));
    return m?.[1];
}

/** The nearest directory at or above `start` that holds a go.mod. */
export function projectRootOf(start: string): string | undefined {
    let dir = resolve(start);
    if (existsSync(dir) && !statSync(dir).isDirectory()) dir = dirname(dir);
    for (;;) {
        if (existsSync(join(dir, 'go.mod'))) return dir;
        const up = dirname(dir);
        if (up === dir) return undefined;
        dir = up;
    }
}

function newestSource(): number {
    let newest = 0;
    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            if (name === 'bin') continue;
            const full = join(dir, name);
            const st = statSync(full);
            if (st.isDirectory()) walk(full);
            else if (/\.(go|mg|json|mod|sum)$/.test(name)) newest = Math.max(newest, st.mtimeMs);
        }
    };
    walk(ORACLE_SOURCE);
    return newest;
}

function goBuild(out: string, modfile?: string): string | undefined {
    mkdirSync(binDir(), { recursive: true });
    const args = ['build', ...(modfile ? ['-modfile', modfile] : []), '-o', out, '.'];
    const res = spawnSync('go', args, { cwd: ORACLE_SOURCE, encoding: 'utf-8', env: { ...process.env, GOFLAGS: '-mod=mod' } });
    return res.status === 0 && existsSync(out) ? undefined : (res.stderr || 'go build failed');
}

const cache = new Map<string, OracleBinary>();

export interface OracleBinary {
    path: string;
    /** Why the binary is not the one the project asked for, if it is not. */
    note?: string;
}

/** A usable oracle for a project (its engine version), building it when necessary. */
export function oracleFor(projectRoot?: string): OracleBinary {
    const fromEnv = process.env['MANGLE_ORACLE'];
    if (fromEnv) {
        if (!existsSync(fromEnv)) throw new OracleUnavailableError(`MANGLE_ORACLE=${fromEnv} does not exist`);
        return { path: fromEnv };
    }
    const sourceOk = existsSync(join(ORACLE_SOURCE, 'go.mod'));
    const goOk = sourceOk && !!onPath('go');
    const pinned = sourceOk ? requiredEngineVersion(readFileSync(join(ORACLE_SOURCE, 'go.mod'), 'utf-8')) : undefined;
    const wanted = projectRoot && existsSync(join(projectRoot, 'go.mod'))
        ? requiredEngineVersion(readFileSync(join(projectRoot, 'go.mod'), 'utf-8'))
        : undefined;
    const key = wanted && wanted !== pinned ? wanted : 'pinned';
    const hit = cache.get(key);
    if (hit) return hit;

    const pinnedPath = join(binDir(), `mangle-oracle${EXE}`);
    const pinnedBinary = (): OracleBinary => {
        if (goOk && (!existsSync(pinnedPath) || statSync(pinnedPath).mtimeMs < newestSource())) {
            const err = goBuild(pinnedPath);
            if (err) throw new OracleUnavailableError(`building mangle-oracle failed:\n${err}`);
        }
        if (existsSync(pinnedPath)) return { path: pinnedPath };
        const installed = onPath('mangle-oracle');
        if (installed) return { path: installed };
        throw new OracleUnavailableError(
            'mangle-oracle is not available: set MANGLE_ORACLE, put mangle-oracle on PATH, or install Go so it can be built from ' + ORACLE_SOURCE);
    };

    let result: OracleBinary;
    if (key === 'pinned') {
        result = pinnedBinary();
    } else if (!goOk) {
        result = { ...pinnedBinary(), note: `the project requires ${ENGINE_MODULE} ${wanted}; without Go only the pinned ${pinned} is available` };
    } else {
        const variant = join(binDir(), `mangle-oracle-${wanted}${EXE}`);
        let err: string | undefined;
        if (!existsSync(variant) || statSync(variant).mtimeMs < newestSource()) {
            const modDir = join(binDir(), `mod-${wanted}`);
            mkdirSync(modDir, { recursive: true });
            const modfile = join(modDir, 'go.mod');
            copyFileSync(join(ORACLE_SOURCE, 'go.mod'), modfile);
            if (existsSync(join(ORACLE_SOURCE, 'go.sum'))) copyFileSync(join(ORACLE_SOURCE, 'go.sum'), join(modDir, 'go.sum'));
            const edit = spawnSync('go', ['mod', 'edit', `-modfile=${modfile}`, `-require=${ENGINE_MODULE}@${wanted}`], { cwd: ORACLE_SOURCE, encoding: 'utf-8' });
            err = edit.status === 0 ? goBuild(variant, modfile) : edit.stderr;
        }
        result = err
            ? { ...pinnedBinary(), note: `could not build mangle-oracle against ${ENGINE_MODULE} ${wanted} (the project's pin), so the pinned ${pinned} ran: ${err.split('\n')[0]}` }
            : { path: variant };
    }
    cache.set(key, result);
    return result;
}

/** Path of the oracle for the given project (or the pinned one). */
export function oraclePath(projectRoot?: string): string {
    return oracleFor(projectRoot).path;
}

/**
 * Runs one oracle command for a project and parses its JSON output. When the
 * oracle that ran is not the project's engine version, the output carries
 * `engineNote` saying why.
 */
export function runOracle<T>(args: string[], projectRoot?: string): T {
    const bin = oracleFor(projectRoot);
    try {
        const out = execFileSync(bin.path, args, { cwd: projectRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 512 });
        const parsed = JSON.parse(out) as T;
        if (bin.note && parsed && typeof parsed === 'object') (parsed as Record<string, unknown>)['engineNote'] = bin.note;
        return parsed;
    } catch (e) {
        const err = e as { stderr?: string; message: string };
        throw new Error(`mangle-oracle ${args[0]} failed: ${err.stderr?.trim() || err.message}`);
    }
}

// ----------------------------------------------------------------- shapes

export interface OracleStep { ok: boolean; error?: string }

export interface EngineVerdict {
    files: string[];
    /** First stage that rejected the program: parse, analyze, bounds, eval, or ok. */
    stage: 'parse' | 'analyze' | 'bounds' | 'eval' | 'ok';
    error?: string;
    parse: OracleStep;
    loose?: OracleStep;
    strict?: OracleStep;
    eval?: OracleStep;
}

export interface VerdictOutput { engine: string; engineNote?: string; verdicts: EngineVerdict[] }

export interface Proof {
    fact: string;
    kind: 'fact' | 'rule' | 'absent' | 'let' | 'aggregate';
    rule?: string;
    transform?: string;
    partial?: boolean;
    premises?: Proof[];
}

export interface RunOutput {
    engine: string;
    engineNote?: string;
    stage: string;
    error?: string;
    result?: { predicate: string; count: number; facts: string[]; why?: Proof[]; whyError?: string };
    strata?: string[][];
}

export interface WhyNotOutput {
    engine: string;
    engineNote?: string;
    result: {
        goal: string;
        holds?: string[];
        kind: 'derived' | 'extensional' | 'external';
        rules: { rule: string; funnel?: { premise: string; rows: number }[]; blockedAt: number; reason: string }[];
        summary: string;
    };
}

export interface OracleLocation { file: string; line: number }

export interface BoundaryFinding {
    code: string;
    predicate: string;
    arity: number;
    at: OracleLocation;
    position?: number;
    note?: string;
    decl?: OracleLocation;
    declared?: string[];
    related?: OracleLocation[];
    proof: string[];
}

export interface BoundaryOutput {
    engine: string;
    engineNote?: string;
    /** Host profile the Go side was read with. */
    profile: string;
    root: string;
    goFiles: number;
    mgFiles: number;
    assertSites: number;
    querySites: number;
    externalCallbacks: number;
    parseErrors: Record<string, string>;
    programs: { id: string; files: string[]; verdict: EngineVerdict }[];
    findings: BoundaryFinding[];
}
