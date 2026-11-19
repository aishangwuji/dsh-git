    function renderTreeRows({
      node, depth, section, expanded, repoRoot, onToggleExpand, onSelect, onOpen, onToggleFile, onToggleDir,
    }) {
      const rows = [];
      const dirs = Array.from(node.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
      for (const dir of dirs) {
        const key = `${section}:${dir.path}`;
        const isOpen = expanded[key] !== false;
        const files = collectFiles(dir);
        const check = section === 'staged' ? 'checked' : files.some((file) => file.partial) ? 'partial' : 'unchecked';
        const aggregate = aggregateKind(files);
        rows.push(h('div', {
          key,
          className: 'dshg-row dshg-dir-row',
          style: { paddingLeft: `${8 + depth * 12}px` },
          'data-dshg-tip': dir.path,
          onClick: () => onToggleExpand(key),
        },
        h('span', { className: 'dshg-chevron' }, isOpen ? '▾' : '▸'),
        h(IconFolder, { size: 14, className: 'dshg-dir-icon' }),
        h('span', { className: 'dshg-dir-name' },
          dir.name.includes('/')
            ? h(React.Fragment, null,
                h('span', { className: 'dshg-dir-prefix' }, `${dir.name.slice(0, dir.name.lastIndexOf('/') + 1)}`),
                h('span', { className: 'dshg-dir-leaf' }, dir.name.slice(dir.name.lastIndexOf('/') + 1)))
            : dir.name),
        h('span', { className: `dshg-dot dshg-dot-${aggregate}` }),
        // An expanded folder already shows its children's numbers, so repeating
        // the same totals on every ancestor is noise. Summaries stay on the
        // collapsed row, where the children are not visible.
        !isOpen ? h('span', { className: 'dshg-dir-count' }, files.length) : null,
        !isOpen && files.some((file) => file.additions || file.deletions) ? h('span', { className: 'dshg-file-diff' },
          h('span', { className: 'dshg-add' }, `+${files.reduce((sum, file) => sum + (file.additions || 0), 0)}`),
          h('span', { className: 'dshg-del' }, `−${files.reduce((sum, file) => sum + (file.deletions || 0), 0)}`)) : null,
        h(CheckBox, {
          state: check,
          label: `${section === 'staged' ? t('unstage') : t('stage')} ${dir.path}`,
          onClick: (event) => {
            event.stopPropagation();
            onToggleDir(dir.path, files, section);
          },
        })));
        if (isOpen) {
          rows.push(...renderTreeRows({
            node: dir,
            depth: depth + 1,
            section,
            expanded,
            repoRoot,
            onToggleExpand,
            onSelect,
            onOpen,
            onToggleFile,
            onToggleDir,
          }));
        }
      }

      const files = node.files.slice().sort((a, b) => a.path.localeCompare(b.path));
      for (const entry of files) {
        const check = section === 'staged' ? 'checked' : entry.partial ? 'partial' : 'unchecked';
        rows.push(h('div', {
          key: `${section}:${entry.path}`,
          className: cx('dshg-row dshg-file-row', entry.kind === 'deleted' && 'dshg-deleted-row'),
          style: { paddingLeft: `${18 + depth * 12}px` },
          'data-dshg-tip': entry.path,
          draggable: true,
          onDragStart: (event) => beginFileDrag(event, joinAbsolute(repoRoot, entry.path)),
          onClick: () => onSelect(entry, section),
          onDoubleClick: () => onOpen(entry, section),
        },
        h(StatusBadge, { entry }),
        h('span', {
          className: cx('dshg-file-name', `dshg-st-${KIND_CLASS[entry.kind] || 'modified'}`),
          'aria-label': tf('statusAria', { kind: kindLabel(entry.kind), path: entry.path }),
        }, basename(entry.path)),
        entry.partial ? h('span', { className: 'dshg-partial-mark', title: t('stagedTab') }, '◐') : null,
        (typeof entry.additions === 'number' && (entry.additions || entry.deletions))
          ? h('span', { className: 'dshg-file-diff' },
              h('span', { className: 'dshg-add' }, `+${entry.additions}`),
              h('span', { className: 'dshg-del' }, `−${entry.deletions}`))
          : null,
        h('span', { className: 'dshg-spacer' }),
        h(CheckBox, {
          state: check,
          label: `${section === 'staged' ? t('unstageAria') : t('stageAria')}`.replace('{path}', entry.path),
          onClick: (event) => {
            event.stopPropagation();
            onToggleFile(entry, section);
          },
        })));
      }
      return rows;
    }
