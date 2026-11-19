    function DiffText({ text, emptyText }) {
      if (!text) {
        return h('div', { className: 'dshg-empty dshg-empty-inline' }, emptyText || t('diffEmpty'));
      }
      const lines = text.split('\n');
      const truncated = lines.length > 4000;
      const shown = lines.slice(0, 4000);
      if (shown.length > 0 && shown[shown.length - 1] === '') shown.pop();
      let oldNumber = 0;
      let newNumber = 0;
      return h('div', { className: 'dshg-diff-wrap' },
        h('div', { className: 'dshg-diff' }, shown.map((line, index) => {
          let kind = 'context';
          if (line.startsWith('@@')) {
            kind = 'hunk';
            const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
            if (match) {
              oldNumber = Number(match[1]) - 1;
              newNumber = Number(match[2]) - 1;
            }
          } else if (
            line.startsWith('+++') || line.startsWith('---') ||
            line.startsWith('diff --git') || line.startsWith('index ') ||
            line.startsWith('new file') || line.startsWith('deleted file') ||
            line.startsWith('similarity index') || line.startsWith('rename ') ||
            line.startsWith('\\')
          ) {
            kind = 'meta';
          } else if (line.startsWith('+')) {
            kind = 'add';
            newNumber += 1;
          } else if (line.startsWith('-')) {
            kind = 'del';
            oldNumber += 1;
          } else {
            oldNumber += 1;
            newNumber += 1;
          }

          if (kind === 'hunk' || kind === 'meta') {
            return h('div', { key: index, className: `dshg-line dshg-line-${kind}` },
              h('span', { className: 'dshg-code' }, line || ' '));
          }

          return h('div', { key: index, className: `dshg-line dshg-line-${kind}` },
            h('span', { className: 'dshg-ln' }, kind === 'add' ? '' : oldNumber),
            h('span', { className: 'dshg-ln' }, kind === 'del' ? '' : newNumber),
            h('span', { className: 'dshg-code' }, line || ' '));
        })),
        truncated ? h('div', { className: 'dshg-truncated' }, t('patchTruncated')) : null);
    }

    function EmptyState({ icon, title, description, action }) {
      return h('div', { className: 'dshg-empty' },
        icon ? h('div', { className: 'dshg-empty-icon' }, icon) : null,
        h('div', { className: 'dshg-empty-title' }, title),
        description ? h('div', { className: 'dshg-empty-desc' }, description) : null,
        action || null);
    }

    function MenuItem({ active, disabled, onClick, children, hint }) {
      return h('button', {
        type: 'button',
        role: 'option',
        'aria-selected': active ? 'true' : 'false',
        className: cx('dshg-menu-item', active && 'active'),
        disabled,
        onClick,
      },
      h('span', { className: 'dshg-menu-label' }, children),
      hint ? h('span', { className: 'dshg-menu-hint' }, hint) : null,
      active ? h(IconCheck, { size: 13, className: 'dshg-menu-check' }) : null);
    }

    /**
     * Pill trigger + popover list. Replaces the native <select>, whose OS popup
     * cannot follow the host's pill language and looks out of place.
     */
    function PillSelect({ ariaLabel, title, trigger, onOpenChange, children, disabled, alignEnd, menuClassName, triggerClassName }) {
      const [open, setOpen] = useState(false);
      const rootRef = useRef(null);
      const change = useCallback((next) => {
        setOpen(next);
        if (onOpenChange) onOpenChange(next);
      }, [onOpenChange]);
      const close = useCallback(() => change(false), [change]);

      useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          if (rootRef.current && !rootRef.current.contains(event.target)) close();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') close();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [open, close]);

      return h('span', { className: 'dshg-pillselect', ref: rootRef },
        h('button', {
          type: 'button',
          className: cx('dshg-pillselect-trigger', triggerClassName),
          disabled,
          onClick: () => change(!open),
          'aria-haspopup': 'listbox',
          'aria-expanded': open ? 'true' : 'false',
          'aria-label': ariaLabel,
          title: title || ariaLabel,
        }, trigger, h('span', { className: 'dshg-pillselect-chevron', 'aria-hidden': true })),
        open ? h('div', {
          className: cx('dshg-menu', alignEnd && 'dshg-menu-end', menuClassName),
          role: 'listbox',
          'aria-label': ariaLabel,
        }, children(close)) : null);
    }

    /** Fold branch names into `/` folders for the tree view. */
