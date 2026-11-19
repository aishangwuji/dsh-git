    function CommitFileRow({ file, active, onClick }) {
      const status = String(file.status || 'M').charAt(0);
      const slash = file.path.lastIndexOf('/');
      const dir = slash >= 0 ? file.path.slice(0, slash) : '';
      const name = slash >= 0 ? file.path.slice(slash + 1) : file.path;
      return h('button', {
        type: 'button',
        className: cx('dshg-detail-file', active && 'active'),
        onClick,
        title: file.path,
      },
      h('span', { className: `dshg-file-status dshg-file-status-${status}` }, status),
      h('span', { className: 'dshg-detail-file-main' },
        h('span', { className: 'dshg-detail-file-name' }, name),
        dir ? h('span', { className: 'dshg-detail-file-dir' }, dir) : null),
      file.binary
        ? h('span', { className: 'dshg-detail-file-stats' }, t('binaryFile'))
        : h('span', { className: 'dshg-detail-file-stats' },
            h('span', { className: 'dshg-add' }, `+${file.additions}`),
            h('span', { className: 'dshg-del' }, `−${file.deletions}`)));
    }

    /**
     * Right pane commit card, modelled on ZCode/Zed: author block, metadata
     * rows (email, hash, remote link), message, changed files, then the patch.
     */
    function CommitDetailView({
      commitDetail, detailFile, detailFileDiff, detailFileLoading,
      onBack, onSelectFile, onCopy,
    }) {
      const files = commitDetail.files || [];
      const stats = commitDetail.stats || { files: files.length, additions: 0, deletions: 0 };
      const patchText = detailFile ? (detailFileDiff ? detailFileDiff.patch : '') : commitDetail.patch;
      const web = commitDetail.webUrl || null;
      const webHost = web ? web.host.replace(/^www\./, '') : '';
      return h('div', { className: 'dshg-detail' },
        h('div', { className: 'dshg-detail-head' },
          h('span', { className: 'dshg-pane-title' }, t('commitDetail')),
          h('span', { className: 'dshg-spacer' }),
          h('button', {
            type: 'button',
            className: 'dshg-iconbtn',
            title: t('close'),
            'aria-label': t('close'),
            onClick: onBack,
          }, h(IconClose, { size: 14 }))),
        h('div', { className: 'dshg-detail-scroll' },
          h('div', { className: 'dshg-detail-card' },
            h('div', { className: 'dshg-avatar', 'aria-hidden': true }, avatarInitials(commitDetail.author)),
            h('div', { className: 'dshg-detail-author' }, commitDetail.author || '—'),
            h('div', { className: 'dshg-detail-date', title: formatTime(commitDetail.timestamp) },
              formatCommitDate(commitDetail.timestamp)),
            h('div', { className: 'dshg-meta-list' },
              commitDetail.email ? h('div', { className: 'dshg-meta-row' },
                h(IconMail, { size: 12 }),
                h('span', { className: 'dshg-meta-text', title: commitDetail.email }, commitDetail.email)) : null,
              h('div', { className: 'dshg-meta-row' },
                h('span', { className: 'dshg-meta-hash' }, '#'),
                h('span', { className: 'dshg-meta-text dshg-meta-mono', title: commitDetail.sha }, commitDetail.sha),
                h('button', {
                  type: 'button',
                  className: 'dshg-meta-copy',
                  title: t('copy'),
                  'aria-label': t('copy'),
                  onClick: () => onCopy(commitDetail.sha),
                }, h(IconCopy, { size: 12 }))),
              (commitDetail.parents || []).length > 0 ? h('div', { className: 'dshg-meta-row' },
                h(IconBranch, { size: 12 }),
                h('span', { className: 'dshg-meta-text dshg-meta-mono', title: (commitDetail.parents || []).join(' ') },
                  (commitDetail.parents || []).map((parent) => parent.slice(0, 7)).join(' · '))) : null,
              web ? h('a', {
                className: 'dshg-meta-row dshg-meta-link',
                href: web.url,
                target: '_blank',
                rel: 'noreferrer noopener',
                title: web.url,
              }, h(IconExternal, { size: 12 }),
                h('span', { className: 'dshg-meta-text' }, tf('viewOnHost', { host: webHost }))) : null),
            h('div', { className: 'dshg-detail-subject' }, commitDetail.subject),
            commitDetail.body ? h('pre', { className: 'dshg-detail-body' }, commitDetail.body) : null,
            h('div', { className: 'dshg-detail-files-head' },
              h('span', null, tf('changedFilesCount', { count: stats.files })),
              h('span', { className: 'dshg-spacer' }),
              h('button', {
                type: 'button',
                className: cx('dshg-menu-action', !detailFile && 'active'),
                onClick: () => onSelectFile(null),
              }, t('allFiles'))),
            files.length > 0 ? h('div', { className: 'dshg-detail-files' }, files.map((file) => h(CommitFileRow, {
              key: file.path,
              file,
              active: detailFile === file.path,
              onClick: () => onSelectFile(file.path),
            }))) : null),
          h('div', { className: 'dshg-detail-diff' },
            detailFileLoading
              ? h('div', { className: 'dshg-empty dshg-empty-inline' }, t('loading'))
              : h(DiffText, { text: patchText, emptyText: t('diffEmpty') })),
          commitDetail.truncated && !detailFile
            ? h('div', { className: 'dshg-truncated' }, t('patchTruncated'))
            : null));
    }
    function CommitBar({
      status, message, setMessage, amend, setAmend, signoff, setSignoff, busy, onCommit,
    }) {
      if (!status || !status.isRepo || status.isBare) return null;
      const hasStaged = status.counts.staged > 0;
      const hasTracked = status.entries.some((entry) => entry.kind !== 'untracked' && entry.kind !== 'ignored');
      const conflicts = status.counts.conflicts > 0;
      const canCommit = message.trim().length > 0 && !conflicts && !busy && (hasStaged || hasTracked);
      const title = hasStaged ? t('commit') : t('commitTracked');
      return h('div', { className: 'dshg-commit-bar' },
        h('div', { className: 'dshg-commit-inner' },
          conflicts ? h('div', { className: 'dshg-warning' }, t('conflictWarning')) : null,
          h('textarea', {
            className: 'dshg-textarea',
            value: message,
            placeholder: t('emptyMessage'),
            onChange: (event) => setMessage(event.target.value),
            rows: 2,
            spellCheck: false,
          }),
          h('div', { className: 'dshg-commit-actions' },
            h('button', {
              type: 'button',
              className: cx('dshg-option', amend && 'active'),
              onClick: () => setAmend(!amend),
              disabled: !status.hasCommits,
              role: 'checkbox',
              'aria-checked': amend ? 'true' : 'false',
            }, amend ? '✓' : '○', t('amend')),
            h('button', {
              type: 'button',
              className: cx('dshg-option', signoff && 'active'),
              onClick: () => setSignoff(!signoff),
              role: 'checkbox',
              'aria-checked': signoff ? 'true' : 'false',
            }, signoff ? '✓' : '○', t('signoff')),
            h('span', { className: 'dshg-spacer' }),
            h('span', { className: 'dshg-commit-hint' }, t('shortcuts')),
            h('button', {
              type: 'button',
              className: 'dshg-btn dshg-btn-brand dshg-commit-button',
              disabled: !canCommit,
              onClick: onCommit,
            }, busy ? t('committing') : title))));
    }

    /** Formatted expandable detail: ref moves get columns, raw Git output stays code. */
    function ToastDetail({ text }) {
      const lines = String(text || '').slice(0, 4000).split(/\r?\n/);
      return h('div', { className: 'dshg-toast-detail-body' },
        lines.map((line, index) => {
          const move = /^(.+?)\s{2}([0-9a-f]{7,64})\s*→\s*([0-9a-f]{7,64})$/.exec(line);
          if (move) {
            return h('div', { className: 'dshg-toast-ref', key: index },
              h('span', { className: 'dshg-toast-ref-name', title: move[1] }, move[1]),
              h('span', { className: 'dshg-toast-ref-oid' }, move[2]),
              h('span', { className: 'dshg-toast-ref-arrow' }, '→'),
              h('span', { className: 'dshg-toast-ref-oid' }, move[3]));
          }
          if (line === '') return h('div', { className: 'dshg-toast-detail-gap', key: index });
          return h('div', { className: 'dshg-toast-detail-line', key: index }, line);
        }));
    }

    function Toast({ toast, onClose }) {
      if (!toast) return null;
      return h('div', { className: cx('dshg-toast', toast.kind === 'error' ? 'error' : 'success'), role: toast.kind === 'error' ? 'alert' : 'status' },
        h('div', { className: 'dshg-toast-main' },
          h('div', { className: 'dshg-toast-text' }, toast.text),
          toast.detail ? h('details', { className: 'dshg-toast-details' },
            h('summary', null, t('details')),
            h(ToastDetail, { text: toast.detail })) : null),
        h('button', { type: 'button', className: 'dshg-iconbtn', onClick: onClose, 'aria-label': t('close') },
          h(IconClose, { size: 13 })));
    }

    /**
     * Cold-start placeholder in the panel's own three-pane shape, so the first
     * frame reads as "layout, filling in" rather than an empty box with a
     * spinner. It only ever shows when there is no seed to paint.
     */
    function GitSkeleton() {
      const bars = (count, key) => Array.from({ length: count }, (_, index) => h('div', {
        key: `${key}-${index}`,
        className: 'dshg-skeleton-row',
      }, h('span', {
        className: 'dshg-skeleton-bar',
        style: { width: `${38 + ((index * 19) % 52)}%` },
      })));
      return h('div', { className: 'dshg-skeleton', 'aria-hidden': 'true' },
        h('div', { className: 'dshg-skeleton-col' },
          h('div', { className: 'dshg-skeleton-head' }),
          bars(7, 'changes')),
        h('div', { className: 'dshg-skeleton-col' },
          h('div', { className: 'dshg-skeleton-head' }),
          bars(9, 'history')),
        h('div', { className: 'dshg-skeleton-col' },
          h('div', { className: 'dshg-skeleton-head' }),
          bars(6, 'diff')));
    }
