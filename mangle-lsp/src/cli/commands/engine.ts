/**
 * run and whynot: evaluate on the real engine (via mangle-oracle).
 *
 * run lists a predicate's facts after evaluation and explains one fact with
 * its proof. whynot turns the program into data: for every rule that could
 * derive the goal it adds one probe rule per body prefix, in the order the
 * engine evaluates the body, evaluates once, and reports how many rows
 * survive each premise, so the first premise that leaves none is named.
 */

import { resolve } from 'path';
import { runOracle, projectRootOf, RunOutput, WhyNotOutput, Proof } from '../../oracle/client';

export interface EngineRunOptions {
    query: string;
    why?: string;
    at?: string;
}

export function runEngineQuery(files: string[], options: EngineRunOptions): RunOutput {
    const args = ['run', '--query', options.query];
    if (options.why) args.push('--why', options.why);
    if (options.at) args.push('--at', options.at);
    return runOracle<RunOutput>([...args, ...files.map(f => resolve(f))], projectRootOf(files[0]!));
}

export function runWhyNot(files: string[], goal: string, at?: string): WhyNotOutput {
    const args = ['whynot', '--goal', goal];
    if (at) args.push('--at', at);
    return runOracle<WhyNotOutput>([...args, ...files.map(f => resolve(f))], projectRootOf(files[0]!));
}

function proofLines(p: Proof, indent: string, out: string[]): void {
    out.push(`${indent}${p.fact}  [${p.kind}${p.partial ? ', partial' : ''}]${p.rule ? `  by ${p.rule}` : ''}`);
    for (const sub of p.premises ?? []) proofLines(sub, indent + '  ', out);
}

export function formatRunText(r: RunOutput): string {
    if (r.error) return `engine ${r.stage}: ${r.error}`;
    const res = r.result!;
    const lines = [`${res.predicate}: ${res.count} facts`, ...res.facts.map(f => `  ${f}`)];
    if (res.whyError) lines.push(`why: ${res.whyError}`);
    for (const p of res.why ?? []) {
        lines.push('why:');
        proofLines(p, '  ', lines);
    }
    return lines.join('\n');
}

export function formatWhyNotText(w: WhyNotOutput): string {
    const r = w.result;
    const lines = [r.summary];
    for (const rule of r.rules) {
        lines.push('', rule.rule);
        (rule.funnel ?? []).forEach((s, i) => {
            lines.push(`  ${i === rule.blockedAt ? '>>' : '  '} ${String(s.rows).padStart(6)} rows after ${s.premise}`);
        });
        lines.push(`  ${rule.reason}`);
    }
    return lines.join('\n');
}
