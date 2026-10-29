/**
 * The engine-backed, repository-level commands of mangle-cli:
 * advise, review, boundary, conformance, run and whynot.
 */

import { runCheck } from './commands/check';
import { formatCheckResultJson, formatCheckResultText } from './formatters/index';
import { runReview, formatReviewText } from './commands/review';
import { runBoundary, formatBoundaryText } from './commands/boundary';
import { runConformance, formatConformanceText } from './commands/conformance';
import { runEngineQuery, runWhyNot, formatRunText, formatWhyNotText } from './commands/engine';
import type { CheckOptions, DiagnosticSeverity } from './types';

type Options = Record<string, string | boolean | number>;

export const AGENT_COMMANDS = ['advise', 'review', 'boundary', 'conformance', 'run', 'whynot'] as const;

export const AGENT_USAGE = `
Agent Commands (engine-backed ones run mangle-oracle, built from mangle-oracle/ with Go
against the engine version the project's go.mod pins, else the pinned v0.7.0):
  advise <files...>          Mangle-feature advice only (A-codes), with rewrites
  review [--root dir]        Whole repo: programs assembled from //go:embed, every
                             diagnostic, engine verdicts, Go boundary findings, and
                             a numbered plan of actions with edits (--severity, --no-boundary)
  boundary [--root dir]      Go <-> .mg findings (B-codes) for a Go module, with proofs.
                             --profile generic|codenerd|file.json says how the host's Go
                             builds facts (default: .mangle/oracle-profile.json, else by
                             go.mod module, else generic)
  conformance <files...>     LSP verdict next to the engine's (--program: one assembled program)
  run <files...> --query p   Evaluate on the engine and list p's facts (--why 'p(1)' for a proof,
                             --at RFC3339 to pin the evaluation time)
  whynot <files...> --goal 'p(X)'
                             Why a goal is not derived: rows surviving each premise of each rule
`;

function out(text: string): void {
    process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}

/** Runs an agent command and returns its exit code. */
export function handleAgentCommand(command: string, files: string[], format: string, options: Options): number {
    const json = format !== 'text';
    switch (command) {
        case 'advise': {
            if (files.length === 0) return usage('advise needs files');
            const opts: CheckOptions = { format: 'json', quiet: true, severity: 'info' as DiagnosticSeverity, failOn: 'never', explain: !!options['explain'] };
            const result = runCheck(files, opts);
            for (const f of result.files) f.diagnostics = f.diagnostics.filter(d => d.code.startsWith('A'));
            result.summary.totalErrors = 0;
            result.summary.totalWarnings = result.files.reduce((n, f) => n + f.diagnostics.filter(d => d.severity === 'warning').length, 0);
            result.summary.totalInfo = result.files.reduce((n, f) => n + f.diagnostics.filter(d => d.severity === 'info').length, 0);
            out(json ? formatCheckResultJson(result) : formatCheckResultText(result));
            return 0;
        }
        case 'review': {
            const report = runReview(String(options['root'] ?? files[0] ?? '.'), {
                noBoundary: !!options['no-boundary'],
                severity: options['severity'] as 'error' | 'warning' | 'info' | undefined,
                profile: options['profile'] as string | undefined,
            });
            out(json ? JSON.stringify(report, null, 2) : formatReviewText(report));
            return report.plan.some(a => a.severity === 'error') ? 1 : 0;
        }
        case 'boundary': {
            const report = runBoundary(String(options['root'] ?? files[0] ?? '.'), options['profile'] as string | undefined);
            out(json ? JSON.stringify(report, null, 2) : formatBoundaryText(report));
            return report.diagnostics.some(d => d.severity === 'error') ? 1 : 0;
        }
        case 'conformance': {
            if (files.length === 0) return usage('conformance needs files');
            const report = runConformance(files, !!options['program']);
            out(json ? JSON.stringify(report, null, 2) : formatConformanceText(report));
            return report.summary.agreeing === report.summary.total ? 0 : 1;
        }
        case 'run': {
            const query = options['query'];
            if (files.length === 0 || typeof query !== 'string') return usage('run needs files and --query');
            const r = runEngineQuery(files, { query, why: options['why'] as string | undefined, at: options['at'] as string | undefined });
            out(json ? JSON.stringify(r, null, 2) : formatRunText(r));
            return r.error ? 1 : 0;
        }
        case 'whynot': {
            const goal = options['goal'];
            if (files.length === 0 || typeof goal !== 'string') return usage('whynot needs files and --goal');
            const w = runWhyNot(files, goal, options['at'] as string | undefined);
            out(json ? JSON.stringify(w, null, 2) : formatWhyNotText(w));
            return 0;
        }
        default:
            return usage(`unknown command ${command}`);
    }
}

function usage(message: string): number {
    process.stderr.write(`Error: ${message}\n${AGENT_USAGE}`);
    return 1;
}
