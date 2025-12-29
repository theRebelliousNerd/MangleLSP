/**
 * Tests for the CLI batch command.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { runBatch, parseBatchInput, BatchQuery } from '../../src/cli/commands/batch';

describe('CLI batch command', () => {
    const testDir = join(__dirname, 'test-files');
    const validFile = join(testDir, 'valid.mg');

    beforeAll(() => {
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }

        writeFileSync(validFile, `
# Valid Mangle file
Decl my_predicate(X).

my_fact(1).
my_fact(2).
my_rule(X) :- my_fact(X).
`);
    });

    afterAll(() => {
        try { unlinkSync(validFile); } catch { }
    });

    describe('parseBatchInput', () => {
        it('should parse JSON array', () => {
            const input = '[{"type":"hover","file":"test.mg","line":1,"column":0}]';
            const queries = parseBatchInput(input);
            expect(queries).toHaveLength(1);
            expect(queries[0]?.type).toBe('hover');
        });

        it('should parse object with queries array', () => {
            const input = '{"queries":[{"type":"symbols","file":"test.mg"}]}';
            const queries = parseBatchInput(input);
            expect(queries).toHaveLength(1);
            expect(queries[0]?.type).toBe('symbols');
        });

        it('should throw on invalid input', () => {
            expect(() => parseBatchInput('not json')).toThrow();
        });
    });

    describe('runBatch', () => {
        it('should process diagnostics query', () => {
            const queries: BatchQuery[] = [
                { type: 'diagnostics', file: validFile }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.version).toBe('1.0');
            expect(result.results).toHaveLength(1);
            expect(result.results[0]?.type).toBe('diagnostics');
            expect(result.summary.succeeded).toBe(1);
            expect(result.summary.failed).toBe(0);
        });

        it('should process symbols query', () => {
            const queries: BatchQuery[] = [
                { type: 'symbols', file: validFile }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.results[0]?.result?.symbols).toBeDefined();
        });

        it('should process hover query', () => {
            const queries: BatchQuery[] = [
                { type: 'hover', file: validFile, line: 5, column: 0 }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.summary.succeeded).toBe(1);
        });

        it('should process fileInfo query', () => {
            const queries: BatchQuery[] = [
                { type: 'fileInfo', file: validFile }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            const fileInfo = result.results[0]?.result;
            expect(fileInfo).toBeDefined();
            expect(fileInfo.lineCount).toBeGreaterThan(0);
            expect(fileInfo.diagnostics).toBeDefined();
            expect(fileInfo.symbols).toBeDefined();
        });

        it('should handle multiple queries', () => {
            const queries: BatchQuery[] = [
                { id: 1, type: 'diagnostics', file: validFile },
                { id: 2, type: 'symbols', file: validFile },
                { id: 3, type: 'fileInfo', file: validFile }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.results).toHaveLength(3);
            expect(result.summary.total).toBe(3);
            expect(result.summary.succeeded).toBe(3);

            // Check that IDs are preserved
            expect(result.results[0]?.id).toBe(1);
            expect(result.results[1]?.id).toBe(2);
            expect(result.results[2]?.id).toBe(3);
        });

        it('should handle file not found', () => {
            const queries: BatchQuery[] = [
                { type: 'diagnostics', file: '/nonexistent/file.mg' }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.summary.failed).toBe(1);
            expect(result.results[0]?.error).toContain('not found');
        });

        it('should handle mixed success and failure', () => {
            const queries: BatchQuery[] = [
                { type: 'diagnostics', file: validFile },
                { type: 'diagnostics', file: '/nonexistent/file.mg' }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.summary.total).toBe(2);
            expect(result.summary.succeeded).toBe(1);
            expect(result.summary.failed).toBe(1);
        });

        it('should process format query', () => {
            const queries: BatchQuery[] = [
                { type: 'format', file: validFile }
            ];
            const result = runBatch(queries, { format: 'json', quiet: false });

            expect(result.results[0]?.result?.formatted).toBeDefined();
        });
    });
});
