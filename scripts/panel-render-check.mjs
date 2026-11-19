/**
 * Render check #2 — the panel with data on screen.
 *
 * `ssr-check.mjs` can only see the cold shell, because a server render never
 * runs effects: the data-bearing chrome (branch pill, changes tree, history
 * rows, the diff pane) only exists once a read has landed. With the first-paint
 * cache that state is reachable without a browser — seed the same
 * `sessionStorage` page the panel would have kept from a previous visit, render
 * once, and the whole chrome has to come out of that first frame intact.
 *
 *   node scripts/panel-render-check.mjs
 *
 * This is the check that catches the class of bug where a component that only
 * appears *with data* references something undefined: the empty state hides it,
 * the cold check stays green, and the real panel crashes.
 */
import { expectMarkup, loadClient } from './lib/client-harness.mjs';

const WORKSPACE = 'D:\\Projects\\demo';
const REPO = 'D:\\Projects\\demo\\app';
const PAINT_KEY = 'dsh-git.paint.v1';

const statusPage = {
  isRepo: true,
  workspaceRoot: WORKSPACE,
  repoRoot: REPO,
  relativePath: '',
  repos: [
    { root: REPO, relativePath: '', branch: 'main', counts: { changed: 2, staged: 0, unstaged: 2, conflicts: 0, untracked: 1 } },
  ],
  branch: 'main',
  detached: false,
  upstream: 'origin/main',
  ahead: 2,
  behind: 1,
  entries: [
    { path: 'src/index.js', kind: 'modified', staged: false, badge: 'M', additions: 4, deletions: 2 },
    { path: 'src/new-file.js', kind: 'untracked', staged: false, badge: '?', additions: 9, deletions: 0 },
  ],
  counts: { changed: 2, staged: 0, unstaged: 2, conflicts: 0, untracked: 1 },
  remotes: ['origin'],
  identity: { name: 'Fixture', email: 'fixture@example.com' },
};

const graphPage = {
  commits: [
    {
      sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      parents: ['b1b2c3d4e5f60718293a4b5c6d7e8f9012345678'],
      author: 'Fixture',
      timestamp: 1_760_000_000,
      subject: 'feat: paint the first frame',
      refs: [{ kind: 'local', name: 'main' }],
    },
    {
      sha: 'b1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      parents: [],
      author: 'Fixture',
      timestamp: 1_759_900_000,
      subject: 'chore: initial commit',
      refs: [],
    },
  ],
  hasMore: false,
};

const client = await loadClient({
  localStorageSeed: {
    'dsh-git.workspace': WORKSPACE,
    [`dsh-git.repo:${WORKSPACE}`]: REPO,
  },
  sessionStorageSeed: {
    [PAINT_KEY]: JSON.stringify({
      status: { [WORKSPACE]: { at: Date.now(), repo: REPO, data: statusPage } },
      graph: { [REPO]: { at: Date.now(), commits: graphPage.commits, hasMore: graphPage.hasMore } },
      workspaces: [{ id: 'ws-1', title: 'demo', path: WORKSPACE }],
    }),
  },
});
if (client === null) {
  console.log('panel-render-check: skipped (React is not resolvable from a DSH profile or the repo)');
  process.exit(0);
}

try {
  const seeded = client.render('main');
  expectMarkup(seeded, [
    'dshg-root',
    'dshg-body',                  // the three-pane workbench, not the skeleton
    'dshg-history',               // commit table
    'dshg-commit-row',            // history rows
    'dshg-file-row',              // changed files
    'dshg-pill-strong',           // branch pill
    'dshg-history-columns',       // commit column header
  ], 'seeded panel');
  if (seeded.includes('dshg-skeleton')) {
    throw new Error('seeded panel still shows the cold skeleton: the first frame ignored the paint cache');
  }
  for (const text of ['main', 'feat: paint the first frame', 'src/index.js']) {
    if (!seeded.includes(text)) throw new Error(`seeded panel lost "${text}"`);
  }

  console.log(`panel-render-check: ok — seeded ${seeded.length} chars (changes + history + branch pill)`);
} finally {
  client.dispose();
}
