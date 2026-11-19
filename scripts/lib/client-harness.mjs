/**
 * Shared harness for the two render checks (`scripts/ssr-check.mjs` and
 * `scripts/panel-render-check.mjs`).
 *
 * The client half is a browser module: it registers a factory on
 * `window.__ModuleLoader__` and renders through React. This loader puts just
 * enough browser around it to run that factory and render its slots with
 * `react-dom/server`, so "renders and throws" regressions (a `t()` that is not
 * a function, a TDZ reference in a hooks dependency array, a dictionary key
 * that no longer exists) surface without a browser.
 *
 * React is resolved from the local DSH profile first (that is the copy the page
 * actually runs), then from the repository; when neither has it the caller
 * skips the check instead of failing, so CI stays honest about what it covers.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/* Captured before any stub is installed: once `setTimeout` itself is overridden
   on globalThis, a stub that calls the bare name would recurse into itself. */
const nodeSetTimeout = globalThis.setTimeout;
const nodeClearTimeout = globalThis.clearTimeout;
const nodeSetInterval = globalThis.setInterval;
const nodeClearInterval = globalThis.clearInterval;

/** React + react-dom/server from the running installation, or from the repo. */
export function resolveReact() {
  const home = process.env.DSH_HOME && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
  const manifests = ['desktop', 'web']
    .map((profile) => join(home, 'profiles', profile, 'package.json'))
    .filter((manifest) => existsSync(manifest));
  manifests.push(join(ROOT, 'package.json'));
  for (const manifest of manifests) {
    try {
      const require = createRequire(manifest);
      return {
        React: require('react'),
        renderToStaticMarkup: require('react-dom/server').renderToStaticMarkup,
        from: manifest,
      };
    } catch {
      // Try the next candidate: a profile without React is normal.
    }
  }
  return null;
}

function storage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    dump: () => Object.fromEntries(map),
  };
}

function element() {
  return {
    dataset: {},
    style: {},
    textContent: '',
    className: '',
    hidden: false,
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute: () => null,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
  };
}

/**
 * Load the real client.js, run `apply`, and return the slot components it
 * registered. `install()` runs before the module is imported, so a caller can
 * seed storage or install extra stubs.
 */
export async function loadClient({ localStorageSeed = {}, sessionStorageSeed = {}, install } = {}) {
  const react = resolveReact();
  if (react === null) return null;

  const local = storage(localStorageSeed);
  const session = storage(sessionStorageSeed);
  const captured = { factory: null };
  const disposers = [];
  const timers = [];

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

  const windowStub = {
    __ModuleLoader__: { load: (definition) => { captured.factory = definition.factory; } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    setTimeout: (fn, ms) => { timers.push(ms); return nodeSetTimeout(fn, ms); },
    clearTimeout: nodeClearTimeout,
    innerWidth: 1280,
    innerHeight: 800,
  };

  const globals = {
    window: windowStub,
    document: documentStub,
    navigator: { platform: 'win32', language: 'zh-CN', userAgent: 'node', clipboard: { writeText: async () => {} } },
    localStorage: local,
    sessionStorage: session,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: null }) }),
    console,
    setTimeout: (fn, ms) => { timers.push(ms); return nodeSetTimeout(fn, ms); },
    clearTimeout: nodeClearTimeout,
    setInterval: nodeSetInterval,
    clearInterval: nodeClearInterval,
    requestAnimationFrame: (fn) => nodeSetTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} takeRecords() { return []; } },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: class ResizeObserver { observe() {} unobserve() {} disconnect() {} },
  };
  const previous = new Map();
  for (const [name, value] of Object.entries(globals)) {
    previous.set(name, Object.prototype.hasOwnProperty.call(globalThis, name) ? globalThis[name] : undefined);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  /** The browser stubs stay installed until dispose(): the factory and the
      component bodies read `window`/`localStorage` at call time, not at import. */
  const restoreGlobals = () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    }
  };
  if (typeof install === 'function') install({ local, session });

  await import(pathToFileURL(join(ROOT, 'client.js')).href);

  if (captured.factory === null) throw new Error('client.js did not register itself with window.__ModuleLoader__');
  const plugin = captured.factory((name) => {
    if (name === 'react') return react.React;
    if (name === 'react-dom') return { createPortal: (node) => node };
    throw new Error(`client.js required a non-baseline module: ${name}`);
  });
  if (typeof plugin.apply !== 'function') throw new Error('the client factory did not return apply()');

  const registered = new Map();
  const slots = {
    inject: (name, callback) => { callback(); return () => {}; },
    register: (definition, Component) => {
      const key = definition && definition.name ? definition.name : String(definition && definition.id);
      registered.set(key, { definition, Component });
      return () => {};
    },
    registerFactory: () => () => {},
  };
  const ctx = {
    effect: (fn) => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); return dispose; },
    on: () => () => {},
    inject: (deps, callback) => {
      const scope = { ...ctx };
      for (const dep of deps || []) {
        if (dep === 'sessions') {
          scope.sessions = { list: { getSnapshot: () => ({ ids: [], byId: {}, items: [] }), subscribe: () => () => {} } };
        } else if (dep === 'workspaces') {
          scope.workspaces = {
            list: { getSnapshot: () => ({ items: [] }) },
            create: async () => ({ workspaceId: 'ws' }),
            delete: async () => {},
          };
        } else if (dep === 'uiWorkspace') {
          scope.uiWorkspace = { openWorkspace: async () => {} };
        }
      }
      callback(scope);
      return () => {};
    },
    locale: { register: () => () => {}, bind: () => (key) => key, getSnapshot: () => ({ id: 'zh' }) },
    slots,
    layout: { selectPanel() {} },
  };
  plugin.apply(ctx);

  const render = (slotName, props) => {
    const entry = registered.get(slotName);
    if (entry === undefined) throw new Error(`slot "${slotName}" was not registered by apply()`);
    return react.renderToStaticMarkup(react.React.createElement(entry.Component, props || {}));
  };

  return {
    plugin,
    registered,
    render,
    React: react.React,
    reactFrom: react.from,
    timers,
    local,
    session,
    dispose() {
      for (const dispose of disposers) {
        try { dispose(); } catch { /* cleanup is best effort in a check */ }
      }
      restoreGlobals();
    },
  };
}

/** Fail with a readable list; used by both checks for their needle assertions. */
export function expectMarkup(html, needles, label) {
  const missing = needles.filter((needle) => !html.includes(needle));
  if (missing.length > 0) {
    throw new Error(`${label}: rendered output is missing ${missing.join(', ')}`);
  }
}

export { ROOT };
