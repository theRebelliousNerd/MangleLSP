/**
 * Conformance with upstream Mangle's own programs.
 *
 * Mirrors upstream analysis/validation_test.go TestCases: every
 * analysis/test_cases/*.mg must be accepted unless its name starts with "neg",
 * in which case it must be rejected. Upstream examples/*.mg must be accepted
 * (example_type_error.mg is, as its name says, a program with a type error).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from '../../src/parser/index';
import { analyzeUnit } from '../../src/analysis/pipeline';

const FIXTURES = join(__dirname, '..', 'fixtures', 'upstream');

function errorsOf(file: string): string[] {
    const source = readFileSync(file, 'utf-8');
    const result = parse(source);
    const parseErrors = result.errors.map(e => `P001 ${e.line}:${e.column} ${e.message}`);
    if (!result.unit) return parseErrors;
    const semantic = analyzeUnit(result.unit).diagnostics
        .filter(d => d.severity === 'error')
        .map(d => `${d.code} ${d.range.start.line}:${d.range.start.column} ${d.message}`);
    return [...parseErrors, ...semantic];
}

function mgFiles(dir: string): string[] {
    return readdirSync(join(FIXTURES, dir)).filter(f => f.endsWith('.mg')).sort();
}

const EXPECTED_TO_FAIL_EXAMPLES = new Set(['example_type_error.mg']);

describe('Upstream analysis/test_cases', () => {
    for (const name of mgFiles('test_cases')) {
        const file = join(FIXTURES, 'test_cases', name);
        if (name.startsWith('neg')) {
            it(`rejects ${name}`, () => {
                expect(errorsOf(file).length).toBeGreaterThan(0);
            });
        } else {
            it(`accepts ${name}`, () => {
                expect(errorsOf(file)).toEqual([]);
            });
        }
    }
});

describe('Upstream examples', () => {
    for (const name of mgFiles('examples')) {
        const file = join(FIXTURES, 'examples', name);
        if (EXPECTED_TO_FAIL_EXAMPLES.has(name)) {
            it(`reports the type error in ${name}`, () => {
                const errors = errorsOf(file);
                expect(errors.some(e => e.startsWith('E070'))).toBe(true);
            });
        } else {
            it(`accepts ${name}`, () => {
                expect(errorsOf(file)).toEqual([]);
            });
        }
    }
});

describe('Specific upstream regressions', () => {
    it('neg_plusarg: fn:plus with a string argument is a type error (E068)', () => {
        const errors = errorsOf(join(FIXTURES, 'test_cases', 'neg_plusarg.mg'));
        expect(errors.some(e => e.startsWith('E068'))).toBe(true);
    });

    it('neg_polymorphic_match: :match_pair on a /number is a type error (E069)', () => {
        const errors = errorsOf(join(FIXTURES, 'test_cases', 'neg_polymorphic_match.mg'));
        expect(errors.some(e => e.startsWith('E069'))).toBe(true);
    });

    it('neg_duplicate_decl: duplicate declaration is rejected (E044, upstream issue #25)', () => {
        const errors = errorsOf(join(FIXTURES, 'test_cases', 'neg_duplicate_decl.mg'));
        expect(errors.some(e => e.startsWith('E044'))).toBe(true);
    });

    it("shortest_path: mode('+', '+', '-') head inputs count as bound", () => {
        expect(errorsOf(join(FIXTURES, 'examples', 'shortest_path.mg'))).toEqual([]);
    });

    it('tagged_union: .TaggedUnion bounds and struct facts are accepted', () => {
        expect(errorsOf(join(FIXTURES, 'examples', 'tagged_union.mg'))).toEqual([]);
    });
});
