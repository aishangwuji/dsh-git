    function DialogShell({ title, subtitle, onClose, children, footer, className }) {
      useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onClose();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [onClose]);

      return h(React.Fragment, null,
        h('div', { className: 'dshg-modal-backdrop', onClick: onClose, 'aria-hidden': true }),
        h('div', {
          className: cx('dshg-dialog', className),
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title,
        },
        h('div', { className: 'dshg-dialog-head' },
          h('div', { className: 'dshg-dialog-heading' },
            h('div', { className: 'dshg-dialog-title' }, title),
            subtitle ? h('div', { className: 'dshg-dialog-subtitle' }, subtitle) : null),
          h('button', {
            type: 'button',
            className: 'dshg-dialog-close',
            onClick: onClose,
            'aria-label': t('close'),
            title: t('close'),
          }, h(IconClose, { size: 15 }))),
        h('div', { className: 'dshg-dialog-body' }, children),
        footer ? h('div', { className: 'dshg-dialog-footer' }, footer) : null));
    }

    function CreateBranchDialog({ onCreate, onClose }) {
      const [name, setName] = useState('');
      const [pending, setPending] = useState(false);
      const [error, setError] = useState(null);

      const submit = useCallback(async () => {
        if (pending) return;
        const trimmed = name.trim();
        if (validateBranchName(trimmed) !== null) {
          setError(t('invalidBranchName'));
          return;
        }
        setPending(true);
        setError(null);
        try {
          await onCreate(trimmed);
          onClose();
        } catch (failure) {
          setError(errorText(failure));
        } finally {
          setPending(false);
        }
      }, [name, pending, onCreate, onClose]);

      return h(DialogShell, {
        title: t('branchCreateTitle'),
        onClose,
        footer: h(React.Fragment, null,
          h('button', { type: 'button', className: 'dshg-dialog-button', onClick: onClose }, t('cancel')),
          h('button', {
            type: 'button',
            className: 'dshg-dialog-button dshg-dialog-button-primary',
            disabled: pending || name.trim() === '',
            onClick: submit,
          }, pending ? t('creatingBranch') : t('createAndCheckout'))),
      },
      h('p', { className: 'dshg-dialog-description' }, t('branchCreateDesc')),
      h('label', { className: 'dshg-dialog-field' },
        h('span', { className: 'dshg-dialog-label' }, t('branchNameLabel')),
        h('input', {
          className: 'dshg-dialog-input',
          value: name,
          placeholder: t('branchNamePlaceholder'),
          onChange: (event) => { setName(event.target.value); setError(null); },
          onKeyDown: (event) => { if (event.key === 'Enter') void submit(); },
          autoFocus: true,
          spellCheck: false,
        })),
      error ? h('div', { className: 'dshg-dialog-error' }, error) : null);
    }

    function GitGraphDialog({ fetchGraph, onClose }) {
      const [view, setView] = useState(null);
      const [loading, setLoading] = useState(true);
      const [loadingMore, setLoadingMore] = useState(false);
      const [error, setError] = useState(null);
      const requestSeq = useRef(0);

      useEffect(() => {
        let alive = true;
        const seq = ++requestSeq.current;
        setLoading(true);
        setError(null);
        fetchGraph(200).then((next) => {
          if (!alive || seq !== requestSeq.current) return;
          setView(next || { commits: [], hasMore: false });
          setLoading(false);
        }).catch((failure) => {
          if (!alive || seq !== requestSeq.current) return;
          setError(errorText(failure));
          setLoading(false);
        });
        return () => { alive = false; };
      }, [fetchGraph]);

      const loadMore = useCallback(async () => {
        if (!view || loadingMore) return;
        const seq = ++requestSeq.current;
        setLoadingMore(true);
        try {
          const next = await fetchGraph(view.commits.length + 100);
          if (seq !== requestSeq.current) return;
          setView((current) => {
            const seen = new Set((current?.commits || []).map((commit) => commit.sha));
            return {
              commits: [...(current?.commits || []), ...((next?.commits) || []).filter((commit) => !seen.has(commit.sha))],
              hasMore: Boolean(next?.hasMore),
            };
          });
        } catch (failure) {
          if (seq === requestSeq.current) setError(errorText(failure));
        } finally {
          if (seq === requestSeq.current) setLoadingMore(false);
        }
      }, [view, loadingMore, fetchGraph]);

      const commits = view?.commits || [];
      const lanes = useMemo(() => computeLanes(commits), [commits]);
      const laneCount = useMemo(() => lanes.reduce((max, row) => Math.max(max, row.columns.length), 0), [lanes]);

      return h(DialogShell, {
        title: t('gitGraphTitle'),
        subtitle: tf('gitGraphSubtitle', { count: commits.length, lanes: laneCount }),
        onClose,
        className: 'dshg-dialog-graph',
      },
      loading && commits.length === 0
        ? h('div', { className: 'dshg-dialog-empty' }, t('gitGraphLoading'))
        : error
          ? h('div', { className: 'dshg-dialog-empty dshg-dialog-empty-error' }, error)
          : commits.length === 0
            ? h('div', { className: 'dshg-dialog-empty' }, t('graphEmpty'))
            : h('div', { className: 'dshg-graph-body' },
              commits.map((commit, index) => {
                const lane = lanes[index] || { columns: [] };
                return h('div', { className: 'dshg-graph-row', key: commit.sha },
                  h('span', { className: 'dshg-graph-lanes', 'aria-hidden': true },
                    lane.columns.map((glyph, column) => h('span', {
                      key: column,
                      className: cx('dshg-graph-lane', `dshg-graph-lane-${glyph}`),
                    }, laneChar(glyph)))),
                  h('span', { className: 'dshg-graph-sha', title: commit.sha }, String(commit.sha).slice(0, 7)),
                  h('span', { className: 'dshg-graph-main' },
                    h('span', { className: 'dshg-graph-subject', title: commit.subject }, commit.subject),
                    h('span', { className: 'dshg-graph-meta' },
                      (commit.refs || []).slice(0, 3).map((ref, refIndex) => {
                        const info = refInfo(ref);
                        return info && info.name
                          ? h('span', {
                              key: `${commit.sha}-ref-${refIndex}`,
                              className: cx('dshg-graph-ref', info.kind),
                              title: info.name,
                            }, info.name)
                          : null;
                      }),
                      h('span', null, commit.author || ''),
                      h('span', { className: 'dshg-graph-sep' }, '·'),
                      h('span', null, formatRelative(commit.timestamp)))));
              }),
              view?.hasMore ? h('button', {
                type: 'button',
                className: 'dshg-graph-more',
                disabled: loadingMore,
                onClick: loadMore,
              }, loadingMore ? t('loading') : t('gitGraphLoadMore')) : null));
    }

    /** Searchable local-branch menu used by the worktree base picker. */
    function BranchFieldMenu({ branches, value, onPick }) {
      const [query, setQuery] = useState('');
      const needle = query.trim().toLowerCase();
      const visible = branches.filter((branch) => !needle || branch.toLowerCase().includes(needle));
      return h(React.Fragment, null,
        h('input', {
          className: 'dshg-menu-search',
          value: query,
          placeholder: t('filterBranches'),
          onChange: (event) => setQuery(event.target.value),
          autoFocus: true,
          spellCheck: false,
          'aria-label': t('filterBranches'),
        }),
        h('div', { className: 'dshg-menu-list dshg-menu-field-list', role: 'group' },
          visible.length === 0
            ? h('div', { className: 'dshg-menu-empty' }, t('branchesLocalEmpty'))
            : visible.map((branch) => h(MenuItem, {
                key: branch,
                active: branch === value,
                onClick: () => onPick(branch),
              }, branch))));
    }

    function CreateWorktreeDialog({ branches, currentBranch, onCreate, onClose }) {
      const [name, setName] = useState('');
      const [baseRef, setBaseRef] = useState(currentBranch || (branches[0] || ''));
      const [pending, setPending] = useState(false);
      const [error, setError] = useState(null);

      const submit = useCallback(async () => {
        if (pending) return;
        const sanitized = sanitizeWorktreeName(name);
        if (!sanitized) {
          setError(t('err_WORKTREE_NAME_INVALID'));
          return;
        }
        setPending(true);
        setError(null);
        try {
          await onCreate(sanitized, baseRef || undefined);
          onClose();
        } catch (failure) {
          setError(errorText(failure));
        } finally {
          setPending(false);
        }
      }, [pending, name, baseRef, onCreate, onClose]);

      const options = branches.includes(currentBranch) || !currentBranch
        ? branches
        : [currentBranch, ...branches];

      return h(DialogShell, {
        title: t('worktreeCreateTitle'),
        onClose,
        className: 'dshg-dialog-worktree',
        footer: h(React.Fragment, null,
          h('button', { type: 'button', className: 'dshg-dialog-button', onClick: onClose }, t('cancel')),
          h('button', {
            type: 'button',
            className: 'dshg-dialog-button dshg-dialog-button-primary',
            disabled: pending || name.trim() === '' || !baseRef,
            onClick: submit,
          }, pending ? t('worktreeStarting') : t('worktreeStart'))),
      },
      h('p', { className: 'dshg-dialog-description' }, t('worktreeCreateDesc')),
      h('label', { className: 'dshg-dialog-field' },
        h('span', { className: 'dshg-dialog-label' }, t('worktreeNameLabel')),
        h('input', {
          className: 'dshg-dialog-input',
          value: name,
          placeholder: t('worktreeNamePlaceholder'),
          onChange: (event) => { setName(event.target.value); setError(null); },
          onKeyDown: (event) => { if (event.key === 'Enter') void submit(); },
          autoFocus: true,
          spellCheck: false,
        })),
      h('div', { className: 'dshg-dialog-field' },
        h('span', { className: 'dshg-dialog-label' }, t('worktreeBaseLabel')),
        h('div', { className: 'dshg-branch-field' },
          h(PillSelect, {
            ariaLabel: t('worktreeBaseLabel'),
            title: baseRef,
            disabled: pending,
            triggerClassName: 'dshg-pillselect-field',
            menuClassName: 'dshg-menu-field',
            trigger: h(React.Fragment, null,
              h(IconBranch, { size: 13 }),
              h('span', { className: 'dshg-field-value' }, baseRef || '—')),
          }, (close) => h(BranchFieldMenu, {
            branches: options,
            value: baseRef,
            onPick: (branch) => { close(); setBaseRef(branch); },
          })))),
      error ? h('div', { className: 'dshg-dialog-error' }, error) : null);
    }

    function WorktreeManagerDialog({ fetchWorktrees, onRemove, onClose }) {
      const [view, setView] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [pending, setPending] = useState(null);
      const [forcePath, setForcePath] = useState(null);
      const [deleteBranches, setDeleteBranches] = useState({});

      const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
          const next = await fetchWorktrees();
          setView(next || { worktrees: [] });
        } catch (failure) {
          setError(errorText(failure));
          setView({ worktrees: [] });
        } finally {
          setLoading(false);
        }
      }, [fetchWorktrees]);

      useEffect(() => { void load(); }, [load]);

      const remove = useCallback(async (item, force) => {
        if (pending) return;
        setPending(item.path);
        setError(null);
        try {
          await onRemove(item.path, { force, deleteBranch: Boolean(deleteBranches[item.path]) });
          setForcePath(null);
          await load();
        } catch (failure) {
          if (failure && failure.code === 'WORKTREE_DIRTY' && !force) {
            setForcePath(item.path);
          } else {
            setError(errorText(failure));
          }
        } finally {
          setPending(null);
        }
      }, [pending, onRemove, deleteBranches, load]);

      const rows = view?.worktrees || [];
      const managed = rows.filter((item) => !item.main);

      return h(DialogShell, {
        title: t('worktreeManagerTitle'),
        onClose,
        footer: h('button', { type: 'button', className: 'dshg-dialog-button', onClick: onClose }, t('close')),
      },
      h('div', { className: 'dshg-worktree-list' },
        loading ? h('div', { className: 'dshg-dialog-empty' }, t('loading')) : null,
        !loading && managed.length === 0 ? h('div', { className: 'dshg-worktree-empty' }, t('worktreeEmpty')) : null,
        !loading ? rows.map((item) => h('div', {
          key: item.path,
          className: cx('dshg-worktree-row', item.main && 'dshg-worktree-row-main'),
        },
        h('div', { className: 'dshg-worktree-info' },
          h('div', { className: 'dshg-worktree-headline' },
            h(IconBranch, { size: 13 }),
            h('span', { className: 'dshg-worktree-branch' },
              item.branch || t('worktreeDetached')),
            item.main ? h('span', { className: 'dshg-worktree-badge' }, t('worktreeMain')) : null,
            !item.main && !item.managed ? h('span', { className: 'dshg-worktree-badge' }, t('worktreeUnmanaged')) : null,
            h('span', { className: 'dshg-worktree-oid' }, String(item.head || '').slice(0, 7))),
          h('div', { className: 'dshg-worktree-path', title: item.path }, item.path),
          forcePath === item.path ? h('div', { className: 'dshg-worktree-confirm' },
            h('span', null, t('worktreeForceConfirm')),
            h('button', {
              type: 'button',
              className: 'dshg-dialog-button',
              disabled: Boolean(pending),
              onClick: () => remove(item, true),
            }, t('worktreeForceYes'))) : null),
        item.main ? null : h('div', { className: 'dshg-worktree-actions' },
          item.managed && item.branch.startsWith('wt/') ? h('label', { className: 'dshg-worktree-check' },
            h('input', {
              type: 'checkbox',
              checked: Boolean(deleteBranches[item.path]),
              onChange: () => setDeleteBranches((current) => ({
                ...current,
                [item.path]: !current[item.path],
              })),
            }),
            t('worktreeDeleteBranch')) : null,
          h('button', {
            type: 'button',
            className: 'dshg-dialog-button',
            disabled: Boolean(pending) || !item.managed,
            onClick: () => remove(item, false),
          }, t('worktreeRemove'))))) : null),
      error ? h('div', { className: 'dshg-dialog-error' }, error) : null);
    }

    /**
     * Portal host for the blank-session hero row. The dock slot is rendered as
     * its own row below `heroWorkspaceRow`; the reference UI places the branch
     * pill inline after the agent-preset chip, before the hero options group.
     * A mutation observer keeps the portal host in that row across shell
     * re-renders without participating in the row's React children.
     */
