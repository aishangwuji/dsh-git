/**
 * Render check #1 — the cold panel.
 *
 * Renders every seat the client half registers with `react-dom/server` and no
 * cache at all, which is exactly the state the panel is in on a first open:
 * the header plus the three-pane skeleton. This is what catches "renders and
 * throws" regressions without a browser — a `t()` that is not a function, a
 * TDZ reference in a hooks dependency array, a dictionary lookup that moved.
 *
 *   node scripts/ssr-check.mjs
 *
 * Skips (exit 0) when React is not resolvable, so CI never depends on a local
 * installation. The data-bearing state is covered by
 * `scripts/panel-render-check.mjs` — the two together are the two checks.
 */
import { expectMarkup, loadClient } from './lib/client-harness.mjs';

const client = await loadClient();
if (client === null) {
  console.log('ssr-check: skipped (React is not resolvable from a DSH profile or the repo)');
  process.exit(0);
}

try {
  const panel = client.render('main');
  expectMarkup(panel, ['dshg-root', 'dshg-header', 'dshg-skeleton'], 'cold panel');
  if (panel.includes('dshg-body')) {
    throw new Error('cold panel painted data it does not have: the seeded body must stay behind the skeleton');
  }

  const icon = client.render('sidebar.panellist', { openPanel() {} });
  expectMarkup(icon, ['dshg-panel-icon'], 'sidebar icon');

  const footer = client.render('sidebar.footer.action', { openPanel() {} });
  expectMarkup(footer, ['dshg-sidebar-status'], 'sidebar footer summary');

  // The composer entry must render nothing without a live blank session.
  const composer = client.render('conversation.input.dock', {});
  if (composer !== '') throw new Error(`composer entry rendered ${composer.length} chars without a session`);

  console.log(`ssr-check: ok — cold panel ${panel.length} chars, icon ${icon.length}, footer ${footer.length} (react from ${client.reactFrom})`);
} finally {
  client.dispose();
}
