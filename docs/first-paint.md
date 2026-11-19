# First frame: how the panel paints before Git answers

The Git workbench used to paint an empty frame on open and then walk a chain of
reads: `workspaces` → repository discovery → full status → history. On Windows
each step is a Git spawn plus a round trip, so "open the Git panel" meant a
second or two of `加载中…` even when nothing had changed since the last visit —
the screen was blank exactly when the user wanted to look at it.

Two mechanisms remove that wait, and both are bounded by the same rule: **a
seed may only fill cold state**. It can never overwrite or roll back data that a
fresh read has already put on screen.

---

## 1. The first-paint cache (`client.js`)

Module-level maps, mirrored into `sessionStorage` so the seed also survives a
page reload (but not a process restart):

```
sessionStorage['dsh-git.paint.v1'] = {
  status: { "<workspace path>": { at, repo, data } },
  graph:  { "<repo root>":      { at, commits, hasMore } },
  workspaces: [ { id, title, path } ]
}
```

| Entry | Written when | Bound | Why |
|---|---|---|---|
| `status` | every successful `status` read (mount, 5 s poll, after a mutation) | 10 min seed TTL, LRU of 4 workspaces | It is the first screen: branch, ahead/behind, changed files and their `+/-`. A 5 s poll keeps it current, so the TTL only decides how old a seed may be and still paint — the mount always revalidates. |
| `graph` | every first-page `graph` read | LRU of 3 repositories, no expiry | Two Git spawns to rebuild, and history barely moves. |
| `workspaces` | every `workspaces` read / prewarm | the registry's own list | Lets the header render its switcher before the registry answers. |

Rules:

- `status.repo` is the host's `repoRoot` for that page, so a seed can never
  describe the wrong checkout. `readBootSeed()` takes `repo` **from the cached
  page**, not from the remembered repository, and falls back to the previous
  repository only when no page is cached.
- Every read/write is `try/catch`-wrapped: private mode, a quota failure, or a
  corrupt payload degrade to "no seed", never to an error.
- Writes are unconditional (no diffing): the payload is tens of kilobytes at
  most, and correctness beats a micro-optimisation. Reading an entry re-tails it
  in its map so LRU eviction follows real use.

`GitPanel` reads the cache once per mount through lazy `useState` initial
values, then lets the existing effects revalidate:

- the `[workspace]` effect sees `seed.status` for this workspace and returns
  **without** clearing the painted page (it consumes the status seed so a later
  workspace change still resets properly);
- the `[workspace, repo]` effect keeps the seeded history page when the
  repository matches, and skips its immediate re-read when `bootstrap` already
  painted an identical page milliseconds ago (`freshRef`, 1.5 s window);
- the `graph` effect re-reads silently when a seeded history page is on screen,
  so the middle pane never flashes a loading placeholder.

Cold start (no seed) renders `GitSkeleton` — the panel's own three columns in
placeholder form — instead of a lone centred `加载中…`.

---

## 2. The first-paint prewarm (`client.js`)

The cache above only fills when a panel mounts, so the very first open in a
workspace still paid the full cold start. The prewarmer fills it in advance:

1. It runs once per client boot, inside `ctx.effect`, 1.2 s after the plugin
   applies (long enough that it does not compete with the shell's own boot).
2. It resolves the workspace **the panel would open on**: the remembered
   workspace while it is still registered, else the first registered one — the
   same rule `readBootSeed` and `GitPanel` apply. Deliberately *not* the active
   session's `cwd`: this panel follows the workspace switcher, not sessions, so
   warming a session directory would warm a page nobody opens.
3. It runs exactly the reads that first paint would run: `status {workspace}`
   (discovery + primary repository status), then — if the panel's pick lands on
   another repository — `status {workspace, repo}`, then the first `graph` page.
   Same pick function as the panel (`pickBootstrapRepo`), so the warmed page
   *is* the page the panel paints.
4. It stays silent when both layers are already warm (`PREWARM_FRESH_MS`, 15 s),
   generations-guard a second run, and swallows every failure.

Read routes only: a broken prewarm just means that panel opens cold.

---

## 3. Host-side round trips (`index.js`)

- `status` returns the switcher summaries **and** the selected repository's full
  status in one response; the two reads now run concurrently and share the
  selected repository's single `git status` (deduplicated inside
  `readRepoSnapshot`).
- `graph` runs `git log`, `git for-each-ref` and a `rev-parse
  --is-bare-repository` check concurrently, instead of a `git status` scan
  followed by the log and then the ref table — the history page no longer pays
  for a worktree status read it never uses.

With a warm cache, an open costs **zero** blocking reads: the first frame is the
cached page and the refresh happens behind it. Cold, it is two round trips.

---

## Verifying by hand

1. `npm test` — the client test drives the real `client.js` in a Node VM
   (`__paint` seam): seed round-trip across a module reload, TTL expiry, LRU
   caps, the bootstrap pick order, and the prewarm read order/silence.
2. In the app: open the Git panel, wait for it, close it, open it again — the
   second open paints immediately. Reload the page (⌘/Ctrl+R) and open it: still
   immediate, because `sessionStorage` kept the seed.
3. `sessionStorage.getItem('dsh-git.paint.v1')` in DevTools should list the
   workspace you are in, with `status.<workspace>.repo` naming the checkout the
   panel shows.
4. To see a genuine cold start, clear `sessionStorage` and open the panel before
   the prewarmer had a chance to run: the three-column skeleton appears, then the
   first read lands.

## Known limits

- The cache is per tab (`sessionStorage`), so a fresh process start is cold
  unless the prewarmer got there first.
- A seeded `+/-` count can lag a file edit by one poll (≤ 5 s); the mount refresh
  corrects it. Counts, paths, and the branch are exact whenever the seed is
  written, since they come from a real read.
- The cache is not a substitute for the 5 s poll: it hides latency, it does not
  keep the panel live.
