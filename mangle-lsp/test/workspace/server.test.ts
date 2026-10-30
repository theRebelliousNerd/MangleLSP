/**
 * The language server over the wire: it diagnoses a file with the declarations
 * of the files beside it, re-checks the open neighbours when a buffer changes,
 * and publishes nothing for an ignored file.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ChildProcess, spawn } from 'child_process';
import { buildSync } from 'esbuild';
import { createMessageConnection, MessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';

interface Published { uri: string; diagnostics: { code?: string; severity?: number; message: string }[] }

const SCHEMA = `Decl lower_ord(Held, Offered, Kept) descr [mode('+', '+', '-'), deferred()] bound [/number, /number, /number].\n`;
const LINEAGE = `lower_ord(Held, Offered, Held) :- Held <= Offered.\nlower_ord(Held, Offered, Offered) :- Offered < Held.\n`;

let dir: string;
let proc: ChildProcess;
let conn: MessageConnection;
let published: Published[] = [];
let waiters: (() => void)[] = [];

const uriOf = (name: string) => pathToFileURL(join(dir, name)).toString();
const errorCodes = (name: string) => latest(name)?.diagnostics.filter(d => d.severity === 1).map(d => d.code) ?? [];
const latest = (name: string) => [...published].reverse().find(p => p.uri === uriOf(name));
async function until(cond: () => boolean, ms = 8000): Promise<void> {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > ms) throw new Error('timed out waiting for diagnostics');
        await new Promise<void>(r => { waiters.push(r); setTimeout(r, 50); });
    }
}
const open = (name: string, text: string) => conn.sendNotification('textDocument/didOpen', { textDocument: { uri: uriOf(name), languageId: 'mangle', version: 1, text } });

beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mangle-srv-'));
    mkdirSync(join(dir, 'bad'));
    writeFileSync(join(dir, 'lineage.mg'), LINEAGE);
    writeFileSync(join(dir, 'schema.mg'), '# no Decl yet\n');
    writeFileSync(join(dir, 'bad', 'x.mg'), 'p(X) :- q(Y).\n');
    writeFileSync(join(dir, '.mangleignore'), 'bad/\n');
    const out = join(dir, 'server.bundle.js');
    buildSync({ entryPoints: [join(__dirname, '..', '..', 'src', 'server.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
    proc = spawn(process.execPath, [out, '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });
    conn = createMessageConnection(new StreamMessageReader(proc.stdout!), new StreamMessageWriter(proc.stdin!));
    conn.onNotification('textDocument/publishDiagnostics', (p: Published) => { published.push(p); waiters.splice(0).forEach(w => w()); });
    conn.onRequest('workspace/configuration', () => [{}]);
    conn.listen();
    await conn.sendRequest('initialize', { processId: process.pid, rootUri: pathToFileURL(dir).toString(), capabilities: {} });
    conn.sendNotification('initialized', {});
}, 30_000);

afterAll(() => {
    conn?.dispose();
    proc?.kill();
    rmSync(dir, { recursive: true, force: true });
});

describe('language server', () => {
    it('does not report comparator errors that the sibling Decl explains away', async () => {
        open('lineage.mg', LINEAGE);
        await until(() => latest('lineage.mg') !== undefined);
        // schema.mg on disk has no Decl: the false positives are real until the Decl exists
        expect(errorCodes('lineage.mg').length).toBe(8);
        open('schema.mg', '# no Decl yet\n');
        await until(() => latest('schema.mg') !== undefined);
        // The user types the Decl into the open schema buffer (not saved): lineage.mg is checked again.
        conn.sendNotification('textDocument/didChange', {
            textDocument: { uri: uriOf('schema.mg'), version: 2 },
            contentChanges: [{ text: SCHEMA }],
        });
        await until(() => errorCodes('lineage.mg').length === 0);
        expect(errorCodes('schema.mg')).toEqual([]);
    });

    it('publishes nothing for a file .mangleignore excludes', async () => {
        open('bad/x.mg', 'p(X) :- q(Y).\n');
        await until(() => latest('bad/x.mg') !== undefined);
        expect(latest('bad/x.mg')!.diagnostics).toEqual([]);
    });

    it('still reports a true error in a file with context', async () => {
        const text = LINEAGE + 'broken(X, Y) :- Held <= Offered.\n';
        conn.sendNotification('textDocument/didChange', { textDocument: { uri: uriOf('lineage.mg'), version: 2 }, contentChanges: [{ text }] });
        await until(() => errorCodes('lineage.mg').length > 0);
        expect(latest('lineage.mg')!.diagnostics.every(d => d.severity !== 1 || /broken|Held|Offered|Y|X/.test(d.message))).toBe(true);
    });
});
