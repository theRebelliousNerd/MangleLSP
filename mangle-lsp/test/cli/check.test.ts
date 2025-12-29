/**
 * Tests for the CLI check command.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { runCheck, getExitCode } from '../../src/cli/commands/check';
import { CheckOptions } from '../../src/cli/types';

describe('CLI check command', () => {
    const testDir = join(__dirname, 'test-files');
    const validFile = join(testDir, 'valid.mg');
    const errorFile = join(testDir, 'error.mg');

    beforeAll(() => {
        // Create test directory
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }

        // Create a valid Mangle file
        writeFileSync(validFile, `
# Valid Mangle file
my_fact(1).
my_fact(2).
my_rule(X) :- my_fact(X).
`);

        // Create a file with errors
        writeFileSync(errorFile, `
# File with errors
my_fact_with_var(X).
another_rule(Y) :- !unknown_pred(Y).
`);
    });

    afterAll(() => {
        // Clean up test files
        try { unlinkSync(validFile); } catch { }
        try { unlinkSync(errorFile); } catch { }
    });

    it('should return empty diagnostics for valid file', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'error',
        };

        const result = runCheck([validFile], options);

        expect(result.version).toBe('1.0');
        expect(result.summary.totalFiles).toBe(1);
        expect(result.summary.totalErrors).toBe(0);
    });

    it('should detect errors in invalid file', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'error',
        };

        const result = runCheck([errorFile], options);

        expect(result.summary.totalFiles).toBe(1);
        expect(result.summary.totalErrors).toBeGreaterThan(0);
    });

    it('should report file not found error', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'error',
        };

        const result = runCheck(['/nonexistent/file.mg'], options);

        expect(result.summary.totalFiles).toBe(1);
        expect(result.summary.totalErrors).toBe(1);
        expect(result.files[0]?.diagnostics[0]?.code).toBe('E000');
    });

    it('should filter by severity', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'error',
            failOn: 'error',
        };

        const result = runCheck([errorFile], options);

        // Only errors should be present
        for (const file of result.files) {
            for (const diag of file.diagnostics) {
                expect(diag.severity).toBe('error');
            }
        }
    });

    it('should check multiple files', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'error',
        };

        const result = runCheck([validFile, errorFile], options);

        expect(result.summary.totalFiles).toBe(2);
    });

    it('should return correct exit code based on errors', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'error',
        };

        const validResult = runCheck([validFile], options);
        const errorResult = runCheck([errorFile], options);

        expect(getExitCode(validResult, options)).toBe(0);
        expect(getExitCode(errorResult, options)).toBe(1);
    });

    it('should return 0 exit code when failOn is never', () => {
        const options: CheckOptions = {
            format: 'json',
            quiet: false,
            severity: 'info',
            failOn: 'never',
        };

        const result = runCheck([errorFile], options);

        expect(getExitCode(result, options)).toBe(0);
    });
});
