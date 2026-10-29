/**
 * Analysis of an assembled program: several .mg files that a host loads as
 * one program (e.g. every file one `//go:embed` pulls in). Cross-file checks
 * (undefined predicates, arity, duplicate Decls, bounds through other files'
 * Decls, negation cycles, negated externals) then see what the engine sees.
 *
 * The files are concatenated, as hosts do, analyzed once, and every
 * diagnostic is mapped back to its file and line.
 */

import { parse, ParseError } from '../parser/index';
import { analyzeUnit, AnalysisDiagnostic } from './pipeline';
import type { SourceRange } from '../parser/ast';
import type { QuickFix } from './validation';

export interface ProgramFile {
    path: string;
    text: string;
}

export interface FileAnalysis {
    path: string;
    parseErrors: ParseError[];
    diagnostics: AnalysisDiagnostic[];
}

interface Segment {
    path: string;
    /** First line of the file in the concatenated text (1-based). */
    start: number;
    lines: number;
}

function segmentsOf(files: ProgramFile[]): { text: string; segments: Segment[] } {
    const segments: Segment[] = [];
    let line = 1;
    const parts: string[] = [];
    for (const f of files) {
        const text = f.text.endsWith('\n') ? f.text : f.text + '\n';
        const lines = text.split('\n').length - 1;
        segments.push({ path: f.path, start: line, lines });
        parts.push(text);
        line += lines;
    }
    return { text: parts.join(''), segments };
}

function segmentAt(segments: Segment[], line: number): Segment {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segments[mid]!.start <= line) lo = mid;
        else hi = mid - 1;
    }
    return segments[lo]!;
}

function shiftRange(r: SourceRange, by: number): SourceRange {
    return {
        start: { ...r.start, line: r.start.line - by },
        end: { ...r.end, line: r.end.line - by },
    };
}

function shiftFix(f: QuickFix, by: number): QuickFix {
    return {
        ...f,
        range: shiftRange(f.range, by),
        additionalEdits: f.additionalEdits?.map(e => ({ ...e, range: shiftRange(e.range, by) })),
    };
}

/** Analyzes files as one program and returns diagnostics per file. */
export function analyzeProgram(files: ProgramFile[]): FileAnalysis[] {
    const { text, segments } = segmentsOf(files);
    const result = new Map<string, FileAnalysis>(files.map(f => [f.path, { path: f.path, parseErrors: [], diagnostics: [] }]));
    const parsed = parse(text);
    for (const e of parsed.errors) {
        const seg = segmentAt(segments, e.line);
        result.get(seg.path)!.parseErrors.push({ ...e, line: e.line - seg.start + 1 });
    }
    if (parsed.unit) {
        for (const d of analyzeUnit(parsed.unit).diagnostics) {
            const seg = segmentAt(segments, d.range.start.line);
            const by = seg.start - 1;
            result.get(seg.path)!.diagnostics.push({
                ...d,
                range: shiftRange(d.range, by),
                fixes: d.fixes?.map(f => shiftFix(f, by)),
            });
        }
    }
    return [...result.values()];
}
