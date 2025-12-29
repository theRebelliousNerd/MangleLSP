/**
 * Tests for CLI formatters.
 */

import { describe, it, expect } from 'vitest';
import {
    formatCheckResultJson,
    formatCheckResultText,
    formatCheckResultSarif,
} from '../../src/cli/formatters/index';
import { CheckResult } from '../../src/cli/types';

describe('CLI formatters', () => {
    const sampleResult: CheckResult = {
        version: '1.0',
        files: [{
            path: 'test.mg',
            diagnostics: [{
                severity: 'error',
                code: 'E001',
                source: 'mangle-semantic',
                message: 'Variables in facts must be ground',
                range: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 10 },
                },
                context: 'my_fact(X).',
            }],
        }],
        summary: {
            totalFiles: 1,
            totalErrors: 1,
            totalWarnings: 0,
            totalInfo: 0,
        },
    };

    describe('JSON formatter', () => {
        it('should produce valid JSON', () => {
            const json = formatCheckResultJson(sampleResult);
            const parsed = JSON.parse(json);

            expect(parsed.version).toBe('1.0');
            expect(parsed.files).toHaveLength(1);
            expect(parsed.summary.totalErrors).toBe(1);
        });

        it('should include all diagnostic fields', () => {
            const json = formatCheckResultJson(sampleResult);
            const parsed = JSON.parse(json);

            const diag = parsed.files[0].diagnostics[0];
            expect(diag.severity).toBe('error');
            expect(diag.code).toBe('E001');
            expect(diag.message).toBe('Variables in facts must be ground');
            expect(diag.range.start.line).toBe(1);
        });
    });

    describe('Text formatter', () => {
        it('should produce human-readable output', () => {
            const text = formatCheckResultText(sampleResult);

            expect(text).toContain('test.mg');
            expect(text).toContain('E001');
            expect(text).toContain('Variables in facts must be ground');
            expect(text).toContain('Summary');
        });

        it('should include context when available', () => {
            const text = formatCheckResultText(sampleResult);

            expect(text).toContain('my_fact(X).');
        });
    });

    describe('SARIF formatter', () => {
        it('should produce valid SARIF JSON', () => {
            const sarif = formatCheckResultSarif(sampleResult);
            const parsed = JSON.parse(sarif);

            expect(parsed.$schema).toContain('sarif-schema');
            expect(parsed.version).toBe('2.1.0');
            expect(parsed.runs).toHaveLength(1);
        });

        it('should include tool information', () => {
            const sarif = formatCheckResultSarif(sampleResult);
            const parsed = JSON.parse(sarif);

            const tool = parsed.runs[0].tool.driver;
            expect(tool.name).toBe('mangle-cli');
            expect(tool.version).toBe('1.0.0');
        });

        it('should include rule definitions', () => {
            const sarif = formatCheckResultSarif(sampleResult);
            const parsed = JSON.parse(sarif);

            const rules = parsed.runs[0].tool.driver.rules;
            expect(rules).toHaveLength(1);
            expect(rules[0].id).toBe('E001');
        });

        it('should include results', () => {
            const sarif = formatCheckResultSarif(sampleResult);
            const parsed = JSON.parse(sarif);

            const results = parsed.runs[0].results;
            expect(results).toHaveLength(1);
            expect(results[0].ruleId).toBe('E001');
            expect(results[0].level).toBe('error');
        });
    });
});
