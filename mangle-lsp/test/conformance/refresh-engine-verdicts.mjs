// Regenerates test/fixtures/conformance/engine-verdicts.json: the upstream
// engine's verdict on every conformance fixture, via mangle-oracle.
// Run from the repository root after `npm run build:lsp`:
//   npm run conformance:refresh
import { readdirSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..', '..');
const require = createRequire(import.meta.url);
const { runOracle } = require(join(pkg, 'dist', 'oracle', 'client.js'));

const fixtures = join(pkg, 'test', 'fixtures');
const dirs = ['upstream/examples', 'upstream/test_cases', 'conformance/probes'];
const files = dirs.flatMap(d => readdirSync(join(fixtures, d)).filter(f => f.endsWith('.mg')).sort().map(f => join(fixtures, d, f)));
const out = runOracle(['verdict', '--at', '2024-01-01T00:00:00Z', ...files]);
const verdicts = {};
out.verdicts.forEach((v, i) => {
    const error = v.error ? v.error.split('\n')[0].replace(/0x[0-9a-f]+/g, '0x...') : undefined;
    verdicts[relative(fixtures, files[i])] = error ? { stage: v.stage, error } : { stage: v.stage };
});
writeFileSync(join(fixtures, 'conformance', 'engine-verdicts.json'), JSON.stringify({ engine: out.engine, verdicts }, null, 2) + '\n');
console.log(`${files.length} verdicts from ${out.engine}`);
