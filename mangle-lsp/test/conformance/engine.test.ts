/**
 * Differential conformance with the upstream engine (TauCeti mangle-go v0.7).
 *
 * engine-verdicts.json holds the engine's verdict on every fixture (upstream
 * examples, upstream analysis test cases, and probe programs that pin v0.7
 * behaviour), produced by mangle-oracle (`npm run conformance:refresh`). Each
 * fixture must get an agreeing LSP verdict, except the listed known
 * disagreements. When Go is installed, the verdicts are recomputed live and
 * must still match the file, so an engine upgrade cannot drift silently.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { classify, isAgreement, lspVerdictOf, Agreement } from '../../src/cli/commands/conformance';
import { runOracle, VerdictOutput } from '../../src/oracle/client';

const FIXTURES = join(__dirname, '..', 'fixtures');
const GOLDEN = JSON.parse(readFileSync(join(FIXTURES, 'conformance', 'engine-verdicts.json'), 'utf-8')) as {
    engine: string;
    verdicts: Record<string, { stage: 'parse' | 'analyze' | 'bounds' | 'eval' | 'ok'; error?: string }>;
};

/** Disagreements we understand, with the reason the LSP does not (or should not) match. */
const KNOWN_DISAGREEMENTS: Record<string, { agreement: Agreement; reason: string }> = {
    'upstream/examples/tagged_union.mg': {
        agreement: 'lsp-misses-bounds',
        reason: 'the upstream example fails its own strict bounds check in v0.7 (fn:list:len over a tagged-union field); the LSP reports only provable mismatches',
    },
    'upstream/test_cases/fun.mg': {
        agreement: 'lsp-misses-runtime',
        reason: 'an analysis-only upstream test case: it reads a mode-declared predicate with no facts, which fails at evaluation ("not a constant")',
    },
};

describe('Conformance with the upstream engine', () => {
    it('pins the engine version the verdicts came from', () => {
        expect(GOLDEN.engine).toBe('codeberg.org/TauCeti/mangle-go v0.7.0');
    });

    for (const [file, verdict] of Object.entries(GOLDEN.verdicts)) {
        const known = KNOWN_DISAGREEMENTS[file];
        it(`${file}: engine ${verdict.stage}${known ? ' (known disagreement)' : ''}`, () => {
            const lsp = lspVerdictOf([join(FIXTURES, file)]);
            const agreement = classify(verdict.stage, lsp.errors.length, lsp.warnings);
            if (known) {
                expect(agreement, known.reason).toBe(known.agreement);
            } else {
                expect(isAgreement(agreement), `${agreement}; LSP errors: ${lsp.errors.join(' | ')}`).toBe(true);
            }
        });
    }

    it('pins the probe verdicts that the analysis relies on', () => {
        const stage = (f: string) => GOLDEN.verdicts[`conformance/probes/${f}.mg`]?.stage;
        expect(stage('neg_wildcard')).toBe('analyze');
        expect(stage('ineq_before_binder')).toBe('ok');
        expect(stage('lt_before_binder')).toBe('analyze');
        expect(stage('contains_bound_var')).toBe('ok');
        expect(stage('contains_name_pattern')).toBe('eval');
        expect(stage('name_swallows_period')).toBe('parse');
        expect(stage('singleton_union')).toBe('bounds');
        expect(stage('bool_bound')).toBe('bounds');
        expect(stage('zero_arity_decl')).toBe('bounds');
        expect(stage('zero_arity_decl_bound')).toBe('ok');
        expect(stage('string_matches')).toBe('bounds');
        expect(stage('float_gt')).toBe('bounds');
        expect(stage('neg_external')).toBe('ok');
        expect(stage('lattice_cyclic')).toBe('ok');
    });
});

const goAvailable = spawnSync('go', ['version']).status === 0;

describe.skipIf(!goAvailable)('Live engine verdicts', () => {
    it('match engine-verdicts.json', () => {
        const files = Object.keys(GOLDEN.verdicts);
        const out = runOracle<VerdictOutput>(['verdict', '--at', '2024-01-01T00:00:00Z', ...files.map(f => join(FIXTURES, f))]);
        expect(out.engine).toBe(GOLDEN.engine);
        const live = Object.fromEntries(files.map((f, i) => [f, out.verdicts[i]!.stage]));
        const golden = Object.fromEntries(files.map(f => [f, GOLDEN.verdicts[f]!.stage]));
        expect(live).toEqual(golden);
    }, 180_000);
});
