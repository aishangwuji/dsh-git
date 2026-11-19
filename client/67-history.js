    function layoutGraph(commits) {
      const lanes = [];
      const laneColor = [];
      let nextColor = 0;
      const rows = [];
      for (const commit of commits) {
        let lane = lanes.indexOf(commit.sha);
        if (lane === -1) {
          lane = lanes.indexOf(null);
          if (lane === -1) {
            lane = lanes.length;
            lanes.push(null);
          }
        }
        if (laneColor[lane] === undefined) laneColor[lane] = nextColor++ % GRAPH_COLORS.length;
        const color = laneColor[lane];
        const before = lanes.slice();
        const beforeColors = before.map((_, index) => laneColor[index] === undefined ? 0 : laneColor[index]);
        for (let index = 0; index < lanes.length; index += 1) {
          if (lanes[index] === commit.sha) lanes[index] = null;
        }
        const parentLanes = [];
        commit.parents.forEach((parent, index) => {
          let parentLane;
          if (index === 0) {
            parentLane = lane;
            lanes[lane] = parent;
          } else {
            parentLane = lanes.indexOf(null);
            if (parentLane === -1) {
              parentLane = lanes.length;
              lanes.push(parent);
            } else {
              lanes[parentLane] = parent;
            }
            if (laneColor[parentLane] === undefined) laneColor[parentLane] = nextColor++ % GRAPH_COLORS.length;
          }
          parentLanes.push(parentLane);
        });
        if (commit.parents.length === 0) lanes[lane] = null;
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
          lanes.pop();
          laneColor.pop();
        }
        const after = lanes.slice();
        const afterColors = after.map((_, index) => laneColor[index] === undefined ? 0 : laneColor[index]);
        rows.push({ ...commit, lane, color, before, beforeColors, after, afterColors, parentLanes });
      }
      return rows;
    }

    function GraphCell({ row, maxLanes }) {
      const laneWidth = 14;
      const height = 26;
      const mid = height / 2;
      const width = Math.max(22, maxLanes * laneWidth + 8);
      const x = (lane) => 7 + lane * laneWidth;
      const colorOf = (index) => GRAPH_COLORS[(index || 0) % GRAPH_COLORS.length];
      const children = [];
      const handled = new Set();
      const outgoing = new Set(row.parentLanes);

      row.before.forEach((oid, lane) => {
        if (oid !== row.sha) return;
        handled.add(lane);
        if (lane === row.lane) {
          children.push(h('line', {
            key: `in-${lane}`,
            x1: x(lane), y1: 0, x2: x(lane), y2: mid,
            stroke: colorOf(row.beforeColors[lane]), strokeWidth: 1.5,
          }));
        } else {
          children.push(h('path', {
            key: `in-curve-${lane}`,
            d: `M ${x(lane)} 0 C ${x(lane)} ${mid * 0.55}, ${x(row.lane)} ${mid * 0.45}, ${x(row.lane)} ${mid}`,
            fill: 'none', stroke: colorOf(row.beforeColors[lane]), strokeWidth: 1.5,
          }));
        }
      });

      const laneCount = Math.max(row.before.length, row.after.length);
      for (let lane = 0; lane < laneCount; lane += 1) {
        if (handled.has(lane) || outgoing.has(lane)) continue;
        if (!row.before[lane] && !row.after[lane]) continue;
        children.push(h('line', {
          key: `pass-${lane}`,
          x1: x(lane), y1: 0, x2: x(lane), y2: height,
          stroke: colorOf(row.beforeColors[lane] === undefined ? row.afterColors[lane] : row.beforeColors[lane]),
          strokeWidth: 1.5, opacity: 0.7,
        }));
      }

      row.parentLanes.forEach((parentLane, index) => {
        if (parentLane === row.lane) {
          children.push(h('line', {
            key: `out-${index}`,
            x1: x(parentLane), y1: mid, x2: x(parentLane), y2: height,
            stroke: colorOf(row.afterColors[parentLane] === undefined ? row.color : row.afterColors[parentLane]),
            strokeWidth: 1.5,
          }));
        } else {
          children.push(h('path', {
            key: `out-curve-${index}`,
            d: `M ${x(row.lane)} ${mid} C ${x(row.lane)} ${mid + 6}, ${x(parentLane)} ${height - 6}, ${x(parentLane)} ${height}`,
            fill: 'none',
            stroke: colorOf(row.afterColors[parentLane] === undefined ? row.color : row.afterColors[parentLane]),
            strokeWidth: 1.5,
          }));
        }
      });

      children.push(h('circle', {
        key: 'dot',
        cx: x(row.lane), cy: mid, r: 3.2,
        fill: colorOf(row.color),
        stroke: 'var(--dsw-alias-bg-base, #fff)',
        strokeWidth: 1,
      }));

      return h('svg', {
        className: 'dshg-graph-cell',
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        'aria-hidden': true,
      }, children);
    }

    /** Splitter between two panes; drag, double-click to reset, arrows to nudge. */
    function PaneResizer({ side, onStart, onNudge, onReset }) {
      return h('div', {
        className: 'dshg-resizer',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': t('resizePanes'),
        title: t('resizePanes'),
        tabIndex: 0,
        onPointerDown: (event) => onStart(side, event),
        onDoubleClick: () => onReset(side),
        onKeyDown: (event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onNudge(side, -16);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onNudge(side, 16);
          }
        },
      });
    }
    function HistoryView({
      graph, graphLoading, graphHasMore, onLoadMore, selectedSha, onSelectCommit,
      filters, onFilters,
    }) {
      const [query, setQuery] = useState('');
      const [authorDraft, setAuthorDraft] = useState(filters.author || '');
      const [pathDraft, setPathDraft] = useState(filters.path || '');
      const [dateKey, setDateKey] = useState('all');

      useEffect(() => { setAuthorDraft(filters.author || ''); }, [filters.author]);
      useEffect(() => { setPathDraft(filters.path || ''); }, [filters.path]);

      const filtered = !isDefaultFilters(filters);
      const apply = useCallback((patch) => {
        onFilters({ ...filters, ...patch });
      }, [filters, onFilters]);

      const source = useMemo(() => {
        const list = graph || [];
        const needle = query.trim().toLowerCase();
        if (!needle) return list;
        return list.filter((commit) => `${commit.subject} ${commit.author} ${commit.sha}`.toLowerCase().includes(needle));
      }, [graph, query]);
      const rows = useMemo(() => layoutGraph(source), [source]);
      const maxLanes = useMemo(() => {
        let max = 1;
        for (const row of rows) {
          max = Math.max(max, row.before.length, row.after.length, ...row.parentLanes.map((lane) => lane + 1));
        }
        return max;
      }, [rows]);
      const graphWidth = Math.max(22, maxLanes * 14 + 8);

      return h('div', { className: 'dshg-center-pane' },
        h('div', { className: 'dshg-pane-head dshg-center-head' },
          h('span', { className: 'dshg-pane-title' }, t('history')),
          h('span', { className: 'dshg-count' }, (graph || []).length),
          h('span', { className: 'dshg-spacer' }),
          h('label', { className: 'dshg-history-search' },
            h(IconSearch, { size: 13, className: 'dshg-history-search-icon' }),
            h('input', {
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: t('filterCommits'),
              'aria-label': t('filterCommits'),
              spellCheck: false,
            }))),
        h('div', { className: 'dshg-history-filters' },
          h('label', { className: 'dshg-filter' },
            h('span', { className: 'dshg-filter-label' }, t('filterAuthor')),
            h('input', {
              className: 'dshg-filter-input',
              value: authorDraft,
              placeholder: t('filterAuthorPlaceholder'),
              'aria-label': t('filterAuthor'),
              spellCheck: false,
              onChange: (event) => setAuthorDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                apply({ author: authorDraft.trim() });
              },
              onBlur: () => {
                if ((filters.author || '') !== authorDraft.trim()) apply({ author: authorDraft.trim() });
              },
            })),
          h('label', { className: 'dshg-filter' },
            h('span', { className: 'dshg-filter-label' }, t('filterDate')),
            h('select', {
              className: 'dshg-filter-select',
              value: dateKey,
              'aria-label': t('filterDate'),
              onChange: (event) => {
                const key = event.target.value;
                setDateKey(key);
                apply({ since: sinceForPreset(key) });
              },
            }, [['all', t('filterDateAll')], ['today', t('filterDateToday')], ['7d', t('filterDate7d')],
              ['30d', t('filterDate30d')], ['year', t('filterDateYear')]]
              .map(([key, text]) => h('option', { key, value: key }, text)))),
          h('label', { className: 'dshg-filter dshg-filter-grow' },
            h('span', { className: 'dshg-filter-label' }, t('filterPath')),
            h('input', {
              className: 'dshg-filter-input',
              value: pathDraft,
              placeholder: t('filterPathPlaceholder'),
              'aria-label': t('filterPath'),
              spellCheck: false,
              onChange: (event) => setPathDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                apply({ path: pathDraft.trim() });
              },
              onBlur: () => {
                if ((filters.path || '') !== pathDraft.trim()) apply({ path: pathDraft.trim() });
              },
            })),
          h('button', {
            type: 'button',
            className: 'dshg-filter-toggle',
            title: t('filterDate'),
            onClick: () => apply({ order: filters.order === 'oldest' ? 'newest' : 'oldest' }),
          }, filters.order === 'oldest' ? t('sortOldest') : t('sortNewest')),
          filtered ? h('button', {
            type: 'button',
            className: 'dshg-filter-clear',
            title: t('filterClear'),
            onClick: () => {
              setAuthorDraft('');
              setPathDraft('');
              setDateKey('all');
              onFilters(defaultFilters());
            },
          }, t('filterClear')) : null),
        h('div', {
          className: 'dshg-history-columns',
          style: { gridTemplateColumns: `${graphWidth}px minmax(0, 1fr) 92px 108px 72px` },
        },
        h('span', null, ''),
        h('span', null, t('commitColSubject')),
        h('span', null, t('commitColTime')),
        h('span', null, t('commitColAuthor')),
        h('span', null, t('commitColSha'))),
        (graphLoading && !graph)
          ? h('div', { className: 'dshg-empty dshg-empty-inline' }, t('loading'))
          : (!graph || graph.length === 0)
            ? h(EmptyState, {
                icon: h(IconBranch, { size: 28 }),
                title: t('graphEmpty'),
                description: t('graphEmptyDesc'),
              })
            : h('div', { className: 'dshg-history' },
                rows.length === 0
                  ? h('div', { className: 'dshg-empty dshg-empty-inline' }, t('noMatchingCommits'))
                  : rows.map((row) => h('div', {
                      key: row.sha,
                      className: cx('dshg-commit-row', selectedSha === row.sha && 'active'),
                      role: 'button',
                      tabIndex: 0,
                      style: { gridTemplateColumns: `${graphWidth}px minmax(0, 1fr) 92px 108px 72px` },
                      onClick: () => onSelectCommit(row.sha),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectCommit(row.sha);
                        }
                      },
                    },
                    h(GraphCell, { row, maxLanes }),
                    h('div', { className: 'dshg-commit-main' },
                      h('div', { className: 'dshg-commit-subject' },
                        (row.refs || []).slice(0, 3).map((ref, index) => h(RefPill, { key: `${row.sha}-ref-${index}`, item: ref })),
                        h('span', { className: 'dshg-commit-title' }, row.subject || '(no subject)'),
                        row.parents.length > 1 ? h('span', { className: 'dshg-merge-mark', title: t('mergeCommit') }, 'M') : null)),
                    h('span', { className: 'dshg-commit-time', title: formatTime(row.timestamp) }, formatRelative(row.timestamp)),
                    h('span', { className: 'dshg-commit-author', title: row.author }, row.author),
                    h('span', { className: 'dshg-sha' }, row.sha.slice(0, 7))))),
        graphHasMore ? h('div', { className: 'dshg-history-more' },
          h('button', {
            type: 'button',
            className: 'dshg-btn dshg-btn-small',
            disabled: Boolean(graphLoading),
            onClick: onLoadMore,
          }, graphLoading ? t('loadingMore') : t('loadMore'))) : null);
    }

    function formatCommitDate(timestamp) {
      if (!timestamp) return '';
      try {
        return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      } catch {
        return '';
      }
    }

    function avatarInitials(name) {
      const text = String(name || '').trim();
      if (!text) return '?';
      const parts = text.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return Array.from(text).slice(0, 2).join('').toUpperCase();
    }
