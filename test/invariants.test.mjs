/**
 * Source-level invariants for both halves.
 *
 * Run: node --test test/invariants.test.mjs
 *
 * These are the rules the plugin depends on but that no behavioural test can
 * express: the client half is a no-build browser module that may only require
 * the host baseline, the host half only imports Node builtins and its own
 * modules, git is always spawned argv-only, and no write operation can escape
 * the per-repository lock. Each assertion names the rule it protects, so a
 * failure reads as "you broke X" rather than "a regex stopped matching".
 *
 * The dictionaries are part of this file too: a key added to one language and
 * forgotten in the other shows up as English text in a Chinese UI, which no
 * behavioural test would ever catch.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFile(join(ROOT, name), 'utf8');

const HOST = await read('index.js');
const HOST_FILES = [
  'index.js',
  'host/runtime.js',
  'host/core.js',
  'host/git.js',
  'host/state.js',
  'host/discovery.js',
  'host/status.js',
  'host/history.js',
  'host/write.js',
  'host/worktrees.js',
  'host/route.js',
];
/** Every host source, for rules that are not about one particular file. */
const HOST_SOURCES = new Map();
for (const file of HOST_FILES) HOST_SOURCES.set(file, await read(file));
const HOST_ANY = [...HOST_SOURCES.values()].join('\n');
const CLIENT = await read('client.js');
const STYLES = await read('styles.css');
const PKG = JSON.parse(await read('package.json'));
const CI = await read('.github/workflows/ci.yml');

/** The object literal body of one client dictionary. */
function dictionary(name) {
  const start = CLIENT.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `client.js no longer declares the ${name} dictionary`);
  const end = CLIENT.indexOf('\n    };', start);
  assert.notEqual(end, -1, `the ${name} dictionary is not terminated by a 4-space brace`);
  return CLIENT.slice(start, end);
}

function dictionaryKeys(name) {
  return [...dictionary(name).matchAll(/^ {6}([A-Za-z][A-Za-z0-9_]*):/gm)].map((match) => match[1]).sort();
}

/** Operation names the host switch dispatches, in source order. */
function dispatchedOps() {
  const start = HOST.indexOf('async function runOperation(');
  assert.notEqual(start, -1, 'index.js no longer has the runOperation switch');
  const end = HOST.indexOf('\n  }', start);
  return [...HOST.slice(start, end).matchAll(/case '([^']+)':\n/g)].map((match) => match[1]);
}

const WRITE_OPS = (() => {
  const match = /const WRITE_OPS = new Set\(\[([\s\S]*?)\]\);/.exec(HOST_ANY);
  assert.ok(match, 'the host no longer declares WRITE_OPS');
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
})();

test('the client half is a no-build module that only requires the host baseline', () => {
  assert.match(CLIENT, /^window\.__ModuleLoader__\.load\(\{/m, 'the module loader wrapper is the entry contract');
  assert.doesNotMatch(CLIENT, /^\s*import\s+[^;]*from\s+['"]/m, 'client.js must not use ESM imports');
  const required = [...CLIENT.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
  const allowed = new Set(['react', 'react-dom']);
  for (const name of new Set(required)) {
    assert.ok(allowed.has(name), `client.js requires "${name}", which is not part of the browser baseline`);
  }
});

test('the host half imports only Node builtins and its own modules', () => {
  let total = 0;
  for (const [file, text] of HOST_SOURCES) {
    const specifiers = [...text.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    total += specifiers.length;
    for (const specifier of specifiers) {
      const local = specifier.startsWith('./') || specifier.startsWith('../');
      assert.ok(local || specifier.startsWith('node:'), `${file} imports "${specifier}", which is neither a builtin nor a relative module`);
    }
  }
  assert.ok(total > 0, 'the host lost its imports entirely');
});

test('git is always spawned argv-only', () => {
  assert.doesNotMatch(HOST_ANY, /shell:\s*true/, 'a shell-spawned command would break the argv-only rule');
  assert.doesNotMatch(HOST_ANY, /(^|[^.\w])exec(Sync)?\(/m, 'exec/execSync build a command string; use the argv spawn');
  assert.doesNotMatch(HOST_ANY, /from ['"]child_process['"]/, 'git goes through the Host subprocess service');
  assert.match(HOST_ANY, /async function runGit\(/, 'the single argv-only git entry point is missing');
});

test('every dispatched operation is either read-only or inside the write lock', () => {
  const ops = dispatchedOps();
  assert.ok(ops.length >= 15, `expected the full operation surface, found ${ops.length}`);
  const readOnly = new Set(['status', 'status-lite', 'graph', 'branches', 'worktrees', 'commit-detail', 'diff']);
  for (const op of ops) {
    assert.ok(
      readOnly.has(op) || WRITE_OPS.has(op),
      `operation "${op}" is neither a declared read nor in WRITE_OPS, so it would bypass the per-repository lock`,
    );
  }
  for (const op of WRITE_OPS) {
    assert.ok(ops.includes(op), `WRITE_OPS lists "${op}" but the switch does not dispatch it`);
  }
  assert.match(HOST, /withRepoLock\(lockKeyOf\(workspace, body\.repo\)/, 'dispatch must route writes through the lock by repository');
});

test('destructive operations refuse to run without an explicit confirmation', () => {
  assert.match(HOST_ANY, /function requireConfirm\(body, action\)/, 'the confirmation guard is missing');
  assert.match(HOST_ANY, /throw new GitError\('CONFIRM_REQUIRED'/, 'the guard must fail with CONFIRM_REQUIRED');
  // Worktree removal is the destructive operation this version ships: `--force`
  // deletes uncommitted files, `deleteBranch` force-deletes a branch.
  const removeStart = HOST_ANY.indexOf('async function removeWorktree(');
  assert.notEqual(removeStart, -1);
  const removeBody = HOST_ANY.slice(removeStart, HOST_ANY.indexOf('\n}', removeStart));
  assert.match(removeBody, /requireConfirm\(payload, 'worktree-remove'\)/, 'worktree-remove must confirm before force/delete-branch');
  // The client must keep sending that record for its own destructive paths.
  assert.match(CLIENT, /confirm: force \|\| deleteBranch/, 'the client must forward the explicit confirmation');
});

test('the panel stylesheet is a real file, not a literal inside the bundle', () => {
  // A 60 KB template literal in the client bundle can be emptied by a transform
  // on the way to the page — the panel then works with no styles at all. The
  // rules therefore live in a stylesheet the browser fetches.
  assert.ok(STYLES.length > 20_000, `styles.css looks truncated: ${STYLES.length} bytes`);
  assert.match(STYLES, /\.dshg-root\s*\{/, 'styles.css must carry the panel root rule');
  assert.match(STYLES, /--dshg-git-styled:\s*1;/, 'the self-check sentinel must be part of the stylesheet');
  assert.doesNotMatch(CLIENT, /const CSS_TEXT = `/, 'the stylesheet must not return to the client bundle as a template literal');
  assert.match(CLIENT, /const STYLE_URL = '\/dsh-git-6b1e\/styles\.css'/, 'the client must fetch the stylesheet from the plugin route');
  assert.match(HOST_ANY, /const STYLE_FILE = join\(/, 'the host must know where styles.css lives');
  assert.match(HOST_ANY, /content-type': 'text\/css; charset=utf-8'/, 'the host must serve the stylesheet as CSS');
  assert.ok(PKG.files.includes('styles.css'), 'styles.css must ship in the package');
});

test('the host stays split into domain modules instead of one god file', () => {
  for (const file of HOST_FILES) {
    assert.ok(HOST_SOURCES.get(file).length > 0, `${file} is missing`);
  }
  const indexLines = HOST.split('\n').length;
  assert.ok(indexLines < 400, `index.js is ${indexLines} lines; domain logic belongs in host/*.js`);
  for (const [file, text] of HOST_SOURCES) {
    const count = text.split('\n').length;
    assert.ok(count <= 600, `${file} is ${count} lines; split it by domain instead of growing a god file`);
  }
  assert.match(PKG.files.join('\n'), /host\/\*\.js/, 'the split host modules must ship in the package');
});

test('the package manifest still describes the bundle the loader needs', () => {
  assert.equal(PKG.dsh.bundle.patch, './cordis.patch.yml', 'the bundle patch entry moved');
  assert.equal(PKG.exports['./client'], './client.js', 'the client entry point moved');
  assert.equal(PKG.exports['./icon'], './icon.svg', 'the icon export moved');
  for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/*.json', 'README.md', 'LICENSE']) {
    assert.ok(PKG.files.includes(entry), `"${entry}" is not in the published files list`);
  }
  assert.ok(typeof PKG.scripts.test === 'string', 'no test script');
  assert.match(PKG.scripts.test, /test\/host\.test\.mjs/, 'the host suite left the test script');
  assert.match(PKG.scripts.test, /test\/client\.test\.mjs/, 'the client suite left the test script');
  assert.match(PKG.scripts.test, /test\/invariants\.test\.mjs/, 'the invariant suite left the test script');
});

test('CI runs every suite and syntax-checks both halves', () => {
  assert.match(CI, /node --test test\/host\.test\.mjs test\/client\.test\.mjs test\/invariants\.test\.mjs/, 'CI must run all three suites');
  assert.match(CI, /node --check index\.js/, 'CI must syntax-check the host half');
  assert.match(CI, /node --check client\.js/, 'CI must syntax-check the client half');
  assert.match(CI, /for file in host\/\*\.js/, 'CI must syntax-check the split host modules');
});

test('the two locales declare exactly the same keys', () => {
  const zh = dictionaryKeys('zh');
  const en = dictionaryKeys('en');
  assert.ok(zh.length > 50, `the dictionaries look truncated: ${zh.length} keys`);
  assert.deepEqual(zh, en, 'zh/en dictionaries have drifted apart');
});

test('every literal translation key used by the client exists in the dictionaries', () => {
  const known = new Set(dictionaryKeys('zh'));
  const used = new Set();
  for (const match of CLIENT.matchAll(/\bt[f]?\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) used.add(match[1]);
  const missing = [...used].filter((key) => !known.has(key)).sort();
  assert.deepEqual(missing, [], `untranslated keys: ${missing.join(', ')}`);
});
