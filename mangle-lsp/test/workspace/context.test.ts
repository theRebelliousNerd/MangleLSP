/**
 * Program context: the editor and `check` see the declarations of the files a
 * host loads together with the one being diagnosed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProgramContext } from '../../src/workspace/context';
import { parseEmbedDirectives } from '../../src/workspace/embed';

const SCHEMA = `
Decl read_component_ord(Path, Ord) descr [fundep([Path], [Ord]), merge([Ord], "lower_ord")] bound [/string, /number].
Decl lower_ord(Held, Offered, Kept) descr [mode('+', '+', '-'), deferred()] bound [/number, /number, /number].
`;
const LINEAGE = `
lower_ord(Held, Offered, Held) :- Held <= Offered.
lower_ord(Held, Offered, Offered) :- Offered < Held.
`;

let root: string;
const write = (rel: string, text: string) => {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
    return join(root, rel);
};
const errors = (ctx: ProgramContext, file: string, text: string) =>
    ctx.analyze(file, text).diagnostics.filter(d => d.severity === 'error').map(d => d.code);
const read = (p: string) => require('fs').readFileSync(p, 'utf-8') as string;

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'mangle-ctx-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('declarations from sibling files (directory context)', () => {
    it('the comparator rules of a merge lattice are clean next to the Decl that gives them modes', () => {
        write('schema.mg', SCHEMA);
        const lineage = write('lineage.mg', LINEAGE);
        const alone = new ProgramContext({ isolated: true });
        expect(errors(alone, lineage, LINEAGE).sort()).toEqual(['E002', 'E002', 'E002', 'E002', 'E004', 'E004', 'E004', 'E004']);
        const ctx = new ProgramContext();
        const report = ctx.analyze(lineage, LINEAGE);
        expect(report.kind).toBe('directory');
        expect(report.context).toEqual([join(root, 'schema.mg')]);
        expect(report.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    });

    it('still reports true errors in the file, at the file\'s own lines', () => {
        write('schema.mg', SCHEMA);
        const text = `${LINEAGE}\nbroken(X, Y) :- Held <= Offered, other(Y).\n`;
        const file = write('lineage.mg', text);
        const diags = new ProgramContext().analyze(file, text).diagnostics.filter(d => d.severity === 'error');
        expect(diags.length).toBeGreaterThan(0);
        for (const d of diags) expect(d.range.start.line).toBe(5);
    });

    it('does not report problems that live in the context files', () => {
        write('schema.mg', `${SCHEMA}\nDecl dup(A) bound [/number].\nDecl dup(A) bound [/number].\n`);
        const file = write('lineage.mg', LINEAGE);
        expect(errors(new ProgramContext(), file, LINEAGE)).toEqual([]);
    });

    it('lets the file redeclare what a neighbour declares (no duplicate-Decl error)', () => {
        write('a.mg', 'Decl p(X) bound [/number].\n');
        const text = 'Decl p(X) bound [/number].\np(1).\n';
        const file = write('b.mg', text);
        expect(errors(new ProgramContext(), file, text)).toEqual([]);
    });

    it('a sibling with a syntax error does not swallow the file\'s statements', () => {
        write('a.mg', 'Decl p(X) bound [/number].\nbroken(X) :- p(X)\n');
        const text = 'q(X) :- p(X).\n';
        const file = write('b.mg', text);
        const report = new ProgramContext().analyze(file, text);
        expect(report.parseErrors).toEqual([]);
        expect(report.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    });

    it('is invalidated when a sibling changes on disk', () => {
        const schema = write('schema.mg', SCHEMA);
        const file = write('lineage.mg', LINEAGE);
        const ctx = new ProgramContext();
        expect(errors(ctx, file, LINEAGE)).toEqual([]);
        writeFileSync(schema, '# the Decl is gone\n');
        const later = new Date(Date.now() + 5000);
        utimesSync(schema, later, later);
        expect(errors(ctx, file, LINEAGE).length).toBe(8);
        writeFileSync(schema, SCHEMA + '\n');
        utimesSync(schema, new Date(Date.now() + 9000), new Date(Date.now() + 9000));
        expect(errors(ctx, file, LINEAGE)).toEqual([]);
    });

    it('prefers the text of an edited buffer over the file on disk', () => {
        const schema = write('schema.mg', '# nothing yet\n');
        const file = write('lineage.mg', LINEAGE);
        let buffer: string | undefined;
        const ctx = new ProgramContext({ overlay: p => (p === schema ? buffer : undefined) });
        expect(errors(ctx, file, LINEAGE).length).toBe(8);
        buffer = SCHEMA;
        expect(errors(ctx, file, LINEAGE)).toEqual([]);
    });
});

describe('programs assembled by //go:embed', () => {
    beforeEach(() => {
        write('go.mod', 'module example.test/app\n\ngo 1.22\n');
        write('policy/engine.go', 'package policy\n\nimport "embed"\n\n//go:embed *.mg\nvar files embed.FS\n');
    });

    it('analyzes the embedded files as one program: a neighbour\'s rules define the predicate', () => {
        write('policy/facts.mg', 'Decl seen(X) bound [/number].\nseen(1).\n');
        const text = 'reached(X) :- seen(X), derived(X).\n';
        const file = write('policy/rules.mg', text);
        write('policy/more.mg', 'derived(2).\n');
        const ctx = new ProgramContext();
        const report = ctx.analyze(file, text);
        expect(report.kind).toBe('embed');
        expect(report.context.sort()).toEqual([join(root, 'policy/facts.mg'), join(root, 'policy/more.mg')]);
        expect(report.diagnostics.find(d => d.code === 'E075')).toBeUndefined();
        expect(new ProgramContext({ isolated: true }).analyze(file, text).diagnostics.find(d => d.code === 'E075')).toBeDefined();
    });

    it('reports a cross-file error on the later file, once, in its own lines', () => {
        write('policy/a.mg', 'Decl p(X) bound [/number].\n');
        const text = '\n\nDecl p(X) bound [/string].\n';
        const file = write('policy/b.mg', text);
        const report = new ProgramContext().analyze(file, text);
        const dup = report.diagnostics.filter(d => d.code === 'E044');
        expect(dup.length).toBe(1);
        expect(dup[0]!.range.start.line).toBe(3);
        expect(new ProgramContext().analyze(join(root, 'policy/a.mg'), 'Decl p(X) bound [/number].\n').diagnostics.filter(d => d.code === 'E044')).toEqual([]);
    });

    it('finds files embedded from a package above through a subdirectory pattern', () => {
        write('policy/engine.go', 'package policy\n\n//go:embed defaults/*.mg defaults/schema/*.mg\nvar fs string\n');
        write('policy/defaults/schema/s.mg', 'Decl edge(A, B) bound [/number, /number].\n');
        const text = 'path(A, B) :- edge(A, B).\n';
        const file = write('policy/defaults/rules.mg', text);
        const report = new ProgramContext().analyze(file, text);
        expect(report.kind).toBe('embed');
        expect(report.context).toEqual([join(root, 'policy/defaults/schema/s.mg')]);
    });

    it('skips dot and underscore files in an embedded directory', () => {
        write('policy/engine.go', 'package policy\n\n//go:embed all_rules\nvar fs string\n');
        write('policy/all_rules/a.mg', 'a(1).\n');
        write('policy/all_rules/_scratch.mg', 'b(1).\n');
        const file = write('policy/all_rules/c.mg', 'c(1).\n');
        expect(new ProgramContext().analyze(file, 'c(1).\n').context).toEqual([join(root, 'policy/all_rules/a.mg')]);
    });

    it('a file embedded alone gets the directory context instead', () => {
        write('policy/engine.go', 'package policy\n\n//go:embed one.mg\nvar one string\n');
        write('policy/schema.mg', SCHEMA);
        const file = write('policy/one.mg', LINEAGE);
        const report = new ProgramContext().analyze(file, LINEAGE);
        expect(report.kind).toBe('directory');
        expect(report.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    });

    it('notices a new .mg file in an embedded directory', () => {
        write('policy/a.mg', 'Decl p(X) bound [/number].\n');
        const text = 'q(X) :- p(X), r(X).\n';
        const file = write('policy/b.mg', text);
        const ctx = new ProgramContext();
        expect(ctx.analyze(file, text).diagnostics.some(d => d.code === 'E075')).toBe(true);
        write('policy/c.mg', 'r(1).\n');
        const later = new Date(Date.now() + 5000);
        utimesSync(join(root, 'policy'), later, later);
        expect(ctx.analyze(file, text).diagnostics.some(d => d.code === 'E075')).toBe(false);
    });
});

describe('parseEmbedDirectives', () => {
    it('reads patterns, quoting, several directives and var blocks', () => {
        const src = [
            'package p', '',
            '//go:embed a.mg "dir with space/*.mg"',
            '// a note between',
            '//go:embed all:b',
            'var one embed.FS', '',
            'var (', '\t//go:embed `c.mg`', '\ttwo string', ')',
            '// go:embed not.mg', 'var three string',
        ].join('\n');
        expect(parseEmbedDirectives(src)).toEqual([
            { variable: 'one', patterns: ['a.mg', 'dir with space/*.mg', 'all:b'] },
            { variable: 'two', patterns: ['c.mg'] },
        ]);
    });
});

describe('ignoring files', () => {
    it('honours .mangleignore patterns: globs, directories, negation, anchoring', () => {
        write('.mangleignore', '# adversarial fixtures\nfixtures/\n*.bad.mg\n!keep.bad.mg\n/top.mg\n');
        const broken = 'p(X) :- q(Y).\n';
        const ctx = new ProgramContext();
        const checks: [string, boolean][] = [
            ['fixtures/a.mg', true], ['deep/fixtures/b/c.mg', true], ['x.bad.mg', true], ['keep.bad.mg', false],
            ['top.mg', true], ['sub/top.mg', false], ['normal.mg', false],
        ];
        for (const [rel, ignored] of checks) {
            const file = write(rel, broken);
            const report = ctx.analyze(file, broken);
            expect([rel, report.ignored]).toEqual([rel, ignored]);
            expect(report.diagnostics.length === 0).toBe(ignored);
        }
    });

    it('lets a nearer .mangleignore override a farther one', () => {
        write('.mangleignore', 'sub/*.mg\n');
        write('sub/.mangleignore', '!ok.mg\n');
        const ctx = new ProgramContext();
        expect(ctx.analyze(write('sub/a.mg', 'p(1).\n'), 'p(1).\n').ignored).toBe(true);
        expect(ctx.analyze(write('sub/ok.mg', 'p(1).\n'), 'p(1).\n').ignored).toBe(false);
    });

    it('honours the file directive and reads it at any line', () => {
        const text = 'p(X) :- q(Y).\n\n  #   mangle-ignore-file  \n';
        const report = new ProgramContext().analyze(write('x.mg', text), text);
        expect(report.ignored).toBe(true);
        expect(report.parseErrors).toEqual([]);
        expect(new ProgramContext().analyze(write('y.mg', '# mangle-ignore-files are not a thing\np(X) :- q(Y).\n'), '# mangle-ignore-files are not a thing\np(X) :- q(Y).\n').ignored).toBe(false);
    });

    it('an ignored file is no context for its neighbours', () => {
        write('.mangleignore', 'bad.mg\n');
        write('bad.mg', 'Decl p(X) bound [/number].\n');
        const text = 'q(X) :- p(X).\n';
        const file = write('good.mg', text);
        const report = new ProgramContext().analyze(file, text);
        expect(report.context).toEqual([]);
        expect(report.diagnostics.some(d => d.code === 'E075')).toBe(true);
    });

    it('picks up an edited .mangleignore without a restart', () => {
        const file = write('a.mg', 'p(X) :- q(Y).\n');
        const ctx = new ProgramContext();
        expect(ctx.analyze(file, read(file)).ignored).toBe(false);
        write('.mangleignore', 'a.mg\n');
        expect(ctx.analyze(file, read(file)).ignored).toBe(true);
    });
});
