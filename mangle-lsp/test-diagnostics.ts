#!/usr/bin/env npx tsx
/**
 * Quick test script to run LSP diagnostics on a Mangle file.
 * Usage: npx tsx test-diagnostics.ts <file.mg>
 */

import { readFileSync } from 'fs';
import { parse, ParseResult } from './src/parser/index.js';
import { validate, SemanticError } from './src/analysis/validation.js';
import { checkStratification, StratificationError } from './src/analysis/stratification.js';

function main() {
    const filePath = process.argv[2] || '../../test.mg';

    console.log(`\n${'='.repeat(70)}`);
    console.log(`MANGLE LSP DIAGNOSTICS TEST`);
    console.log(`File: ${filePath}`);
    console.log(`${'='.repeat(70)}\n`);

    let source: string;
    try {
        source = readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.error(`Error reading file: ${e}`);
        process.exit(1);
    }

    // Parse
    console.log('PARSING...\n');
    const parseResult: ParseResult = parse(source);

    // Show parse errors
    if (parseResult.errors.length > 0) {
        console.log(`PARSE ERRORS (${parseResult.errors.length}):`);
        console.log('-'.repeat(50));
        for (const err of parseResult.errors) {
            console.log(`  Line ${err.line}:${err.column} - ${err.message}`);
        }
        console.log();
    } else {
        console.log('No parse errors.\n');
    }

    // Semantic validation
    if (parseResult.unit) {
        console.log('SEMANTIC VALIDATION...\n');
        const validationResult = validate(parseResult.unit);

        if (validationResult.errors.length > 0) {
            // Group by severity
            const errors = validationResult.errors.filter(e => e.severity === 'error');
            const warnings = validationResult.errors.filter(e => e.severity === 'warning');
            const infos = validationResult.errors.filter(e => e.severity === 'info');

            if (errors.length > 0) {
                console.log(`ERRORS (${errors.length}):`);
                console.log('-'.repeat(50));
                for (const err of errors) {
                    console.log(`  [${err.code}] Line ${err.range.start.line}:${err.range.start.column}`);
                    console.log(`         ${err.message}`);
                }
                console.log();
            }

            if (warnings.length > 0) {
                console.log(`WARNINGS (${warnings.length}):`);
                console.log('-'.repeat(50));
                for (const warn of warnings) {
                    console.log(`  [${warn.code}] Line ${warn.range.start.line}:${warn.range.start.column}`);
                    console.log(`         ${warn.message}`);
                }
                console.log();
            }

            if (infos.length > 0) {
                console.log(`INFO (${infos.length}):`);
                console.log('-'.repeat(50));
                for (const info of infos) {
                    console.log(`  [${info.code}] Line ${info.range.start.line}:${info.range.start.column}`);
                    console.log(`         ${info.message}`);
                }
                console.log();
            }
        } else {
            console.log('No semantic errors.\n');
        }

        // Stratification analysis
        console.log('STRATIFICATION ANALYSIS...\n');
        const stratErrors = checkStratification(parseResult.unit);

        if (stratErrors.length > 0) {
            console.log(`STRATIFICATION ISSUES (${stratErrors.length}):`);
            console.log('-'.repeat(50));
            for (const err of stratErrors) {
                const sevLabel = err.severity.toUpperCase();
                console.log(`  [${err.code}] ${sevLabel} - Line ${err.range.start.line}:${err.range.start.column}`);
                console.log(`         ${err.message}`);
                if (err.cycle && err.cycle.length > 0) {
                    console.log(`         Cycle: ${err.cycle.join(' -> ')}`);
                }
            }
            console.log();
        } else {
            console.log('No stratification issues.\n');
        }

        // Summary
        console.log('='.repeat(70));
        console.log('SUMMARY');
        console.log('-'.repeat(50));
        console.log(`  Parse errors:          ${parseResult.errors.length}`);
        console.log(`  Semantic errors:       ${validationResult.errors.filter(e => e.severity === 'error').length}`);
        console.log(`  Semantic warnings:     ${validationResult.errors.filter(e => e.severity === 'warning').length}`);
        console.log(`  Stratification issues: ${stratErrors.length}`);
        console.log(`  Total issues:          ${parseResult.errors.length + validationResult.errors.length + stratErrors.length}`);
        console.log('='.repeat(70));
    }
}

main();
