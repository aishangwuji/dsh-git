    function GitPanel() {
      const rootRef = useRef(null);
      const busyRef = useRef(false);
      const statusSeq = useRef(0);
      const bootstrapSeq = useRef(0);
      const prefixTimer = useRef(null);
      const draftTimer = useRef(null);
      /**
       * The first frame comes from the paint cache (lazy initial state, so it is
       * read once per mount): a workspace this panel has already shown paints
       * its branch, changed files and history immediately, and the effects below
       * revalidate them in the background instead of blanking the panel for a
       * spinner. `seedRef` tells the repository effect which checkout the seeded
       * history page belongs to, and `lastWorkspaceRef` keeps the mount effects
       * from resetting the page that is already on screen.
       */
      const [seed] = useState(readBootSeed);
      const seedRef = useRef(seed);
      /**
       * `null` while the panel looks normal; when the stylesheet did not reach
       * this panel, the diagnostic details that explain why.
       */
      const [styleState, setStyleState] = useState(null);
      /** The workspace whose page the mount effects must not clear (see below). */
      const lastWorkspaceRef = useRef(seed.status ? seed.workspace : null);
      /** Marks a status page fetched seconds ago, so mount does not re-read it. */
      const freshRef = useRef(null);
      const [workspaces, setWorkspaces] = useState(seed.workspaces);
      const [workspace, setWorkspace] = useState(seed.workspace);
      const [repos, setRepos] = useState(() => (seed.status && Array.isArray(seed.status.repos) ? seed.status.repos : []));
      const [repo, setRepo] = useState(seed.repo);
      const [showAllRepos, setShowAllRepos] = useState(() => readStorage('dsh-git.repoScope') === 'all');
      const [status, setStatus] = useState(seed.status);
      const [loading, setLoading] = useState(!seed.status);
      const [busy, setBusy] = useState('');
      const [toast, setToast] = useState(null);
      const [expanded, setExpanded] = useState({});
      const [selected, setSelected] = useState(null);
      const [diff, setDiff] = useState(null);
      const [diffLoading, setDiffLoading] = useState(false);
      const [graph, setGraph] = useState(seed.graph);
      const [graphHasMore, setGraphHasMore] = useState(seed.graphHasMore);
      const [graphLoading, setGraphLoading] = useState(false);
      const [graphVersion, setGraphVersion] = useState(0);
      const [filters, setFilters] = useState(defaultFilters);
      const [commitDetail, setCommitDetail] = useState(null);
      const [detailLoading, setDetailLoading] = useState(false);
      const [detailFile, setDetailFile] = useState(null);
      const [detailFileDiff, setDetailFileDiff] = useState(null);
      const [detailFileLoading, setDetailFileLoading] = useState(false);
      const [message, setMessage] = useState('');
      const [amend, setAmend] = useState(false);
      const [signoff, setSignoff] = useState(false);
      const [prefix, setPrefix] = useState(false);
      const [leftWidth, setLeftWidth] = useState(() => readPaneWidth('dsh-git.pane.left', 300, 220, 620));
      const [rightWidth, setRightWidth] = useState(() => readPaneWidth('dsh-git.pane.right', 400, 280, 820));
      const [resizing, setResizing] = useState(false);
      const [dialog, setDialog] = useState(null);
      const [worktreeBranches, setWorktreeBranches] = useState([]);

      /**
       * A history filter change is a new first page: the old paging cursor and
       * the seeded default page no longer describe what should be on screen.
       */
      const changeFilters = useCallback((next) => {
        setFilters(next);
        setGraphVersion((value) => value + 1);
      }, []);

      const applyStatus = useCallback((next) => {
        setStatus(next);
        if (next && Array.isArray(next.repos)) setRepos(next.repos);
      }, []);

      const refreshStatus = useCallback(async (targetWorkspace, targetRepo, spinner = false) => {
        if (!targetWorkspace) return;
        const seq = ++statusSeq.current;
        if (spinner) setLoading(true);
        try {
          const next = await rpc('status', targetRepo
            ? { workspace: targetWorkspace, repo: targetRepo }
            : { workspace: targetWorkspace });
          if (seq === statusSeq.current) {
            applyStatus(next);
            // Keep the paint cache in step with what is on screen: the next
            // mount (and the prewarmer) seeds from exactly this page.
            const pageRepo = next && next.repoRoot ? next.repoRoot : targetRepo;
            writePaintStatus(targetWorkspace, pageRepo, next);
            freshRef.current = { workspace: targetWorkspace, repo: pageRepo, at: Date.now() };
            setLoading(false);
            window.dispatchEvent(new Event('dsh-git:refresh'));
          }
        } catch (error) {
          if (seq === statusSeq.current) {
            setLoading(false);
            if (error && error.code === 'REPO_NOT_FOUND') {
              // The selected repository vanished (deleted or rebuilt by
              // `git init`); fall back to rediscovery instead of looping.
              setRepo('');
              return;
            }
            setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          }
        }
      }, [applyStatus]);

      /**
       * Learn the repository list of a workspace, then pick one. The discovery
       * read already carries the primary repository's full status, so when the
       * pick lands on that same repository the panel paints from this response
       * instead of asking for the identical page a second time. `seq` discards
       * the answer when the workspace changed meanwhile.
       */
      const bootstrap = useCallback(async (targetWorkspace, seq) => {
        try {
          const next = await rpc('status', { workspace: targetWorkspace });
          if (seq !== bootstrapSeq.current) return;
          const list = Array.isArray(next.repos) ? next.repos : [];
          setRepos(list);
          if (list.length === 0) {
            writePaintStatus(targetWorkspace, null, next);
            setStatus(next);
            setLoading(false);
            return;
          }
          const chosen = pickBootstrapRepo(next, readStorage(`dsh-git.repo:${targetWorkspace}`));
          if (!chosen) return;
          if (samePath(chosen.root, next.repoRoot) && Array.isArray(next.entries)) {
            applyStatus(next);
            writePaintStatus(targetWorkspace, chosen.root, next);
            freshRef.current = { workspace: targetWorkspace, repo: chosen.root, at: Date.now() };
            setLoading(false);
          }
          setRepo(chosen.root);
        } catch (error) {
          if (seq !== bootstrapSeq.current) return;
          setLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, [applyStatus]);

      const loadDiff = useCallback(async (targetWorkspace, targetRepo, path, mode) => {
        if (!targetWorkspace || !path) return;
        setDiffLoading(true);
        setDiff(null);
        try {
          const next = await rpc('diff', {
            workspace: targetWorkspace,
            repo: targetRepo,
            path,
            staged: mode === 'staged',
          });
          setDiff(next);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDiffLoading(false);
        }
      }, []);

      const loadGraph = useCallback(async (targetWorkspace, targetRepo, targetFilters) => {
        if (!targetWorkspace || !targetRepo) return;
        const next = await rpc('graph', {
          workspace: targetWorkspace,
          repo: targetRepo,
          ...graphRequest(targetFilters),
        });
        setGraph(next.commits || []);
        setGraphHasMore(Boolean(next.hasMore));
        // The history is the second half of the first screen: keep its first
        // page warm so the next mount paints the middle pane too — but only the
        // unfiltered page, because that is the page a fresh mount shows.
        if (isDefaultFilters(targetFilters)) writePaintGraph(targetRepo, next);
      }, []);

      const loadMoreCommits = useCallback(async () => {
        if (!workspace || !repo || !graph) return;
        setGraphLoading(true);
        try {
          const next = await rpc('graph', {
            workspace,
            repo,
            skip: graph.length,
            limit: 200,
            ...graphRequest(filters),
          });
          setGraph((current) => {
            const seen = new Set((current || []).map((commit) => commit.sha));
            return [...(current || []), ...(next.commits || []).filter((commit) => !seen.has(commit.sha))];
          });
          setGraphHasMore(Boolean(next.hasMore));
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setGraphLoading(false);
        }
      }, [workspace, repo, graph, filters]);

      const act = useCallback(async (label, operation) => {
        if (busyRef.current) return null;
        busyRef.current = true;
        setBusy(label);
        setToast(null);
        try {
          const result = await operation();
          if (result && result.message) {
            setToast({ kind: 'success', text: result.message, detail: result.detail || null });
          }
          return result;
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          return null;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, []);

      /** Branch list is read lazily, only when the switcher opens. */
      const loadBranches = useCallback(async () => {
        if (!workspace || !repo) return { branches: [] };
        return rpc('branches', { workspace, repo });
      }, [workspace, repo]);

      const pickBranch = useCallback(async (pick) => {
        const branch = typeof pick === 'string' ? pick : pick.branch;
        const remoteBranch = pick && typeof pick === 'object' ? pick.remoteBranch : undefined;
        await act(t('checkingOut'), async () => {
          const result = await rpc('checkout', { workspace, repo, branch, remoteBranch });
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          const name = (result && result.branch) || branch;
          return {
            message: result && result.created
              ? tf('branchTrackingCreated', { branch: name })
              : tf('branchSwitched', { branch: name }),
          };
        });
      }, [workspace, repo, act, refreshStatus]);

      const createBranchFromHead = useCallback(async (name) => {
        busyRef.current = true;
        setBusy(t('creatingBranch'));
        setToast(null);
        try {
          const result = await rpc('create-branch', { workspace, repo, name });
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          setToast({ kind: 'success', text: tf('branchCreated', { branch: (result && result.branch) || name }) });
          return result;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, [workspace, repo, refreshStatus]);

      const fetchGraphDialog = useCallback(async (limit) => {
        return rpc('graph', { workspace, repo, limit, all: true });
      }, [workspace, repo]);

      const openWorktreeCreate = useCallback(async () => {
        try {
          const next = await loadBranches();
          const names = (next && Array.isArray(next.local) ? next.local : []).map((item) => item.name);
          if (status && status.branch && !names.includes(status.branch)) names.unshift(status.branch);
          if (names.length === 0) {
            setToast({ kind: 'error', text: t('worktreeNoBase') });
            return;
          }
          setWorktreeBranches(names);
          setDialog({ kind: 'worktree-create' });
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, [loadBranches, status]);

      const openWorktreeManager = useCallback(() => {
        setDialog({ kind: 'worktree-manage' });
      }, []);

      const createWorktreeSession = useCallback(async (name, baseRef) => {
        busyRef.current = true;
        setBusy(t('worktreeStarting'));
        setToast(null);
        try {
          const created = await addWorktreeSession(workspace, repo, name, baseRef);
          setToast({ kind: 'success', text: tf('worktreeCreated', { name: created.name }) });
          setGraphVersion((value) => value + 1);
          return created;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, [workspace, repo]);

      const fetchWorktrees = useCallback(() => rpc('worktrees', { workspace, repo }), [workspace, repo]);

      const removeWorktree = useCallback(async (path, options) => {
        const result = await removeWorktreeSession(workspace, repo, path, options);
        setToast({ kind: 'success', text: t('worktreeRemoved') });
        setGraphVersion((value) => value + 1);
        return result;
      }, [workspace, repo]);

      useEffect(() => {
        let alive = true;
        rpc('workspaces').then((list) => {
          if (!alive) return;
          writePaintWorkspaces(list);
          setWorkspaces(list);
          const saved = readStorage('dsh-git.workspace');
          const picked = list.find((item) => item.path === saved) || list[0];
          if (picked) setWorkspace(picked.path);
          else {
            setLoading(false);
            setToast({ kind: 'error', text: t('noWorkspace') });
          }
        }).catch((error) => {
          if (!alive) return;
          setLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        });
        return () => { alive = false; };
      }, []);

      useEffect(() => {
        const timer = setTimeout(() => {
          try { rootRef.current?.focus({ preventScroll: true }); } catch { /* focus is best effort */ }
        }, 60);
        return () => clearTimeout(timer);
      }, []);

      /**
       * Verify that the fetched stylesheet actually reached this panel, adopt it
       * on a shadow root when the panel lives in one, and report with inline
       * styles when it still does not apply (the only styling that survives a
       * refused stylesheet) — including the numbers that explain why.
       */
      useLayoutEffect(() => {
        const node = rootRef.current;
        if (!node) return;
        let cancelled = false;
        void ensureStyles().then(() => {
          if (cancelled) return;
          const root = typeof node.getRootNode === 'function' ? node.getRootNode() : document;
          if (root !== document && styleState.sheet) adoptSheet(root, styleState.sheet);
          if (stylesActive(node)) return;
          const detail = styleDiagnostics();
          setStyleState(detail);
          try {
            console.warn('[dsh-git] the panel stylesheet is not active', detail);
          } catch {
            // Logging must never replace the panel.
          }
        });
        return () => { cancelled = true; };
      }, []);

      useEffect(() => {
        if (!workspace) return;
        // Only a real workspace switch resets the panel. The workspace that was
        // painted from the seed on mount therefore keeps its page while the
        // effects below revalidate it in place — clearing here is what used to
        // flash an empty panel on every reopen — and an effect re-run (React's
        // dev double-invoke) is a no-op instead of a reset.
        if (lastWorkspaceRef.current !== null && samePath(lastWorkspaceRef.current, workspace)) return;
        lastWorkspaceRef.current = workspace;
        // Invalidate every read still in flight for the previous workspace.
        statusSeq.current += 1;
        bootstrapSeq.current += 1;
        setStatus(null);
        setLoading(true);
        setRepos([]);
        setRepo('');
        setSelected(null);
        setDiff(null);
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        setGraph(null);
        setGraphHasMore(false);
        setExpanded({});
        setAmend(false);
        setSignoff(false);
        setDialog(null);
        setGraphVersion((value) => value + 1);
      }, [workspace]);

      useEffect(() => {
        if (!workspace) return undefined;
        if (!repo) {
          // No repository chosen yet (first open, or the previous choice
          // disappeared): learn the repository list, then pick one.
          const seq = ++bootstrapSeq.current;
          setLoading(true);
          bootstrap(workspace, seq);
          return undefined;
        }
        writeStorage(`dsh-git.repo:${workspace}`, repo);
        setSelected(null);
        setDiff(null);
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        // A seeded history page belongs to one repository; clearing it while the
        // same repository is being re-read would flash an empty middle pane.
        const seed = seedRef.current;
        if (!seed || !samePath(seed.repo, repo)) {
          setGraph(null);
          setGraphHasMore(false);
        }
        setAmend(false);
        setSignoff(false);
        setDialog(null);
        setGraphVersion((value) => value + 1);
        // `bootstrap` may have painted this exact page from its own response a
        // moment ago; re-reading it would only cost another Git round trip.
        const fresh = freshRef.current;
        const reused = Boolean(fresh) && fresh.workspace === workspace
          && samePath(fresh.repo, repo) && Date.now() - fresh.at < 1500;
        freshRef.current = null;
        if (!reused) refreshStatus(workspace, repo, true);
        const timer = setInterval(() => {
          if (busyRef.current) return;
          if (document.visibilityState === 'hidden') return;
          refreshStatus(workspace, repo, false);
        }, 5000);
        return () => clearInterval(timer);
      }, [workspace, repo, bootstrap, refreshStatus]);

      useEffect(() => {
        if (!workspace) return;
        if (draftTimer.current) clearTimeout(draftTimer.current);
        const draftKey = `dsh-git.draft:${workspace}`;
        setMessage(readStorage(draftKey) || '');
      }, [workspace]);

      useEffect(() => {
        if (!workspace || !repo) return undefined;
        let alive = true;
        // A seeded history page is already on screen: re-read it silently rather
        // than replacing it with a loading placeholder.
        const seed = seedRef.current;
        const painted = Boolean(seed) && Boolean(seed.graph) && samePath(seed.repo, repo)
          && isDefaultFilters(filters);
        if (!painted) setGraphLoading(true);
        loadGraph(workspace, repo, filters).then(() => {
          if (alive) setGraphLoading(false);
        }).catch((error) => {
          if (!alive) return;
          setGraphLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        });
        return () => { alive = false; };
      }, [workspace, repo, graphVersion, filters, loadGraph]);

      useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(
          () => setToast(null),
          toast.kind === 'error' ? 9000 : (toast.detail ? 8000 : 5000),
        );
        return () => clearTimeout(timer);
      }, [toast]);

      useEffect(() => () => {
        if (prefixTimer.current) clearTimeout(prefixTimer.current);
        if (draftTimer.current) clearTimeout(draftTimer.current);
      }, []);

      const updateMessage = useCallback((value) => {
        setMessage(value);
        if (!workspace) return;
        if (draftTimer.current) clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => {
          writeStorage(`dsh-git.draft:${workspace}`, value);
        }, 300);
      }, [workspace]);

      const reloadAfterMutation = useCallback(async (includeGraph = true) => {
        await refreshStatus(workspace, repo, false);
        if (includeGraph) setGraphVersion((value) => value + 1);
        if (selected) await loadDiff(workspace, repo, selected.path, selected.mode);
      }, [workspace, repo, selected, refreshStatus, loadDiff]);

      const stage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('stage'), async () => {
          await rpc('stage', { workspace, repo, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('stageDone', { count: unique.length }) };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const unstage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('unstage'), async () => {
          await rpc('unstage', { workspace, repo, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('unstageDone', { count: unique.length }) };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const stageAll = useCallback(async () => {
        if (!status) return;
        const entries = status.entries.filter((entry) => !entry.staged || entry.partial);
        await stage(entries.map((entry) => entry.path));
      }, [status, stage]);

      const unstageAll = useCallback(async () => {
        if (!status) return;
        const entries = status.entries.filter((entry) => entry.staged || entry.partial);
        await unstage(entries.map((entry) => entry.path));
      }, [status, unstage]);

      const toggleFile = useCallback(async (entry, section) => {
        if (section === 'staged') await unstage([entry.path]);
        else await stage([entry.path]);
      }, [stage, unstage]);

      const toggleDir = useCallback(async (dirPath, files, section) => {
        if (section === 'staged') await unstage(files.map((file) => file.path));
        else await stage(files.map((file) => file.path));
      }, [stage, unstage]);

      const selectFile = useCallback((entry, section) => {
        const mode = section === 'staged' ? 'staged' : 'unstaged';
        setSelected({ path: entry.path, mode, entry });
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        loadDiff(workspace, repo, entry.path, mode);
      }, [workspace, repo, loadDiff]);

      const openFile = useCallback((entry, section) => {
        const mode = section === 'staged' ? 'staged' : entry.partial ? 'staged' : 'unstaged';
        setSelected({ path: entry.path, mode, entry });
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        loadDiff(workspace, repo, entry.path, mode);
      }, [workspace, repo, loadDiff]);

      const switchDiffMode = useCallback((mode) => {
        if (!selected) return;
        setSelected({ ...selected, mode });
        loadDiff(workspace, repo, selected.path, mode);
      }, [selected, workspace, repo, loadDiff]);
      const initRepository = useCallback(async () => {
        await act(t('initializing'), async () => {
          const next = await rpc('init', { workspace });
          if (Array.isArray(next.repos)) setRepos(next.repos);
          if (next.repoRoot) setRepo(next.repoRoot);
          else setStatus(next);
          setGraphVersion((value) => value + 1);
          return { message: t('init') };
        });
      }, [workspace, act]);

      const commit = useCallback(async () => {
        if (!status || !status.isRepo) return;
        if (!message.trim()) {
          setToast({ kind: 'error', text: t('emptyMessage') });
          return;
        }
        if (status.counts.conflicts > 0) {
          setToast({ kind: 'error', text: t('conflictWarning') });
          return;
        }
        await act(t('committing'), async () => {
          const result = await rpc('commit', {
            workspace,
            repo,
            message,
            amend,
            signoff,
          });
          if (draftTimer.current) clearTimeout(draftTimer.current);
          setMessage('');
          writeStorage(`dsh-git.draft:${workspace}`, null);
          setAmend(false);
          setSignoff(false);
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          return { message: `${t('committed')} ${result.sha || ''}`.trim() };
        });
      }, [status, message, amend, signoff, workspace, repo, act, refreshStatus]);

      const fetchRemote = useCallback(async () => {
        await act(t('fetch'), async () => {
          const result = await rpc('fetch', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: fetchSummary(result),
            detail: fetchDetail(result),
          };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const pullRemote = useCallback(async () => {
        await act(t('pull'), async () => {
          const result = await rpc('pull', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: pullSummary(result),
            detail: result && result.output ? result.output : null,
          };
        });
      }, [workspace, act, reloadAfterMutation]);

      const pushRemote = useCallback(async () => {
        await act(t('push'), async () => {
          const result = await rpc('push', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: pushSummary(result),
            detail: result && result.output ? result.output : null,
          };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const openCommit = useCallback(async (sha) => {
        setDetailLoading(true);
        setCommitDetail(null);
        setSelected(null);
        setDiff(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        try {
          const detail = await rpc('commit-detail', { workspace, repo, sha });
          setCommitDetail(detail);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDetailLoading(false);
        }
      }, [workspace, repo]);

      const closeCommitDetail = useCallback(() => {
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
      }, []);

      /** Show one file of the open commit; `null` returns to the full patch. */
      const selectCommitFile = useCallback(async (path) => {
        const sha = commitDetail && commitDetail.sha;
        if (!sha) return;
        setDetailFile(path || null);
        if (!path) {
          setDetailFileDiff(null);
          return;
        }
        setDetailFileLoading(true);
        try {
          const next = await rpc('commit-detail', { workspace, repo, sha, path });
          setDetailFileDiff(next);
        } catch (error) {
          setDetailFile(null);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDetailFileLoading(false);
        }
      }, [commitDetail, workspace, repo]);

      const copyText = useCallback(async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          setToast({ kind: 'success', text: t('copied') });
        } catch {
          setToast({ kind: 'error', text: t('copy') });
        }
      }, []);

      /** Drag a splitter to resize the left/center or center/right panes. */
      const startResize = useCallback((side, event) => {
        if (event.button !== undefined && event.button !== 0) return;
        const root = rootRef.current;
        if (!root) return;
        event.preventDefault();
        const startX = event.clientX;
        const startLeft = leftWidth;
        const startRight = rightWidth;
        const total = root.clientWidth;
        const minCenter = 300;
        const minSide = side === 'left' ? 220 : 280;
        setResizing(true);
        try { document.body.classList.add('dshg-resizing'); } catch { /* ignore */ }

        const onMove = (moveEvent) => {
          if (side === 'left') {
            const max = Math.max(minSide, total - startRight - minCenter);
            setLeftWidth(clampPaneWidth(startLeft + (moveEvent.clientX - startX), minSide, max));
          } else {
            const max = Math.max(minSide, total - startLeft - minCenter);
            setRightWidth(clampPaneWidth(startRight - (moveEvent.clientX - startX), minSide, max));
          }
        };
        const finish = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', finish);
          try { document.body.classList.remove('dshg-resizing'); } catch { /* ignore */ }
          setResizing(false);
          setLeftWidth((value) => { writeStorage('dsh-git.pane.left', String(value)); return value; });
          setRightWidth((value) => { writeStorage('dsh-git.pane.right', String(value)); return value; });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
      }, [leftWidth, rightWidth]);

      const nudgePane = useCallback((side, delta) => {
        if (side === 'left') {
          setLeftWidth((value) => {
            const next = clampPaneWidth(value + delta, 220, 620);
            writeStorage('dsh-git.pane.left', String(next));
            return next;
          });
        } else {
          setRightWidth((value) => {
            const next = clampPaneWidth(value + delta, 280, 820);
            writeStorage('dsh-git.pane.right', String(next));
            return next;
          });
        }
      }, []);

      const resetPane = useCallback((side) => {
        if (side === 'left') {
          setLeftWidth(300);
          writeStorage('dsh-git.pane.left', '300');
        } else {
          setRightWidth(400);
          writeStorage('dsh-git.pane.right', '400');
        }
      }, []);

      const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
          setSelected(null);
          setCommitDetail(null);
          setPrefix(false);
          if (prefixTimer.current) clearTimeout(prefixTimer.current);
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          commit();
          return;
        }

        const target = event.target;
        const typing = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        );
        if (typing) return;

        if (event.altKey && event.key.toLowerCase() === 's') {
          event.preventDefault();
          if (event.shiftKey) unstageAll();
          else stageAll();
          return;
        }

        if (event.altKey && event.key.toLowerCase() === 'g') {
          event.preventDefault();
          setPrefix(true);
          if (prefixTimer.current) clearTimeout(prefixTimer.current);
          prefixTimer.current = setTimeout(() => setPrefix(false), 1800);
          return;
        }

        if (prefix) {
          const key = event.key.toLowerCase();
          setPrefix(false);
          if (prefixTimer.current) clearTimeout(prefixTimer.current);
          if (key === 'f') { event.preventDefault(); fetchRemote(); }
          else if (key === 'p') { event.preventDefault(); pushRemote(); }
          else if (key === 'l') { event.preventDefault(); pullRemote(); }
        }
      }, [commit, stageAll, unstageAll, prefix, fetchRemote, pushRemote, pullRemote]);

      const hasRepo = Boolean(status && status.isRepo && !status.isBare);
      const isBare = Boolean(status && status.isRepo && status.isBare);

      return h('div', {
        ref: rootRef,
        className: cx('dshg-root', resizing && 'dshg-resizing'),
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        'aria-label': t('panel'),
        'aria-busy': busy ? 'true' : 'false',
      },
      // Inline styles on purpose: if this banner is visible, a stylesheet was
      // refused, so a class-based banner would be invisible too. A 405 means the
      // running Host predates the stylesheet route, which no page reload can
      // fix — the panel says so instead of only printing numbers.
      styleState ? h('div', {
        role: 'status',
        className: 'dshg-style-alert',
        style: {
          padding: '6px 10px',
          background: '#fff4e5',
          color: '#7a3e00',
          borderBottom: '1px solid #f0c48a',
          fontSize: '11px',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, monospace',
        },
      },
      /405/.test(String(styleState.error || '')) ? `${t('styleRestartRequired')}` : t('styleAlert'),
      ` · ${styleState.status} css=${styleState.css} rules=${styleState.sheet} adopted=${styleState.adopted}${
        styleState.error ? ` err=${styleState.error}` : ''}`) : null,
      h(PanelHeader, {
        workspaces,
        workspace,
        repos,
        repo,
        showAllRepos,
        status,
        busy,
        onWorkspace: (next) => {
          setWorkspace(next);
          writeStorage('dsh-git.workspace', next);
        },
        onRepo: (next) => {
          // A manual pick outranks a repository bootstrap still in flight.
          bootstrapSeq.current += 1;
          setRepo(next);
          writeStorage(`dsh-git.repo:${workspace}`, next);
        },
        onToggleRepos: () => {
          setShowAllRepos((current) => {
            const next = !current;
            writeStorage('dsh-git.repoScope', next ? 'all' : 'top');
            return next;
          });
        },
        onRefresh: () => refreshStatus(workspace, repo, true),
        onFetch: fetchRemote,
        onPull: pullRemote,
        onPush: pushRemote,
        loadBranches,
        onPickBranch: pickBranch,
        onCreateBranch: () => setDialog({ kind: 'create-branch' }),
        onOpenGraph: () => setDialog({ kind: 'graph' }),
        onOpenWorktree: openWorktreeCreate,
        onManageWorktrees: openWorktreeManager,
      }),
      h(Toast, { toast, onClose: () => setToast(null) }),
      dialog && dialog.kind === 'create-branch' ? h(CreateBranchDialog, {
        onCreate: createBranchFromHead,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'graph' ? h(GitGraphDialog, {
        fetchGraph: fetchGraphDialog,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'worktree-create' ? h(CreateWorktreeDialog, {
        branches: worktreeBranches,
        currentBranch: status && status.branch ? status.branch : '',
        onCreate: createWorktreeSession,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'worktree-manage' ? h(WorktreeManagerDialog, {
        fetchWorktrees,
        onRemove: removeWorktree,
        onClose: () => setDialog(null),
      }) : null,
      busy ? h('div', { className: 'dshg-progress', 'aria-hidden': true }) : null,
      !workspace && !loading ? h(EmptyState, {
        icon: h(GitGlyph, { size: 30 }),
        title: t('noWorkspace'),
      }) : null,
      loading && !status ? h(GitSkeleton) : null,
      status && !status.isRepo ? h(EmptyState, {
        icon: h(GitGlyph, { size: 34 }),
        title: t('notRepo'),
        description: t('notRepoDesc'),
        action: h('button', {
          type: 'button',
          className: 'dshg-btn dshg-btn-brand',
          disabled: Boolean(busy),
          onClick: initRepository,
        }, t('init')),
      }) : null,
      isBare ? h(EmptyState, {
        icon: h(GitGlyph, { size: 34 }),
        title: t('bareRepo'),
        description: t('bareRepoDesc'),
      }) : null,
      hasRepo ? h(React.Fragment, null,
        h('div', { className: 'dshg-body' },
        h('div', { className: 'dshg-left', style: { width: `${leftWidth}px` } },
          h('div', { className: 'dshg-pane-head' },
            h('span', { className: 'dshg-pane-title' }, t('changes')),
            h('span', { className: 'dshg-count' }, status.counts.changed),
            h('span', { className: 'dshg-spacer' }),
            h('button', {
              type: 'button',
              className: 'dshg-iconbtn',
              title: t('stageAll'),
              'aria-label': t('stageAll'),
              disabled: Boolean(busy) || status.counts.changed === 0,
              onClick: stageAll,
            }, h(IconCheck, { size: 14 })),
            h('button', {
              type: 'button',
              className: 'dshg-iconbtn',
              title: t('unstageAll'),
              'aria-label': t('unstageAll'),
              disabled: Boolean(busy) || status.counts.staged === 0,
              onClick: unstageAll,
            }, h(IconMinus, { size: 14 }))),
          h('div', { className: 'dshg-scroll' },
            h(ChangesList, {
              status,
              loading,
              expanded,
              onToggleExpand: (key) => setExpanded((current) => ({ ...current, [key]: current[key] === false })),
              onSelect: selectFile,
              onOpen: openFile,
              onToggleFile: toggleFile,
              onToggleDir: toggleDir,
            })),
          h(CommitBar, {
            status,
            message,
            setMessage: updateMessage,
            amend,
            setAmend,
            signoff,
            setSignoff,
            busy,
            onCommit: commit,
          })),
        h(PaneResizer, {
          side: 'left',
          onStart: startResize,
          onNudge: nudgePane,
          onReset: resetPane,
        }),
        h('div', { className: 'dshg-center' },
          h(HistoryView, {
            graph,
            graphLoading,
            graphHasMore,
            onLoadMore: loadMoreCommits,
            selectedSha: commitDetail && commitDetail.sha,
            onSelectCommit: openCommit,
            filters,
            onFilters: changeFilters,
          })),
        h(PaneResizer, {
          side: 'right',
          onStart: startResize,
          onNudge: nudgePane,
          onReset: resetPane,
        }),
        h('div', { className: 'dshg-right', style: { width: `${rightWidth}px` } },
          detailLoading && !commitDetail
            ? h('div', { className: 'dshg-empty' }, t('loading'))
            : commitDetail
              ? h(CommitDetailView, {
                  commitDetail,
                  detailFile,
                  detailFileDiff,
                  detailFileLoading,
                  onBack: closeCommitDetail,
                  onSelectFile: selectCommitFile,
                  onCopy: copyText,
                })
              : h(DiffView, {
                  selected,
                  diff,
                  diffLoading,
                  onMode: switchDiffMode,
                  onClose: () => { setSelected(null); setDiff(null); },
                  status,
                  repos,
                  repo,
                  graph,
                  onShowHistory: () => { if (graph && graph[0]) openCommit(graph[0].sha); },
                })))) : null);
    }

    class GitPanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error, info) {
        try {
          console.error('[dsh-git] panel crashed', error, info);
        } catch {
          // Logging must never replace the fallback UI.
        }
      }

      render() {
        if (this.state.error) {
          return h('div', { className: 'dshg-root' },
            h('div', { className: 'dshg-empty' },
              h('div', { className: 'dshg-empty-icon' }, h(GitGlyph, { size: 30 })),
              h('div', { className: 'dshg-empty-title' }, t('error')),
              h('div', { className: 'dshg-empty-desc' }, String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error))));
        }
        return this.props.children;
      }
    }

    function GitPanelRoot() {
      return h(GitPanelBoundary, null, h(GitPanel));
    }
    /* ------------------------------------------------------------------ *
     * Stylesheet loading
     *
     * The rules live in `styles.css` and are served by this plugin's own
     * route (`/dsh-git-6b1e/styles.css`), not inlined into the client bundle.
     * A 60 KB template literal inside the bundle is fragile — one transform that
     * rewrites or drops the literal leaves a fully working panel with no styles
     * at all — while a fetched sheet is just text that cannot be mangled.
     *
     * The fetched text is adopted as a constructable stylesheet, so there is no
     * <style> element to refuse or to remove. When constructable stylesheets are
     * unavailable, a <link rel="stylesheet"> for the same URL is the fallback;
     * a link is not a <style data-plugin>, so the host's HMR bookkeeping never
     * claims or removes it.
     * ------------------------------------------------------------------ */
