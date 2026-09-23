/**
 * Invariants of the diagnostic catalog (src/analysis/diagnostics.ts).
 *
 * Every code the analyzer emits must be documented, codes must be unique, and
 * docs/DIAGNOSTICS.md must be the generated rendering of the catalog.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
    DIAGNOSTIC_CATALOG,
    getAllDiagnosticInfos,
    getDiagnosticInfo,
    renderExplanation,
    renderDiagnosticsMarkdown,
    suggestSimilar,
    editDistance,
} from '../../src/analysis/diagnostics';

const SRC = join(__dirname, '..', '..', 'src');

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry !== 'gen') out.push(...sourceFiles(full));
        } else if (entry.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

function emittedCodes(): Map<string, string> {
    const codes = new Map<string, string>();
    for (const file of sourceFiles(SRC)) {
        if (file.endsWith('diagnostics.ts') && file.includes('analysis')) continue;
        const text = readFileSync(file, 'utf-8');
        for (const m of text.matchAll(/code: '([EP]\d{3})'/g)) {
            codes.set(m[1]!, file);
        }
    }
    return codes;
}

describe('Diagnostic catalog', () => {
    it('documents every code emitted in src/', () => {
        const missing = [...emittedCodes().entries()].filter(([code]) => !DIAGNOSTIC_CATALOG.has(code));
        expect(missing).toEqual([]);
    });

    it('has unique codes and complete entries', () => {
        const all = getAllDiagnosticInfos();
        expect(new Set(all.map(i => i.code)).size).toBe(all.length);
        for (const info of all) {
            expect(info.title.length).toBeGreaterThan(3);
            expect(info.explanation.length).toBeGreaterThan(20);
            expect(info.fix.length).toBeGreaterThan(5);
        }
    });

    it('looks up codes case-insensitively', () => {
        expect(getDiagnosticInfo('e002')?.code).toBe('E002');
        expect(getDiagnosticInfo('E999')).toBeUndefined();
    });

    it('renders an explanation with an example', () => {
        const text = renderExplanation(getDiagnosticInfo('E003')!);
        expect(text).toContain('E003');
        expect(text).toContain('How to fix');
        expect(text).toContain('Instead of');
    });

    it('docs/DIAGNOSTICS.md is up to date (regenerate with `mangle-cli explain --markdown`)', () => {
        const doc = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'DIAGNOSTICS.md'), 'utf-8');
        expect(doc.trim()).toBe(renderDiagnosticsMarkdown().trim());
    });
});

describe('Suggestions', () => {
    it('computes edit distance', () => {
        expect(editDistance('kitten', 'sitting')).toBe(3);
        expect(editDistance('', 'abc')).toBe(3);
    });

    it('suggests close names and same-tail builtins', () => {
        expect(suggestSimilar('fn:time:truncate', ['fn:time:trunc', 'fn:time:add'])).toContain('fn:time:trunc');
        expect(suggestSimilar(':string:startswith', [':string:starts_with', ':match_prefix'])).toEqual([':string:starts_with']);
    });

    it('does not suggest unrelated short names', () => {
        expect(suggestSimilar('ev', ['wk', 'owns'])).toEqual([]);
    });
});
