    function Svg({ size = 16, children, className }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        'aria-hidden': true,
      }, children);
    }

    function IconRefresh(props) {
      return h(Svg, props, h('path', { d: 'M20 11a8 8 0 1 0 2 5' }), h('path', { d: 'M20 5v6h-6' }));
    }

    function IconFetch(props) {
      return h(Svg, props, h('path', { d: 'M12 3v12' }), h('path', { d: 'm7 10 5 5 5-5' }), h('path', { d: 'M4 21h16' }));
    }

    function IconPull(props) {
      return h(Svg, props, h('path', { d: 'M12 21V9' }), h('path', { d: 'm7 14 5-5 5 5' }), h('path', { d: 'M4 3h16' }));
    }

    function IconPush(props) {
      return h(Svg, props, h('path', { d: 'M12 3v12' }), h('path', { d: 'm7 8 5-5 5 5' }), h('path', { d: 'M4 21h16' }));
    }

    function IconBranch(props) {
      return h(Svg, props,
        h('circle', { cx: 6, cy: 5, r: 2.2 }),
        h('circle', { cx: 6, cy: 19, r: 2.2 }),
        h('circle', { cx: 18, cy: 8, r: 2.2 }),
        h('path', { d: 'M6 7.2v9.6' }),
        h('path', { d: 'M8.2 5h3.3A4.5 4.5 0 0 1 16 9.5v0' }));
    }

    function IconFolder(props) {
      return h(Svg, props, h('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' }));
    }

    function IconCheck(props) {
      return h(Svg, props, h('path', { d: 'm5 12 4 4 10-10' }));
    }

    function IconMinus(props) {
      return h(Svg, props, h('path', { d: 'M5 12h14' }));
    }

    function IconClose(props) {
      return h(Svg, props, h('path', { d: 'M6 6l12 12M18 6 6 18' }));
    }

    function IconCopy(props) {
      return h(Svg, props, h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }));
    }

    function formatRelative(timestamp) {
      if (!timestamp) return '';
      const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
      if (seconds < 60) return t('justNow');
      if (seconds < 3600) return tf('minutesAgo', { count: Math.floor(seconds / 60) });
      if (seconds < 86400) return tf('hoursAgo', { count: Math.floor(seconds / 3600) });
      if (seconds < 86400 * 30) return tf('daysAgo', { count: Math.floor(seconds / 86400) });
      try {
        return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      } catch {
        return '';
      }
    }

    /** Normalise a host ref (`{name, kind}`) or a legacy string. */
    function refInfo(ref) {
      if (!ref) return null;
      if (typeof ref === 'string') {
        if (ref.startsWith('HEAD -> ')) return { kind: 'head', name: ref.slice(8) };
        if (ref.startsWith('tag: ')) return { kind: 'tag', name: ref.slice(5) };
        return { kind: 'local', name: ref };
      }
      return { kind: ref.kind || 'local', name: ref.name || '' };
    }

    function RefPill({ item }) {
      const info = refInfo(item);
      if (!info || !info.name) return null;
      return h('span', {
        className: cx('dshg-ref', info.kind),
        'data-dshg-tip': info.name,
      },
        info.kind === 'tag' ? h(IconTag, { size: 10 }) : h(IconBranch, { size: 10 }),
        h('span', { className: 'dshg-ref-name' }, info.name));
    }

    function IconSearch(props) {
      return h(Svg, props, h('circle', { cx: 11, cy: 11, r: 6.5 }), h('path', { d: 'm16 16 4.5 4.5' }));
    }

    function IconTag(props) {
      return h(Svg, props,
        h('path', { d: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8a2 2 0 0 1 2-2H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z' }),
        h('circle', { cx: 7.5, cy: 7.5, r: 1.2 }));
    }

    function IconMail(props) {
      return h(Svg, props,
        h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2.5 }),
        h('path', { d: 'm3.6 7.2 8.4 5.6 8.4-5.6' }));
    }

    function IconExternal(props) {
      return h(Svg, props,
        h('path', { d: 'M14 4h6v6' }),
        h('path', { d: 'M20 4 11 13' }),
        h('path', { d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }));
    }

    function GitGlyph({ size = 20 }) {
      return h(Svg, { size },
        h('circle', { cx: 6, cy: 5, r: 2.2 }),
        h('circle', { cx: 6, cy: 19, r: 2.2 }),
        h('circle', { cx: 18, cy: 8, r: 2.2 }),
        h('path', { d: 'M6 7.2v9.6' }),
        h('path', { d: 'M8.2 5h3.3A4.5 4.5 0 0 1 16 9.5v0' }));
    }

    function GitPanelIcon({ size = 20, active, openPanel }) {
      const handleClick = openPanel
        ? () => {
            try {
              openPanel();
            } catch (error) {
              console.error('[dsh-git] could not open panel from sidebar', error);
            }
          }
        : undefined;
      return h('span', {
        className: cx('dshg-panel-icon', active && 'active'),
        style: {
          display: 'inline-flex',
          color: active ? 'var(--dsw-alias-label-primary, currentColor)' : 'var(--dsw-alias-label-secondary, currentColor)',
          cursor: openPanel ? 'pointer' : undefined,
        },
        onClick: handleClick,
      }, h(GitGlyph, { size }));
    }
