    function GitSidebarStatus({ openPanel }) {
      const [summary, setSummary] = useState(null);
      useEffect(() => {
        let alive = true;
        const load = async () => {
          if (document.visibilityState === 'hidden') return;
          try {
            const list = await rpc('workspaces');
            const saved = readStorage('dsh-git.workspace');
            const picked = list.find((item) => item.path === saved) || list[0];
            if (!picked) return;
            // Aggregate across every discovered repository: the footer is a
            // workspace summary, while the panel scopes to one repository.
            const next = await rpc('status-lite', { workspace: picked.path });
            if (!alive) return;
            if (!next.isRepo) {
              setSummary(null);
              return;
            }
            const entries = Array.isArray(next.entries) ? next.entries : [];
            const repos = Array.isArray(next.repos) ? next.repos : [];
            const byKind = (kinds) => entries.filter((entry) => kinds.includes(entry.kind)).length;
            setSummary({
              branch: next.branch || null,
              repos: repos.length,
              changed: next.counts ? next.counts.changed : entries.length,
              conflicts: next.counts ? next.counts.conflicts : 0,
              modified: byKind(['modified', 'renamed']),
              added: byKind(['added', 'untracked']),
              deleted: byKind(['deleted']),
            });
          } catch {
            if (alive) setSummary(null);
          }
        };
        load();
        const timer = setInterval(load, 10000);
        return () => { alive = false; clearInterval(timer); };
      }, []);

      if (!summary) {
        return h('button', {
          type: 'button',
          className: 'dshg-sidebar-status',
          onClick: openPanel,
          title: t('panel'),
          'aria-label': t('panel'),
        }, h(GitGlyph, { size: 14 }));
      }

      const tone = summary.conflicts > 0 || summary.deleted > 0
        ? 'deleted'
        : summary.modified > 0
          ? 'modified'
          : summary.changed > 0
            ? 'added'
            : null;
      return h('button', {
        type: 'button',
        className: 'dshg-sidebar-status',
        onClick: openPanel,
        title: `${summary.branch || t('detached')} · ${tf('filesChanged', { count: summary.changed })}${
          summary.repos > 1 ? ` · ${tf('repoCount', { count: summary.repos })}` : ''}`,
        'aria-label': `${t('panel')}: ${tf('filesChanged', { count: summary.changed })}`,
      },
      h(GitGlyph, { size: 14 }),
      tone ? h('span', { className: cx('dshg-mini-dot', `dshg-dot-${tone}`) }) : null,
      summary.changed > 0 ? h('span', { className: 'dshg-side-count' }, summary.changed) : null);
    }

    const KIND_CLASS = {
      added: 'added',
      modified: 'modified',
      deleted: 'deleted',
      untracked: 'untracked',
      conflict: 'conflict',
      ignored: 'ignored',
      renamed: 'renamed',
      copied: 'modified',
    };

    function kindLabel(kind) {
      switch (kind) {
        case 'added': return t('kindAdded');
        case 'modified': return t('kindModified');
        case 'deleted': return t('kindDeleted');
        case 'untracked': return t('kindUntracked');
        case 'conflict': return t('kindConflict');
        case 'ignored': return t('kindIgnored');
        case 'renamed': return t('kindRenamed');
        default: return kind;
      }
    }

    function StatusBadge({ entry }) {
      if (!entry.badge) return null;
      return h('span', {
        className: cx('dshg-badge', `dshg-st-${KIND_CLASS[entry.kind] || 'modified'}`),
        title: kindLabel(entry.kind),
      }, entry.badge);
    }

    function CheckBox({ state, onClick, label }) {
      return h('button', {
        type: 'button',
        className: cx('dshg-check', state),
        onClick,
        'aria-label': label,
        'aria-checked': state === 'checked' ? 'true' : state === 'partial' ? 'mixed' : 'false',
        role: 'checkbox',
      }, state === 'checked' ? h(IconCheck, { size: 10 }) : state === 'partial' ? h('span', { className: 'dshg-check-line' }) : null);
    }

    function buildTree(entries) {
      const root = { name: '', path: '', dirs: new Map(), files: [] };
      for (const entry of entries) {
        const parts = entry.path.split('/');
        let node = root;
        let currentPath = '';
        for (let index = 0; index < parts.length - 1; index += 1) {
          const part = parts[index];
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!node.dirs.has(part)) {
            node.dirs.set(part, { name: part, path: currentPath, dirs: new Map(), files: [] });
          }
          node = node.dirs.get(part);
        }
        node.files.push(entry);
      }
      compactTree(root);
      return root;
    }

    /**
     * Collapse single-child directory chains (`apps` > `campus-activity` > `src` >
     * `main` > ...) into one row, the way Zed compacts a project tree. A folder
     * ladder with one name per row is unreadable at depth; a merged chain keeps
     * the same information in one line.
     */
    function compactTree(root) {
      for (const dir of root.dirs.values()) compactDir(dir);
    }

    function compactDir(node) {
      for (const dir of node.dirs.values()) compactDir(dir);
      if (node.files.length > 0 || node.dirs.size !== 1) return;
      const child = node.dirs.values().next().value;
      node.name = `${node.name}/${child.name}`;
      node.path = child.path;
      // The merged node takes over the child's files too; dropping them makes a
      // file whose parent chain got compacted disappear from the list.
      node.files = child.files;
      node.dirs = child.dirs;
    }

    function collectFiles(node, output = []) {
      for (const file of node.files) output.push(file);
      for (const dir of node.dirs.values()) collectFiles(dir, output);
      return output;
    }

    function aggregateKind(files) {
      if (files.some((file) => file.kind === 'conflict')) return 'conflict';
      if (files.some((file) => file.kind === 'deleted')) return 'deleted';
      if (files.some((file) => file.kind === 'modified')) return 'modified';
      if (files.some((file) => file.kind === 'added' || file.kind === 'untracked')) return 'added';
      return 'modified';
    }
