/**
 * First-paint cache and prewarm checks for the Client half.
 *
 * Run: node --test test/client.test.mjs
 *
 * `client.js` is a browser module (it hands its factory to the host module
 * loader), so this harness evaluates it in a Node VM with just enough of the
 * browser around it and drives the read-only `__paint` seam. No React render
 * happens: everything asserted here is the cache/seed planner the panel uses to
 * paint its first frame, which is exactly the part that must not regress.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SOURCE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'client.js');
const source = await readFile(SOURCE_PATH, 'utf8');

const WORKSPACE = 'D:\\Projects\\demo';
const OTHER_WORKSPACE = 'D:\\Projects\\other';
const REPO = 'D:\\Projects\\demo\\app';
const REPO_B = 'D:\\Projects\\demo\\lib';

/** Minimal Web Storage with the two methods the plugin uses. */
function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    dump: () => Object.fromEntries(map),
  };
}

function fakeReact() {
  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState() {}
    forceUpdate() {}
  }
  return {
    Component,
    createElement: (type, props, ...children) => ({ type, props, children }),
    createPortal: (node) => node,
  };
}

/**
 * Evaluate client.js in a VM and return its module object. `fetch` answers like
 * the host route: `{ ok: true, value }` with the JSON the op expects.
 */
async function loadClient({ session = makeStorage(), local = makeStorage(), onRpc = null, testSeam = true } = {}) {
  const calls = [];
  const captured = { factory: null };
  const events = [];

  const fetchStub = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const value = onRpc ? await onRpc(body) : null;
    return {
      ok: true,
      status: 200,
      async json() { return { ok: true, value }; },
    };
  };

  const element = () => ({
    dataset: {},
    style: {},
    textContent: '',
    className: '',
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  });

  const documentStub = {
    visibilityState: 'visible',
    documentElement: element(),
    head: element(),
    body: element(),
    createElement: element,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };

  const timers = [];
  const eventNames = [];
  const windowStub = {
    __ModuleLoader__: { load: (definition) => { captured.factory = definition.factory; } },
    // The plugin only attaches its cache/prewarm test seam when the harness opts
    // in, so the module it ships to the loader is exactly `{ inject, apply }`.
    __DSH_GIT_TEST__: testSeam === true,
    addEventListener: (name) => eventNames.push(name),
    removeEventListener() {},
    dispatchEvent() { return true; },
    setTimeout: (fn, ms) => { timers.push(ms); return setTimeout(fn, ms); },
    clearTimeout: (handle) => clearTimeout(handle),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  const context = vm.createContext({
    window: windowStub,
    document: documentStub,
    navigator: { platform: 'win32', language: 'zh-CN', userAgent: 'node' },
    localStorage: local,
    sessionStorage: session,
    fetch: fetchStub,
    console,
    setTimeout: (fn, ms) => { timers.push(ms); return setTimeout(fn, ms); },
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    MutationObserver: class MutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    structuredClone: (value) => JSON.parse(JSON.stringify(value)),
  });
  context.globalThis = context;
  context.self = windowStub;

  vm.runInContext(source, context, { filename: 'client.js' });
  assert.ok(captured.factory, 'client.js did not hand a factory to the module loader');
  const module = captured.factory((name) => (name === 'react' || name === 'react-dom' ? fakeReact() : null));
  if (testSeam) assert.ok(module.__paint, 'client.js must expose the __paint test seam');
  else assert.equal(module.__paint, undefined, 'the shipped module must not carry the test seam');
  return { module, paint: module.__paint, calls, session, local, timers, eventNames };
}

/** A host `status` answer for one repository, shaped like `readStatus`. */
function statusPage({ repo = REPO, changed = 1, repos = null } = {}) {
  const entries = changed > 0
    ? [{ path: 'src/index.js', kind: 'modified', staged: false, badge: 'M', additions: 2, deletions: 1 }]
    : [];
  return {
    isRepo: true,
    workspaceRoot: WORKSPACE,
    repoRoot: repo,
    relativePath: '',
    repos: repos || [{ root: repo, relativePath: '', branch: 'main', counts: { changed, staged: 0, unstaged: changed, conflicts: 0, untracked: 0 } }],
    branch: 'main',
    detached: false,
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    entries,
    counts: { changed, staged: 0, unstaged: changed, conflicts: 0, untracked: 0 },
    remotes: ['origin'],
    identity: { name: 'Fixture', email: 'fixture@example.com' },
  };
}

function graphPage(commits = 2) {
  return {
    commits: Array.from({ length: commits }, (_, index) => ({
      sha: `sha${index}`.padEnd(40, '0'),
      parents: [],
      author: 'Fixture',
      timestamp: 1_760_000_000 - index,
      subject: `commit ${index}`,
      refs: [],
    })),
    hasMore: false,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a cold start seeds nothing and does not throw', async () => {
  const { paint } = await loadClient();
  const seed = paint.readBootSeed();
  assert.equal(seed.status, null);
  assert.equal(seed.repo, '');
  assert.equal(seed.graph, null);
  assert.deepEqual([...seed.workspaces], []);
});

test('the cached page seeds the next mount (header, changes and history)', async () => {
  const local = makeStorage({ 'dsh-git.workspace': WORKSPACE, [`dsh-git.repo:${WORKSPACE}`]: REPO });
  const session = makeStorage();
  const first = await loadClient({ local, session });
  const page = statusPage();
  first.paint.writePaintWorkspaces([{ id: 'w1', title: 'demo', path: WORKSPACE }]);
  first.paint.writePaintStatus(WORKSPACE, REPO, page);
  first.paint.writePaintGraph(REPO, graphPage());

  // A second load is the reload/reopen case: same tab storage, new module.
  const second = await loadClient({ local, session });
  const seed = second.paint.readBootSeed();
  assert.equal(seed.workspace, WORKSPACE);
  assert.equal(seed.repo, REPO);
  assert.equal(seed.status.branch, 'main');
  assert.equal(seed.status.counts.changed, 1);
  assert.equal(seed.graph.length, 2);
  assert.equal(seed.graphHasMore, false);
  assert.equal(seed.workspaces.length, 1);
});

test('a repo whose page is not cached is not guessed', async () => {
  const local = makeStorage({ 'dsh-git.workspace': WORKSPACE });
  const session = makeStorage();
  const first = await loadClient({ local, session });
  // The last page describes REPO, but the user was on REPO_B when the panel
  // closed: the seed must stay self-consistent and paint REPO, not a repo it
  // has no data for.
  first.paint.writePaintStatus(WORKSPACE, REPO, statusPage());
  local.setItem(`dsh-git.repo:${WORKSPACE}`, REPO_B);
  const seed = first.paint.readBootSeed();
  assert.equal(seed.repo, REPO);
  assert.equal(seed.status.repoRoot, REPO);
});

test('status pages expire after the seed TTL, history pages stay warm', async () => {
  const { paint, session } = await loadClient();
  paint.writePaintStatus(WORKSPACE, REPO, statusPage());
  paint.writePaintGraph(REPO, graphPage());

  const stored = JSON.parse(session.getItem('dsh-git.paint.v1'));
  stored.status[WORKSPACE].at = Date.now() - 11 * 60_000;
  session.setItem('dsh-git.paint.v1', JSON.stringify(stored));

  // A fresh module hydrates from storage; the stale page must be dropped while
  // the history page survives, so a cold panel refetches status but still
  // paints its middle pane.
  const reloaded = await loadClient({ session });
  assert.equal(reloaded.paint.readPaintStatus(WORKSPACE), undefined);
  assert.equal(reloaded.paint.readPaintGraph(REPO).commits.length, 2);
});

test('the history cache keeps the three most recently used repositories', async () => {
  const { paint } = await loadClient();
  const roots = ['D:\\r1', 'D:\\r2', 'D:\\r3', 'D:\\r4'];
  for (const root of roots) paint.writePaintGraph(root, graphPage(1));
  assert.equal(paint.readPaintGraph(roots[0]), undefined);
  assert.ok(paint.readPaintGraph(roots[1]));
  assert.ok(paint.readPaintGraph(roots[2]));
  assert.ok(paint.readPaintGraph(roots[3]));
  // Reading an entry makes it the freshest one, so it survives the next write.
  paint.readPaintGraph(roots[1]);
  paint.writePaintGraph('D:\\r5', graphPage(1));
  assert.ok(paint.readPaintGraph(roots[1]));
  assert.equal(paint.readPaintGraph(roots[2]), undefined);
});

test('bootstrap prefers the remembered repository, then the busiest project', async () => {
  const { paint } = await loadClient();
  const nested = {
    root: 'D:\\Projects\\demo\\node_modules\\dep',
    relativePath: 'node_modules/dep',
    counts: { changed: 9 },
  };
  const project = { root: REPO, relativePath: 'app', counts: { changed: 2 } };
  const clean = { root: REPO_B, relativePath: 'lib', counts: { changed: 0 } };
  const discovered = { repoRoot: REPO_B, repos: [nested, project, clean] };

  assert.equal(paint.pickBootstrapRepo(discovered, '').root, REPO, 'busiest project wins');
  assert.equal(paint.pickBootstrapRepo(discovered, REPO_B).root, REPO_B, 'the remembered repo wins');
  assert.equal(paint.pickBootstrapRepo(discovered, 'D:\\gone').root, REPO, 'a vanished choice falls back');
  assert.equal(paint.pickBootstrapRepo({ repoRoot: null, repos: [] }, REPO), null);
});

test('prewarming fills both cache layers for the workspace the panel opens on', async () => {
  const workspaceList = [{ id: 'w1', title: 'demo', path: WORKSPACE }];
  const page = statusPage({ repo: REPO });
  const history = graphPage(3);
  const { paint, calls } = await loadClient({
    onRpc: (body) => {
      if (body.op === 'workspaces') return workspaceList;
      if (body.op === 'status') return page;
      if (body.op === 'graph') return history;
      return null;
    },
  });

  paint.schedulePrewarm(0);
  await wait(80);
  paint.resetPrewarm();

  const ops = calls.map((call) => call.op).filter((op) => op !== 'workspaces');
  assert.deepEqual(ops.slice(0, 2), ['status', 'graph'], `unexpected read order: ${ops.join(' → ')}`);
  const statusCall = calls.find((call) => call.op === 'status');
  const graphCall = calls.find((call) => call.op === 'graph');
  assert.equal(statusCall.workspace, WORKSPACE);
  assert.equal(graphCall.repo, REPO);

  const seed = paint.readBootSeed();
  assert.equal(seed.workspace, WORKSPACE);
  assert.equal(seed.repo, REPO);
  assert.equal(seed.status.branch, 'main');
  assert.equal(seed.graph.length, 3);
});

test('prewarming warms the remembered workspace, not merely the first one', async () => {
  const workspaceList = [
    { id: 'w0', title: 'other', path: OTHER_WORKSPACE },
    { id: 'w1', title: 'demo', path: WORKSPACE },
  ];
  const { paint, calls } = await loadClient({
    local: makeStorage({ 'dsh-git.workspace': WORKSPACE, [`dsh-git.repo:${WORKSPACE}`]: REPO }),
    onRpc: (body) => {
      if (body.op === 'workspaces') return workspaceList;
      if (body.op === 'status') return statusPage({ repo: REPO });
      if (body.op === 'graph') return graphPage(1);
      return null;
    },
  });
  paint.schedulePrewarm(0);
  await wait(80);
  paint.resetPrewarm();
  assert.equal(calls[0].op, 'workspaces');
  assert.equal(calls[1].workspace, WORKSPACE, 'the remembered workspace is what the panel would paint');
});

test('prewarming stays silent when both cache layers are already warm', async () => {
  const page = statusPage({ changed: 0, repos: [{ root: REPO, relativePath: '', branch: 'main', counts: { changed: 0 } }] });
  const { paint, calls } = await loadClient({
    local: makeStorage({ 'dsh-git.workspace': WORKSPACE }),
    onRpc: (body) => {
      if (body.op === 'workspaces') return [{ id: 'w1', title: 'demo', path: WORKSPACE }];
      if (body.op === 'status') return page;
      if (body.op === 'graph') return graphPage(1);
      return null;
    },
  });
  paint.writePaintStatus(WORKSPACE, REPO, page);
  paint.writePaintGraph(REPO, graphPage(1));
  // Nothing is stale and everything is warm: the prewarmer must stay silent
  // instead of spawning Git behind the user's back.
  paint.writePaintWorkspaces([{ id: 'w1', title: 'demo', path: WORKSPACE }]);
  paint.schedulePrewarm(0);
  await wait(80);
  paint.resetPrewarm();
  assert.deepEqual(calls, []);
});

test('apply() registers the panel and schedules exactly one deferred prewarm', async () => {
  const workspaceList = [{ id: 'w1', title: 'demo', path: WORKSPACE }];
  // No test seam here: this is the module the loader actually receives.
  const { module, calls, timers, eventNames } = await loadClient({
    local: makeStorage({ 'dsh-git.workspace': WORKSPACE, [`dsh-git.repo:${WORKSPACE}`]: REPO }),
    testSeam: false,
    onRpc: (body) => {
      if (body.op === 'workspaces') return workspaceList;
      if (body.op === 'status') return statusPage({ repo: REPO });
      if (body.op === 'status-lite') return { isRepo: true, repos: [], entries: [], counts: { changed: 0 } };
      if (body.op === 'graph') return graphPage(1);
      return null;
    },
  });

  const registered = [];
  const cleanups = [];
  const ctx = {
    effect(fn) { const dispose = fn(); cleanups.push(dispose); return dispose; },
    on() { return () => {}; },
    inject(deps, callback) { callback(fakeScope(deps)); return () => {}; },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(key, callback) { callback(); return () => {}; },
      register(definition) { registered.push(definition && (definition.name || definition.id)); return () => {}; },
    },
    layout: { selectPanel() {} },
  };

  try {
    module.apply(ctx);
    assert.deepEqual(Object.keys(module).sort(), ['apply', 'inject'], 'the shipped module stays exactly { inject, apply }');
    assert.ok(registered.includes('main'), 'the main panel slot is registered');
    assert.ok(registered.includes('sidebar.panellist'), 'the sidebar icon is registered');
    assert.ok(timers.includes(1200), `prewarm must be deferred, saw timers: ${timers.join(',')}`);
    assert.ok(eventNames.includes('keydown'), 'the open shortcut listener is installed');

    // The deferred prewarm runs after the shell settled and fills the cache.
    await wait(1500);
    const ops = calls.map((call) => call.op);
    assert.ok(ops.includes('status'), `prewarm did not read status: ${ops.join(' → ')}`);
    assert.ok(ops.includes('graph'), `prewarm did not read history: ${ops.join(' → ')}`);
  } finally {
    // Disposal must drop the pending timer and every listener: a plugin reload
    // may not write a seed later or keep the page's work alive.
    for (const dispose of cleanups) {
      if (typeof dispose === 'function') dispose();
    }
  }
});

/** The scoped context `ctx.inject([...], …)` hands back. */
function fakeScope(deps) {
  const scope = {};
  for (const dep of deps || []) {
    if (dep === 'sessions') {
      scope.sessions = { list: { getSnapshot: () => ({ ids: [], byId: {}, items: [] }) } };
    } else if (dep === 'workspaces') {
      scope.workspaces = {
        list: { getSnapshot: () => ({ items: [] }) },
        create: async () => ({ workspaceId: 'w1' }),
        delete: async () => {},
      };
    } else if (dep === 'uiWorkspace') {
      scope.uiWorkspace = { openWorkspace: async () => {} };
    }
  }
  return scope;
}
