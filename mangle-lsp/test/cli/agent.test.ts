/**
 * The agent commands end to end: review, boundary, run, whynot, advise, and
 * an advice quick fix checked on the real engine. Engine-backed tests run
 * when Go is installed (mangle-oracle builds on demand).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { runReview } from '../../src/cli/commands/review';
import { runBoundary } from '../../src/cli/commands/boundary';
import { runEngineQuery, runWhyNot } from '../../src/cli/commands/engine';
import { runCheck } from '../../src/cli/commands/check';
import { parse } from '../../src/parser/index';
import { analyzeUnit } from '../../src/analysis/pipeline';
import { requiredEngineVersion, projectRootOf } from '../../src/oracle/client';

const goAvailable = spawnSync('go', ['version']).status === 0;
const ORACLE_DIR = join(__dirname, '..', '..', '..', 'mangle-oracle');
const PROBES = join(__dirname, '..', 'fixtures', 'conformance', 'probes');

/** Applies one quick fix (all its edits) to source text. */
function applyFix(text: string, fix: { range: { start: { line: number; column: number }; end: { line: number; column: number } }; newText: string; additionalEdits?: { range: { start: { line: number; column: number }; end: { line: number; column: number } }; newText: string }[] }): string {
    const lines = text.split('\n');
    const offset = (p: { line: number; column: number }) => lines.slice(0, p.line - 1).reduce((n, l) => n + l.length + 1, 0) + p.column;
    const edits = [fix, ...(fix.additionalEdits ?? [])].sort((a, b) => offset(b.range.start) - offset(a.range.start));
    let out = text;
    for (const e of edits) out = out.slice(0, offset(e.range.start)) + e.newText + out.slice(offset(e.range.end));
    return out;
}

describe('CLI output through a pipe', () => {
    const bundle = join(__dirname, '..', '..', '..', 'mangle-vscode', 'server', 'cli.bundle.js');
    it.skipIf(!existsSync(bundle))('is complete when larger than a pipe buffer (no process.exit before the flush)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'mangle-pipe-'));
        const file = join(dir, 'big.mg');
        writeFileSync(file, Array.from({ length: 400 }, (_, i) => `r${i}(X) :- p${i}(X), q${i}(Y).`).join('\n') + '\n');
        const res = spawnSync('node', [bundle, 'check', file], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
        expect(res.stdout.length).toBeGreaterThan(65536);
        expect(() => JSON.parse(res.stdout)).not.toThrow();
    });
});

describe('Engine version of a project', () => {
    it("reads the engine version a go.mod requires", () => {
        expect(requiredEngineVersion('module x\n\nrequire (\n\tcodeberg.org/TauCeti/mangle-go v0.7.0\n\tgithub.com/x/y v1.0.0\n)\n')).toBe('v0.7.0');
        expect(requiredEngineVersion('module x\n\nrequire codeberg.org/TauCeti/mangle-go v0.6.1 // indirect\n')).toBe('v0.6.1');
    });
    it('is undefined for a module without the engine', () => {
        expect(requiredEngineVersion('module x\n\nrequire github.com/google/mangle v0.4.0\n')).toBeUndefined();
    });
    it('finds the project root above a file', () => {
        const dir = mkdtempSync(join(tmpdir(), 'mangle-root-'));
        mkdirSync(join(dir, 'a', 'b'), { recursive: true });
        writeFileSync(join(dir, 'go.mod'), 'module x\n');
        writeFileSync(join(dir, 'a', 'b', 'p.mg'), 'p(1).\n');
        expect(projectRootOf(join(dir, 'a', 'b', 'p.mg'))).toBe(dir);
    });
});

describe('advise', () => {
    it('reports only advice codes', () => {
        const r = runCheck([join(PROBES, 'collect_to_map.mg')], { format: 'json', quiet: true, severity: 'info', failOn: 'never', explain: false });
        const advice = r.files[0]!.diagnostics.filter(d => d.code.startsWith('A'));
        expect(advice.map(d => d.code)).toEqual(['A005']);
    });
});

describe.skipIf(!goAvailable)('Engine-backed commands', () => {
    let repo: string;
    beforeAll(() => {
        repo = mkdtempSync(join(tmpdir(), 'mangle-review-'));
        mkdirSync(join(repo, 'core'), { recursive: true });
        writeFileSync(join(repo, 'go.mod'), 'module example.com/r\n\ngo 1.22\n');
        writeFileSync(join(repo, 'core', 'kernel.go'), [
            'package core', '', 'import "embed"', '',
            '//go:embed schema.mg policy.mg', 'var logic embed.FS', '',
            'type Fact struct {', '\tPredicate string', '\tArgs      []any', '}', '',
            'func facts(id string) []Fact {',
            '\treturn []Fact{{Predicate: "score", Args: []any{id, 0.5}}}',
            '}', '',
        ].join('\n'));
        writeFileSync(join(repo, 'core', 'schema.mg'), 'Decl score(Id, S) bound [/string, /number].\nDecl ext(X, Y) descr [external(), mode(\'+\', \'-\')] bound [/string, /string].\n');
        writeFileSync(join(repo, 'core', 'policy.mg'), '# policy\nhigh(I) :- score(I, S), S > 3.\nmiss(I) :- score(I, _), !ext(I, "x").\n');
    }, 120_000);

    it('boundary and review report rules that can never fire and conclusions nothing reads, with proofs', () => {
        const dead = mkdtempSync(join(tmpdir(), 'mangle-dead-'));
        mkdirSync(join(dead, 'core'), { recursive: true });
        writeFileSync(join(dead, 'go.mod'), 'module example.com/d\n\ngo 1.22\n');
        writeFileSync(join(dead, 'core', 'kernel.go'), [
            'package core', '',
            'type Fact struct {', '\tPredicate string', '\tArgs      []any', '}', '',
            'func facts(id string, q interface{ Query(string) ([]Fact, error) }) []Fact {',
            '\t_, _ = q.Query("shown")',
            '\treturn []Fact{{Predicate: "score", Args: []any{id, 1}}}',
            '}', '',
        ].join('\n'));
        writeFileSync(join(dead, 'core', 'rules.mg'), [
            'Decl score(Id, S) bound [/string, /number].',
            'Decl never(Id) bound [/string].',
            'dead(I) :- never(I).',
            'dead_too(I) :- score(I, _), dead(I).',
            'quiet(I) :- score(I, _), !dead(I).',
            'shown(I) :- score(I, _), !dead(I).',
            'side(I) :- score(I, _).',
            '',
        ].join('\n'));
        const r = runReview(dead);
        const at = (code: string) => r.plan.filter(a => a.code === code).map(a => `${a.file}:${a.line}`).sort();
        // Blocked: the premise nothing produces, and the rule that reads the blocked rule's head.
        expect(at('B013')).toEqual(['core/rules.mg:3', 'core/rules.mg:4']);
        const direct = r.plan.find(a => a.code === 'B013' && a.line === 3)!;
        expect(direct.message).toContain('never/1');
        expect(direct.message).toContain('never fire');
        expect(r.plan.find(a => a.code === 'B013' && a.line === 4)!.message).toContain('dead/1');
        expect(direct.proof?.some(p => p.startsWith('not live('))).toBe(true);
        // Not read by anything that reaches a Go query: dead_too, quiet, side. shown is queried, and
        // its negated premise makes dead a needed predicate.
        expect(at('B014')).toEqual(['core/rules.mg:4', 'core/rules.mg:5', 'core/rules.mg:7']);
        expect(r.plan.find(a => a.code === 'B014' && a.line === 7)!.message).toContain('side/1');
        expect(r.plan.find(a => a.code === 'B014')!.severity).toBe('warning');
    }, 120_000);

    it('mangle-oracle passes its own Go tests', () => {
        const res = spawnSync('go', ['test', '-count=1', './...'], { cwd: ORACLE_DIR, encoding: 'utf-8' });
        expect(res.status, res.stdout + res.stderr).toBe(0);
    }, 180_000);

    it('boundary finds the float in a /number column, with its proof', () => {
        const r = runBoundary(repo);
        const b007 = r.diagnostics.find(d => d.code === 'B007');
        expect(b007?.file).toBe('core/kernel.go');
        expect(b007?.message).toContain('float64');
        expect(b007?.proof.some(p => p.startsWith('go_arg('))).toBe(true);
        expect(r.programs.map(p => p.id)).toEqual(['core:logic']);
    }, 120_000);

    it('review assembles the embed program, so a cross-file negated external is found', () => {
        const r = runReview(repo);
        const e081 = r.plan.find(a => a.code === 'E081');
        expect(e081?.file).toBe('core/policy.mg');
        expect(e081?.edits?.length).toBe(2);
        expect(r.plan.find(a => a.code === 'B011')).toBeDefined();
        expect(r.plan.some(a => a.code === 'E075')).toBe(false); // score is declared in schema.mg
        expect(r.plan[0]!.severity).toBe('error'); // most severe first
    }, 120_000);

    it('review without the boundary scan still assembles nothing and says why', () => {
        const r = runReview(repo, { noBoundary: true });
        expect(r.plan.some(a => a.code === 'B007')).toBe(false);
    }, 120_000);

    it('run lists facts and explains one with a proof', () => {
        const r = runEngineQuery([join(PROBES, 'argmax_join_back.mg')], { query: 'latest', why: 'latest(/f1, "new")' });
        expect(r.result?.facts).toEqual(['latest(/f1,"new")', 'latest(/f2,"only")']);
        const proof = r.result?.why?.[0];
        expect(proof?.kind).toBe('rule');
        // Recorder mode explains through the aggregation that chose the winner.
        expect(proof?.premises?.[0]?.kind).toBe('aggregate');
    }, 120_000);

    it('whynot names the premise that blocks a goal', () => {
        const w = runWhyNot([join(PROBES, 'argmax_join_back.mg')], 'latest(/f3, V)');
        const rule = w.result.rules[0]!;
        // The goal's constant becomes F = /f3 (1 row); latest_t has no row for /f3.
        expect(rule.funnel!.map(s => s.rows)).toEqual([1, 0, 0]);
        expect(rule.blockedAt).toBe(1);
        expect(rule.reason).toContain('latest_t/2');
    }, 120_000);

    it('the A001 quick fix gives the same winners on the engine', () => {
        const file = join(PROBES, 'argmax_join_back.mg');
        const text = readFileSync(file, 'utf-8');
        const fix = analyzeUnit(parse(text).unit!).diagnostics.find(d => d.code === 'A001')!.fixes![0]!;
        const dir = mkdtempSync(join(tmpdir(), 'mangle-a001-'));
        const fixed = join(dir, 'fixed.mg');
        writeFileSync(fixed, applyFix(text, fix));
        const best = runEngineQuery([fixed], { query: 'best_obs' }).result!.facts;
        expect(best).toEqual(['best_obs(/f1,fn:pair(30, "new"))', 'best_obs(/f2,fn:pair(5, "only"))']);
    }, 120_000);

    it('the E081 quick fix makes the external answer the negation', () => {
        const file = join(PROBES, 'neg_external.mg');
        const text = readFileSync(file, 'utf-8');
        const d = analyzeUnit(parse(text).unit!).diagnostics.find(x => x.code === 'E081')!;
        const fixed = applyFix(text, d.fixes![0]!);
        expect(fixed).toContain('neg(X) :- item(X), !ext_holds(X).');
        expect(fixed).toContain('ext_holds(X) :- item(X), ext(X, "hit").');
        const dir = mkdtempSync(join(tmpdir(), 'mangle-e081-'));
        writeFileSync(join(dir, 'fixed.mg'), fixed);
        expect(runEngineQuery([join(dir, 'fixed.mg')], { query: 'neg' }).stage).toBe('ok');
    }, 120_000);
});
