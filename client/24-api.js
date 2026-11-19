    function pillCounters(status) {
      const counters = [];
      if (!status) return counters;
      const changed = status.counts ? Number(status.counts.changed) || 0 : 0;
      if (changed > 0) counters.push({ kind: 'changed', text: `±${changed}` });
      const ahead = Number(status.ahead) || 0;
      if (ahead > 0) counters.push({ kind: 'ahead', text: `↑${ahead}` });
      const behind = Number(status.behind) || 0;
      if (behind > 0) counters.push({ kind: 'behind', text: `↓${behind}` });
      return counters;
    }

    /** Class per counter kind: uncommitted = warn, ahead = push, behind = pull. */
    const PILL_COUNTER_CLASS = {
      changed: 'dshg-pill-changed',
      ahead: 'dshg-ahead',
      behind: 'dshg-behind',
    };

    function formatTime(timestamp) {
      if (!timestamp) return '';
      try {
        return new Date(timestamp * 1000).toLocaleString(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return '';
      }
    }

    function readStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    /** Pane width persisted across sessions, clamped to a usable range. */
    function readPaneWidth(key, fallback, min, max) {
      const raw = Number(readStorage(key));
      if (!Number.isFinite(raw) || raw <= 0) return fallback;
      return Math.min(Math.max(raw, min), max);
    }

    function clampPaneWidth(value, min, max) {
      return Math.min(Math.max(Math.round(value), min), Math.max(min, max));
    }

    function writeStorage(key, value) {
      try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Private mode or a storage quota failure must not break the panel.
      }
    }

    async function rpc(op, payload) {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.code = 'INTERNAL';
        throw error;
      }
      const json = await response.json();
      if (!json.ok) {
        const error = new Error(json.error && json.error.message ? json.error.message : 'Git operation failed');
        error.code = json.error && json.error.code ? json.error.code : 'UNKNOWN';
        error.detail = json.error && json.error.detail ? json.error.detail : null;
        throw error;
      }
      return json.value;
    }

    /* ------------------------------ first-paint cache ------------------------------ */
    /**
     * The panel is remounted every time it is opened again (sidebar seat, main
     * tab, session switch), and a cold mount used to paint an empty frame and
     * then wait through `workspaces` → repository discovery → full status →
     * history, one round trip after another. This cache keeps the last page each
     * workspace produced, so the next mount renders it synchronously and
     * revalidates behind it (stale-while-revalidate): real Git data on the first
     * frame, corrected a moment later.
     *
     * The two entries age differently:
     * - the workspace page (files, branch, counts) keeps a 10 minute seed TTL —
     *   freshness is the mount refresh's job, the TTL only decides how old a
     *   seed may be to still paint the first screen;
     * - the history page costs two Git spawns to rebuild and barely moves, so it
     *   is kept warm with an LRU of three repositories and no expiry.
     *
     * `sessionStorage` (not `localStorage`) keeps the seed for the life of the
     * tab: a reload paints instantly too, while a fresh process start is cold.
     * Every read/write is best-effort — private mode, quota and corrupt payloads
     * degrade to "no seed", never to an error, and a seed only ever fills states
     * that are still empty (it can never roll back live data).
     */
    const PAINT_KEY = 'dsh-git.paint.v1';
    const PAINT_STATUS_TTL_MS = 10 * 60_000;
    const PAINT_STATUS_KEEP_WARM = 4;
    const PAINT_GRAPH_KEEP_WARM = 3;
    const paintStatus = new Map();
    const paintGraph = new Map();
    let paintWorkspaces = [];
    let paintHydrated = false;

    function paintWorkspaceRow(row) {
      return Boolean(row) && typeof row === 'object' && typeof row.path === 'string';
    }

    /** Move an entry to the tail, so eviction follows real use, not write order. */
    function paintTouch(map, key) {
      const entry = map.get(key);
      if (entry === undefined) return undefined;
      map.delete(key);
      map.set(key, entry);
      return entry;
    }

    function paintCap(map, size) {
      while (map.size > size) map.delete(map.keys().next().value);
    }

    function hydratePaint() {
      if (paintHydrated) return;
      paintHydrated = true;
      let parsed = null;
      try {
        const raw = sessionStorage.getItem(PAINT_KEY);
        if (typeof raw === 'string' && raw !== '') parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      const feed = (map, stored, cap) => {
        if (!stored || typeof stored !== 'object') return;
        let count = 0;
        for (const key of Object.keys(stored)) {
          const entry = stored[key];
          if (!entry || typeof entry !== 'object' || typeof entry.at !== 'number') continue;
          // A write that happened before this read is always the fresher one.
          if (map.has(key)) continue;
          if (count >= cap) break;
          map.set(key, entry);
          count += 1;
        }
      };
      feed(paintStatus, parsed.status, PAINT_STATUS_KEEP_WARM);
      feed(paintGraph, parsed.graph, PAINT_GRAPH_KEEP_WARM);
      if (Array.isArray(parsed.workspaces)) paintWorkspaces = parsed.workspaces.filter(paintWorkspaceRow);
    }

    function persistPaint() {
      try {
        const pack = (map) => {
          const out = {};
          for (const [key, entry] of map) out[key] = entry;
          return out;
        };
        sessionStorage.setItem(PAINT_KEY, JSON.stringify({
          status: pack(paintStatus),
          graph: pack(paintGraph),
          workspaces: paintWorkspaces,
        }));
      } catch {
        // A quota or private-mode failure only costs the next mount its seed.
      }
    }

    function readPaintWorkspaces() {
      hydratePaint();
      return paintWorkspaces;
    }

    function writePaintWorkspaces(list) {
      paintWorkspaces = (Array.isArray(list) ? list : []).filter(paintWorkspaceRow);
      persistPaint();
    }

    /** The last workspace page, or undefined when missing or past its seed TTL. */
    function readPaintStatus(workspace) {
      if (!workspace) return undefined;
      hydratePaint();
      const entry = paintTouch(paintStatus, workspace);
      if (!entry) return undefined;
      if (Date.now() - entry.at > PAINT_STATUS_TTL_MS) {
        paintStatus.delete(workspace);
        return undefined;
      }
      return entry;
    }

    /** `repo` is the host's `repoRoot` for this page, so the seed never lies about which checkout it shows. */
    function writePaintStatus(workspace, repo, data) {
      if (!workspace || !data || typeof data !== 'object') return;
      paintStatus.delete(workspace);
      paintStatus.set(workspace, { at: Date.now(), repo: repo || null, data });
      paintCap(paintStatus, PAINT_STATUS_KEEP_WARM);
      persistPaint();
    }

    function readPaintGraph(repo) {
      if (!repo) return undefined;
      hydratePaint();
      return paintTouch(paintGraph, repo);
    }

    function writePaintGraph(repo, page) {
      if (!repo || !page) return;
      paintGraph.delete(repo);
      paintGraph.set(repo, {
        at: Date.now(),
        commits: Array.isArray(page.commits) ? page.commits : [],
        hasMore: page.hasMore === true,
      });
      paintCap(paintGraph, PAINT_GRAPH_KEEP_WARM);
      persistPaint();
    }

    /**
     * Everything the panel needs for its first frame, or a cold start when the
     * cache is empty. Only fields the cache can vouch for are seeded: a status
     * page always carries the repository it describes, so the header, the
     * changes tree and the history seed can never disagree about which checkout
     * is on screen.
     */
    function readBootSeed() {
      const known = readPaintWorkspaces();
      const saved = readStorage('dsh-git.workspace');
      let workspace = '';
      if (saved && (known.length === 0 || known.some((row) => samePath(row.path, saved)))) workspace = saved;
      else if (known.length > 0) workspace = known[0].path;
      else if (saved) workspace = saved;
      const entry = workspace ? readPaintStatus(workspace) : undefined;
      const repo = entry && entry.repo ? entry.repo : '';
      const page = repo ? readPaintGraph(repo) : undefined;
      return {
        workspaces: known,
        workspace,
        status: entry ? entry.data : null,
        repo,
        graph: page ? page.commits : null,
        graphHasMore: page ? page.hasMore === true : false,
      };
    }

    /**
     * The repository the panel opens with: the last one used for this workspace,
     * else the busiest project, else the workspace's own repository. Shared with
     * the prewarmer so the warmed page is exactly the page the panel paints.
     * `discovered` is the host's answer for the whole workspace, whose
     * `repoRoot` already carries the primary repository's full status.
     */
    function pickBootstrapRepo(discovered, saved) {
      const list = Array.isArray(discovered && discovered.repos) ? discovered.repos : [];
      if (list.length === 0) return null;
      // A repository whose work tree cannot be read (an uninitialised
      // submodule, for instance) is not a useful default.
      const usable = list.filter((item) => !item.error);
      const candidates = usable.length > 0 ? usable : list;
      const byChanged = (a, b) => {
        const left = a.counts ? a.counts.changed || 0 : 0;
        const right = b.counts ? b.counts.changed || 0 : 0;
        return right - left || (a.relativePath || '').localeCompare(b.relativePath || '');
      };
      // Prefer a project with pending work over a dependency that happens to
      // have changes, then any changed repository, then the workspace's own
      // repository.
      const preferred = candidates.filter((item) => repoIsProject(item) && repoChanged(item)).sort(byChanged)[0]
        || candidates.filter(repoChanged).sort(byChanged)[0]
        || candidates.find((item) => samePath(item.root, discovered.repoRoot))
        || candidates[0];
      return candidates.find((item) => samePath(item.root, saved)) || preferred;
    }

    /* ------------------------------ first-paint prewarm ------------------------------ */
    /**
     * The cache above only fills when a panel mounts, so the very first open in
     * a workspace still paid the full cold start. This prewarmer closes that gap
     * from the one place the panel's own choice is known before it mounts: it
     * runs exactly the reads the first paint would run, for exactly the
     * workspace and repository the panel is about to open, and writes them into
     * the same cache. Read routes only, silent on every failure: a broken
     * prewarm just means that panel opens cold.
     *
     * It is deliberately not tied to sessions: this panel opens on the workspace
     * it remembers (the header switcher is the only thing that changes it), so
     * the active session's directory is not what would be painted.
     */
    const PREWARM_INITIAL_DELAY_MS = 1200;
    const PREWARM_FRESH_MS = 15_000;
    let prewarmTimer = null;
    let prewarmGeneration = 0;

    async function prewarmWorkspace(workspacePath) {
      const generation = ++prewarmGeneration;
      try {
        const warm = readPaintStatus(workspacePath);
        const warmEnough = Boolean(warm) && Date.now() - warm.at < PREWARM_FRESH_MS;
        if (warmEnough && (!warm.repo || readPaintGraph(warm.repo) !== undefined)) return;
        let discovered = warmEnough ? warm.data : null;
        if (!discovered) {
          discovered = await rpc('status', { workspace: workspacePath });
          // A newer prewarm arrived while this read ran: drop the stale answer.
          if (generation !== prewarmGeneration) return;
          writePaintStatus(workspacePath, discovered && discovered.repoRoot, discovered);
          if (!discovered || discovered.isRepo !== true) return;
        } else if (discovered.isRepo !== true) {
          return;
        }
        const chosen = pickBootstrapRepo(discovered, readStorage(`dsh-git.repo:${workspacePath}`));
        if (!chosen) return;
        if (!samePath(chosen.root, discovered.repoRoot)) {
          const scoped = await rpc('status', { workspace: workspacePath, repo: chosen.root });
          if (generation !== prewarmGeneration) return;
          writePaintStatus(workspacePath, chosen.root, scoped);
        }
        if (readPaintGraph(chosen.root) !== undefined) return;
        const history = await rpc('graph', { workspace: workspacePath, repo: chosen.root });
        if (generation !== prewarmGeneration) return;
        writePaintGraph(chosen.root, history);
      } catch {
        // Prewarming is opportunistic; the panel's own mount read stays the authority.
      }
    }

    /**
     * The workspace the panel opens on: the remembered one while it is still
     * registered, else the first registered workspace (the same rule `GitPanel`
     * applies at mount, and `readBootSeed` at seed time).
     */
    function bootWorkspaceOf(workspaces, saved) {
      if (saved && workspaces.some((row) => samePath(row.path, saved))) return saved;
      return workspaces[0] ? workspaces[0].path : '';
    }

    async function prewarmFirstPaint() {
      let workspaces = readPaintWorkspaces();
      if (workspaces.length === 0) {
        try {
          workspaces = await rpc('workspaces');
          writePaintWorkspaces(workspaces);
        } catch {
          return;
        }
      }
      const workspace = bootWorkspaceOf(workspaces, readStorage('dsh-git.workspace'));
      if (!workspace) return;
      await prewarmWorkspace(workspace);
    }

    /** Debounced entry point: one warm per boot, after the shell settled. */
    function schedulePrewarm(delay = PREWARM_INITIAL_DELAY_MS) {
      if (prewarmTimer !== null) clearTimeout(prewarmTimer);
      prewarmTimer = setTimeout(() => {
        prewarmTimer = null;
        void prewarmFirstPaint();
      }, delay);
    }

    /**
     * Shared worktree flow for both the Git panel and the composer branch pill:
     * create the managed checkout, then register its workspace and open a blank
     * session. A failure after the Git write removes the checkout again so no
     * half-created workspace is left behind.
     */
    async function addWorktreeSession(workspace, repo, name, baseRef) {
      if (!worktreeBridge) {
        const unavailable = new Error(t('err_WORKTREE_SERVICE_UNAVAILABLE'));
        unavailable.code = 'WORKTREE_SERVICE_UNAVAILABLE';
        throw unavailable;
      }
      let created = null;
      try {
        created = await rpc('worktree-add', { workspace, repo, name, baseRef });
        await worktreeBridge.start(created.path);
        return created;
      } catch (error) {
        if (created) {
          try {
            await rpc('worktree-remove', {
              workspace,
              repo,
              path: created.path,
              force: true,
              deleteBranch: true,
              // This is our own just-created checkout being rolled back, not a
              // user action: the confirmation it would otherwise need is the
              // failure that triggered the rollback.
              confirm: true,
            });
          } catch {
            // The original failure is what the caller reports.
          }
        }
        throw error;
      }
    }

    /** Remove a managed worktree and, when linked, its workspace registration. */
    async function removeWorktreeSession(workspace, repo, path, options) {
      const force = Boolean(options && options.force);
      const deleteBranch = Boolean(options && options.deleteBranch);
      const result = await rpc('worktree-remove', {
        workspace,
        repo,
        path,
        force,
        deleteBranch,
        // Both flags only arrive from an explicit, user-facing step: the inline
        // force confirmation after a WORKTREE_DIRTY refusal, or the "delete
        // branch too" checkbox. The host refuses the destructive removal
        // without this record.
        confirm: force || deleteBranch,
      });
      if (worktreeBridge) {
        const items = worktreeBridge.list();
        const linked = Array.isArray(items)
          ? items.find((item) => samePath(item.path, path))
          : null;
        if (linked) {
          try {
            await worktreeBridge.delete(linked.workspaceId);
          } catch {
            // The disk removal succeeded; a stale workspace row is less harmful
            // than hiding that success.
          }
        }
      }
      return result;
    }
