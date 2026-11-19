    const TREE_STATUS = {
      modified: { badge: 'M', labelKey: 'kindModified' },
      added: { badge: 'A', labelKey: 'kindAdded' },
      untracked: { badge: 'U', labelKey: 'kindUntracked' },
      deleted: { badge: 'D', labelKey: 'kindDeleted' },
      conflict: { badge: '!', labelKey: 'kindConflict' },
      renamed: { badge: 'R', labelKey: 'kindRenamed' },
      copied: { badge: 'C', labelKey: 'kindRenamed' },
    };
    const TREE_PRIORITY = ['conflict', 'deleted', 'modified', 'added', 'untracked', 'renamed', 'copied', 'ignored'];
    const TREE_REFRESH_MS = 4000;
    const TREE_POLL_MS = 12000;

    function treeNormalize(value) {
      return String(value == null ? '' : value).replace(/\\/g, '/').replace(/\/+$/, '');
    }

    function treeKey(value) {
      const normalized = treeNormalize(value);
      return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
    }

    function treePriority(kind) {
      const index = TREE_PRIORITY.indexOf(kind);
      return index === -1 ? TREE_PRIORITY.length : index;
    }

    function treeBadgeOf(node) {
      for (const child of node.children) {
        if (child.classList && child.classList.contains('dshg-tree-badge')) return child;
      }
      return null;
    }

    /** Latest Git status per absolute file path, shared with the document header chip. */
    let treeStatusPaths = new Map();
    /** Latest aggregated Git status per absolute directory path. */
    let treeStatusDirs = new Map();
    /** Absolute paths whose status the document header wants even when the tree is closed. */
    const treeWantedPaths = new Set();

    /** Header chip for the previewed file, fed by the same status cache as the tree badges. */
    function GitDocumentStatus({ absolutePath, openPanel }) {
      const [, force] = useState(0);
      useEffect(() => {
        if (!absolutePath) return undefined;
        const key = treeKey(absolutePath);
        treeWantedPaths.add(key);
        window.dispatchEvent(new Event('dsh-git:refresh'));
        const update = () => force((value) => value + 1);
        window.addEventListener('dsh-git:status', update);
        return () => {
          window.removeEventListener('dsh-git:status', update);
          treeWantedPaths.delete(key);
          window.dispatchEvent(new Event('dsh-git:refresh'));
        };
      }, [absolutePath]);
      if (!absolutePath) return null;
      const found = treeStatusPaths.get(treeKey(absolutePath));
      const status = found ? found.entry : null;
      if (!status) return null;
      const meta = TREE_STATUS[status.kind] || TREE_STATUS.modified;
      const label = t(meta.labelKey);
      return h('button', {
        type: 'button',
        className: 'dshg-doc-status',
        'data-dshg-status': status.kind,
        title: label + ' · ' + absolutePath,
        onClick: openPanel
          ? () => {
              try {
                openPanel();
              } catch (error) {
                console.error('[dsh-git] could not open panel', error);
              }
            }
          : undefined,
      }, h('span', { className: 'dshg-doc-status-badge' }, meta.badge),
        h('span', { className: 'dshg-doc-status-label' }, label));
    }

    /**
     * One floating tooltip for truncated labels marked with `data-dshg-tip`.
     * A shared layer keeps the pills untouched (they live inside `overflow`
     * boxes) and shows the full branch path instantly instead of the browser's
     * delayed native tooltip.
     */
    function installTooltip() {
      const host = document.body || document.documentElement;
      if (!host) return () => {};
      const tip = document.createElement('div');
      tip.className = 'dshg-tip';
      tip.hidden = true;
      host.appendChild(tip);

      let current = null;
      let pointerX = 0;
      let pointerY = 0;

      const hide = () => {
        current = null;
        tip.hidden = true;
      };

      const place = () => {
        const pad = 10;
        const rect = tip.getBoundingClientRect();
        let left = pointerX + 14;
        let top = pointerY + 18;
        if (left + rect.width > window.innerWidth - pad) left = Math.max(pad, pointerX - rect.width - 12);
        if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, pointerY - rect.height - 12);
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
      };

      const show = (target) => {
        const text = target.getAttribute('data-dshg-tip');
        if (!text) return;
        current = target;
        if (tip.textContent !== text) tip.textContent = text;
        tip.hidden = false;
        place();
      };

      const onOver = (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        const target = event.target && event.target.closest
          ? event.target.closest('[data-dshg-tip]')
          : null;
        if (target) show(target);
        else if (current) hide();
      };
      const onMove = (event) => {
        if (!current) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        place();
      };
      const onHide = () => hide();
      const onKey = (event) => {
        if (event.key === 'Escape') hide();
      };

      document.addEventListener('pointerover', onOver, true);
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerdown', onHide, true);
      document.addEventListener('scroll', onHide, true);
      document.addEventListener('keydown', onKey, true);

      return () => {
        document.removeEventListener('pointerover', onOver, true);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerdown', onHide, true);
        document.removeEventListener('scroll', onHide, true);
        document.removeEventListener('keydown', onKey, true);
        tip.remove();
      };
    }

    function installWorkspaceTreeDecorations() {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return () => {};
      }
      let workspaces = null;
      let lastRefresh = 0;
      let refreshing = false;
      let timer = null;
      let pendingForce = false;
      let disposed = false;

      const schedule = (delay, force) => {
        if (disposed) return;
        if (force) pendingForce = true;
        if (timer !== null) return;
        timer = setTimeout(() => {
          const runForce = pendingForce;
          pendingForce = false;
          timer = null;
          void run(runForce);
        }, delay == null ? 120 : delay);
      };

      async function ensureWorkspaces() {
        if (workspaces !== null) return workspaces;
        try {
          const list = await rpc('workspaces');
          workspaces = Array.isArray(list) ? list : [];
        } catch {
          workspaces = [];
        }
        return workspaces;
      }

      function activeRoots() {
        if (!workspaces || workspaces.length === 0) return [];
        const rows = document.querySelectorAll('[data-files-path]');
        const wanted = [...treeWantedPaths];
        const picked = [];
        for (const workspace of workspaces) {
          const rootKey = treeKey(workspace && workspace.path);
          if (!rootKey) continue;
          let hit = false;
          for (const row of rows) {
            const key = treeKey(row.getAttribute('data-files-path'));
            if (key && (key === rootKey || key.startsWith(rootKey + '/'))) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const key of wanted) {
              if (key && (key === rootKey || key.startsWith(rootKey + '/'))) {
                hit = true;
                break;
              }
            }
          }
          if (hit) picked.push(workspace);
        }
        if (picked.length === 0) picked.push(workspaces[0]);
        return picked.slice(0, 4);
      }

      async function refreshStatuses(force) {
        if (disposed || refreshing) return;
        const now = Date.now();
        if (!force && now - lastRefresh < TREE_REFRESH_MS) return;
        refreshing = true;
        lastRefresh = now;
        try {
          await ensureWorkspaces();
          const roots = activeRoots();
          const nextPaths = new Map();
          const nextDirs = new Map();
          await Promise.all(roots.map(async (workspace) => {
            let status;
            try {
              status = await rpc('status-lite', { workspace: workspace.path });
            } catch {
              return;
            }
            if (!status || !status.isRepo || !Array.isArray(status.entries)) return;
            // Each entry names the repository that owns it, so a nested
            // independent project decorates its own files even when the
            // workspace root belongs to a different repository.
            const fallbackRoot = treeNormalize(status.repoRoot || workspace.path);
            for (const entry of status.entries) {
              if (!entry || !entry.path || entry.kind === 'ignored') continue;
              const repoRoot = treeNormalize(entry.repo || fallbackRoot);
              const absolute = treeNormalize(repoRoot + '/' + entry.path);
              nextPaths.set(treeKey(absolute), { entry, absolute });
              const parts = absolute.split('/');
              for (let index = parts.length - 1; index >= 1; index -= 1) {
                const ancestor = parts.slice(0, index).join('/');
                if (/^[A-Za-z]:$/.test(ancestor)) continue;
                const key = treeKey(ancestor);
                if (!key) continue;
                const priority = treePriority(entry.kind);
                const current = nextDirs.get(key);
                if (current) {
                  current.count += 1;
                  if (priority < current.priority) {
                    current.kind = entry.kind;
                    current.priority = priority;
                  }
                } else {
                  nextDirs.set(key, { kind: entry.kind, count: 1, priority });
                }
              }
            }
          }));
          if (!disposed) {
            treeStatusPaths = nextPaths;
            treeStatusDirs = nextDirs;
            window.dispatchEvent(new Event('dsh-git:status'));
          }
        } finally {
          refreshing = false;
        }
      }

      function decorateNode(node) {
        const absolute = node.getAttribute('data-files-path');
        if (!absolute) return;
        const type = node.getAttribute('data-files-entry');
        const key = treeKey(absolute);
        let status = null;
        if (type === 'file') {
          const found = treeStatusPaths.get(key);
          if (found) status = found.entry;
        } else if (type === 'directory') {
          const found = treeStatusDirs.get(key);
          if (found) status = found;
        }
        const host = node.querySelector('button') || node;
        const badge = treeBadgeOf(host);
        if (!status) {
          node.removeAttribute('data-dshg-status');
          if (badge) badge.remove();
          if (host.dataset.dshgTitle !== undefined) {
            host.title = host.dataset.dshgTitle;
            delete host.dataset.dshgTitle;
          }
          return;
        }
        const kind = status.kind;
        const meta = TREE_STATUS[kind] || TREE_STATUS.modified;
        const isFile = type === 'file';
        node.setAttribute('data-dshg-status', kind);
        if (host.dataset.dshgTitle === undefined) host.dataset.dshgTitle = host.title || '';
        host.title = t(meta.labelKey) + ' · ' + absolute + (isFile ? '' : ` · ${status.count}`);
        // ZCode's file tree shows a coloured letter for files and a 6px
        // aggregate dot for directories; no boxed badges.
        const text = isFile ? meta.badge : '';
        let nextBadge = badge;
        if (!nextBadge) {
          nextBadge = document.createElement('span');
          nextBadge.className = 'dshg-tree-badge';
          host.appendChild(nextBadge);
        }
        nextBadge.classList.toggle('dshg-tree-dot', !isFile);
        nextBadge.setAttribute('aria-hidden', isFile ? 'false' : 'true');
        if (nextBadge.textContent !== text) nextBadge.textContent = text;
        nextBadge.setAttribute('data-dshg-kind', kind);
      }

      /** Drag a tree row into the composer: the drop payload is its absolute path. */
      function handleDragStart(event) {
        const target = event.currentTarget;
        const path = target && target.getAttribute ? target.getAttribute('data-files-path') : null;
        if (path) beginFileDrag(event, path);
      }

      function enableDrag(node) {
        if (node.dataset.dshgDraggable === '1') return;
        node.dataset.dshgDraggable = '1';
        node.setAttribute('draggable', 'true');
        node.addEventListener('dragstart', handleDragStart);
      }

      function decorate() {
        for (const node of document.querySelectorAll('[data-files-entry][data-files-path]')) {
          enableDrag(node);
          decorateNode(node);
        }
      }

      async function run(force) {
        // Paint from the last known status first so expanding a folder shows
        // cached badges immediately; the network refresh follows.
        decorate();
        await refreshStatuses(force);
        if (!disposed) decorate();
      }

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target;
          if (target && target.closest && target.closest('[data-files-entry]')) {
            schedule(200);
            return;
          }
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            if ((node.matches && node.matches('[data-files-path]')) ||
                (node.querySelector && node.querySelector('[data-files-path]'))) {
              schedule(200);
              return;
            }
          }
        }
      });
      const root = document.body || document.documentElement;
      if (!root) return () => {};
      observer.observe(root, { childList: true, subtree: true });

      const onVisible = () => {
        if (document.visibilityState === 'visible') schedule(200, true);
      };
      const onExternal = () => schedule(60, true);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      window.addEventListener('dsh-git:refresh', onExternal);

      const poll = setInterval(() => {
        if (document.visibilityState === 'visible' && document.querySelector('[data-files-entry]')) {
          schedule(0, false);
        }
      }, TREE_POLL_MS);

      schedule(400, true);

      return () => {
        disposed = true;
        observer.disconnect();
        clearInterval(poll);
        if (timer !== null) clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
        window.removeEventListener('dsh-git:refresh', onExternal);
        for (const node of document.querySelectorAll('[data-dshg-status], [data-dshg-draggable]')) {
          node.removeAttribute('data-dshg-status');
          node.removeAttribute('data-dshg-draggable');
          node.removeAttribute('draggable');
          node.removeEventListener('dragstart', handleDragStart);
          const host = node.querySelector('button') || node;
          const badge = treeBadgeOf(host);
          if (badge) badge.remove();
        }
      };
    }
