    function branchFolders(items) {
      const root = { dirs: new Map(), leaves: [] };
      for (const item of items) {
        const parts = String(item.name).split('/');
        let node = root;
        for (let index = 0; index < parts.length - 1; index += 1) {
          const part = parts[index];
          const path = parts.slice(0, index + 1).join('/');
          if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path, dirs: new Map(), leaves: [] });
          node = node.dirs.get(part);
        }
        node.leaves.push(item);
      }
      return root;
    }

    /**
     * Branch tree: HEAD / local / remote / tags, the way a Git tool window
     * groups them. Local branches fold by `/` into folders (`fix/xxx` reads as a
     * folder, not a wall of names), each row carries its upstream drift, and a
     * branch already checked out in another worktree is marked busy instead of
     * failing at `git checkout` later.
     */
    function BranchSwitcher({
      status, busy, load, onPick,
      onCreate, onGraph, onCreateWorktree, onManageWorktrees, hero,
    }) {
      const [query, setQuery] = useState('');
      const [branches, setBranches] = useState({ local: [], remote: [], tags: [] });
      const [folded, setFolded] = useState(() => new Set());
      const [loading, setLoading] = useState(false);
      const [failed, setFailed] = useState(null);

      const refresh = useCallback(async () => {
        setLoading(true);
        setFailed(null);
        try {
          const next = await load();
          setBranches({
            local: Array.isArray(next.local) ? next.local : [],
            remote: Array.isArray(next.remote) ? next.remote : [],
            tags: Array.isArray(next.tags) ? next.tags : [],
          });
        } catch (error) {
          setBranches({ local: [], remote: [], tags: [] });
          setFailed(error && error.code ? error.code : 'UNKNOWN');
        } finally {
          setLoading(false);
        }
      }, [load]);

      const label = status.detached ? t('detached') : status.branch || '—';
      const needle = query.trim().toLowerCase();
      const filtering = needle.length > 0;
      const match = (item) => !filtering || String(item.name).toLowerCase().includes(needle);
      const head = (branches.local || []).find((item) => item.current) || null;
      const local = (branches.local || []).filter((item) => !item.current && match(item));
      const remote = (branches.remote || []).filter(match);
      const tags = (branches.tags || []).filter(match);
      const headVisible = head !== null && match(head);
      const nothing = !loading && !failed && !headVisible && local.length === 0 && remote.length === 0 && tags.length === 0;

      const toggleFolder = (path) => setFolded((current) => {
        const next = new Set(current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });

      const groupHead = (title, count) => h('div', { className: 'dshg-menu-group', role: 'presentation' },
        h('span', null, title),
        typeof count === 'number' ? h('span', { className: 'dshg-menu-group-count' }, count) : null);

      const branchRow = (item, options) => h('button', {
        key: `${options.group}:${item.name}`,
        type: 'button',
        role: 'option',
        className: cx('dshg-branch-row', options.active && 'active'),
        style: { paddingLeft: `${8 + (options.depth || 0) * 14}px` },
        title: item.worktree ? tf('branchInWorktree', { path: item.worktree }) : item.name,
        'aria-selected': options.active ? 'true' : 'false',
        onClick: options.onClick,
      },
      h('span', { className: cx('dshg-branch-dot', options.active && 'on') }),
      h('span', { className: 'dshg-branch-name' }, options.leaf || item.name),
      item.gone ? h('span', { className: 'dshg-branch-gone', title: t('branchUpstreamGone') }, '×') : null,
      item.worktree ? h('span', { className: 'dshg-branch-worktree', 'aria-hidden': 'true' }, 'W') : null,
      item.ahead > 0 ? h('span', { className: 'dshg-ahead' }, `↑${item.ahead}`) : null,
      item.behind > 0 ? h('span', { className: 'dshg-behind' }, `↓${item.behind}`) : null);

      const localRows = (node, depth, rows, close) => {
        for (const dir of [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name))) {
          // A filter always shows its hits: folding is a browsing aid, not a
          // reason to hide a match.
          const open = !folded.has(dir.path) || filtering;
          rows.push(h('button', {
            key: `dir:${dir.path}`,
            type: 'button',
            className: 'dshg-branch-folder',
            style: { paddingLeft: `${8 + depth * 14}px` },
            onClick: () => toggleFolder(dir.path),
            'aria-expanded': open ? 'true' : 'false',
            title: dir.path,
          }, h('span', { className: 'dshg-branch-folder-mark', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
             h('span', null, dir.name)));
          if (open) localRows(dir, depth + 1, rows, close);
        }
        for (const item of node.leaves) {
          const leaf = item.name.split('/').pop();
          rows.push(branchRow(item, {
            group: 'local',
            depth,
            leaf,
            onClick: () => {
              if (item.worktree) return;
              close();
              void onPick({ branch: item.name });
            },
          }));
        }
        return rows;
      };

      return h(PillSelect, {
        ariaLabel: t('selectBranch'),
        title: status.repoRoot || '',
        disabled: Boolean(busy) || Boolean(status.isBare),
        menuClassName: cx('dshg-menu-branch', hero && 'dshg-menu-branch-hero'),
        triggerClassName: hero ? 'dshg-pillselect-hero' : null,
        trigger: h(React.Fragment, null,
          h(IconBranch, { size: 13 }),
          h('strong', { className: 'dshg-pill-strong', 'data-dshg-tip': label }, label),
          // Status counters: uncommitted files, pull-behind, push-ahead. In the
          // composer the pill is the only place that can say "this checkout
          // moved" while the user is chatting, so the counters show there too.
          pillCounters(status).map((counter) => h('span', {
            key: counter.kind,
            className: PILL_COUNTER_CLASS[counter.kind],
            title: counter.kind === 'changed'
              ? tf('filesChanged', { count: status.counts.changed })
              : (counter.kind === 'ahead' ? t('push') : t('pull')),
          }, counter.text))),
        onOpenChange: (open) => {
          if (!open) return;
          setQuery('');
          void refresh();
        },
      }, (close) => h(React.Fragment, null,
        h('input', {
          className: 'dshg-menu-search',
          value: query,
          placeholder: t('filterBranches'),
          onChange: (event) => setQuery(event.target.value),
          autoFocus: true,
          spellCheck: false,
          'aria-label': t('filterBranches'),
        }),
        h('div', { className: 'dshg-menu-list', role: 'group' },
          loading ? h('div', { className: 'dshg-menu-empty' }, t('loading')) : null,
          !loading && failed ? h('div', { className: 'dshg-menu-error' },
            failed === 'UNKNOWN_OP'
              ? t('branchesStaleHost')
              : tf('branchesFailedWithCode', { code: failed })) : null,
          !loading && !failed && nothing ? h('div', { className: 'dshg-menu-empty' }, t('branchesEmpty')) : null,
          !loading && !failed && (headVisible || local.length > 0) ? h(React.Fragment, null,
            h(React.Fragment, null,
              headVisible ? h(React.Fragment, null,
                groupHead(t('branchGroupHead')),
                branchRow(head, { group: 'head', active: true, onClick: () => close() })) : null),
            local.length > 0 ? h(React.Fragment, null,
              groupHead(t('branchesLocal'), local.length),
              localRows(branchFolders(local), 0, [], close)) : null) : null,
          !loading && !failed && remote.length > 0 ? h(React.Fragment, null,
            groupHead(t('branchesRemote'), remote.length),
            remote.map((item) => branchRow(item, {
              group: 'remote',
              hint: item.name === status.upstream ? t('branchUpstream') : null,
              onClick: () => {
                close();
                void onPick({ branch: item.branch, remoteBranch: item.name });
              },
            }))) : null,
          !loading && !failed && tags.length > 0 ? h(React.Fragment, null,
            groupHead(t('branchGroupTags'), tags.length),
            tags.map((item) => h('div', {
              key: `tag:${item.name}`,
              className: 'dshg-branch-row dshg-branch-tag',
              title: t('branchTagReadonly'),
            },
            h('span', { className: 'dshg-branch-dot' }),
            h('span', { className: 'dshg-branch-name' }, item.name),
            item.sha ? h('span', { className: 'dshg-branch-sha' }, item.sha) : null))) : null),
        h('div', { className: 'dshg-menu-actions' },
          h('button', {
            type: 'button',
            className: 'dshg-menu-action-row',
            onClick: () => { close(); onCreate(); },
          }, h(IconBranch, { size: 14 }), h('span', null, t('branchCreateAction'))),
          h('button', {
            type: 'button',
            className: 'dshg-menu-action-row',
            onClick: () => { close(); onGraph(); },
          }, h(IconBranch, { size: 14 }), h('span', null, t('branchGraphAction'))),
          h('button', {
            type: 'button',
            className: 'dshg-menu-action-row',
            onClick: () => { close(); void onCreateWorktree(); },
          }, h(IconBranch, { size: 14 }), h('span', null, t('worktreeCreateAction'))),
          h('button', {
            type: 'button',
            className: 'dshg-menu-action-row',
            onClick: () => { close(); onManageWorktrees(); },
          }, h(IconBranch, { size: 14 }), h('span', null, t('worktreeManageAction'))))));
    }

    /**
     * Shared modal shell: a transparent backdrop plus the centered card.
     * Keeping it inline (not a portal) matches the panel's existing stacking
     * model and leaves the host sidebar visible, like the reference dialogs.
     */
