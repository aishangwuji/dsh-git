# DSH Git Workbench

A local Harness plugin that adds a **Git** panel to the Web UI.

## Install

Requires DeepSeek Harness 0.2.x and `pnpm` on `PATH` (DSH ships both). The plugin runs inside
the DSH host process — there is nothing to build at install time.

```powershell
dsh plugin --profile <your profile> add @aishangwuji/dsh-git
```

Then open **Plugins → Installed plugins**, switch the bundle on, and refresh the page (restart
DSH if the sidebar does not update). The Git panel appears in the sidebar, plus the branch pill
in a blank session's composer.

- **Upgrade**: `dsh plugin --profile <p> add @aishangwuji/dsh-git@<version>`, or use
  **Versions → Update** on the bundle page (registry installs list newer versions there).
- **Uninstall**: **Remove** on the same page; this stops the panel.
- The package is scoped because unscoped `dsh-git-panel` / `dsh-git-workbench` / `dsh-git`
  are already published by other DSH Git-panel plugins.

## What it does

- **Opens on real Git data instead of a spinner.** The panel paints the last page
  it showed for that workspace — branch, changed files with `+/-` counts, history
  — on the first frame and revalidates behind it. A prewarm read shortly after
  the client boots fills that cache for the workspace the panel will open on, so
  even the first open in a workspace does not wait for repository discovery. A
  genuinely cold start (no cache yet) shows the panel's three-pane skeleton
  rather than an empty box.
- Discovers **every Git repository inside the workspace**, not only the one at the
  workspace root: sibling projects (`workspace/DS-Bot`), repositories nested inside
  another repository, linked worktrees (`.git` file), submodules, and bare checkouts.
- Switches the panel between those repositories from the header. The switcher
  keeps the workspace manageable:
  - repositories with pending changes always appear first;
  - the workspace's own projects (top-level folders) come next;
  - clean dependency repositories and unusable checkouts (an uninitialised
    submodule, for example) stay behind the `Nested N` / `Collapse` toggle,
    where unusable ones are listed greyed out and cannot be selected;
  - nested labels drop their parent's prefix and are marked `↳`.
- Switches branches from the header through a **branch tree**: `Current branch`,
  `Local`, `Remote` and `Tags` groups, with local names folded by `/` into
  folders (`fix/login` reads as a folder, not a wall of names) and a filter box
  that always expands the folders it matches. Each local row carries its
  upstream drift (`↑ahead` / `↓behind`, `×` when the upstream is gone) and a `W`
  badge when another worktree already has it checked out — that row is not a
  checkout target, because Git would refuse it. Tags are listed read-only in
  this version. Checking out a remote branch without a local counterpart creates
  the tracking branch (`git checkout --track`); switching is refused when Git
  would overwrite local changes.
- Keeps the branch menu's four bottom actions, matching the reference Git
  picker: **Create and check out new branch...**, **Git graph**, **Start a new
  session in a worktree...**, and **Manage worktrees...**.
- Adds the same branch pill to the blank-session composer hero row, immediately
  after the agent-preset chip (the `conversation.input.dock` entry portals into
  the shell's `heroWorkspaceRow`). It carries the same status counters as the
  header pill — `±uncommitted` (amber), `↑to push` (green), `↓to pull` (amber) —
  and only non-zero counters are drawn, refreshed on focus and on a slow visible
  poll. It appears only for a blank session whose workspace resolves to exactly
  one Git repository, so active sessions, non-repository workspaces, and
  multi-repository project folders (where one branch cannot represent the whole
  workspace) keep the untouched composer.
- Creates a branch from the current `HEAD` and switches to it immediately. The
  dialog mirrors `git check-ref-format --branch` for instant feedback while the
  host remains the authority; duplicate names are reported without touching the
  working tree.
- Opens a read-only **Git graph** dialog with the topo-ordered commit list,
  lane topology, short SHA, refs, author, relative time, and paging. It reuses
  the same host `graph` operation as the workbench history with `all: true`, so
  there is no second Git read path and the dialog can still show every branch.
- Starts an isolated session from the branch menu: the host creates
  `$DSH_HOME/worktrees/<repo-key>/<name>` on a new `wt/<name>` branch from the
  chosen base branch, registers it as a workspace, and opens a blank session
  there. The current checkout never moves. A registration/session failure rolls
  the fresh worktree back. The base-branch picker uses the plugin's pill
  popover (searchable local branches) instead of a native `<select>`.
- Manages panel-owned worktrees: the dialog lists every linked worktree with
  its branch, short SHA, and path. The primary checkout is display-only; only
  paths exactly under the managed home (`<repo-key>/<name>`) can be removed. A
  dirty worktree rejects once and then offers an inline force confirmation; the
  `wt/` branch survives removal unless the row's delete-branch checkbox is on.
- Uses plugin-owned pill popovers for the workspace, repository, and branch
  pickers, so the open list follows the host's pill language instead of the
  operating system's native `<select>` popup.
- Shows the full value of a truncated label (branch, tag, remote branch,
  repository, workspace) in a shared tooltip as soon as the pointer rests on it,
  so long branch names never have to be guessed from an ellipsis.
- Drags a changed file (or any workspace tree file) into the conversation
  composer to insert its absolute path — the same behaviour as dropping a file
  from Zed's project panel into the agent panel.
- Lists every changed file in the selected repository as a colored tree, with
  per-file `+additions/-deletions` and folder summaries:
  - folder rows show their file count and totals only while collapsed, so an
    expanded folder does not repeat the same numbers on every ancestor row;
  - modified = amber
  - deleted = red, with a strikethrough ghost row
  - added / untracked = green
  - conflict = red `!`
- Collapses single-child folder chains (`apps` > `src` > `main` > `java` > ...)
  into one row, the way Zed compacts a tree; a long chain keeps its last folder
  visible and shows the full path on hover, so deep paths never become a ladder
  of one-name rows.
- Lays the panel out as three panes, like Zed's Git panel: changes and the commit
  box on the left, the commit history in the middle, and the selected diff or
  commit details on the right. Drag the splitter between panes to resize them
  (double-click resets, arrow keys nudge 16px); widths are remembered per profile.
- Shows the checked-out branch's reachable history as a table (graph, description,
  date, author, SHA) with branch/tag pills, an instant text filter over the loaded
  page, and `Load more` paging (200 commits a page). Above the table a filter row
  narrows history **in Git**: author, a date preset (today / 7 days / 30 days /
  this year), a path filter, and a newest-first / oldest-first toggle. Every
  filter keeps paging through the filtered set, so `Load more` never jumps out of
  what the user asked for. Switching branches re-reads this history; the **Git
  graph** dialog deliberately keeps the all-refs view so a branch comparison is
  one click away.
- Opens commit details as a card, like Zed's commit view: initials avatar, author,
  date, email, full hash with a copy button, parent commits, a "view on GitHub /
  GitLab / Gitee" link derived from the origin remote, the message, and the
  changed-file list (`name · directory · +/−`); selecting a file loads only that
  file's patch.
- Shows a commit graph (topo order, lanes, refs) with commit details and patch.
- Stages and unstages individual files, whole directories, all changes, or the staged set.
- Commits staged changes, or auto-stages tracked changes when nothing is staged
  (`Commit tracked changes`); supports amend and sign-off.
- Fetches, pulls, and pushes through the same Git binary the terminal uses.
- The fetch/pull/push toast carries a one-line summary instead of just the verb:
  changed refs and branch drift for fetch, pulled commits/files and line totals
  for pull, and pushed commit count or new-branch notice for push. The raw Git
  output stays available in the toast's `Details` disclosure.
- Decorates the workspace file tree and the preview header with per-file status from
  **all** repositories at once, and summarizes the workspace in the sidebar footer.
- Keyboard shortcuts while the panel is focused:
  - `Ctrl/Cmd+Enter` commit
  - `Alt+S` stage all, `Alt+Shift+S` unstage all
  - `Alt+G` then `F` fetch, `P` push, `L` pull
  - `Ctrl/Cmd+Shift+G` opens the Git panel from anywhere (unless typing)

## Design notes

- The browser never runs Git. A same-origin host route (`/dsh-git-6b1e`) accepts
  JSON requests, validates the workspace against the Harness workspace registry,
  and spawns Git with an argv array only (no shell). The same prefix serves the
  panel stylesheet as CSS text (`GET /dsh-git-6b1e/styles.css`), behind the same
  origin fence; the client fetches it and adopts it as a constructable
  stylesheet, with a `<link>` to that URL as the fallback. The panel self-checks
  the result (a sentinel custom property) and shows an inline-styled diagnostic
  row with the numbers that explain a failure, because an unstyled panel that
  still works is otherwise invisible to the console.
- Repository discovery follows Zed's worktree scan (`crates/worktree/src/worktree.rs`,
  `insert_git_repository`): a directory that contains a `.git` entry *is* a
  repository, `.git` internals are never walked, and a repository nested inside
  another one is an independent project rather than an exclusion. A `.git` file
  counts (linked worktree / submodule), and a bare checkout (`HEAD` + `objects` +
  a ref store, no `.git`) is reported as read-only. When the workspace itself holds
  no repository but sits inside one, that enclosing repository is used — the same
  idea as Zed's external work directory. The walk is bounded by depth (8) and by a
  directory budget (6000), slices around `node_modules`, virtualenvs, and build
  output, and is cached for 30 seconds.
- Status is assembled from one `git status --porcelain=v1 --branch -z` per
  repository: the branch header, upstream, and ahead/behind come from the same
  read, and each repository's snapshot is cached for 1.5 seconds so the panel
  poll, the file tree, and the sidebar share it. Repositories that are not the
  current selection reuse the snapshot for 8 seconds, and a repository whose
  work tree cannot be read is not retried for 30 seconds — that keeps an
  uninitialised submodule from spawning Git on every poll.
- The panel's first frame is served from a **first-paint cache** rather than
  from a fresh read (details in `docs/first-paint.md`). Two entries per workspace
  seed it: the status page (10 minute seed TTL, LRU of four workspaces) and the
  first history page (LRU of three repositories, no expiry). Both live in
  `sessionStorage` under `dsh-git.paint.v1`, so a reload paints instantly too,
  and both are written after every successful read, so the seed is the page the
  user last saw. A seed only fills cold state — it can never roll back live data
  — and every mount revalidates behind it (stale-while-revalidate).
- A **first-paint prewarm** fills that cache shortly after the client boots: it
  resolves the workspace the panel would open on (the remembered one, else the
  first registered), runs exactly the reads the panel's first paint would run —
  `status` for the whole workspace, a second `status` when the repository pick
  leaves the primary one, then the first `graph` page — and writes them into the
  same cache. Read routes only, once per boot, silent on failure, and idle when
  both layers are already warm. It is deliberately not tied to sessions: this
  panel follows the workspace switcher, not the active session's directory.
- Opening the panel costs two round trips when nothing is cached: `status`
  (discovery *and* the selected repository's full status, which the host returns
  together) and `graph`. The bootstrap reuses that status response when its
  repository pick lands on the same repository instead of asking twice; the host
  runs the switcher summaries and the selected repository's status concurrently,
  and the history read runs its log, its ref table and a cheap bare-check
  concurrently instead of paying for a worktree status scan the history does not
  use.
- The panel is scoped to one repository at a time (as in Zed's Git panel); writes
  name their repository explicitly and are refused with `REPO_REQUIRED` rather
  than guessing when a workspace holds several repositories.
- Branch switching runs `git checkout` through the same host route; a dirty tree
  that the target branch would overwrite is reported as `CHECKOUT_DIRTY` instead
  of being discarded. Creating a branch uses `git checkout -b` after a
  `check-ref-format --branch` gate, so an invalid name never reaches the index.
- The workbench history reads `git log HEAD`, so it follows the checked-out
  branch; the graph dialog passes `all: true` to read every ref. Both share the
  same `graph` operation, paging, and ref decoding.
- Worktree writes also go through the argv-only host route. Creation requires a
  valid ref, a free `wt/<name>` branch, and a free managed directory; removal
  first proves the path is a direct child of the managed home and is listed by
  `git worktree list --porcelain`, so a crafted path cannot delete arbitrary
  files. Dirty worktrees need an explicit force flag. The Client half registers
  the checkout through the `workspaces` service and opens its blank session
  through `uiWorkspace.openWorkspace`, so the host never needs a browser-side
  navigation API.
- The workspace file tree is decorated in place (status letters, 6px directory
  dots, drag payload). The host's files plugin renders no context menu of its
  own, so this plugin does not add menu rows to it — right-click actions such as
  "reveal in file manager" would need a host slot that does not exist yet.
- Commands run through the Harness `subprocess` service with bounded output,
  a hard timeout, and a scrubbed environment.
- **Writes are serialized per repository on the host**, not only per panel: the
  main Git tab and the sidebar seat can both be open, and a promise-chain queue
  keyed by the checkout means the same work tree never runs two `git` writes at
  once. `dispatch` classifies every operation as a read or a write, and a test
  fails if a new operation is neither.
- **Destructive operations require `confirm: true`** from the caller. Removing a
  worktree with `--force` (deletes uncommitted files) or with `deleteBranch`
  (force-deletes a branch) is refused with `CONFIRM_REQUIRED` otherwise; the UI
  sends that flag only from the step where the user actually confirmed (the
  inline force button, or the "delete branch too" checkbox).
- History filters run in Git (`--author`, `--since`, `--until`, `--reverse`, and
  `-- <path>` after `safeRepoPath`), so paging stays inside the filtered set; the
  first-paint cache only stores the unfiltered first page, because that is the
  page a fresh mount shows.
- The branch tree is one `for-each-ref` (heads + remotes + tags, with upstream
  drift) plus one `git worktree list --porcelain`: two spawns, no per-branch
  request.
- Two render checks back the client half: `scripts/ssr-check.mjs` renders the cold
  panel (header + skeleton) and `scripts/panel-render-check.mjs` renders a panel
  with a seeded first-paint page, so the chrome that only exists once data is on
  screen is covered without a browser. Both skip cleanly when React cannot be
  resolved and both run from `npm run check`.
- Operations are serialized per panel; the UI keeps commit drafts per workspace
  and polls status every five seconds while visible.
- The panel is registered as a `main` slot keyed `git` and a
  `sidebar.panellist` icon with the same id, so it is reachable from the sidebar.
- The composer pill is a `conversation.input.dock` entry, but the shell renders
  that hole as its own row below the hero controls; the client portals the pill
  into the visible `heroWorkspaceRow` before the right-aligned `heroOptions`
  group. A mutation observer re-asserts the seat when the shell replaces the
  row. The entry renders nothing for a non-blank session, a session without a
  cwd, or a workspace with no repository; branch reads are lazy and refresh on
  focus, so a non-repository workspace costs no Git polling.
- This version intentionally does **not** implement hunk-level staging, stash,
  submodule updates, LFS, or credential prompts. Use the terminal for interactive
  authentication (or configure ssh-agent / a credential helper). Worktree
  removal is limited to panel-managed checkouts; linked worktrees outside the
  managed home stay visible but read-only.

## Troubleshooting

- **"Could not read branches" / `UNKNOWN_OP` right after an update**: the Host
  half (`index.js`) is loaded when the profile is applied, while `client.js` is
  re-read when the page loads. A page refresh therefore runs the new UI against
  the old Host and every newly added operation answers `UNKNOWN_OP`. Fully quit
  Harness (tray icon → Quit) and reopen it, or toggle this bundle in
  Settings → Plugins to force a profile reload.
- **A repository shows `(unavailable)`**: its work tree cannot be read, which is
  normal for an uninitialised submodule. Initialise it in a terminal
  (`git submodule update --init`) and reopen the switcher.
- **`CONFIRM_REQUIRED` when driving the route by hand**: destructive operations
  (force worktree removal, branch deletion during removal) need `confirm: true`
  in the request body. The panel sends it from its own confirmation step; a
  scripted caller must pass it explicitly.

## Files

- `index.js` — the thin host entry: plugin row (`inject`), `apply()`, the HTTP
  route (including `GET /styles.css`), and the operation switch. Everything the
  switch calls lives in `host/`.
- `host/core.js` — errors, limits, and the only path/ref validators.
- `host/git.js` — the single argv-only `git` entry point, executable resolution,
  and the environment Git runs with.
- `host/state.js` — short-lived caches, the per-repository write queue, and the
  destructive-operation `confirm` guard.
- `host/discovery.js` — workspace allow-list and repository discovery.
- `host/status.js` — status snapshots, counts, auxiliary reads, status pages.
- `host/history.js` — filtered commit graph, commit details, diffs, branch tree.
- `host/write.js` — stage/commit/checkout/branch/fetch/pull/push/init.
- `host/worktrees.js` — managed worktrees: layout, listing, create/remove.
- `host/route.js` — same-origin fence, bounded body reads, JSON responses.
- `host/runtime.js` — the Cordis context and logger the helpers read instead of
  closing over `apply()`.
- `client.js` — React view registered into `main` and `sidebar.panellist`.
- `styles.css` — the panel stylesheet, served by the plugin route at
  `/dsh-git-6b1e/styles.css` and adopted by the client as a constructable
  stylesheet. It is a real file rather than a template literal in the bundle: a
  literal can be dropped or rewritten by whatever transforms the bundle on its
  way to the page, which leaves a fully working panel with no styles at all.
- `cordis.patch.yml` — inserts the host plugin row.
- `locale/*.json`, `icon.svg` — plugin manager metadata and artwork.
- `docs/pill-popover.md` — the pill-trigger popover used by the workspace,
  repository, and branch switchers: full visual spec, states, variants, and a
  copy-paste checklist for reusing it in another panel.
- `docs/first-paint.md` — how the panel paints before Git answers: cache schema,
  seed TTLs and LRU sizes, the prewarm triggers, the two-round-trip first open,
  and how to verify it by hand.
- `test/host.test.mjs` — route-level checks over a throwaway fixture workspace
  that reproduces nested, ignored, worktree, bare, and enclosing repositories,
  plus branch creation and managed-worktree create/list/remove safety. Run with
  `npm test` (needs `git` on `PATH`).
- `test/client.test.mjs` — first-paint cache, prewarm planner, branch-folder and
  pill-counter checks: the Client half is evaluated in a Node VM with a stub
  browser around it, so the seed/LRU/TTL rules, the prewarm read order and the
  pure helpers are asserted without React.
- `test/invariants.test.mjs` — the rules no behavioural test can express: the
  client only requires the browser baseline, the host only imports Node builtins
  and its own modules, git stays argv-only, every dispatched operation is either
  a declared read or inside the write lock, destructive operations carry the
  confirmation guard, the manifest/CI contract holds, both locales declare the
  same keys, and every literal `t()` key exists.
- `scripts/ssr-check.mjs`, `scripts/panel-render-check.mjs` — the two render
  checks (cold panel with skeleton, seeded panel with data). `npm run check`
  runs them together with the suites; both skip when React is not resolvable.
