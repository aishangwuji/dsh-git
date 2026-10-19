window.__ModuleLoader__.load({
  id: '@local/dsh-git-panel',
  factory(require) {
    const React = require('react');
    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    const h = React.createElement;

    const NS = 'dsh.git';
    const RPC_PATH = '/dsh-git-6b1e/rpc';
    const GRAPH_COLORS = [
      'var(--dsw-alias-brand-primary, #3b82f6)',
      'var(--dsw-alias-state-success-primary, #22c55e)',
      'var(--dsw-alias-state-warn-primary, #eab308)',
      'var(--dsw-alias-state-error-primary, #ef4444)',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#ec4899',
    ];

    let t = (key) => key;

    const zh = {
      panel: 'Git 工作台',
      git: 'Git',
      changes: '更改',
      history: '历史',
      stageAll: '全部暂存',
      unstageAll: '全部取消',
      noChanges: '工作区没有未提交的更改',
      selectFile: '选择左侧文件查看 diff',
      noWorkspace: '没有可用的工作区',
      notRepo: '当前工作区还不是 Git 仓库',
      notRepoDesc: '初始化后即可在这里查看文件状态、提交与历史。',
      init: '初始化 Git 仓库',
      initializing: '正在初始化…',
      refresh: '刷新',
      refreshShort: '刷新状态',
      fetch: '获取',
      pull: '拉取',
      push: '推送',
      commit: '提交',
      commitTracked: '提交已跟踪更改',
      committing: '正在提交…',
      committed: '已提交',
      amend: '修正上一条提交',
      signoff: '添加 Signed-off-by',
      conflictWarning: '存在未解决的冲突，解决并暂存后才能提交',
      emptyMessage: '请填写提交信息',
      files: '个文件',
      stage: '暂存',
      unstage: '取消暂存',
      stagedCount: '已暂存 {count} 项',
      unstagedCount: '未暂存 {count} 项',
      stageDone: '已暂存 {count} 个文件',
      unstageDone: '已取消暂存 {count} 个文件',
      diffEmpty: '没有可显示的差异',
      untrackedDiff: '未跟踪文件还没有 diff，暂存后即可查看',
      workingTree: '工作区',
      stagedTab: '已暂存',
      changesTab: '更改',
      filterPlaceholder: '筛选文件…',
      loading: '加载中…',
      graphEmpty: '还没有提交',
      graphEmptyDesc: '提交第一个更改后，提交图会显示在这里。',
      bareRepo: '裸仓库暂不支持工作区操作',
      bareRepoDesc: '当前工作区是 bare 仓库，只能读取历史，不能暂存或提交。',
      detached: 'HEAD 分离',
      ahead: '领先',
      behind: '落后',
      copy: '复制 SHA',
      copied: '已复制',
      close: '关闭',
      details: '详情',
      back: '返回',
      commitDetail: '提交详情',
      patchTruncated: '内容过长，已截断',
      shortcuts: '快捷键：Ctrl+Enter 提交 · Alt+S 暂存全部 · Alt+Shift+S 取消暂存 · Alt+G 后 F/P/L 获取/推送/拉取',
      noRemote: '没有远程仓库',
      error: '操作失败',
      filesChanged: '{count} 个文件',
      selectWorkspace: '工作区',
      statusClean: '工作区干净',
      statusCleanDesc: '没有需要提交的更改。',
      kindAdded: '新增',
      kindModified: '修改',
      kindDeleted: '删除',
      kindUntracked: '未跟踪',
      kindConflict: '冲突',
      kindIgnored: '忽略',
      kindRenamed: '重命名',
      statusAria: '{kind}：{path}',
      stageAria: '暂存 {path}',
      unstageAria: '取消暂存 {path}',
      err_GIT_MISSING: 'Git 未安装或不在 PATH 中',
      err_WORKSPACE_REQUIRED: '缺少工作区',
      err_WORKSPACE_NOT_FOUND: '该路径不是已注册的工作区',
      err_STATUS_FAILED: '读取 Git 状态失败',
      err_REPO_ROOT_FAILED: '无法确定仓库根目录',
      err_GIT_TIMEOUT: 'Git 操作超时',
      err_CANCELLED: '操作已取消',
      err_GIT_SPAWN_FAILED: '无法启动 Git',
      err_GIT_FAILED: 'Git 进程失败',
      err_INVALID_PATH: '文件路径不合法',
      err_INVALID_REF: '分支名不合法',
      err_INVALID_REMOTE: '远程名不合法',
      err_INVALID_SHA: '提交 SHA 不合法',
      err_NOT_A_REPO: '当前工作区不是 Git 仓库',
      err_BODY_TOO_LARGE: '请求体过大',
      err_BAD_REQUEST: '请求格式错误',
      err_UNKNOWN_OP: '未知操作',
      err_STAGE_FAILED: '暂存失败',
      err_UNSTAGE_FAILED: '取消暂存失败',
      err_EMPTY_MESSAGE: '提交信息不能为空',
      err_IDENTITY_MISSING: '请先配置 Git 的 user.name 与 user.email',
      err_NOTHING_TO_COMMIT: '没有可提交的更改',
      err_NOTHING_TO_AMEND: '尚无提交可以修正',
      err_COMMIT_FAILED: '提交失败',
      err_NO_REMOTE: '没有配置远程仓库',
      err_NON_FAST_FORWARD: '远端包含本地没有的提交，请先拉取',
      err_AUTH_FAILED: '认证失败，请先在终端配置凭据或 ssh-agent',
      err_PULL_CONFLICT: '拉取产生冲突，请先解决冲突',
      err_REMOTE_NOT_FOUND: '远程仓库不存在或不可访问',
      err_GIT_COMMAND_FAILED: 'Git 命令失败',
      err_DETACHED_HEAD: '分离 HEAD 状态下无法执行该操作',
      err_INIT_FAILED: '初始化仓库失败',
      err_COMMIT_NOT_FOUND: '提交不存在',
      err_DIFF_FAILED: '读取 diff 失败',
      err_INTERNAL: '内部错误',
      err_METHOD_NOT_ALLOWED: '不支持的请求方法',
      err_ORIGIN_REJECTED: '请求来源不被允许',
      err_MESSAGE_TOO_LARGE: '提交信息过长',
      err_INVALID_MESSAGE: '提交信息包含非法字符',
      err_UNKNOWN: '操作失败',
    };

    const en = {
      panel: 'Git Workbench',
      git: 'Git',
      changes: 'Changes',
      history: 'History',
      stageAll: 'Stage all',
      unstageAll: 'Unstage all',
      noChanges: 'No uncommitted changes',
      selectFile: 'Select a file to view its diff',
      noWorkspace: 'No workspace available',
      notRepo: 'This workspace is not a Git repository',
      notRepoDesc: 'Initialize Git to see file status, commits, and history here.',
      init: 'Initialize repository',
      initializing: 'Initializing…',
      refresh: 'Refresh',
      refreshShort: 'Refresh status',
      fetch: 'Fetch',
      pull: 'Pull',
      push: 'Push',
      commit: 'Commit',
      commitTracked: 'Commit tracked changes',
      committing: 'Committing…',
      committed: 'Committed',
      amend: 'Amend previous commit',
      signoff: 'Add Signed-off-by',
      conflictWarning: 'Resolve and stage all conflicts before committing',
      emptyMessage: 'Enter a commit message',
      files: 'files',
      stage: 'Stage',
      unstage: 'Unstage',
      stagedCount: '{count} staged',
      unstagedCount: '{count} unstaged',
      stageDone: 'Staged {count} files',
      unstageDone: 'Unstaged {count} files',
      diffEmpty: 'No diff to show',
      untrackedDiff: 'Untracked files have no diff until staged',
      workingTree: 'Working tree',
      stagedTab: 'Staged',
      changesTab: 'Changes',
      filterPlaceholder: 'Filter files…',
      loading: 'Loading…',
      graphEmpty: 'No commits yet',
      graphEmptyDesc: 'The commit graph appears after your first commit.',
      bareRepo: 'Bare repositories are read-only here',
      bareRepoDesc: 'This workspace is a bare repository; history is visible but staging and commits are disabled.',
      detached: 'HEAD detached',
      ahead: 'ahead',
      behind: 'behind',
      copy: 'Copy SHA',
      copied: 'Copied',
      close: 'Close',
      details: 'Details',
      back: 'Back',
      commitDetail: 'Commit detail',
      patchTruncated: 'Output truncated',
      shortcuts: 'Shortcuts: Ctrl+Enter commit · Alt+S stage all · Alt+Shift+S unstage all · Alt+G then F/P/L fetch/push/pull',
      noRemote: 'No remote configured',
      error: 'Operation failed',
      filesChanged: '{count} files',
      selectWorkspace: 'Workspace',
      statusClean: 'Working tree clean',
      statusCleanDesc: 'Nothing to commit.',
      kindAdded: 'Added',
      kindModified: 'Modified',
      kindDeleted: 'Deleted',
      kindUntracked: 'Untracked',
      kindConflict: 'Conflict',
      kindIgnored: 'Ignored',
      kindRenamed: 'Renamed',
      statusAria: '{kind}: {path}',
      stageAria: 'Stage {path}',
      unstageAria: 'Unstage {path}',
      err_GIT_MISSING: 'Git is not installed or not on PATH',
      err_WORKSPACE_REQUIRED: 'Workspace is required',
      err_WORKSPACE_NOT_FOUND: 'That path is not a registered workspace',
      err_STATUS_FAILED: 'Could not read Git status',
      err_REPO_ROOT_FAILED: 'Could not determine the repository root',
      err_GIT_TIMEOUT: 'Git operation timed out',
      err_CANCELLED: 'Operation cancelled',
      err_GIT_SPAWN_FAILED: 'Could not start Git',
      err_GIT_FAILED: 'Git process failed',
      err_INVALID_PATH: 'Invalid file path',
      err_INVALID_REF: 'Invalid branch name',
      err_INVALID_REMOTE: 'Invalid remote name',
      err_INVALID_SHA: 'Invalid commit SHA',
      err_NOT_A_REPO: 'This workspace is not a Git repository',
      err_BODY_TOO_LARGE: 'Request body too large',
      err_BAD_REQUEST: 'Malformed request',
      err_UNKNOWN_OP: 'Unknown operation',
      err_STAGE_FAILED: 'Could not stage paths',
      err_UNSTAGE_FAILED: 'Could not unstage paths',
      err_EMPTY_MESSAGE: 'Commit message is required',
      err_IDENTITY_MISSING: 'Configure Git user.name and user.email first',
      err_NOTHING_TO_COMMIT: 'Nothing to commit',
      err_NOTHING_TO_AMEND: 'There is no commit to amend',
      err_COMMIT_FAILED: 'Commit failed',
      err_NO_REMOTE: 'No remote configured',
      err_NON_FAST_FORWARD: 'The remote has commits you do not have; pull first',
      err_AUTH_FAILED: 'Authentication failed; configure credentials or ssh-agent first',
      err_PULL_CONFLICT: 'Pull produced conflicts; resolve them first',
      err_REMOTE_NOT_FOUND: 'Remote repository not found or unreachable',
      err_GIT_COMMAND_FAILED: 'Git command failed',
      err_DETACHED_HEAD: 'This operation is unavailable on a detached HEAD',
      err_INIT_FAILED: 'Could not initialize repository',
      err_COMMIT_NOT_FOUND: 'Commit not found',
      err_DIFF_FAILED: 'Could not read diff',
      err_INTERNAL: 'Internal error',
      err_METHOD_NOT_ALLOWED: 'Method not allowed',
      err_ORIGIN_REJECTED: 'Request origin is not allowed',
      err_MESSAGE_TOO_LARGE: 'Commit message is too long',
      err_INVALID_MESSAGE: 'Commit message contains invalid characters',
      err_UNKNOWN: 'Operation failed',
    };

    function tf(key, vars) {
      let text = String(t(key));
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    }

    function errorText(error) {
      const code = error && error.code ? error.code : 'UNKNOWN';
      const key = `err_${code}`;
      const translated = t(key);
      if (translated !== key) return translated;
      return (error && error.message) || t('err_UNKNOWN');
    }

    function cx(...values) {
      return values.filter(Boolean).join(' ');
    }

    function basename(path) {
      const index = path.lastIndexOf('/');
      return index === -1 ? path : path.slice(index + 1);
    }

    function formatTime(timestamp) {
      if (!timestamp) return '';
      try {
        return new Date(timestamp * 1000).toLocaleString(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return '';
      }
    }

    function readStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function writeStorage(key, value) {
      try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Private mode or a storage quota failure must not break the panel.
      }
    }

    async function rpc(op, payload) {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.code = 'INTERNAL';
        throw error;
      }
      const json = await response.json();
      if (!json.ok) {
        const error = new Error(json.error && json.error.message ? json.error.message : 'Git operation failed');
        error.code = json.error && json.error.code ? json.error.code : 'UNKNOWN';
        error.detail = json.error && json.error.detail ? json.error.detail : null;
        throw error;
      }
      return json.value;
    }

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

    function IconClose(props) {
      return h(Svg, props, h('path', { d: 'M6 6l12 12M18 6 6 18' }));
    }

    function IconCopy(props) {
      return h(Svg, props, h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }));
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
        ? (event) => {
            event.preventDefault();
            event.stopPropagation();
            openPanel();
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
            const next = await rpc('status', { workspace: picked.path });
            if (!alive) return;
            if (!next.isRepo || next.isBare) {
              setSummary(null);
              return;
            }
            const entries = next.entries || [];
            const byKind = (kinds) => entries.filter((entry) => kinds.includes(entry.kind)).length;
            setSummary({
              branch: next.branch,
              changed: next.counts.changed,
              conflicts: next.counts.conflicts,
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
        title: `${summary.branch || t('detached')} · ${tf('filesChanged', { count: summary.changed })}`,
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
      return root;
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

    function renderTreeRows({
      node, depth, section, expanded, onToggleExpand, onSelect, onOpen, onToggleFile, onToggleDir,
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
          onClick: () => onToggleExpand(key),
        },
        h('span', { className: 'dshg-chevron' }, isOpen ? '▾' : '▸'),
        h(IconFolder, { size: 14, className: 'dshg-dir-icon' }),
        h('span', { className: 'dshg-dir-name' }, dir.name),
        h('span', { className: `dshg-dot dshg-dot-${aggregate}` }),
        h('span', { className: 'dshg-dir-count' }, files.length),
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
          title: entry.path,
          onClick: () => onSelect(entry, section),
          onDoubleClick: () => onOpen(entry, section),
        },
        h(StatusBadge, { entry }),
        h('span', {
          className: cx('dshg-file-name', `dshg-st-${KIND_CLASS[entry.kind] || 'modified'}`),
          'aria-label': tf('statusAria', { kind: kindLabel(entry.kind), path: entry.path }),
        }, basename(entry.path)),
        entry.partial ? h('span', { className: 'dshg-partial-mark', title: t('stagedTab') }, '◐') : null,
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

    function DiffText({ text, emptyText }) {
      if (!text) {
        return h('div', { className: 'dshg-empty dshg-empty-inline' }, emptyText || t('diffEmpty'));
      }
      const lines = text.split('\n');
      const shown = lines.slice(0, 4000);
      return h('div', { className: 'dshg-diff-wrap' },
        h('pre', { className: 'dshg-diff' }, shown.map((line, index) => {
          let kind = '';
          if (line.startsWith('@@')) kind = 'hunk';
          else if (line.startsWith('+++') || line.startsWith('---')) kind = 'meta';
          else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) kind = 'meta';
          else if (line.startsWith('+')) kind = 'add';
          else if (line.startsWith('-')) kind = 'del';
          return h('div', { key: index, className: cx('dshg-line', kind && `dshg-line-${kind}`) }, line || ' ');
        })),
        lines.length > shown.length ? h('div', { className: 'dshg-truncated' }, t('patchTruncated')) : null);
    }

    function EmptyState({ icon, title, description, action }) {
      return h('div', { className: 'dshg-empty' },
        icon ? h('div', { className: 'dshg-empty-icon' }, icon) : null,
        h('div', { className: 'dshg-empty-title' }, title),
        description ? h('div', { className: 'dshg-empty-desc' }, description) : null,
        action || null);
    }

    function PanelHeader({
      workspaces, workspace, status, busy, onWorkspace, onRefresh, onFetch, onPull, onPush,
    }) {
      const branchLabel = status && status.isRepo
        ? status.isBare ? t('bareRepo') : status.detached ? t('detached') : status.branch || '—'
        : null;
      return h('div', { className: 'dshg-header' },
        h('div', { className: 'dshg-brand' }, h(GitGlyph, { size: 18 }), h('span', null, t('git'))),
        workspaces.length > 1 ? h('select', {
          className: 'dshg-select',
          value: workspace,
          onChange: (event) => onWorkspace(event.target.value),
          'aria-label': t('selectWorkspace'),
        }, workspaces.map((item) => h('option', { key: item.id, value: item.path }, item.title || item.path))) : null,
        branchLabel ? h('span', { className: 'dshg-chip', title: status.repoRoot || '' },
          h(IconBranch, { size: 13 }),
          h('strong', null, branchLabel),
          status.ahead > 0 ? h('span', { className: 'dshg-ahead' }, `↑${status.ahead}`) : null,
          status.behind > 0 ? h('span', { className: 'dshg-behind' }, `↓${status.behind}`) : null) : null,
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
      onStageAll, onUnstageAll,
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
            h('span', null, t('changesTab')),
            h('span', { className: 'dshg-count' }, unstagedEntries.length)),
          h('div', { className: 'dshg-tree' }, renderTreeRows({
            node: buildTree(unstagedEntries),
            depth: 0,
            section: 'changes',
            expanded,
            onToggleExpand,
            onSelect,
            onOpen,
            onToggleFile,
            onToggleDir,
          }))));
      }

      return h('div', { className: 'dshg-sections' },
        h('div', { className: 'dshg-left-actions' },
          h('button', { type: 'button', className: 'dshg-btn dshg-btn-small', onClick: onStageAll }, t('stageAll')),
          h('button', { type: 'button', className: 'dshg-btn dshg-btn-small', onClick: onUnstageAll }, t('unstageAll'))),
        sections);
    }

    function DiffView({ selected, diff, diffLoading, onMode, onClose }) {
      if (!selected) {
        return h(EmptyState, {
          icon: h(GitGlyph, { size: 28 }),
          title: t('selectFile'),
        });
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

    function HistoryView({
      graph, graphLoading, commitDetail, detailLoading, onSelectCommit, onCloseDetail, onCopy,
    }) {
      const rows = useMemo(() => layoutGraph(graph || []), [graph]);
      const maxLanes = useMemo(() => {
        let max = 1;
        for (const row of rows) {
          max = Math.max(max, row.before.length, row.after.length, ...row.parentLanes.map((lane) => lane + 1));
        }
        return max;
      }, [rows]);

      if (detailLoading && !commitDetail) {
        return h('div', { className: 'dshg-empty' }, t('loading'));
      }

      if (commitDetail) {
        return h('div', { className: 'dshg-detail' },          h('div', { className: 'dshg-detail-head' },
            h('button', { type: 'button', className: 'dshg-btn dshg-btn-small', onClick: onCloseDetail }, `← ${t('back')}`),
            h('span', { className: 'dshg-detail-sha' }, commitDetail.sha.slice(0, 10)),
            h('button', {
              type: 'button', className: 'dshg-btn dshg-btn-small',
              onClick: () => onCopy(commitDetail.sha),
            }, h(IconCopy, { size: 13 }), t('copy'))),
          h('div', { className: 'dshg-detail-subject' }, commitDetail.subject),
          h('div', { className: 'dshg-detail-meta' },
            h('span', null, commitDetail.author),
            h('span', null, formatTime(commitDetail.timestamp))),
          commitDetail.body ? h('pre', { className: 'dshg-detail-body' }, commitDetail.body) : null,
          h('div', { className: 'dshg-detail-patch' }, h(DiffText, { text: commitDetail.patch, emptyText: t('diffEmpty') })),
          commitDetail.truncated ? h('div', { className: 'dshg-truncated' }, t('patchTruncated')) : null);
      }

      if (graphLoading && !graph) {
        return h('div', { className: 'dshg-empty' }, t('loading'));
      }
      if (!graph || graph.length === 0) {
        return h(EmptyState, {
          icon: h(IconBranch, { size: 28 }),
          title: t('graphEmpty'),
          description: t('graphEmptyDesc'),
        });
      }

      return h('div', { className: 'dshg-history' },
        rows.map((row) => h('div', {
          key: row.sha,
          className: 'dshg-commit-row',
          role: 'button',
          tabIndex: 0,
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
          h('div', { className: 'dshg-commit-subject' }, row.subject || '(no subject)'),
          h('div', { className: 'dshg-commit-meta' },
            (row.refs || []).map((ref, index) => h('span', {
              key: `${ref}-${index}`,
              className: cx('dshg-ref', ref.startsWith('HEAD ->') && 'head', ref.startsWith('tag:') && 'tag'),
            }, ref)),
            h('span', null, row.author),
            h('span', null, formatTime(row.timestamp)))),
        h('span', { className: 'dshg-sha' }, row.sha.slice(0, 7)))));
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
          }, busy ? t('committing') : title)));
    }

    function Toast({ toast, onClose }) {
      if (!toast) return null;
      return h('div', { className: cx('dshg-toast', toast.kind === 'error' ? 'error' : 'success'), role: toast.kind === 'error' ? 'alert' : 'status' },
        h('div', { className: 'dshg-toast-main' },
          h('div', { className: 'dshg-toast-text' }, toast.text),
          toast.detail ? h('details', { className: 'dshg-toast-details' },
            h('summary', null, t('details')),
            h('pre', null, String(toast.detail).slice(0, 4000))) : null),
        h('button', { type: 'button', className: 'dshg-iconbtn', onClick: onClose, 'aria-label': t('close') },
          h(IconClose, { size: 13 })));
    }

    function GitPanel() {
      const rootRef = useRef(null);
      const busyRef = useRef(false);
      const statusSeq = useRef(0);
      const prefixTimer = useRef(null);
      const draftTimer = useRef(null);
      const [workspaces, setWorkspaces] = useState([]);
      const [workspace, setWorkspace] = useState('');
      const [status, setStatus] = useState(null);
      const [loading, setLoading] = useState(true);
      const [busy, setBusy] = useState('');
      const [toast, setToast] = useState(null);
      const [tab, setTab] = useState('changes');
      const [expanded, setExpanded] = useState({});
      const [selected, setSelected] = useState(null);
      const [diff, setDiff] = useState(null);
      const [diffLoading, setDiffLoading] = useState(false);
      const [graph, setGraph] = useState(null);
      const [graphLoading, setGraphLoading] = useState(false);
      const [graphVersion, setGraphVersion] = useState(0);
      const [commitDetail, setCommitDetail] = useState(null);
      const [detailLoading, setDetailLoading] = useState(false);
      const [message, setMessage] = useState('');
      const [amend, setAmend] = useState(false);
      const [signoff, setSignoff] = useState(false);
      const [prefix, setPrefix] = useState(false);

      const refreshStatus = useCallback(async (targetWorkspace, spinner = false) => {
        if (!targetWorkspace) return;
        const seq = ++statusSeq.current;
        if (spinner) setLoading(true);
        try {
          const next = await rpc('status', { workspace: targetWorkspace });
          if (seq === statusSeq.current) {
            setStatus(next);
            setLoading(false);
          }
        } catch (error) {
          if (seq === statusSeq.current) {
            setLoading(false);
            setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          }
        }
      }, []);

      const loadDiff = useCallback(async (targetWorkspace, path, mode) => {
        if (!targetWorkspace || !path) return;
        setDiffLoading(true);
        setDiff(null);
        try {
          const next = await rpc('diff', { workspace: targetWorkspace, path, staged: mode === 'staged' });
          setDiff(next);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDiffLoading(false);
        }
      }, []);

      const loadGraph = useCallback(async (targetWorkspace) => {
        if (!targetWorkspace) return;
        const next = await rpc('graph', { workspace: targetWorkspace });
        setGraph(next.commits || []);
      }, []);

      const act = useCallback(async (label, operation) => {
        if (busyRef.current) return null;
        busyRef.current = true;
        setBusy(label);
        setToast(null);
        try {
          const result = await operation();
          if (result && result.message) setToast({ kind: 'success', text: result.message });
          return result;
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          return null;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, []);

      useEffect(() => {
        let alive = true;
        rpc('workspaces').then((list) => {
          if (!alive) return;
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

      useEffect(() => {
        if (!workspace) return;
        setStatus(null);
        setLoading(true);
        setSelected(null);
        setDiff(null);
        setCommitDetail(null);
        setGraph(null);
        setExpanded({});
        setAmend(false);
        setSignoff(false);
        setGraphVersion((value) => value + 1);
        refreshStatus(workspace, false);
        const timer = setInterval(() => {
          if (busyRef.current) return;
          if (document.visibilityState === 'hidden') return;
          refreshStatus(workspace, false);
        }, 5000);
        return () => clearInterval(timer);
      }, [workspace, refreshStatus]);

      useEffect(() => {
        if (!workspace) return;
        if (draftTimer.current) clearTimeout(draftTimer.current);
        const draftKey = `dsh-git.draft:${workspace}`;
        setMessage(readStorage(draftKey) || '');
      }, [workspace]);

      useEffect(() => {
        if (!workspace || tab !== 'history') return;
        let alive = true;
        setGraphLoading(true);
        loadGraph(workspace).then(() => {
          if (alive) setGraphLoading(false);
        }).catch((error) => {
          if (!alive) return;
          setGraphLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        });
        return () => { alive = false; };
      }, [workspace, tab, graphVersion, loadGraph]);

      useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 9000 : 4500);
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
        await refreshStatus(workspace, false);
        if (includeGraph) setGraphVersion((value) => value + 1);
        if (selected) await loadDiff(workspace, selected.path, selected.mode);
      }, [workspace, selected, refreshStatus, loadDiff]);

      const stage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('stage'), async () => {
          await rpc('stage', { workspace, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('stageDone', { count: unique.length }) };
        });
      }, [workspace, act, reloadAfterMutation]);

      const unstage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('unstage'), async () => {
          await rpc('unstage', { workspace, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('unstageDone', { count: unique.length }) };
        });
      }, [workspace, act, reloadAfterMutation]);

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
        setTab('changes');
        loadDiff(workspace, entry.path, mode);
      }, [workspace, loadDiff]);

      const openFile = useCallback((entry, section) => {
        const mode = section === 'staged' ? 'staged' : entry.partial ? 'staged' : 'unstaged';
        setSelected({ path: entry.path, mode, entry });
        setTab('changes');
        loadDiff(workspace, entry.path, mode);
      }, [workspace, loadDiff]);

      const switchDiffMode = useCallback((mode) => {
        if (!selected) return;
        setSelected({ ...selected, mode });
        loadDiff(workspace, selected.path, mode);
      }, [selected, workspace, loadDiff]);

      const initRepository = useCallback(async () => {
        await act(t('initializing'), async () => {
          const next = await rpc('init', { workspace });
          setStatus(next);
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
            message,
            amend,
            signoff,
          });
          if (draftTimer.current) clearTimeout(draftTimer.current);
          setMessage('');
          writeStorage(`dsh-git.draft:${workspace}`, null);
          setAmend(false);
          setSignoff(false);
          await refreshStatus(workspace, false);
          setGraphVersion((value) => value + 1);
          return { message: `${t('committed')} ${result.sha || ''}`.trim() };
        });
      }, [status, message, amend, signoff, workspace, act, refreshStatus]);

      const fetchRemote = useCallback(async () => {
        await act(t('fetch'), async () => {
          await rpc('fetch', { workspace });
          await reloadAfterMutation(true);
          return { message: t('fetch') };
        });
      }, [workspace, act, reloadAfterMutation]);

      const pullRemote = useCallback(async () => {
        await act(t('pull'), async () => {
          await rpc('pull', { workspace });
          await reloadAfterMutation(true);
          return { message: t('pull') };
        });
      }, [workspace, act, reloadAfterMutation]);

      const pushRemote = useCallback(async () => {
        await act(t('push'), async () => {
          await rpc('push', { workspace });
          await reloadAfterMutation(true);
          return { message: t('push') };
        });
      }, [workspace, act, reloadAfterMutation]);

      const openCommit = useCallback(async (sha) => {
        setDetailLoading(true);
        setCommitDetail(null);
        try {
          const detail = await rpc('commit-detail', { workspace, sha });
          setCommitDetail(detail);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDetailLoading(false);
        }
      }, [workspace]);

      const copyText = useCallback(async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          setToast({ kind: 'success', text: t('copied') });
        } catch {
          setToast({ kind: 'error', text: t('copy') });
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
          else if (key === 'h') { event.preventDefault(); setTab('history'); }
        }
      }, [commit, stageAll, unstageAll, prefix, fetchRemote, pushRemote, pullRemote]);

      const hasRepo = Boolean(status && status.isRepo && !status.isBare);
      const isBare = Boolean(status && status.isRepo && status.isBare);

      return h('div', {
        ref: rootRef,
        className: 'dshg-root',
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        'aria-label': t('panel'),
        'aria-busy': busy ? 'true' : 'false',
      },
      h(PanelHeader, {
        workspaces,
        workspace,
        status,
        busy,
        onWorkspace: (next) => {
          setWorkspace(next);
          writeStorage('dsh-git.workspace', next);
        },
        onRefresh: () => refreshStatus(workspace, true),
        onFetch: fetchRemote,
        onPull: pullRemote,
        onPush: pushRemote,
      }),
      h(Toast, { toast, onClose: () => setToast(null) }),
      busy ? h('div', { className: 'dshg-progress', 'aria-hidden': true }) : null,
      !workspace && !loading ? h(EmptyState, {
        icon: h(GitGlyph, { size: 30 }),
        title: t('noWorkspace'),
      }) : null,
      loading && !status ? h('div', { className: 'dshg-loading' }, t('loading')) : null,
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
        h('div', { className: 'dshg-left' },
          h('div', { className: 'dshg-pane-head' },
            h('span', { className: 'dshg-pane-title' }, t('changes')),
            h('span', { className: 'dshg-count' }, status.counts.changed),
            h('span', { className: 'dshg-spacer' })),
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
              onStageAll: stageAll,
              onUnstageAll: unstageAll,
            }))),
        h('div', { className: 'dshg-right' },
          h('div', { className: 'dshg-tabs' },
            h('button', {
              type: 'button',
              className: cx('dshg-tab', tab === 'changes' && 'active'),
              onClick: () => setTab('changes'),
            }, t('changesTab'), status.counts.changed > 0 ? h('span', { className: 'dshg-tab-count' }, status.counts.changed) : null),
            h('button', {
              type: 'button',
              className: cx('dshg-tab', tab === 'history' && 'active'),
              onClick: () => setTab('history'),
            }, t('history')),
            prefix ? h('span', { className: 'dshg-prefix-hint' }, 'G …') : null),
          h('div', { className: 'dshg-right-body' },
            tab === 'changes' ? h(DiffView, {
              selected,
              diff,
              diffLoading,
              onMode: switchDiffMode,
              onClose: () => { setSelected(null); setDiff(null); },
            }) : h(HistoryView, {
              graph,
              graphLoading,
              commitDetail,
              detailLoading,
              onSelectCommit: openCommit,
              onCloseDetail: () => setCommitDetail(null),
              onCopy: copyText,
            })))),
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
        })) : null);
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

    const CSS_TEXT = `
      .dshg-root {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
        background: var(--dsw-alias-bg-base, #fff);
        color: var(--dsw-alias-label-primary, #111);
        font: inherit;
        outline: none;
      }
      .dshg-root:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #2563eb); outline-offset: -2px; }
      .dshg-root button:focus-visible, .dshg-root textarea:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary, #2563eb);
        outline-offset: 1px;
      }
      .dshg-root *, .dshg-root *::before, .dshg-root *::after { box-sizing: border-box; }
      .dshg-header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 46px;
        padding: 0 12px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        flex: 0 0 auto;
        overflow: hidden;
      }
      .dshg-brand { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 650; white-space: nowrap; }
      .dshg-select {
        height: 26px; max-width: 220px; padding: 0 6px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        border-radius: 6px;
        background: var(--dsw-alias-bg-layer-1, #f8fafc);
        color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 12px;
      }
      .dshg-chip {
        display: inline-flex; align-items: center; gap: 4px;
        height: 24px; padding: 0 8px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f8fafc);
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 11px; white-space: nowrap; max-width: 260px;
      }
      .dshg-chip strong { color: var(--dsw-alias-label-primary, #111); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
      .dshg-ahead { color: var(--dsw-alias-state-success-primary, #16a34a); }
      .dshg-behind { color: var(--dsw-alias-state-warn-primary, #ca8a04); }
      .dshg-muted { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; }
      .dshg-spacer { flex: 1 1 auto; }
      .dshg-actions { display: flex; align-items: center; gap: 4px; }
      .dshg-btn, .dshg-iconbtn {
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        height: 28px; padding: 0 9px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        border-radius: 6px;
        background: transparent;
        color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
      }
      .dshg-btn:hover:not(:disabled), .dshg-iconbtn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-1, #f3f4f6); }
      .dshg-btn:disabled, .dshg-iconbtn:disabled { opacity: .45; cursor: default; }
      .dshg-btn-brand { border-color: var(--dsw-alias-brand-primary, #2563eb); color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-btn-small { height: 24px; padding: 0 7px; font-size: 11px; }
      .dshg-iconbtn { width: 28px; padding: 0; }
      .dshg-progress {
        position: absolute; top: 44px; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, transparent, var(--dsw-alias-brand-primary, #2563eb), transparent);
        background-size: 50% 100%; background-repeat: no-repeat;
        animation: dshg-progress 1.1s linear infinite;
        z-index: 4;
      }
      @keyframes dshg-progress { from { background-position: -50% 0; } to { background-position: 150% 0; } }
      .dshg-body { flex: 1 1 auto; display: flex; min-height: 0; }
      .dshg-left {
        width: 320px; flex: 0 0 auto; display: flex; flex-direction: column;
        min-height: 0; border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      .dshg-pane-head { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; flex: 0 0 auto; }
      .dshg-pane-title { font-size: 12px; font-weight: 650; }
      .dshg-count {
        min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f3f4f6);
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 10px; line-height: 18px; text-align: center;
      }
      .dshg-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .dshg-left-actions { display: flex; gap: 6px; padding: 2px 10px 8px; }
      .dshg-section { padding-bottom: 6px; }
      .dshg-section-head {
        display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
      }
      .dshg-tree { display: flex; flex-direction: column; }
      .dshg-row {
        display: flex; align-items: center; gap: 6px;
        min-height: 26px; padding-right: 8px;
        font-size: 12px; cursor: default; user-select: none;
      }
      .dshg-row:hover { background: var(--dsw-alias-bg-layer-1, #f8fafc); }
      .dshg-dir-row { color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-chevron { width: 12px; text-align: center; font-size: 10px; flex: 0 0 auto; }
      .dshg-dir-icon { flex: 0 0 auto; color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-dir-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary, #111); }
      .dshg-dir-count { margin-left: auto; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px; }
      .dshg-file-row { cursor: pointer; }
      .dshg-file-row:hover { background: var(--dsw-alias-bg-layer-1, #f8fafc); }
      .dshg-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-deleted-row .dshg-file-name { text-decoration: line-through; opacity: .82; }
      .dshg-partial-mark { color: var(--dsw-alias-state-warn-primary, #ca8a04); font-size: 10px; }
      .dshg-badge {
        flex: 0 0 auto; width: 16px; height: 16px; border-radius: 3px;
        font-size: 10px; font-weight: 800; line-height: 16px; text-align: center;
        background: rgba(127,127,127,.14);
        border: 1px solid currentColor;
      }
      @supports (background: color-mix(in srgb, red 10%, transparent)) {
        .dshg-badge { background: color-mix(in srgb, currentColor 14%, transparent); border-color: color-mix(in srgb, currentColor 30%, transparent); }
      }
      .dshg-st-added, .dshg-st-untracked { color: var(--dsw-alias-state-success-primary, #16a34a); }
      .dshg-st-modified { color: var(--dsw-alias-state-warn-primary, #ca8a04); }
      .dshg-st-deleted, .dshg-st-conflict { color: var(--dsw-alias-state-error-primary, #dc2626); }
      .dshg-st-ignored { color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-st-renamed { color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; }
      .dshg-dot-added { background: var(--dsw-alias-state-success-primary, #16a34a); }
      .dshg-dot-modified { background: var(--dsw-alias-state-warn-primary, #ca8a04); }
      .dshg-dot-deleted, .dshg-dot-conflict { background: var(--dsw-alias-state-error-primary, #dc2626); }
      .dshg-check {
        width: 15px; height: 15px; flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db);
        border-radius: 3px; background: transparent; color: transparent;
        cursor: pointer; padding: 0;
      }
      .dshg-check:hover { border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-check.checked { background: var(--dsw-alias-brand-primary, #2563eb); border-color: var(--dsw-alias-brand-primary, #2563eb); color: #fff; }
      .dshg-check.partial { border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-check-line { width: 8px; height: 2px; background: var(--dsw-alias-brand-primary, #2563eb); display: block; }
      .dshg-right { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
      .dshg-tabs { display: flex; align-items: center; gap: 2px; height: 36px; padding: 0 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); flex: 0 0 auto; }
      .dshg-tab {
        height: 28px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent;
        color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 12px; cursor: pointer;
      }
      .dshg-tab.active { background: var(--dsw-alias-bg-layer-1, #f3f4f6); color: var(--dsw-alias-label-primary, #111); }
      .dshg-tab-count { margin-left: 5px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px; }
      .dshg-prefix-hint { margin-left: 8px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; }
      .dshg-right-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
      .dshg-diff-pane { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
      .dshg-diff-head { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); flex: 0 0 auto; }
      .dshg-diff-title { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; }
      .dshg-diff-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .dshg-segmented { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 5px; overflow: hidden; }
      .dshg-seg { height: 24px; padding: 0 8px; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 11px; cursor: pointer; }
      .dshg-seg.active { background: var(--dsw-alias-bg-layer-1, #f3f4f6); color: var(--dsw-alias-label-primary, #111); }
      .dshg-diff-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .dshg-diff-wrap { padding: 4px 0 16px; }
      .dshg-diff {
        margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 12px; line-height: 1.55; tab-size: 4;
      }
      .dshg-line { min-height: 18px; padding: 0 12px; white-space: pre; color: var(--dsw-alias-label-primary, #111); }
      .dshg-line-add { background: rgba(34,197,94,.12); color: var(--dsw-alias-state-success-primary, #16a34a); }
      .dshg-line-del { background: rgba(239,68,68,.12); color: var(--dsw-alias-state-error-primary, #dc2626); }
      .dshg-line-hunk { color: var(--dsw-alias-brand-primary, #2563eb); opacity: .85; }
      .dshg-line-meta { color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-truncated { padding: 8px 12px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; }
      .dshg-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-empty-inline { min-height: 120px; }
      .dshg-empty-icon { color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-empty-title { color: var(--dsw-alias-label-primary, #111); font-size: 13px; font-weight: 600; }
      .dshg-empty-desc { max-width: 360px; font-size: 12px; line-height: 1.5; }
      .dshg-loading { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
      .dshg-history { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 0 12px; }
      .dshg-commit-row { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 10px 0 4px; cursor: pointer; }
      .dshg-commit-row:hover { background: var(--dsw-alias-bg-layer-1, #f8fafc); }
      .dshg-graph-cell { flex: 0 0 auto; display: block; }
      .dshg-commit-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .dshg-commit-subject { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-commit-meta { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px; white-space: nowrap; }
      .dshg-ref { max-width: 160px; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; border-radius: 3px; background: var(--dsw-alias-bg-layer-1, #f3f4f6); }
      .dshg-ref.head { color: var(--dsw-alias-state-success-primary, #16a34a); }
      .dshg-ref.tag { color: var(--dsw-alias-state-warn-primary, #ca8a04); }
      .dshg-sha { flex: 0 0 auto; color: var(--dsw-alias-label-secondary, #6b7280); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
      .dshg-detail { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: auto; padding: 10px 12px 18px; }
      .dshg-detail-head { display: flex; align-items: center; gap: 8px; }
      .dshg-detail-sha { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; }
      .dshg-detail-subject { margin-top: 8px; font-size: 14px; font-weight: 650; }
      .dshg-detail-meta { margin-top: 4px; display: flex; gap: 10px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; }
      .dshg-detail-body { margin: 10px 0 0; padding: 8px; background: var(--dsw-alias-bg-layer-1, #f8fafc); border-radius: 6px; white-space: pre-wrap; font-size: 12px; line-height: 1.5; }
      .dshg-detail-patch { margin-top: 10px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 6px; }
      .dshg-commit-bar { flex: 0 0 auto; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; background: var(--dsw-alias-bg-base, #fff); }
      .dshg-textarea {
        width: 100%; min-height: 46px; max-height: 110px; resize: vertical;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 6px;
        background: var(--dsw-alias-bg-layer-1, #f8fafc); color: var(--dsw-alias-label-primary, #111);
        padding: 7px 9px; font: inherit; font-size: 12px; line-height: 1.5; outline: none;
      }
      .dshg-textarea:focus { border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-commit-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dshg-option { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 11px; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
      .dshg-option:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-1, #f3f4f6); }
      .dshg-option.active { color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshg-option:disabled { opacity: .45; cursor: default; }
      .dshg-commit-hint { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px; }
      .dshg-commit-button { min-width: 96px; }
      .dshg-warning { padding: 5px 8px; border-radius: 5px; background: rgba(239,68,68,.10); color: var(--dsw-alias-state-error-primary, #dc2626); font-size: 11px; }
      .dshg-toast {
        position: absolute; top: 54px; right: 14px; z-index: 6;
        display: flex; align-items: flex-start; gap: 8px;
        max-width: min(520px, calc(100% - 28px));
        padding: 8px 10px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: var(--dsw-alias-bg-overlay, #fff);
        box-shadow: 0 8px 24px rgba(0,0,0,.14);
        font-size: 12px;
      }
      .dshg-toast.error { border-color: var(--dsw-alias-state-error-primary, #dc2626); }
      .dshg-toast-main { min-width: 0; }
      .dshg-toast-text { line-height: 1.45; }
      .dshg-toast-details { margin-top: 4px; color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-toast-details pre { max-height: 160px; overflow: auto; white-space: pre-wrap; font-size: 10px; margin: 4px 0 0; }
      .dshg-panel-icon { line-height: 0; }
      .dshg-sidebar-status {
        display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 6px; border: 0; border-radius: 6px;
        background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
        font: inherit; cursor: pointer;
      }
      .dshg-sidebar-status:hover { background: var(--dsw-alias-bg-layer-1, #f3f4f6); color: var(--dsw-alias-label-primary, #111); }
      .dshg-mini-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
      .dshg-side-count { font-size: 10px; font-weight: 700; color: var(--dsw-alias-label-primary, #111); }
      @media (max-width: 900px) {
        .dshg-left { width: 270px; }
        .dshg-btn-label { display: none; }
        .dshg-commit-hint { display: none; }
      }
    `;

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.dshGitPanel = 'styles';
        style.textContent = CSS_TEXT;
        const styleHost = document.head || document.documentElement;
        if (!styleHost) return () => {};
        styleHost.appendChild(style);
        return () => style.remove();
      }, 'dsh-git: styles');
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-git: dictionaries');
      t = ctx.locale.bind(NS);

      ctx.effect(() => {
        const onKeyDown = (event) => {
          if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
          if (event.key.toLowerCase() !== 'g') return;
          const target = event.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
          event.preventDefault();
          event.stopPropagation();
          try {
            ctx.layout.selectPanel('git');
          } catch (error) {
            console.error('[dsh-git] could not open panel', error);
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, 'dsh-git: open shortcut');

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'git',
        locale: NS,
      }, GitPanelRoot));

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'git',
        order: 5,
        locale: NS,
        label: () => t('panel'),
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitPanelIcon));

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'git-status',
        order: -10,
        locale: NS,
        label: () => t('git'),
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitSidebarStatus));
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});
