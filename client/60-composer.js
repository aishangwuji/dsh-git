    function HeroRowPortal({ active, children, anchorRef }) {
      const [host] = useState(() => document.createElement('div'));
      useLayoutEffect(() => {
        if (!active) return undefined;
        host.dataset.dshgComposerChip = '1';
        host.style.display = 'contents';
        const place = () => {
          const anchor = anchorRef && anchorRef.current;
          const outlet = anchor && anchor.parentElement;
          let row = null;
          if (outlet) {
            const previous = outlet.previousElementSibling;
            if (previous && String(previous.className || '').includes('heroWorkspaceRow')) {
              row = previous;
            }
            if (!row) {
              const stack = outlet.closest('[class*="composerStack"], [class*="composerHero"]');
              row = stack ? stack.querySelector('[class*="heroWorkspaceRow"]') : null;
            }
          }
          if (!row) {
            const rows = Array.from(document.querySelectorAll('[class*="heroWorkspaceRow"]'));
            row = rows.find((node) => node.getBoundingClientRect().width > 0) || rows[0];
          }
          if (!row) return;
          const trailing = Array.from(row.children).find(
            (node) => String(node.className || '').includes('heroOptions'),
          );
          if (host.parentElement !== row || (trailing && host.nextElementSibling !== trailing)) {
            row.insertBefore(host, trailing || null);
          }
        };
        place();
        const observer = new MutationObserver(place);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', place);
        return () => {
          observer.disconnect();
          window.removeEventListener('resize', place);
          host.remove();
        };
      }, [active, anchorRef, host]);
      if (!active) return null;
      return createPortal(children, host);
    }

    /**
     * Branch pill for a blank session hero. It resolves the session cwd from
     * the shell's session snapshot, probes the workspace for a repository, and
     * reuses the same branch switcher and dialogs as the Git panel.
     */
    function ComposerBranchChip(props) {
      const sessionId = props.sessionId;
      const summary = typeof props.useSessions === 'function'
        ? props.useSessions((state) => (
            sessionId === undefined ? undefined : state.byId[sessionId]
          ))
        : (sessionBridge ? sessionBridge.summary(sessionId) : undefined);
      const blank = Boolean(
        (summary && summary.blank === true)
        || (props.session && props.session.blank === true),
      );
      const cwd = (summary && summary.cwd) || (props.session && props.session.cwd) || '';

      const [status, setStatus] = useState(null);
      const [busy, setBusy] = useState('');
      const [notice, setNotice] = useState(null);
      const [dialog, setDialog] = useState(null);
      const [worktreeBranches, setWorktreeBranches] = useState([]);
      const seq = useRef(0);
      const dockRef = useRef(null);
      const active = Boolean(blank && cwd);

      const refresh = useCallback(async () => {
        if (!cwd) return null;
        const id = ++seq.current;
        try {
          const next = await rpc('status', { workspace: cwd });
          if (id === seq.current) {
            setStatus(next);
            window.dispatchEvent(new Event('dsh-git:refresh'));
          }
          return next;
        } catch {
          if (id === seq.current) setStatus(null);
          return null;
        }
      }, [cwd]);

      useEffect(() => {
        if (!active) {
          seq.current += 1;
          setStatus(null);
          return undefined;
        }
        void refresh();
        const onFocus = () => {
          if (document.visibilityState === 'visible') void refresh();
        };
        window.addEventListener('focus', onFocus);
        // A conversation can stay open for a long time, so poll slowly while the
        // tab is visible: the pill is the only status readout in that surface.
        const timer = setInterval(() => {
          if (document.visibilityState === 'hidden') return;
          void refresh();
        }, 15000);
        return () => {
          window.removeEventListener('focus', onFocus);
          clearInterval(timer);
        };
      }, [active, refresh]);

      useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 9000 : 4500);
        return () => clearTimeout(timer);
      }, [notice]);

      const repoRoot = status && status.repoRoot ? status.repoRoot : '';
      const loadBranches = useCallback(
        () => rpc('branches', { workspace: cwd, repo: repoRoot }),
        [cwd, repoRoot],
      );
      const fetchGraph = useCallback(
        (limit) => rpc('graph', { workspace: cwd, repo: repoRoot, limit, all: true }),
        [cwd, repoRoot],
      );

      const pickBranch = useCallback(async (pick) => {
        if (!repoRoot) return;
        const branch = typeof pick === 'string' ? pick : pick.branch;
        const remoteBranch = pick && typeof pick === 'object' ? pick.remoteBranch : undefined;
        setBusy(t('checkingOut'));
        setNotice(null);
        try {
          const result = await rpc('checkout', { workspace: cwd, repo: repoRoot, branch, remoteBranch });
          await refresh();
          const name = (result && result.branch) || branch;
          setNotice({
            kind: 'success',
            text: result && result.created
              ? tf('branchTrackingCreated', { branch: name })
              : tf('branchSwitched', { branch: name }),
          });
        } catch (error) {
          setNotice({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot, refresh]);

      const createBranch = useCallback(async (name) => {
        setBusy(t('creatingBranch'));
        setNotice(null);
        try {
          const result = await rpc('create-branch', { workspace: cwd, repo: repoRoot, name });
          await refresh();
          setNotice({ kind: 'success', text: tf('branchCreated', { branch: (result && result.branch) || name }) });
          return result;
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot, refresh]);

      const openWorktreeCreate = useCallback(async () => {
        try {
          const next = await loadBranches();
          const names = (next && Array.isArray(next.local) ? next.local : []).map((item) => item.name);
          if (status && status.branch && !names.includes(status.branch)) names.unshift(status.branch);
          if (names.length === 0) {
            setNotice({ kind: 'error', text: t('worktreeNoBase') });
            return;
          }
          setWorktreeBranches(names);
          setDialog({ kind: 'worktree-create' });
        } catch (error) {
          setNotice({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, [loadBranches, status]);

      const createWorktree = useCallback(async (name, baseRef) => {
        setBusy(t('worktreeStarting'));
        setNotice(null);
        try {
          const created = await addWorktreeSession(cwd, repoRoot, name, baseRef);
          setNotice({ kind: 'success', text: tf('worktreeCreated', { name: created.name }) });
          return created;
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot]);

      const fetchWorktrees = useCallback(
        () => rpc('worktrees', { workspace: cwd, repo: repoRoot }),
        [cwd, repoRoot],
      );

      const removeWorktree = useCallback(async (path, options) => {
        const result = await removeWorktreeSession(cwd, repoRoot, path, options);
        setNotice({ kind: 'success', text: t('worktreeRemoved') });
        return result;
      }, [cwd, repoRoot]);

      // A workspace that collects several independent repositories has no
      // single branch to show. The Git panel still offers the per-repository
      // switcher, but the composer entry would be misleading, so hide it.
      const repoCount = status && Array.isArray(status.repos) ? status.repos.length : 1;
      if (!active || !status || !status.isRepo || status.isBare || repoCount > 1) return null;

      return h(React.Fragment, null,
        h('div', {
          ref: dockRef,
          className: 'dshg-composer-dock-anchor',
          style: { display: 'none' },
          'aria-hidden': true,
        }),
        h(HeroRowPortal, { active: true, key: sessionId, anchorRef: dockRef },
          h(BranchSwitcher, {
            status,
            busy,
            load: loadBranches,
            onPick: pickBranch,
            onCreate: () => setDialog({ kind: 'create-branch' }),
            onGraph: () => setDialog({ kind: 'graph' }),
            onCreateWorktree: openWorktreeCreate,
            onManageWorktrees: () => setDialog({ kind: 'worktree-manage' }),
            hero: true,
          })),
        h('div', { className: 'dshg-composer-toast-host' },
          h(Toast, { toast: notice, onClose: () => setNotice(null) })),
        dialog && dialog.kind === 'create-branch' ? h(CreateBranchDialog, {
          onCreate: createBranch,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'graph' ? h(GitGraphDialog, {
          fetchGraph,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'worktree-create' ? h(CreateWorktreeDialog, {
          branches: worktreeBranches,
          currentBranch: status.branch || '',
          onCreate: createWorktree,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'worktree-manage' ? h(WorktreeManagerDialog, {
          fetchWorktrees,
          onRemove: removeWorktree,
          onClose: () => setDialog(null),
        }) : null);
    }
