/**
 * Build the single-file client artifact from `client/*.js`.
 *
 * The module loader contract is one `client.js` per package: the browser
 * baseline exposes `require` for `react`/`react-dom` only, so the parts cannot
 * be ES modules. They are concatenated fragments sharing one factory scope, in
 * filename order, and the result is committed — installing the plugin stays
 * build-free.
 *
 * Usage:
 *   node scripts/build-client.mjs           # write client.js
 *   node scripts/build-client.mjs --check   # fail when client.js is stale
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS_DIR = join(ROOT, 'client');
const OUTPUT = join(ROOT, 'client.js');

const HEAD = `window.__ModuleLoader__.load({
  id: '@aishangwuji/dsh-git',
  factory(require) {`;

const TAIL = `
    return shipped;
  },
});
`;

const banner = (name) => `    /* ---- client/${name} ---- */`;

const names = (await readdir(PARTS_DIR)).filter((name) => name.endsWith('.js')).sort();
if (names.length === 0) throw new Error('client/: no parts found');

const fragments = [];
for (const name of names) {
  // Only the edges' newlines are trimmed: the leading indentation is the
  // fragment's own (everything lives inside `factory(require) {`).
  const source = (await readFile(join(PARTS_DIR, name), 'utf8')).replace(/^\n+/, '').replace(/\s+$/, '');
  if (source.length === 0) throw new Error(`client/${name} is empty`);
  if (source.includes('__ModuleLoader__')) throw new Error(`client/${name} must be a fragment, not a loader wrapper`);
  fragments.push(`${banner(name)}\n${source}`);
}

const built = `${HEAD}\n${fragments.join('\n\n')}${TAIL}`;

if (process.argv.includes('--check')) {
  const current = await readFile(OUTPUT, 'utf8').catch(() => '');
  if (current !== built) {
    console.error('client.js is stale: run `node scripts/build-client.mjs` and commit the result');
    process.exitCode = 1;
  } else {
    console.log(`build-client: up to date (${names.length} parts, ${built.split('\n').length} lines)`);
  }
} else {
  await writeFile(OUTPUT, built, 'utf8');
  console.log(`build-client: wrote client.js (${names.length} parts, ${built.split('\n').length} lines)`);
}
