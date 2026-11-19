    function PanelHeader({
      workspaces, workspace, repos, repo, showAllRepos, status, busy,
      onWorkspace, onRepo, onToggleRepos, onRefresh, onFetch, onPull, onPush,
      loadBranches, onPickBranch,
      onCreateBranch, onOpenGraph, onOpenWorktree, onManageWorktrees,
    }) {
      const selectedRepo = repos.find((item) => samePath(item.root, repo));
      const currentWorkspace = workspaces.find((item) => item.path === workspace);
      const groups = repoGroups(repos, repo, showAllRepos);
      const allGroups = showAllRepos ? groups : repoGroups(repos, repo, true);
      const hidden = Math.max(0, repoOptionCount(allGroups) - repoOptionCount(groups));
      return h('div', { className: 'dshg-header' },
        h('div', { className: 'dshg-brand' }, h(GitGlyph, { size: 18 }), h('span', null, t('git'))),
        workspaces.length > 1 ? h(PillSelect, {
          trigger: h('span', {
            className: 'dshg-pill-label',
            'data-dshg-tip': currentWorkspace ? (currentWorkspace.path || currentWorkspace.title) : workspace,
          }, currentWorkspace ? currentWorkspace.title || currentWorkspace.path : workspace),
        }, (close) => workspaces.map((item) => h(MenuItem, {
          key: item.id,
          active: item.path === workspace,
          onClick: () => { close(); onWorkspace(item.path); },
        }, item.title || item.path))) : null,
        repos.length > 1 ? h(PillSelect, {
          ariaLabel: t('selectRepo'),
          trigger: h(React.Fragment, null,
            h('span', {
              className: 'dshg-pill-label',
              'data-dshg-tip': selectedRepo ? selectedRepo.root : (repos[0] && repos[0].root) || '',
            }, selectedRepo ? repoSelectLabel(repos, selectedRepo) : repoLabel(repos[0])),
            selectedRepo && selectedRepo.counts && selectedRepo.counts.changed > 0
              ? h('span', { className: 'dshg-pillcount' }, selectedRepo.counts.changed) : null),
        }, (close) => h(React.Fragment, null,
          groups.map((group) => h(React.Fragment, { key: group.key },
            h('div', { className: 'dshg-menu-group' }, group.label),
            group.items.map((item) => h(MenuItem, {
              key: item.root,
              active: samePath(item.root, repo),
              disabled: Boolean(item.error),
              hint: item.error ? t('repoUnavailable') : (item.counts && item.counts.changed ? item.counts.changed : null),
              onClick: () => { close(); onRepo(item.root); },
            }, repoSelectLabel(repos, item))))),
          hidden > 0 || showAllRepos ? h('div', { className: 'dshg-menu-footer' },
            h('button', {
              type: 'button',
              className: 'dshg-menu-action',
              onClick: () => onToggleRepos(),
            }, showAllRepos ? t('repoScopeLess') : tf('repoScopeMore', { count: hidden }))) : null)) : null,
        selectedRepo && repos.length === 1 ? h('span', {
          className: 'dshg-repo-name',
          'data-dshg-tip': selectedRepo.root,
        }, repoSelectLabel(repos, selectedRepo)) : null,
        status && status.isRepo && !status.isBare ? h(BranchSwitcher, {
          status,
          busy,
          load: loadBranches,
          onPick: onPickBranch,
          onCreate: onCreateBranch,
          onGraph: onOpenGraph,
          onCreateWorktree: onOpenWorktree,
          onManageWorktrees: onManageWorktrees,
        }) : null,
        status && status.isBare ? h('span', { className: 'dshg-chip' }, h('strong', null, t('bareRepo'))) : null,
        status && status.isRepo && Array.isArray(status.remotes) && status.remotes.length === 0
          ? h('span', { className: 'dshg-muted' }, t('noRemote')) : null,
        h('span', { className: 'dshg-spacer' }),
        status && status.isRepo ? h('div', { className: 'dshg-actions' },
          h('button', { type: 'button', className: 'dshg-btn', disabled: Boolean(busy), onClick: onFetch, title: t('fetch') },
            h(IconFetch, { size: 14 }), h('span', { className: 'dshg-btn-label' }, t('fetch'))),
          h('button', { type: 'button', className: 'dshg-btn', disabled: Boolean(busy) || status.detached, onClick: onPull, title: t('pull') },
            h(IconPull, { size: 14 }), h('span', { className: 'dshg-btn-label' }, t('pull'))),
          h('button', { type: 'button', className: 'dshg-btn dshg-btn-brand', disabled: Boolean(busy) || status.detached, onClick: onPush, title: t('push') },
            h(IconPush, { size: 14 }), h('span', { className: 'dshg-btn-label' }, t('push')))) : null,
        h('button', {
          type: 'button',
          className: 'dshg-iconbtn',
          disabled: Boolean(busy) || !workspace,
          onClick: onRefresh,
          title: t('refreshShort'),
          'aria-label': t('refreshShort'),
        }, h(IconRefresh, { size: 15 })));
    }

    function ChangesList({
      status, loading, expanded, onToggleExpand, onSelect, onOpen, onToggleFile, onToggleDir,
    }) {
      if (loading && !status) {
        return h('div', { className: 'dshg-empty dshg-empty-inline' }, t('loading'));
      }
      if (!status) return null;
      if (!status.isRepo) return null;
      if (status.entries.length === 0) {
        return h('div', { className: 'dshg-empty dshg-empty-inline' },
          h('div', { className: 'dshg-empty-title' }, t('statusClean')),
          h('div', { className: 'dshg-empty-desc' }, t('statusCleanDesc')));
      }

      const stagedEntries = status.entries.filter((entry) => entry.staged || entry.partial);
      const unstagedEntries = status.entries.filter((entry) => !entry.staged || entry.partial);
      const sections = [];

      if (stagedEntries.length > 0) {
        sections.push(h('div', { key: 'staged', className: 'dshg-section' },
          h('div', { className: 'dshg-section-head' },
            h('span', null, t('stagedTab')),
            h('span', { className: 'dshg-count' }, stagedEntries.length)),
          h('div', { className: 'dshg-tree' }, renderTreeRows({
            node: buildTree(stagedEntries),
            depth: 0,
            section: 'staged',
            expanded,
            repoRoot: status.repoRoot,
            onToggleExpand,
            onSelect,
            onOpen,
            onToggleFile,
            onToggleDir,
          }))));
      }

      if (unstagedEntries.length > 0) {
        sections.push(h('div', { key: 'changes', className: 'dshg-section' },
          h('div', { className: 'dshg-section-head' },
            h('span', null, t('unstagedTab')),
            h('span', { className: 'dshg-count' }, unstagedEntries.length)),
          h('div', { className: 'dshg-tree' }, renderTreeRows({
            node: buildTree(unstagedEntries),
            depth: 0,
            section: 'changes',
            expanded,
            repoRoot: status.repoRoot,
            onToggleExpand,
            onSelect,
            onOpen,
            onToggleFile,
            onToggleDir,
          }))));
      }

      return h('div', { className: 'dshg-sections' }, sections);
    }

    function RepoOverview({ status, repos, repo, graph, onShowHistory }) {
      if (!status) {
        return h(EmptyState, { icon: h(GitGlyph, { size: 28 }), title: t('loading') });
      }
      const last = graph && graph[0];
      const ahead = status.ahead || 0;
      const behind = status.behind || 0;
      const selectedRepo = repos.find((item) => samePath(item.root, repo));
      return h('div', { className: 'dshg-overview' },
        h('div', { className: 'dshg-overview-card' },
          h('div', { className: 'dshg-overview-head' },
            h('div', { className: 'dshg-overview-icon' }, h(GitGlyph, { size: 24 })),
            h('div', { className: 'dshg-overview-heading' },
              h('div', { className: 'dshg-overview-title' }, t('overviewTitle')),
              h('div', { className: 'dshg-overview-sub', title: status.repoRoot || '' },
                selectedRepo ? `${repoLabel(selectedRepo)} — ${status.repoRoot}` : status.repoRoot || status.workspaceRoot || ''))),
          h('div', { className: 'dshg-overview-grid' },
            h('div', { className: 'dshg-metric' },
              h('span', { className: 'dshg-metric-label' }, t('branchLabel')),
              h('strong', null, status.branch || t('detached')),
              h('span', { className: 'dshg-metric-sub' },
                status.upstream
                  ? `${status.upstream}${ahead ? ` · ↑${ahead}` : ''}${behind ? ` · ↓${behind}` : ''}`
                  : t('noRemote'))),
            h('div', { className: 'dshg-metric' },
              h('span', { className: 'dshg-metric-label' }, t('changes')),
              h('strong', null, status.counts.changed),
              h('span', { className: 'dshg-metric-sub' },
                `${status.counts.staged} ${t('stagedTab')} · ${status.counts.untracked} ${t('kindUntracked')}`)),
            repos.length > 1 ? h('div', { className: 'dshg-metric' },
              h('span', { className: 'dshg-metric-label' }, t('repos')),
              h('strong', null, repos.length),
              h('span', { className: 'dshg-metric-sub', title: repos.map((item) => `${repoLabel(item)} (${item.root})`).join('\n') },
                selectedRepo ? repoSelectLabel(repos, selectedRepo) : repoLabel(repos[0]))) : null),
          last
            ? h('button', { type: 'button', className: 'dshg-overview-last', onClick: onShowHistory },
                h('span', { className: 'dshg-overview-last-label' }, t('latestCommit')),
                h('span', { className: 'dshg-overview-last-subject' }, last.subject),
                h('span', { className: 'dshg-overview-last-meta' }, `${last.author} · ${formatTime(last.timestamp)}`),
                h('span', { className: 'dshg-overview-last-action' }, `${t('history')} →`))
            : h('div', { className: 'dshg-overview-empty' }, t('graphEmpty')),
          h('div', { className: 'dshg-overview-hints' },
            h('span', null, h('kbd', null, 'Ctrl+Enter'), ` ${t('commit')}`),
            h('span', null, h('kbd', null, 'Alt+S'), ` ${t('stageAll')}`),
            h('span', null, h('kbd', null, 'Ctrl+Shift+G'), ` ${t('panel')}`))));
    }

    function DiffView({ selected, diff, diffLoading, onMode, onClose, status, repos, repo, graph, onShowHistory }) {
      if (!selected) {
        return h(RepoOverview, { status, repos, repo, graph, onShowHistory });
      }
      return h('div', { className: 'dshg-diff-pane' },
        h('div', { className: 'dshg-diff-head' },
          h('div', { className: 'dshg-diff-title', title: selected.path },
            h('span', { className: 'dshg-diff-path' }, selected.path),
            selected.entry ? h(StatusBadge, { entry: selected.entry }) : null),
          h('div', { className: 'dshg-segmented' },
            h('button', {
              type: 'button',
              className: cx('dshg-seg', selected.mode === 'unstaged' && 'active'),
              onClick: () => onMode('unstaged'),
            }, t('workingTree')),
            h('button', {
              type: 'button',
              className: cx('dshg-seg', selected.mode === 'staged' && 'active'),
              onClick: () => onMode('staged'),
            }, t('stagedTab'))),
          h('button', { type: 'button', className: 'dshg-iconbtn', onClick: onClose, title: t('close'), 'aria-label': t('close') },
            h(IconClose, { size: 14 }))),
        h('div', { className: 'dshg-diff-body' },
          diffLoading ? h('div', { className: 'dshg-empty dshg-empty-inline' }, t('loading')) :
            diff ? h(DiffText, {
              text: diff.text,
              emptyText: selected.entry && selected.entry.kind === 'untracked' ? t('untrackedDiff') : t('diffEmpty'),
            }) : null));
    }
