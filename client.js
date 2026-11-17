window.__ModuleLoader__.load({
  id: '@aishangwuji/dsh-git',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;
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
    /**
     * Workspace/session bridge filled by `ctx.inject(['workspaces',
     * 'uiWorkspace'])` in apply(). Keeping it module-level lets the panel stay
     * usable in shells that omit those services, while the worktree flow can
     * report a readable error instead of crashing the panel.
     */
    let worktreeBridge = null;
    /** Session summary lookup used by the composer chip when its slot props omit hooks. */
    let sessionBridge = null;

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
      fetchUpToDate: '获取完成 · {remotes} 个远程均无更新',
      fetchUpdated: '获取完成 · 更新 {refs} 个引用 · {remotes} 个远程',
      fetchBehind: '当前分支落后 {count} 个提交',
      fetchAhead: '当前分支领先 {count} 个提交',
      pullUpToDate: '拉取完成 · 已是最新',
      pullUpdated: '拉取完成 · {commits} 个提交 · {files} 个文件',
      pushUpToDate: '推送完成 · 已是最新',
      pushUpdated: '推送完成 · {commits} 个提交',
      pushNewBranch: '已推送新分支 {branch}',
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
      unstagedTab: '未暂存',
      filterPlaceholder: '筛选文件…',
      loading: '加载中…',
      graphEmpty: '还没有提交',
      graphEmptyDesc: '提交第一个更改后，提交图会显示在这里。',
      filterCommits: '筛选提交…',
      noMatchingCommits: '没有匹配的提交',
      commitColSubject: '描述',
      commitColTime: '日期',
      commitColAuthor: '作者',
      commitColSha: '提交',
      commitStats: '{files} 个文件 · +{additions} −{deletions}',
      changedFiles: '变更文件',
      changedFilesCount: '{count} 个更改文件',
      viewOnHost: '在 {host} 上查看',
      allFiles: '全部差异',
      binaryFile: '二进制',
      parentsLabel: '父提交',
      mergeCommit: '合并提交',
      justNow: '刚刚',
      minutesAgo: '{count} 分钟前',
      hoursAgo: '{count} 小时前',
      daysAgo: '{count} 天前',
      loadMore: '加载更多',
      loadingMore: '正在加载…',
      resizePanes: '拖拽调整宽度，双击恢复默认',
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
      shortcuts: 'Ctrl+Enter 提交',
      noRemote: '没有远程仓库',
      error: '操作失败',
      filesChanged: '{count} 个文件',
      selectWorkspace: '工作区',
      selectRepo: '切换仓库',
      selectBranch: '切换分支',
      filterBranches: '筛选分支…',
      noBranches: '没有可切换的分支',
      branchesFailed: '读取分支失败',
      branchesStaleHost: '宿主插件还是旧版本，请完全退出并重新打开 Harness',
      branchesFailedWithCode: '读取分支失败（{code}）',
      branchCurrent: '当前',
      branchUpstream: '上游',
      branchesLocal: '本地',
      branchesRemote: '远端',
      branchesLocalEmpty: '没有本地分支',
      branchesRemoteEmpty: '没有远端分支',
      branchSwitched: '已切换到 {branch}',
      branchTrackingCreated: '已基于 {branch} 创建本地分支',
      checkingOut: '正在切换分支…',
      branchCreateAction: '创建并检出新分支...',
      branchGraphAction: 'Git 图谱',
      worktreeCreateAction: '在 worktree 中开始新会话...',
      worktreeManageAction: '管理 worktree...',
      branchCreateTitle: '创建并检出新分支',
      branchCreateDesc: '基于当前 HEAD 创建一个新的本地分支，并在创建成功后立即切换过去。',
      branchNameLabel: '分支名',
      branchNamePlaceholder: '例如 feature/git-branch-switcher',
      cancel: '取消',
      createAndCheckout: '创建并切换',
      creatingBranch: '正在创建分支…',
      branchCreated: '已创建并切换到 {branch}',
      invalidBranchName: '分支名不合法',
      gitGraphTitle: 'Git 图谱',
      gitGraphSubtitle: '{count} 个提交，{lanes} 条泳道',
      gitGraphLoading: '正在加载提交…',
      gitGraphLoadMore: '加载更多',
      worktreeCreateTitle: '在 worktree 中开始新会话',
      worktreeCreateDesc: '在 DSH 托管目录（$DSH_HOME/worktrees/）创建隔离 worktree，携带新分支 wt/<名称>，并在其中打开新会话。当前检出不受影响。',
      worktreeNameLabel: 'worktree 名称',
      worktreeNamePlaceholder: '例如 fix-login-race',
      worktreeBaseLabel: '基线分支',
      worktreeStart: '创建并开始会话',
      worktreeStarting: '正在创建 worktree…',
      worktreeNoBase: '当前仓库还没有可用的本地分支',
      worktreeCreated: '已在 {name} 中开始新会话',
      worktreeManagerTitle: 'Worktree 管理',
      worktreeEmpty: '没有托管的 worktree',
      worktreeMain: '主检出',
      worktreeDetached: '分离 HEAD',
      worktreeRemove: '移除',
      worktreeDeleteBranch: '同时删除分支',
      worktreeForceConfirm: '该 worktree 有未提交的更改，仍要移除？',
      worktreeForceYes: '强制移除',
      worktreeRemoved: '已移除 worktree',
      worktreeUnmanaged: '非托管',
      repoCount: '{count} 个仓库',
      repoGroupChanged: '有更改',
      repoGroupProjects: '项目',
      repoGroupNested: '子仓库',
      repoGroupUnavailable: '不可用',
      repoUnavailable: '（不可用）',
      repoScopeAll: '全部仓库',
      repoScopeMore: '子仓库 {count}',
      repoScopeLess: '收起',
      statusClean: '工作区干净',
      statusCleanDesc: '没有需要提交的更改。',
      overviewTitle: '仓库概览',
      branchLabel: '分支',
      latestCommit: '最近提交',
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
      err_REPO_REQUIRED: '工作区中有多个 Git 仓库，请先选择一个仓库',
      err_REPO_NOT_FOUND: '该仓库不在当前工作区内',
      err_BRANCH_NOT_FOUND: '分支不存在',
      err_CHECKOUT_DIRTY: '本地更改会被覆盖，请先提交或暂存后再切换分支',
      err_CHECKOUT_FAILED: '切换分支失败',
      err_BRANCH_ALREADY_EXISTS: '分支已存在',
      err_BRANCH_CREATE_FAILED: '创建分支失败',
      err_WORKTREE_NAME_INVALID: 'worktree 名称不合法',
      err_WORKTREE_PATH_EXISTS: '目标 worktree 目录已存在',
      err_WORKTREE_ADD_FAILED: '创建 worktree 失败',
      err_WORKTREE_LIST_FAILED: '读取 worktree 失败',
      err_WORKTREE_BASE_NOT_FOUND: '基线分支不存在',
      err_WORKTREE_NOT_FOUND: 'worktree 不存在',
      err_WORKTREE_IS_MAIN: '不能移除主检出',
      err_WORKTREE_NOT_MANAGED: '只能移除由面板托管的 worktree',
      err_WORKTREE_DIRTY: 'worktree 中还有未提交的更改',
      err_WORKTREE_REMOVE_FAILED: '移除 worktree 失败',
      err_WORKTREE_SERVICE_UNAVAILABLE: '当前界面没有提供工作区服务，无法打开新会话',
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
      fetchUpToDate: 'Fetched · {remotes} remotes, no updates',
      fetchUpdated: 'Fetched · {refs} refs updated · {remotes} remotes',
      fetchBehind: 'branch is {count} commits behind',
      fetchAhead: 'branch is {count} commits ahead',
      pullUpToDate: 'Pulled · already up to date',
      pullUpdated: 'Pulled · {commits} commits · {files} files',
      pushUpToDate: 'Pushed · already up to date',
      pushUpdated: 'Pushed · {commits} commits',
      pushNewBranch: 'Pushed new branch {branch}',
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
      unstagedTab: 'Unstaged',
      filterPlaceholder: 'Filter files…',
      loading: 'Loading…',
      graphEmpty: 'No commits yet',
      graphEmptyDesc: 'The commit graph appears after your first commit.',
      filterCommits: 'Filter commits…',
      noMatchingCommits: 'No matching commits',
      commitColSubject: 'Description',
      commitColTime: 'Date',
      commitColAuthor: 'Author',
      commitColSha: 'Commit',
      commitStats: '{files} files · +{additions} −{deletions}',
      changedFiles: 'Changed files',
      changedFilesCount: '{count} changed files',
      viewOnHost: 'View on {host}',
      allFiles: 'All changes',
      binaryFile: 'binary',
      parentsLabel: 'Parents',
      mergeCommit: 'Merge commit',
      justNow: 'just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
      loadMore: 'Load more',
      loadingMore: 'Loading…',
      resizePanes: 'Drag to resize, double-click to reset',
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
      shortcuts: 'Ctrl+Enter to commit',
      noRemote: 'No remote configured',
      error: 'Operation failed',
      filesChanged: '{count} files',
      selectWorkspace: 'Workspace',
      selectRepo: 'Switch repository',
      selectBranch: 'Switch branch',
      filterBranches: 'Filter branches…',
      noBranches: 'No branch to switch to',
      branchesFailed: 'Could not read branches',
      branchesStaleHost: 'The host plugin is still the old build; fully quit and reopen Harness',
      branchesFailedWithCode: 'Could not read branches ({code})',
      branchCurrent: 'current',
      branchUpstream: 'upstream',
      branchesLocal: 'Local',
      branchesRemote: 'Remote',
      branchesLocalEmpty: 'No local branches',
      branchesRemoteEmpty: 'No remote branches',
      branchSwitched: 'Switched to {branch}',
      branchTrackingCreated: 'Created a local branch from {branch}',
      checkingOut: 'Switching branch…',
      branchCreateAction: 'Create and check out new branch...',
      branchGraphAction: 'Git graph',
      worktreeCreateAction: 'Start a new session in a worktree...',
      worktreeManageAction: 'Manage worktrees...',
      branchCreateTitle: 'Create and check out a new branch',
      branchCreateDesc: 'Create a new local branch from the current HEAD and switch to it immediately.',
      branchNameLabel: 'Branch name',
      branchNamePlaceholder: 'e.g. feature/git-branch-switcher',
      cancel: 'Cancel',
      createAndCheckout: 'Create and switch',
      creatingBranch: 'Creating branch…',
      branchCreated: 'Created and switched to {branch}',
      invalidBranchName: 'Invalid branch name',
      gitGraphTitle: 'Git graph',
      gitGraphSubtitle: '{count} commits, {lanes} lanes',
      gitGraphLoading: 'Loading commits…',
      gitGraphLoadMore: 'Load more',
      worktreeCreateTitle: 'Start a new session in a worktree',
      worktreeCreateDesc: 'Create an isolated worktree under $DSH_HOME/worktrees/ with a new wt/<name> branch, then start a new session there. The current checkout is untouched.',
      worktreeNameLabel: 'Worktree name',
      worktreeNamePlaceholder: 'e.g. fix-login-race',
      worktreeBaseLabel: 'Base branch',
      worktreeStart: 'Create and start session',
      worktreeStarting: 'Creating worktree…',
      worktreeNoBase: 'This repository has no local branch to use as the base',
      worktreeCreated: 'Started a new session in {name}',
      worktreeManagerTitle: 'Worktree manager',
      worktreeEmpty: 'No managed worktrees',
      worktreeMain: 'Main checkout',
      worktreeDetached: 'Detached HEAD',
      worktreeRemove: 'Remove',
      worktreeDeleteBranch: 'Delete branch too',
      worktreeForceConfirm: 'This worktree has uncommitted changes. Remove it anyway?',
      worktreeForceYes: 'Force remove',
      worktreeRemoved: 'Removed worktree',
      worktreeUnmanaged: 'Unmanaged',
      repoCount: '{count} repositories',
      repoGroupChanged: 'Changed',
      repoGroupProjects: 'Projects',
      repoGroupNested: 'Nested',
      repoGroupUnavailable: 'Unavailable',
      repoUnavailable: '(unavailable)',
      repoScopeAll: 'All repositories',
      repoScopeMore: 'Nested {count}',
      repoScopeLess: 'Collapse',
      statusClean: 'Working tree clean',
      statusCleanDesc: 'Nothing to commit.',
      overviewTitle: 'Repository overview',
      branchLabel: 'Branch',
      latestCommit: 'Latest commit',
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
      err_REPO_REQUIRED: 'This workspace holds several Git repositories; choose one first',
      err_REPO_NOT_FOUND: 'That repository is not inside this workspace',
      err_BRANCH_NOT_FOUND: 'That branch does not exist',
      err_CHECKOUT_DIRTY: 'Local changes would be overwritten; commit or stash them before switching',
      err_CHECKOUT_FAILED: 'Could not switch branches',
      err_BRANCH_ALREADY_EXISTS: 'That branch already exists',
      err_BRANCH_CREATE_FAILED: 'Could not create the branch',
      err_WORKTREE_NAME_INVALID: 'Invalid worktree name',
      err_WORKTREE_PATH_EXISTS: 'The worktree directory already exists',
      err_WORKTREE_ADD_FAILED: 'Could not create the worktree',
      err_WORKTREE_LIST_FAILED: 'Could not read worktrees',
      err_WORKTREE_BASE_NOT_FOUND: 'The base branch does not exist',
      err_WORKTREE_NOT_FOUND: 'That worktree does not exist',
      err_WORKTREE_IS_MAIN: 'The main checkout cannot be removed',
      err_WORKTREE_NOT_MANAGED: 'Only panel-managed worktrees can be removed',
      err_WORKTREE_DIRTY: 'The worktree has uncommitted changes',
      err_WORKTREE_REMOVE_FAILED: 'Could not remove the worktree',
      err_WORKTREE_SERVICE_UNAVAILABLE: 'This shell does not expose the workspace service, so a new session cannot be opened',
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
      const code = error && error.code ? error.code : null;
      if (code) {
        const key = `err_${code}`;
        const translated = t(key);
        if (translated !== key) return translated;
      }
      return (error && (error.message || (error.rpcError && error.rpcError.message))) || t('err_UNKNOWN');
    }

    /** One-line summary for the fetch toast: refs, remotes, and branch drift. */
    function fetchSummary(result) {
      const remotes = Number(result && result.remotes) || 0;
      const refs = Number(result && result.updatedRefs) || 0;
      const behind = Number(result && result.behind) || 0;
      const ahead = Number(result && result.ahead) || 0;
      if (refs === 0) {
        let text = tf('fetchUpToDate', { remotes });
        if (behind > 0) text += ` · ${tf('fetchBehind', { count: behind })}`;
        if (ahead > 0) text += ` · ${tf('fetchAhead', { count: ahead })}`;
        return text;
      }
      let text = tf('fetchUpdated', { refs, remotes });
      if (behind > 0) text += ` · ${tf('fetchBehind', { count: behind })}`;
      if (ahead > 0) text += ` · ${tf('fetchAhead', { count: ahead })}`;
      return text;
    }

    /** Expandable fetch detail: one old..new line per changed ref. */
    function fetchDetail(result) {
      const lines = ((result && result.updates) || []).slice(0, 80).map((update) => {
        const ref = String(update.ref || '')
          .replace(/^refs\/remotes\//, '')
          .replace(/^refs\/tags\//, 'tag: ')
          .replace(/^refs\/heads\//, '');
        const oldOid = String(update.old || '').slice(0, 7);
        const newOid = String(update.new || '').slice(0, 7);
        return `${ref}  ${oldOid} → ${newOid}`;
      });
      if (result && result.output && lines.length === 0) lines.push(String(result.output));
      return lines.join('\n').slice(0, 4000);
    }

    /** One-line summary for the pull toast. */
    function pullSummary(result) {
      if (!result || !result.updated) return t('pullUpToDate');
      let text = tf('pullUpdated', {
        commits: Number(result.commits) || 0,
        files: Number(result.files) || 0,
      });
      const additions = Number(result.additions) || 0;
      const deletions = Number(result.deletions) || 0;
      if (additions + deletions > 0) text += ` · +${additions} −${deletions}`;
      return text;
    }

    /** One-line summary for the push toast. */
    function pushSummary(result) {
      if (!result) return t('pushUpToDate');
      if (result.newBranch) return tf('pushNewBranch', { branch: result.branch || '' });
      if (!result.updated) return t('pushUpToDate');
      return tf('pushUpdated', { commits: Number(result.pushedCommits) || 0 });
    }

    function cx(...values) {
      return values.filter(Boolean).join(' ');
    }

    function basename(path) {
      const index = path.lastIndexOf('/');
      return index === -1 ? path : path.slice(index + 1);
    }

    /** Display label for a repository: workspace-relative path, else folder name. */
    function repoLabel(repo) {
      if (!repo) return '';
      if (repo.relativePath) return repo.relativePath;
      const root = String(repo.root || '');
      const parts = root.split(/[\\/]/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : root;
    }

    /** A repository at the top of the workspace (a project, not a dependency). */
    function repoIsProject(repo) {
      const relativePath = repo && repo.relativePath ? repo.relativePath : '';
      return relativePath === '' || relativePath.indexOf('/') === -1;
    }

    function repoChanged(repo) {
      return Boolean(repo && repo.counts && repo.counts.changed > 0);
    }

    /** Closest repository whose root contains this one (root repo included). */
    function nearestAncestorRepo(repos, repo) {
      if (!repo || !repo.relativePath) return null;
      const own = repo.relativePath;
      let best = null;
      for (const candidate of repos) {
        if (!candidate || samePath(candidate.root, repo.root)) continue;
        const prefix = candidate.relativePath || '';
        if (prefix && !own.startsWith(`${prefix}/`)) continue;
        if (!best || (best.relativePath || '').length < prefix.length) best = candidate;
      }
      return best;
    }

    /**
     * Short label for the switcher: top-level projects use their folder name;
     * nested repositories drop their nearest ancestor's prefix and are marked
     * as nested, so a submodule list stays readable.
     */
    function repoSelectLabel(repos, repo) {
      if (!repo) return '';
      if (!repo.relativePath) return repoLabel(repo);
      const ancestor = nearestAncestorRepo(repos, repo);
      if (!ancestor || !ancestor.relativePath) return repoLabel(repo);
      return `↳ ${repo.relativePath.slice(ancestor.relativePath.length + 1)}`;
    }

    function repoOptionLabel(repos, repo) {
      const label = repoSelectLabel(repos, repo);
      if (repo && repo.error) return `${label} ${t('repoUnavailable')}`;
      const changed = repo && repo.counts ? repo.counts.changed || 0 : 0;
      return changed > 0 ? `${label} · ${changed}` : label;
    }

    function repoOptionCount(groups) {
      return groups.reduce((total, group) => total + group.items.length, 0);
    }

    /**
     * Group repositories for the switcher. Pending changes always surface,
     * top-level projects come next, and clean dependency repositories stay
     * behind the "all repositories" toggle; unusable ones (for example an
     * uninitialised submodule) are listed last and cannot be selected.
     */
    function repoGroups(repos, selectedRoot, showAll) {
      const isSelected = (repo) => samePath(repo.root, selectedRoot);
      const available = repos.filter((repo) => !repo.error);
      const broken = repos.filter((repo) => repo.error);
      const visible = showAll
        ? available
        : available.filter((repo) => repoIsProject(repo) || repoChanged(repo) || isSelected(repo));
      const byPath = (a, b) => repoLabel(a).localeCompare(repoLabel(b));
      const changed = visible.filter(repoChanged).sort((a, b) => {
        const left = a.counts ? a.counts.changed : 0;
        const right = b.counts ? b.counts.changed : 0;
        return right - left || byPath(a, b);
      });
      const clean = visible.filter((repo) => !repoChanged(repo)).sort(byPath);
      const groups = [];
      if (changed.length > 0) groups.push({ key: 'changed', label: t('repoGroupChanged'), items: changed });
      const projects = clean.filter(repoIsProject);
      if (projects.length > 0) groups.push({ key: 'projects', label: t('repoGroupProjects'), items: projects });
      const nested = clean.filter((repo) => !repoIsProject(repo));
      if (nested.length > 0) groups.push({ key: 'nested', label: t('repoGroupNested'), items: nested });
      const visibleBroken = (showAll || available.length === 0 ? broken : broken.filter(repoIsProject)).sort(byPath);
      if (visibleBroken.length > 0) {
        groups.push({ key: 'unavailable', label: t('repoGroupUnavailable'), items: visibleBroken });
      }
      return groups;
    }

    function samePath(left, right) {
      const normalize = (value) => String(value == null ? '' : value).replace(/\\/g, '/').replace(/\/+$/, '');
      return normalize(left) === normalize(right);
    }

    /** Pure mirror of `git check-ref-format --branch`; the host stays the authority. */
    function validateBranchName(name) {
      if (name === '') return 'empty';
      if (name === '@') return 'at-sign';
      if (name.startsWith('-')) return 'leading-dash';
      if (name.endsWith('.')) return 'trailing-dot';
      if (name.endsWith('.lock')) return 'lock-suffix';
      if (name.includes('..')) return 'double-dot';
      if (name.includes('@{')) return 'at-brace';
      if (name.includes('//')) return 'double-slash';
      if (/\s/.test(name)) return 'space';
      if (/[~^:?*[\\]/.test(name)) return 'forbidden-char';
      if (/[\u0000-\u001f\u007f]/.test(name)) return 'control-char';
      for (const component of name.split('/')) {
        if (component === '') return 'empty-component';
        if (component.startsWith('.')) return 'dot-component';
        if (component.endsWith('.lock')) return 'lock-suffix';
      }
      return null;
    }

    /** Same normalization as the host: lowercase, safe path/branch component. */
    function sanitizeWorktreeName(value) {
      const cleaned = String(value == null ? '' : value).trim().toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-.]+/, '')
        .replace(/[-.]+$/, '')
        .slice(0, 64);
      if (cleaned === '' || cleaned === '.' || cleaned === '..') return null;
      if (cleaned.includes('..') || cleaned.endsWith('.lock')) return null;
      return cleaned;
    }

    /** Lane topology for the graph dialog, matching the host's topo order. */
    function computeLanes(rows) {
      const later = new Set();
      for (const row of rows) {
        for (const parent of row.parents || []) later.add(parent);
      }
      const lanes = [];
      const result = [];
      for (const row of rows) {
        let nodeColumn = lanes.findIndex((pending) => pending === row.sha);
        if (nodeColumn === -1) {
          lanes.push(row.sha);
          nodeColumn = lanes.length - 1;
        }
        const columns = [];
        for (let index = 0; index < lanes.length; index += 1) {
          const pending = lanes[index];
          if (pending === null) columns.push('gap');
          else if (index === nodeColumn) columns.push((row.parents || []).length > 1 ? 'merge' : 'node');
          else if (pending === row.sha) columns.push('gap');
          else if (typeof pending === 'string' && later.has(pending)) columns.push('pass');
          else columns.push('gap');
        }
        const parents = (row.parents || []).filter((parent) => later.has(parent));
        const [first, ...rest] = parents;
        for (let index = 0; index < lanes.length; index += 1) {
          if (lanes[index] === row.sha && index !== nodeColumn) lanes[index] = null;
        }
        lanes[nodeColumn] = first === undefined ? null : first;
        for (const parent of rest) {
          if (!lanes.includes(parent)) lanes.push(parent);
        }
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
        result.push({ columns, nodeColumn, merge: (row.parents || []).length > 1 });
      }
      return result;
    }

    function laneChar(glyph) {
      if (glyph === 'node') return '●';
      if (glyph === 'merge') return '◆';
      if (glyph === 'pass') return '│';
      return ' ';
    }

    /** Absolute filesystem path of a repository-relative entry. */
    function joinAbsolute(root, relativePath) {
      const base = String(root || '').replace(/[\\/]+$/, '');
      const separator = base.includes('\\') ? '\\' : '/';
      const tail = String(relativePath || '').split('/').filter(Boolean).join(separator);
      return tail ? `${base}${separator}${tail}` : base;
    }

    function fileUriOf(absolutePath) {
      const forward = String(absolutePath || '').replace(/\\/g, '/');
      if (/^[A-Za-z]:/.test(forward)) return `file:///${forward}`;
      return forward.startsWith('/') ? `file://${forward}` : `file:///${forward}`;
    }

    /**
     * Drag payload for the conversation composer. Zed inserts the dropped
     * file's path; here the plain-text payload is the absolute path, which a
     * contenteditable composer inserts as-is on drop.
     */
    function beginFileDrag(event, absolutePath) {
      if (!event || !event.dataTransfer || !absolutePath) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', absolutePath);
      try {
        event.dataTransfer.setData('text/uri-list', fileUriOf(absolutePath));
      } catch {
        // Some browsers reject custom types; plain text is enough.
      }
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

    /** Pane width persisted across sessions, clamped to a usable range. */
    function readPaneWidth(key, fallback, min, max) {
      const raw = Number(readStorage(key));
      if (!Number.isFinite(raw) || raw <= 0) return fallback;
      return Math.min(Math.max(raw, min), max);
    }

    function clampPaneWidth(value, min, max) {
      return Math.min(Math.max(Math.round(value), min), Math.max(min, max));
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

    /**
     * Shared worktree flow for both the Git panel and the composer branch pill:
     * create the managed checkout, then register its workspace and open a blank
     * session. A failure after the Git write removes the checkout again so no
     * half-created workspace is left behind.
     */
    async function addWorktreeSession(workspace, repo, name, baseRef) {
      if (!worktreeBridge) {
        const unavailable = new Error(t('err_WORKTREE_SERVICE_UNAVAILABLE'));
        unavailable.code = 'WORKTREE_SERVICE_UNAVAILABLE';
        throw unavailable;
      }
      let created = null;
      try {
        created = await rpc('worktree-add', { workspace, repo, name, baseRef });
        await worktreeBridge.start(created.path);
        return created;
      } catch (error) {
        if (created) {
          try {
            await rpc('worktree-remove', {
              workspace,
              repo,
              path: created.path,
              force: true,
              deleteBranch: true,
            });
          } catch {
            // The original failure is what the caller reports.
          }
        }
        throw error;
      }
    }

    /** Remove a managed worktree and, when linked, its workspace registration. */
    async function removeWorktreeSession(workspace, repo, path, options) {
      const result = await rpc('worktree-remove', {
        workspace,
        repo,
        path,
        force: Boolean(options && options.force),
        deleteBranch: Boolean(options && options.deleteBranch),
      });
      if (worktreeBridge) {
        const items = worktreeBridge.list();
        const linked = Array.isArray(items)
          ? items.find((item) => samePath(item.path, path))
          : null;
        if (linked) {
          try {
            await worktreeBridge.delete(linked.workspaceId);
          } catch {
            // The disk removal succeeded; a stale workspace row is less harmful
            // than hiding that success.
          }
        }
      }
      return result;
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

    /** Branch switcher: searchable list with the four branch/worktree actions. */
    function BranchSwitcher({
      status, busy, load, onPick,
      onCreate, onGraph, onCreateWorktree, onManageWorktrees, hero,
    }) {
      const [query, setQuery] = useState('');
      const [tab, setTab] = useState('local');
      const [branches, setBranches] = useState({ local: [], remote: [] });
      const [loading, setLoading] = useState(false);
      const [failed, setFailed] = useState(null);

      const refresh = useCallback(async () => {
        setLoading(true);
        setFailed(null);
        try {
          const next = await load();
          const remote = Array.isArray(next.remote) ? next.remote : [];
          setBranches({
            local: Array.isArray(next.local) ? next.local : [],
            remote,
          });
          // The reference branch menu only shows local branches when the
          // repository has no remote; a stale remote tab must not hide them.
          if (remote.length === 0) setTab('local');
        } catch (error) {
          setBranches({ local: [], remote: [] });
          setTab('local');
          setFailed(error && error.code ? error.code : 'UNKNOWN');
        } finally {
          setLoading(false);
        }
      }, [load]);

      const label = status.detached ? t('detached') : status.branch || '—';
      const needle = query.trim().toLowerCase();
      const local = branches.local || [];
      const remote = branches.remote || [];
      const activeTab = tab === 'remote' && remote.length > 0 ? 'remote' : 'local';
      // Keep the local current branch's upstream at the top of the remote tab:
      // switching back to it is the most common action after browsing a remote.
      const source = activeTab === 'local'
        ? local
        : remote.slice().sort((left, right) => {
            const leftUpstream = left.name === status.upstream ? 0 : 1;
            const rightUpstream = right.name === status.upstream ? 0 : 1;
            return leftUpstream - rightUpstream || left.name.localeCompare(right.name);
          });
      const visible = source
        .filter((item) => !needle || item.name.toLowerCase().includes(needle));
      const emptyText = activeTab === 'local' ? t('branchesLocalEmpty') : t('branchesRemoteEmpty');

      const tabButton = (id, text, count) => h('button', {
        type: 'button',
        className: cx('dshg-menu-tab', activeTab === id && 'active'),
        onClick: () => setTab(id),
        'aria-pressed': activeTab === id ? 'true' : 'false',
      }, text, count > 0 ? h('span', { className: 'dshg-menu-tab-count' }, count) : null);

      return h(PillSelect, {
        ariaLabel: t('selectBranch'),
        title: status.repoRoot || '',
        disabled: Boolean(busy) || Boolean(status.isBare),
        menuClassName: cx('dshg-menu-branch', hero && 'dshg-menu-branch-hero'),
        triggerClassName: hero ? 'dshg-pillselect-hero' : null,
        trigger: h(React.Fragment, null,
          h(IconBranch, { size: 13 }),
          h('strong', { className: 'dshg-pill-strong', 'data-dshg-tip': label }, label),
          !hero && status.ahead > 0 ? h('span', { className: 'dshg-ahead' }, `↑${status.ahead}`) : null,
          !hero && status.behind > 0 ? h('span', { className: 'dshg-behind' }, `↓${status.behind}`) : null),
        onOpenChange: (open) => {
          if (!open) return;
          setQuery('');
          void refresh();
        },
      }, (close) => h(React.Fragment, null,
        remote.length > 0 ? h('div', { className: 'dshg-menu-tabs', role: 'tablist' },
          tabButton('local', t('branchesLocal'), local.length),
          tabButton('remote', t('branchesRemote'), remote.length)) : null,
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
          !loading && !failed && visible.length === 0 ? h('div', { className: 'dshg-menu-empty' }, emptyText) : null,
          !loading && !failed ? visible.map((item) => h(MenuItem, {
            key: item.name,
            active: activeTab === 'local' ? item.current : false,
            hint: activeTab === 'local'
              ? null
              : (item.name === status.upstream ? t('branchUpstream') : null),
            onClick: () => {
              close();
              if (activeTab === 'local' && item.current) return;
              void onPick(activeTab === 'local'
                ? { branch: item.name }
                : { branch: item.branch, remoteBranch: item.name });
            },
          }, item.name)) : null),
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
    function HeroRowPortal({ active, children, anchorRef }) {
      const [host] = useState(() => document.createElement('div'));
      useLayoutEffect(() => {
        if (!active) return undefined;
        host.dataset.dshgComposerChip = '1';
        host.style.display = 'contents';
        const place = () => {
          const anchor = anchorRef && anchorRef.current;
          const outlet = anchor && anchor.parentElement;
          let row = null;
          if (outlet) {
            const previous = outlet.previousElementSibling;
            if (previous && String(previous.className || '').includes('heroWorkspaceRow')) {
              row = previous;
            }
            if (!row) {
              const stack = outlet.closest('[class*="composerStack"], [class*="composerHero"]');
              row = stack ? stack.querySelector('[class*="heroWorkspaceRow"]') : null;
            }
          }
          if (!row) {
            const rows = Array.from(document.querySelectorAll('[class*="heroWorkspaceRow"]'));
            row = rows.find((node) => node.getBoundingClientRect().width > 0) || rows[0];
          }
          if (!row) return;
          const trailing = Array.from(row.children).find(
            (node) => String(node.className || '').includes('heroOptions'),
          );
          if (host.parentElement !== row || (trailing && host.nextElementSibling !== trailing)) {
            row.insertBefore(host, trailing || null);
          }
        };
        place();
        const observer = new MutationObserver(place);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', place);
        return () => {
          observer.disconnect();
          window.removeEventListener('resize', place);
          host.remove();
        };
      }, [active, anchorRef, host]);
      if (!active) return null;
      return createPortal(children, host);
    }

    /**
     * Branch pill for a blank session hero. It resolves the session cwd from
     * the shell's session snapshot, probes the workspace for a repository, and
     * reuses the same branch switcher and dialogs as the Git panel.
     */
    function ComposerBranchChip(props) {
      const sessionId = props.sessionId;
      const summary = typeof props.useSessions === 'function'
        ? props.useSessions((state) => (
            sessionId === undefined ? undefined : state.byId[sessionId]
          ))
        : (sessionBridge ? sessionBridge.summary(sessionId) : undefined);
      const blank = Boolean(
        (summary && summary.blank === true)
        || (props.session && props.session.blank === true),
      );
      const cwd = (summary && summary.cwd) || (props.session && props.session.cwd) || '';

      const [status, setStatus] = useState(null);
      const [busy, setBusy] = useState('');
      const [notice, setNotice] = useState(null);
      const [dialog, setDialog] = useState(null);
      const [worktreeBranches, setWorktreeBranches] = useState([]);
      const seq = useRef(0);
      const dockRef = useRef(null);
      const active = Boolean(blank && cwd);

      const refresh = useCallback(async () => {
        if (!cwd) return null;
        const id = ++seq.current;
        try {
          const next = await rpc('status', { workspace: cwd });
          if (id === seq.current) {
            setStatus(next);
            window.dispatchEvent(new Event('dsh-git:refresh'));
          }
          return next;
        } catch {
          if (id === seq.current) setStatus(null);
          return null;
        }
      }, [cwd]);

      useEffect(() => {
        if (!active) {
          seq.current += 1;
          setStatus(null);
          return undefined;
        }
        void refresh();
        const onFocus = () => {
          if (document.visibilityState === 'visible') void refresh();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
      }, [active, refresh]);

      useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 9000 : 4500);
        return () => clearTimeout(timer);
      }, [notice]);

      const repoRoot = status && status.repoRoot ? status.repoRoot : '';
      const loadBranches = useCallback(
        () => rpc('branches', { workspace: cwd, repo: repoRoot }),
        [cwd, repoRoot],
      );
      const fetchGraph = useCallback(
        (limit) => rpc('graph', { workspace: cwd, repo: repoRoot, limit, all: true }),
        [cwd, repoRoot],
      );

      const pickBranch = useCallback(async (pick) => {
        if (!repoRoot) return;
        const branch = typeof pick === 'string' ? pick : pick.branch;
        const remoteBranch = pick && typeof pick === 'object' ? pick.remoteBranch : undefined;
        setBusy(t('checkingOut'));
        setNotice(null);
        try {
          const result = await rpc('checkout', { workspace: cwd, repo: repoRoot, branch, remoteBranch });
          await refresh();
          const name = (result && result.branch) || branch;
          setNotice({
            kind: 'success',
            text: result && result.created
              ? tf('branchTrackingCreated', { branch: name })
              : tf('branchSwitched', { branch: name }),
          });
        } catch (error) {
          setNotice({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot, refresh]);

      const createBranch = useCallback(async (name) => {
        setBusy(t('creatingBranch'));
        setNotice(null);
        try {
          const result = await rpc('create-branch', { workspace: cwd, repo: repoRoot, name });
          await refresh();
          setNotice({ kind: 'success', text: tf('branchCreated', { branch: (result && result.branch) || name }) });
          return result;
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot, refresh]);

      const openWorktreeCreate = useCallback(async () => {
        try {
          const next = await loadBranches();
          const names = (next && Array.isArray(next.local) ? next.local : []).map((item) => item.name);
          if (status && status.branch && !names.includes(status.branch)) names.unshift(status.branch);
          if (names.length === 0) {
            setNotice({ kind: 'error', text: t('worktreeNoBase') });
            return;
          }
          setWorktreeBranches(names);
          setDialog({ kind: 'worktree-create' });
        } catch (error) {
          setNotice({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, [loadBranches, status]);

      const createWorktree = useCallback(async (name, baseRef) => {
        setBusy(t('worktreeStarting'));
        setNotice(null);
        try {
          const created = await addWorktreeSession(cwd, repoRoot, name, baseRef);
          setNotice({ kind: 'success', text: tf('worktreeCreated', { name: created.name }) });
          return created;
        } finally {
          setBusy('');
        }
      }, [cwd, repoRoot]);

      const fetchWorktrees = useCallback(
        () => rpc('worktrees', { workspace: cwd, repo: repoRoot }),
        [cwd, repoRoot],
      );

      const removeWorktree = useCallback(async (path, options) => {
        const result = await removeWorktreeSession(cwd, repoRoot, path, options);
        setNotice({ kind: 'success', text: t('worktreeRemoved') });
        return result;
      }, [cwd, repoRoot]);

      // A workspace that collects several independent repositories has no
      // single branch to show. The Git panel still offers the per-repository
      // switcher, but the composer entry would be misleading, so hide it.
      const repoCount = status && Array.isArray(status.repos) ? status.repos.length : 1;
      if (!active || !status || !status.isRepo || status.isBare || repoCount > 1) return null;

      return h(React.Fragment, null,
        h('div', {
          ref: dockRef,
          className: 'dshg-composer-dock-anchor',
          style: { display: 'none' },
          'aria-hidden': true,
        }),
        h(HeroRowPortal, { active: true, key: sessionId, anchorRef: dockRef },
          h(BranchSwitcher, {
            status,
            busy,
            load: loadBranches,
            onPick: pickBranch,
            onCreate: () => setDialog({ kind: 'create-branch' }),
            onGraph: () => setDialog({ kind: 'graph' }),
            onCreateWorktree: openWorktreeCreate,
            onManageWorktrees: () => setDialog({ kind: 'worktree-manage' }),
            hero: true,
          })),
        h('div', { className: 'dshg-composer-toast-host' },
          h(Toast, { toast: notice, onClose: () => setNotice(null) })),
        dialog && dialog.kind === 'create-branch' ? h(CreateBranchDialog, {
          onCreate: createBranch,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'graph' ? h(GitGraphDialog, {
          fetchGraph,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'worktree-create' ? h(CreateWorktreeDialog, {
          branches: worktreeBranches,
          currentBranch: status.branch || '',
          onCreate: createWorktree,
          onClose: () => setDialog(null),
        }) : null,
        dialog && dialog.kind === 'worktree-manage' ? h(WorktreeManagerDialog, {
          fetchWorktrees,
          onRemove: removeWorktree,
          onClose: () => setDialog(null),
        }) : null);
    }

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
    }) {
      const [query, setQuery] = useState('');
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

    function GitPanel() {
      const rootRef = useRef(null);
      const busyRef = useRef(false);
      const statusSeq = useRef(0);
      const bootstrapSeq = useRef(0);
      const prefixTimer = useRef(null);
      const draftTimer = useRef(null);
      const [workspaces, setWorkspaces] = useState([]);
      const [workspace, setWorkspace] = useState('');
      const [repos, setRepos] = useState([]);
      const [repo, setRepo] = useState('');
      const [showAllRepos, setShowAllRepos] = useState(() => readStorage('dsh-git.repoScope') === 'all');
      const [status, setStatus] = useState(null);
      const [loading, setLoading] = useState(true);
      const [busy, setBusy] = useState('');
      const [toast, setToast] = useState(null);
      const [expanded, setExpanded] = useState({});
      const [selected, setSelected] = useState(null);
      const [diff, setDiff] = useState(null);
      const [diffLoading, setDiffLoading] = useState(false);
      const [graph, setGraph] = useState(null);
      const [graphHasMore, setGraphHasMore] = useState(false);
      const [graphLoading, setGraphLoading] = useState(false);
      const [graphVersion, setGraphVersion] = useState(0);
      const [commitDetail, setCommitDetail] = useState(null);
      const [detailLoading, setDetailLoading] = useState(false);
      const [detailFile, setDetailFile] = useState(null);
      const [detailFileDiff, setDetailFileDiff] = useState(null);
      const [detailFileLoading, setDetailFileLoading] = useState(false);
      const [message, setMessage] = useState('');
      const [amend, setAmend] = useState(false);
      const [signoff, setSignoff] = useState(false);
      const [prefix, setPrefix] = useState(false);
      const [leftWidth, setLeftWidth] = useState(() => readPaneWidth('dsh-git.pane.left', 300, 220, 620));
      const [rightWidth, setRightWidth] = useState(() => readPaneWidth('dsh-git.pane.right', 400, 280, 820));
      const [resizing, setResizing] = useState(false);
      const [dialog, setDialog] = useState(null);
      const [worktreeBranches, setWorktreeBranches] = useState([]);

      const applyStatus = useCallback((next) => {
        setStatus(next);
        if (next && Array.isArray(next.repos)) setRepos(next.repos);
      }, []);

      const refreshStatus = useCallback(async (targetWorkspace, targetRepo, spinner = false) => {
        if (!targetWorkspace) return;
        const seq = ++statusSeq.current;
        if (spinner) setLoading(true);
        try {
          const next = await rpc('status', targetRepo
            ? { workspace: targetWorkspace, repo: targetRepo }
            : { workspace: targetWorkspace });
          if (seq === statusSeq.current) {
            applyStatus(next);
            setLoading(false);
            window.dispatchEvent(new Event('dsh-git:refresh'));
          }
        } catch (error) {
          if (seq === statusSeq.current) {
            setLoading(false);
            if (error && error.code === 'REPO_NOT_FOUND') {
              // The selected repository vanished (deleted or rebuilt by
              // `git init`); fall back to rediscovery instead of looping.
              setRepo('');
              return;
            }
            setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          }
        }
      }, [applyStatus]);

      /**
       * Pick the repository the panel opens with: the last one used for this
       * workspace, else the busiest one, else the workspace-root one. `seq`
       * discards the answer when the workspace changed meanwhile.
       */
      const bootstrap = useCallback(async (targetWorkspace, seq) => {
        try {
          const next = await rpc('status', { workspace: targetWorkspace });
          if (seq !== bootstrapSeq.current) return;
          const list = Array.isArray(next.repos) ? next.repos : [];
          setRepos(list);
          if (list.length === 0) {
            setStatus(next);
            setLoading(false);
            return;
          }
          const saved = readStorage(`dsh-git.repo:${targetWorkspace}`);
          // A repository whose work tree cannot be read (an uninitialised
          // submodule, for instance) is not a useful default.
          const usable = list.filter((item) => !item.error);
          const candidates = usable.length > 0 ? usable : list;
          const byChanged = (a, b) => {
            const left = a.counts ? a.counts.changed || 0 : 0;
            const right = b.counts ? b.counts.changed || 0 : 0;
            return right - left || (a.relativePath || '').localeCompare(b.relativePath || '');
          };
          // Prefer a project with pending work over a dependency that happens
          // to have changes, then any changed repository, then the workspace's
          // own repository.
          const preferred = candidates.filter((item) => repoIsProject(item) && repoChanged(item)).sort(byChanged)[0]
            || candidates.filter(repoChanged).sort(byChanged)[0]
            || candidates.find((item) => samePath(item.root, next.repoRoot))
            || candidates[0];
          const chosen = candidates.find((item) => samePath(item.root, saved)) || preferred;
          setRepo(chosen.root);
        } catch (error) {
          if (seq !== bootstrapSeq.current) return;
          setLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, []);

      const loadDiff = useCallback(async (targetWorkspace, targetRepo, path, mode) => {
        if (!targetWorkspace || !path) return;
        setDiffLoading(true);
        setDiff(null);
        try {
          const next = await rpc('diff', {
            workspace: targetWorkspace,
            repo: targetRepo,
            path,
            staged: mode === 'staged',
          });
          setDiff(next);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDiffLoading(false);
        }
      }, []);

      const loadGraph = useCallback(async (targetWorkspace, targetRepo) => {
        if (!targetWorkspace || !targetRepo) return;
        const next = await rpc('graph', { workspace: targetWorkspace, repo: targetRepo });
        setGraph(next.commits || []);
        setGraphHasMore(Boolean(next.hasMore));
      }, []);

      const loadMoreCommits = useCallback(async () => {
        if (!workspace || !repo || !graph) return;
        setGraphLoading(true);
        try {
          const next = await rpc('graph', { workspace, repo, skip: graph.length, limit: 200 });
          setGraph((current) => {
            const seen = new Set((current || []).map((commit) => commit.sha));
            return [...(current || []), ...(next.commits || []).filter((commit) => !seen.has(commit.sha))];
          });
          setGraphHasMore(Boolean(next.hasMore));
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setGraphLoading(false);
        }
      }, [workspace, repo, graph]);

      const act = useCallback(async (label, operation) => {
        if (busyRef.current) return null;
        busyRef.current = true;
        setBusy(label);
        setToast(null);
        try {
          const result = await operation();
          if (result && result.message) {
            setToast({ kind: 'success', text: result.message, detail: result.detail || null });
          }
          return result;
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
          return null;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, []);

      /** Branch list is read lazily, only when the switcher opens. */
      const loadBranches = useCallback(async () => {
        if (!workspace || !repo) return { branches: [] };
        return rpc('branches', { workspace, repo });
      }, [workspace, repo]);

      const pickBranch = useCallback(async (pick) => {
        const branch = typeof pick === 'string' ? pick : pick.branch;
        const remoteBranch = pick && typeof pick === 'object' ? pick.remoteBranch : undefined;
        await act(t('checkingOut'), async () => {
          const result = await rpc('checkout', { workspace, repo, branch, remoteBranch });
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          const name = (result && result.branch) || branch;
          return {
            message: result && result.created
              ? tf('branchTrackingCreated', { branch: name })
              : tf('branchSwitched', { branch: name }),
          };
        });
      }, [workspace, repo, act, refreshStatus]);

      const createBranchFromHead = useCallback(async (name) => {
        busyRef.current = true;
        setBusy(t('creatingBranch'));
        setToast(null);
        try {
          const result = await rpc('create-branch', { workspace, repo, name });
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          setToast({ kind: 'success', text: tf('branchCreated', { branch: (result && result.branch) || name }) });
          return result;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, [workspace, repo, refreshStatus]);

      const fetchGraphDialog = useCallback(async (limit) => {
        return rpc('graph', { workspace, repo, limit, all: true });
      }, [workspace, repo]);

      const openWorktreeCreate = useCallback(async () => {
        try {
          const next = await loadBranches();
          const names = (next && Array.isArray(next.local) ? next.local : []).map((item) => item.name);
          if (status && status.branch && !names.includes(status.branch)) names.unshift(status.branch);
          if (names.length === 0) {
            setToast({ kind: 'error', text: t('worktreeNoBase') });
            return;
          }
          setWorktreeBranches(names);
          setDialog({ kind: 'worktree-create' });
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        }
      }, [loadBranches, status]);

      const openWorktreeManager = useCallback(() => {
        setDialog({ kind: 'worktree-manage' });
      }, []);

      const createWorktreeSession = useCallback(async (name, baseRef) => {
        busyRef.current = true;
        setBusy(t('worktreeStarting'));
        setToast(null);
        try {
          const created = await addWorktreeSession(workspace, repo, name, baseRef);
          setToast({ kind: 'success', text: tf('worktreeCreated', { name: created.name }) });
          setGraphVersion((value) => value + 1);
          return created;
        } finally {
          busyRef.current = false;
          setBusy('');
        }
      }, [workspace, repo]);

      const fetchWorktrees = useCallback(() => rpc('worktrees', { workspace, repo }), [workspace, repo]);

      const removeWorktree = useCallback(async (path, options) => {
        const result = await removeWorktreeSession(workspace, repo, path, options);
        setToast({ kind: 'success', text: t('worktreeRemoved') });
        setGraphVersion((value) => value + 1);
        return result;
      }, [workspace, repo]);

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
        // Invalidate every read still in flight for the previous workspace.
        statusSeq.current += 1;
        bootstrapSeq.current += 1;
        setStatus(null);
        setLoading(true);
        setRepos([]);
        setRepo('');
        setSelected(null);
        setDiff(null);
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        setGraph(null);
        setGraphHasMore(false);
        setExpanded({});
        setAmend(false);
        setSignoff(false);
        setDialog(null);
        setGraphVersion((value) => value + 1);
      }, [workspace]);

      useEffect(() => {
        if (!workspace) return undefined;
        if (!repo) {
          // No repository chosen yet (first open, or the previous choice
          // disappeared): learn the repository list, then pick one.
          const seq = ++bootstrapSeq.current;
          setLoading(true);
          bootstrap(workspace, seq);
          return undefined;
        }
        writeStorage(`dsh-git.repo:${workspace}`, repo);
        setSelected(null);
        setDiff(null);
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        setGraph(null);
        setGraphHasMore(false);
        setAmend(false);
        setSignoff(false);
        setDialog(null);
        setGraphVersion((value) => value + 1);
        refreshStatus(workspace, repo, true);
        const timer = setInterval(() => {
          if (busyRef.current) return;
          if (document.visibilityState === 'hidden') return;
          refreshStatus(workspace, repo, false);
        }, 5000);
        return () => clearInterval(timer);
      }, [workspace, repo, bootstrap, refreshStatus]);

      useEffect(() => {
        if (!workspace) return;
        if (draftTimer.current) clearTimeout(draftTimer.current);
        const draftKey = `dsh-git.draft:${workspace}`;
        setMessage(readStorage(draftKey) || '');
      }, [workspace]);

      useEffect(() => {
        if (!workspace || !repo) return undefined;
        let alive = true;
        setGraphLoading(true);
        loadGraph(workspace, repo).then(() => {
          if (alive) setGraphLoading(false);
        }).catch((error) => {
          if (!alive) return;
          setGraphLoading(false);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        });
        return () => { alive = false; };
      }, [workspace, repo, graphVersion, loadGraph]);

      useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(
          () => setToast(null),
          toast.kind === 'error' ? 9000 : (toast.detail ? 8000 : 5000),
        );
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
        await refreshStatus(workspace, repo, false);
        if (includeGraph) setGraphVersion((value) => value + 1);
        if (selected) await loadDiff(workspace, repo, selected.path, selected.mode);
      }, [workspace, repo, selected, refreshStatus, loadDiff]);

      const stage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('stage'), async () => {
          await rpc('stage', { workspace, repo, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('stageDone', { count: unique.length }) };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const unstage = useCallback(async (paths) => {
        const unique = Array.from(new Set(paths));
        if (unique.length === 0) return;
        await act(t('unstage'), async () => {
          await rpc('unstage', { workspace, repo, paths: unique });
          await reloadAfterMutation(false);
          return { message: tf('unstageDone', { count: unique.length }) };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

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
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        loadDiff(workspace, repo, entry.path, mode);
      }, [workspace, repo, loadDiff]);

      const openFile = useCallback((entry, section) => {
        const mode = section === 'staged' ? 'staged' : entry.partial ? 'staged' : 'unstaged';
        setSelected({ path: entry.path, mode, entry });
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        loadDiff(workspace, repo, entry.path, mode);
      }, [workspace, repo, loadDiff]);

      const switchDiffMode = useCallback((mode) => {
        if (!selected) return;
        setSelected({ ...selected, mode });
        loadDiff(workspace, repo, selected.path, mode);
      }, [selected, workspace, repo, loadDiff]);
      const initRepository = useCallback(async () => {
        await act(t('initializing'), async () => {
          const next = await rpc('init', { workspace });
          if (Array.isArray(next.repos)) setRepos(next.repos);
          if (next.repoRoot) setRepo(next.repoRoot);
          else setStatus(next);
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
            repo,
            message,
            amend,
            signoff,
          });
          if (draftTimer.current) clearTimeout(draftTimer.current);
          setMessage('');
          writeStorage(`dsh-git.draft:${workspace}`, null);
          setAmend(false);
          setSignoff(false);
          await refreshStatus(workspace, repo, false);
          setGraphVersion((value) => value + 1);
          return { message: `${t('committed')} ${result.sha || ''}`.trim() };
        });
      }, [status, message, amend, signoff, workspace, repo, act, refreshStatus]);

      const fetchRemote = useCallback(async () => {
        await act(t('fetch'), async () => {
          const result = await rpc('fetch', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: fetchSummary(result),
            detail: fetchDetail(result),
          };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const pullRemote = useCallback(async () => {
        await act(t('pull'), async () => {
          const result = await rpc('pull', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: pullSummary(result),
            detail: result && result.output ? result.output : null,
          };
        });
      }, [workspace, act, reloadAfterMutation]);

      const pushRemote = useCallback(async () => {
        await act(t('push'), async () => {
          const result = await rpc('push', { workspace, repo });
          await reloadAfterMutation(true);
          return {
            message: pushSummary(result),
            detail: result && result.output ? result.output : null,
          };
        });
      }, [workspace, repo, act, reloadAfterMutation]);

      const openCommit = useCallback(async (sha) => {
        setDetailLoading(true);
        setCommitDetail(null);
        setSelected(null);
        setDiff(null);
        setDetailFile(null);
        setDetailFileDiff(null);
        try {
          const detail = await rpc('commit-detail', { workspace, repo, sha });
          setCommitDetail(detail);
        } catch (error) {
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDetailLoading(false);
        }
      }, [workspace, repo]);

      const closeCommitDetail = useCallback(() => {
        setCommitDetail(null);
        setDetailFile(null);
        setDetailFileDiff(null);
      }, []);

      /** Show one file of the open commit; `null` returns to the full patch. */
      const selectCommitFile = useCallback(async (path) => {
        const sha = commitDetail && commitDetail.sha;
        if (!sha) return;
        setDetailFile(path || null);
        if (!path) {
          setDetailFileDiff(null);
          return;
        }
        setDetailFileLoading(true);
        try {
          const next = await rpc('commit-detail', { workspace, repo, sha, path });
          setDetailFileDiff(next);
        } catch (error) {
          setDetailFile(null);
          setToast({ kind: 'error', text: errorText(error), detail: error.detail || null });
        } finally {
          setDetailFileLoading(false);
        }
      }, [commitDetail, workspace, repo]);

      const copyText = useCallback(async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          setToast({ kind: 'success', text: t('copied') });
        } catch {
          setToast({ kind: 'error', text: t('copy') });
        }
      }, []);

      /** Drag a splitter to resize the left/center or center/right panes. */
      const startResize = useCallback((side, event) => {
        if (event.button !== undefined && event.button !== 0) return;
        const root = rootRef.current;
        if (!root) return;
        event.preventDefault();
        const startX = event.clientX;
        const startLeft = leftWidth;
        const startRight = rightWidth;
        const total = root.clientWidth;
        const minCenter = 300;
        const minSide = side === 'left' ? 220 : 280;
        setResizing(true);
        try { document.body.classList.add('dshg-resizing'); } catch { /* ignore */ }

        const onMove = (moveEvent) => {
          if (side === 'left') {
            const max = Math.max(minSide, total - startRight - minCenter);
            setLeftWidth(clampPaneWidth(startLeft + (moveEvent.clientX - startX), minSide, max));
          } else {
            const max = Math.max(minSide, total - startLeft - minCenter);
            setRightWidth(clampPaneWidth(startRight - (moveEvent.clientX - startX), minSide, max));
          }
        };
        const finish = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', finish);
          try { document.body.classList.remove('dshg-resizing'); } catch { /* ignore */ }
          setResizing(false);
          setLeftWidth((value) => { writeStorage('dsh-git.pane.left', String(value)); return value; });
          setRightWidth((value) => { writeStorage('dsh-git.pane.right', String(value)); return value; });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
      }, [leftWidth, rightWidth]);

      const nudgePane = useCallback((side, delta) => {
        if (side === 'left') {
          setLeftWidth((value) => {
            const next = clampPaneWidth(value + delta, 220, 620);
            writeStorage('dsh-git.pane.left', String(next));
            return next;
          });
        } else {
          setRightWidth((value) => {
            const next = clampPaneWidth(value + delta, 280, 820);
            writeStorage('dsh-git.pane.right', String(next));
            return next;
          });
        }
      }, []);

      const resetPane = useCallback((side) => {
        if (side === 'left') {
          setLeftWidth(300);
          writeStorage('dsh-git.pane.left', '300');
        } else {
          setRightWidth(400);
          writeStorage('dsh-git.pane.right', '400');
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
        }
      }, [commit, stageAll, unstageAll, prefix, fetchRemote, pushRemote, pullRemote]);

      const hasRepo = Boolean(status && status.isRepo && !status.isBare);
      const isBare = Boolean(status && status.isRepo && status.isBare);

      return h('div', {
        ref: rootRef,
        className: cx('dshg-root', resizing && 'dshg-resizing'),
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        'aria-label': t('panel'),
        'aria-busy': busy ? 'true' : 'false',
      },
      h(PanelHeader, {
        workspaces,
        workspace,
        repos,
        repo,
        showAllRepos,
        status,
        busy,
        onWorkspace: (next) => {
          setWorkspace(next);
          writeStorage('dsh-git.workspace', next);
        },
        onRepo: (next) => {
          // A manual pick outranks a repository bootstrap still in flight.
          bootstrapSeq.current += 1;
          setRepo(next);
          writeStorage(`dsh-git.repo:${workspace}`, next);
        },
        onToggleRepos: () => {
          setShowAllRepos((current) => {
            const next = !current;
            writeStorage('dsh-git.repoScope', next ? 'all' : 'top');
            return next;
          });
        },
        onRefresh: () => refreshStatus(workspace, repo, true),
        onFetch: fetchRemote,
        onPull: pullRemote,
        onPush: pushRemote,
        loadBranches,
        onPickBranch: pickBranch,
        onCreateBranch: () => setDialog({ kind: 'create-branch' }),
        onOpenGraph: () => setDialog({ kind: 'graph' }),
        onOpenWorktree: openWorktreeCreate,
        onManageWorktrees: openWorktreeManager,
      }),
      h(Toast, { toast, onClose: () => setToast(null) }),
      dialog && dialog.kind === 'create-branch' ? h(CreateBranchDialog, {
        onCreate: createBranchFromHead,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'graph' ? h(GitGraphDialog, {
        fetchGraph: fetchGraphDialog,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'worktree-create' ? h(CreateWorktreeDialog, {
        branches: worktreeBranches,
        currentBranch: status && status.branch ? status.branch : '',
        onCreate: createWorktreeSession,
        onClose: () => setDialog(null),
      }) : null,
      dialog && dialog.kind === 'worktree-manage' ? h(WorktreeManagerDialog, {
        fetchWorktrees,
        onRemove: removeWorktree,
        onClose: () => setDialog(null),
      }) : null,
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
        h('div', { className: 'dshg-left', style: { width: `${leftWidth}px` } },
          h('div', { className: 'dshg-pane-head' },
            h('span', { className: 'dshg-pane-title' }, t('changes')),
            h('span', { className: 'dshg-count' }, status.counts.changed),
            h('span', { className: 'dshg-spacer' }),
            h('button', {
              type: 'button',
              className: 'dshg-iconbtn',
              title: t('stageAll'),
              'aria-label': t('stageAll'),
              disabled: Boolean(busy) || status.counts.changed === 0,
              onClick: stageAll,
            }, h(IconCheck, { size: 14 })),
            h('button', {
              type: 'button',
              className: 'dshg-iconbtn',
              title: t('unstageAll'),
              'aria-label': t('unstageAll'),
              disabled: Boolean(busy) || status.counts.staged === 0,
              onClick: unstageAll,
            }, h(IconMinus, { size: 14 }))),
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
            })),
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
          })),
        h(PaneResizer, {
          side: 'left',
          onStart: startResize,
          onNudge: nudgePane,
          onReset: resetPane,
        }),
        h('div', { className: 'dshg-center' },
          h(HistoryView, {
            graph,
            graphLoading,
            graphHasMore,
            onLoadMore: loadMoreCommits,
            selectedSha: commitDetail && commitDetail.sha,
            onSelectCommit: openCommit,
          })),
        h(PaneResizer, {
          side: 'right',
          onStart: startResize,
          onNudge: nudgePane,
          onReset: resetPane,
        }),
        h('div', { className: 'dshg-right', style: { width: `${rightWidth}px` } },
          detailLoading && !commitDetail
            ? h('div', { className: 'dshg-empty' }, t('loading'))
            : commitDetail
              ? h(CommitDetailView, {
                  commitDetail,
                  detailFile,
                  detailFileDiff,
                  detailFileLoading,
                  onBack: closeCommitDetail,
                  onSelectFile: selectCommitFile,
                  onCopy: copyText,
                })
              : h(DiffView, {
                  selected,
                  diff,
                  diffLoading,
                  onMode: switchDiffMode,
                  onClose: () => { setSelected(null); setDiff(null); },
                  status,
                  repos,
                  repo,
                  graph,
                  onShowHistory: () => { if (graph && graph[0]) openCommit(graph[0].sha); },
                })))) : null);
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
      /* ------------------------------------------------------------------ *
       * Visual language
       *
       * Pill controls and quiet status letters, matching the host sidebar's
       * rounded session rows. Status colours and the monospace letter / 6px
       * directory dot follow ZCode's workspace file tree:
       *   modified amber, added+untracked teal, deleted red, renamed sky,
       *   ignored muted — the letter sits at 80% opacity, no badge box.
       * ------------------------------------------------------------------ */
      :root {
        --dshg-git-added: var(--dsw-alias-state-success-primary, #46bf72);
        --dshg-git-modified: var(--dsw-alias-state-warn-primary, #ff8a30);
        --dshg-git-deleted: var(--dsw-alias-state-error-primary, #ff5c5c);
        --dshg-git-renamed: var(--dsw-alias-state-business-primary, #4099ff);
        --dshg-git-conflict: var(--dsw-alias-state-error-primary, #ff5c5c);
        --dshg-git-ignored: var(--dsw-alias-label-tertiary, #8b8f96);
      }
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
        font-size: 12px;
        outline: none;
      }
      .dshg-root:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4a8cff); outline-offset: -2px; }
      .dshg-root button:focus-visible,
      .dshg-root select:focus-visible,
      .dshg-root textarea:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4a8cff); outline-offset: 2px; }
      .dshg-root *, .dshg-root *::before, .dshg-root *::after { box-sizing: border-box; }
      /* The composer pill and its menu/dialogs live outside .dshg-root (they
         are portalled into the shell hero row), so they need the same
         border-box contract explicitly. */
      .dshg-pillselect, .dshg-menu, .dshg-dialog, .dshg-composer-toast-host { box-sizing: border-box; }
      .dshg-pillselect *, .dshg-menu *, .dshg-dialog *, .dshg-composer-toast-host * { box-sizing: border-box; }

      /* Header ---------------------------------------------------------- */
      .dshg-header {
        display: flex; align-items: center; gap: 8px;
        min-height: 44px; padding: 0 12px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        flex: 0 0 auto; overflow: visible;
      }
      .dshg-brand { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 650; white-space: nowrap; }
      .dshg-spacer { flex: 1 1 auto; }
      .dshg-actions { display: flex; align-items: center; gap: 2px; }

      /* Pill selectors: the popup is ours, so it follows the pill language
         instead of the OS <select> list. */
      .dshg-pillselect { position: relative; display: inline-flex; min-width: 0; flex: 0 1 auto; }
      .dshg-pillselect-trigger {
        position: relative; display: inline-flex; align-items: center; gap: 6px;
        height: 26px; max-width: 240px; min-width: 0; padding: 0 26px 0 10px;
        border: 1px solid transparent; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 11.5px; white-space: nowrap; cursor: pointer;
        transition: background-color .12s ease;
      }
      .dshg-pillselect-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-pillselect-trigger[aria-expanded="true"] { background: var(--dsw-alias-bg-layer-2, #eef2f7); }
      .dshg-pillselect-trigger:disabled { opacity: .5; cursor: default; }
      /* Blank-session hero seat: transparent 28px pill, matching the
         workspace / agent-preset controls beside it. */
      .dshg-pillselect-hero {
        height: 28px; max-width: 220px; padding: 0 24px 0 6px;
        border: 1px solid transparent; border-radius: 16px;
        background: transparent; color: var(--dsw-alias-label-primary, #111);
        gap: 4px; font-size: 13px; font-weight: 500; margin-left: 4px;
      }
      .dshg-pillselect-hero:hover:not(:disabled),
      .dshg-pillselect-hero[aria-expanded="true"] {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10));
      }
      .dshg-pillselect-hero .dshg-pill-strong { font-weight: 500; }
      .dshg-pillselect-hero .dshg-pillselect-chevron {
        right: 8px;
        border-top-color: var(--dsw-alias-label-caption, #9ca3af);
      }
      .dshg-pillselect-chevron {
        position: absolute; right: 9px; pointer-events: none;
        width: 0; height: 0;
        border-left: 4px solid transparent; border-right: 4px solid transparent;
        border-top: 5px solid var(--dsw-alias-label-tertiary, #6b7280);
      }
      .dshg-pill-label { overflow: hidden; text-overflow: ellipsis; }
      .dshg-pill-strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
      .dshg-pillcount { color: var(--dsw-alias-label-tertiary, #6b7280); font-variant-numeric: tabular-nums; }
      .dshg-repo-name {
        max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px;
      }

      .dshg-menu {
        position: absolute; top: calc(100% + 6px); left: 0; z-index: 30;
        min-width: 240px; max-width: min(420px, 82vw); max-height: 340px; overflow: auto;
        padding: 6px; border-radius: 14px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #fff));
        box-shadow: var(--dsw-elevation-panel, 0 12px 32px rgba(0,0,0,.18));
      }
      .dshg-menu-end { left: auto; right: 0; }
      .dshg-menu-group {
        padding: 6px 8px 3px;
        color: var(--dsw-alias-label-tertiary, #6b7280);
        font-size: 9.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
      }
      .dshg-menu-item {
        display: flex; align-items: center; gap: 7px;
        width: 100%; min-height: 28px; padding: 0 8px;
        border: 0; border-radius: 999px; background: transparent; color: inherit;
        font: inherit; font-size: 12px; text-align: left; cursor: pointer;
        transition: background-color .1s ease;
      }
      .dshg-menu-item:hover:not(:disabled), .dshg-menu-item:focus-visible {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10));
        outline: none;
      }
      .dshg-menu-item.active { background: var(--dsw-alias-bg-layer-2, #eef2f7); font-weight: 600; }
      .dshg-menu-item:disabled { opacity: .45; cursor: default; }
      .dshg-menu-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-menu-hint { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10px; }
      .dshg-menu-check { flex: 0 0 auto; color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-menu-search {
        width: 100%; height: 26px; margin-bottom: 4px; padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7); color: inherit;
        font: inherit; font-size: 11.5px; outline: none;
      }
      .dshg-menu-search:focus { border-color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-menu-empty, .dshg-menu-error { padding: 8px 10px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }
      .dshg-menu-error { color: var(--dshg-git-deleted); }
      .dshg-menu-footer {
        display: flex; justify-content: center;
        margin-top: 4px; padding: 4px 0 2px;
        border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      .dshg-menu-action {
        height: 24px; padding: 0 10px; border: 0; border-radius: 999px;
        background: transparent; color: var(--dsw-alias-state-business-primary, #4a8cff);
        font: inherit; font-size: 10.5px; cursor: pointer;
      }
      .dshg-menu-action:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }

      /* Branch menu footer: the four reference actions, one per row. */
      .dshg-menu-actions {
        display: flex; flex-direction: column; gap: 1px;
        flex: 0 0 auto;
        margin-top: 4px; padding: 6px 2px 0;
        border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      .dshg-menu-action-row {
        display: flex; align-items: center; gap: 9px;
        width: 100%; min-height: 30px; padding: 0 8px;
        border: 0; border-radius: 8px; background: transparent; color: inherit;
        font: inherit; font-size: 12px; text-align: left; cursor: pointer;
        transition: background-color .1s ease;
      }
      .dshg-menu-action-row:hover, .dshg-menu-action-row:focus-visible {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10));
        outline: none;
      }
      .dshg-menu-action-row svg { flex: 0 0 auto; color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-menu-action-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Branch menu: search + scrollable list + fixed action footer. */
      .dshg-menu-branch {
        width: 320px; max-width: min(360px, 88vw);
        max-height: none; overflow: hidden;
        display: flex; flex-direction: column;
        padding: 6px 6px 4px;
      }
      .dshg-menu-tabs { display: flex; gap: 4px; padding: 0 0 6px; flex: 0 0 auto; }
      .dshg-menu-tab {
        flex: 1 1 0; height: 26px; border: 0; border-radius: 999px;
        background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
        font: inherit; font-size: 11.5px; cursor: pointer;
      }
      .dshg-menu-tab:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-menu-tab.active { background: var(--dsw-alias-bg-layer-2, #eef2f7); color: var(--dsw-alias-label-primary, #111); font-weight: 600; }
      .dshg-menu-tab-count { margin-left: 5px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10px; }
      .dshg-menu-branch .dshg-menu-search { flex: 0 0 auto; }
      .dshg-menu-branch .dshg-menu-list {
        max-height: 196px;
      }
      .dshg-menu-list {
        flex: 1 1 auto; min-height: 0; max-height: 248px; overflow: auto;
        padding-right: 2px;
      }

      .dshg-chip {
        display: inline-flex; align-items: center; gap: 4px;
        height: 24px; padding: 0 9px;
        border: 1px solid transparent; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 11px; white-space: nowrap; max-width: 260px;
      }
      .dshg-chip strong { color: var(--dsw-alias-label-primary, #111); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
      .dshg-ahead { color: var(--dshg-git-added); }
      .dshg-behind { color: var(--dshg-git-modified); }
      .dshg-muted { color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }

      /* Pill buttons ---------------------------------------------------- */
      .dshg-btn, .dshg-iconbtn {
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        height: 26px; padding: 0 10px;
        border: 1px solid transparent; border-radius: 999px;
        background: transparent; color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 11.5px; white-space: nowrap; cursor: pointer;
        transition: background-color .12s ease, color .12s ease, opacity .12s ease;
      }
      .dshg-btn:hover:not(:disabled), .dshg-iconbtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-btn:active:not(:disabled), .dshg-iconbtn:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active, rgba(127,127,127,.16)); }
      .dshg-btn:disabled, .dshg-iconbtn:disabled { opacity: .4; cursor: default; }
      .dshg-btn-brand { color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-btn-small { height: 22px; padding: 0 8px; font-size: 10.5px; }
      .dshg-iconbtn { width: 26px; padding: 0; }
      .dshg-progress {
        position: absolute; top: 44px; left: 12px; right: 12px; height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, var(--dsw-alias-state-business-primary, #4a8cff), transparent);
        background-size: 50% 100%; background-repeat: no-repeat;
        animation: dshg-progress 1.1s linear infinite;
        z-index: 4;
      }
      @keyframes dshg-progress { from { background-position: -50% 0; } to { background-position: 150% 0; } }

      /* Left pane ------------------------------------------------------- */
      .dshg-body { flex: 1 1 auto; display: flex; min-height: 0; overflow: hidden; }
      /* Drag handle between panes: 7px hit area, hairline that lights up. */
      .dshg-resizer {
        flex: 0 0 auto; width: 7px; margin: 0 -1px;
        display: flex; align-items: stretch; justify-content: center;
        cursor: col-resize; position: relative; z-index: 2; touch-action: none;
      }
      .dshg-resizer::after {
        content: ''; width: 2px; margin: 8px 0; border-radius: 999px;
        background: transparent; transition: background-color .12s ease;
      }
      .dshg-resizer:hover::after, .dshg-resizer:focus-visible::after {
        background: var(--dsw-alias-border-l3, #cfd3d9);
      }
      .dshg-resizer:focus-visible { outline: none; }
      body.dshg-resizing, body.dshg-resizing * {
        cursor: col-resize !important;
        user-select: none !important;
      }
      .dshg-left {
        flex: 0 0 auto; display: flex; flex-direction: column;
        min-height: 0; min-width: 0; max-width: 46%;
        border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      .dshg-pane-head { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 8px 0 12px; flex: 0 0 auto; }
      .dshg-pane-title { font-size: 12px; font-weight: 650; }
      .dshg-count {
        min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 10px; line-height: 18px; text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .dshg-pane-head .dshg-iconbtn { width: 24px; height: 24px; color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-pane-head .dshg-iconbtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #111); }
      .dshg-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 6px 8px; }
      .dshg-sections { display: flex; flex-direction: column; }
      .dshg-section { padding: 2px 0 6px; }
      .dshg-section-head {
        display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px;
        color: var(--dsw-alias-label-tertiary, #6b7280);
        font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
      }
      .dshg-tree { display: flex; flex-direction: column; }
      .dshg-row {
        display: flex; align-items: center; gap: 6px;
        min-height: 26px; padding: 0 8px;
        border-radius: 999px;
        font-size: 12px; cursor: default; user-select: none;
        transition: background-color .1s ease;
      }
      .dshg-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); }
      .dshg-dir-row { min-height: 24px; color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; }
      .dshg-chevron { width: 12px; text-align: center; font-size: 9px; flex: 0 0 auto; opacity: .75; }
      .dshg-dir-icon { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-dir-name { display: inline-flex; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-primary, #111); font-size: 11.5px; }
      .dshg-dir-prefix { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-dir-leaf { flex: 0 0 auto; white-space: nowrap; }
      .dshg-dir-count { margin-left: auto; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 9.5px; }
      .dshg-file-row { cursor: pointer; }
      .dshg-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .dshg-deleted-row .dshg-file-name { text-decoration: line-through; opacity: .72; }
      .dshg-partial-mark { color: var(--dshg-git-modified); font-size: 10px; }

      /* Status letters and dots (ZCode file-tree language) -------------- */
      .dshg-badge {
        flex: 0 0 auto; min-width: 12px; padding: 0;
        border: 0; background: none;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px; font-weight: 700; line-height: 1; text-align: left;
        opacity: .9;
      }
      .dshg-st-added, .dshg-st-untracked { color: var(--dshg-git-added); }
      .dshg-st-modified { color: var(--dshg-git-modified); }
      .dshg-st-deleted, .dshg-st-conflict { color: var(--dshg-git-deleted); }
      .dshg-st-ignored { color: var(--dshg-git-ignored); }
      .dshg-st-renamed, .dshg-st-copied { color: var(--dshg-git-renamed); }
      .dshg-dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; opacity: .9; }
      .dshg-dot-added { background: var(--dshg-git-added); }
      .dshg-dot-modified { background: var(--dshg-git-modified); }
      .dshg-dot-deleted, .dshg-dot-conflict { background: var(--dshg-git-deleted); }
      .dshg-dot-renamed { background: var(--dshg-git-renamed); }

      .dshg-check {
        width: 16px; height: 16px; flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1.5px solid var(--dsw-alias-border-l3, #cfd3d9);
        border-radius: 999px; background: transparent; color: transparent;
        cursor: pointer; padding: 0;
        transition: background-color .12s ease, border-color .12s ease, color .12s ease;
      }
      .dshg-check:hover { border-color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-check.checked { background: var(--dsw-alias-state-business-primary, #4a8cff); border-color: transparent; color: #fff; }
      .dshg-check.partial { border-color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-check-line { width: 7px; height: 2px; border-radius: 999px; background: var(--dsw-alias-state-business-primary, #4a8cff); display: block; }

      /* Panes ------------------------------------------------------------ */
      .dshg-center {
        flex: 1 1 auto; min-width: 260px; display: flex; flex-direction: column;
        min-height: 0; overflow: hidden;
        border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      /* The history wrapper needs the full column height so the list itself scrolls. */
      .dshg-center-pane {
        flex: 1 1 auto; display: flex; flex-direction: column;
        min-height: 0; min-width: 0; overflow: hidden;
      }
      .dshg-right { flex: 0 0 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; max-width: 52%; }
      .dshg-center-head { gap: 8px; }
      .dshg-history-search {
        margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 9px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-tertiary, #6b7280); min-width: 0;
      }
      .dshg-history-search:focus-within {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 22%, transparent);
      }
      .dshg-history-search input {
        width: 168px; max-width: 38vw; border: 0; background: transparent;
        color: var(--dsw-alias-label-primary, #111); font: inherit; font-size: 11.5px; outline: none;
      }
      .dshg-history-search input::placeholder { color: var(--dsw-alias-label-tertiary, #6b7280); }

      .dshg-diff-pane { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
      .dshg-diff-head { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); flex: 0 0 auto; }
      .dshg-diff-title { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; }
      .dshg-diff-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .dshg-segmented { display: inline-flex; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-bg-layer-1, #f4f5f7); }
      .dshg-seg { height: 22px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); font: inherit; font-size: 11px; cursor: pointer; }
      .dshg-seg.active { background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #111); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
      .dshg-diff-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; background: var(--dsw-alias-bg-base, #fff); }
      .dshg-diff-wrap { padding: 2px 0 18px; }
      .dshg-diff { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 11.5px; line-height: 1.55; tab-size: 4; }
      .dshg-line { display: grid; grid-template-columns: 42px 42px minmax(0, 1fr); min-height: 18px; padding: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--dsw-alias-label-primary, #111); }
      .dshg-ln { text-align: right; padding-right: 7px; color: var(--dsw-alias-label-tertiary, #6b7280); opacity: .55; user-select: none; font-variant-numeric: tabular-nums; border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb); margin-right: 8px; }
      .dshg-code { min-width: 0; padding-right: 12px; overflow-wrap: anywhere; word-break: break-word; }
      .dshg-line-add { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 9%, transparent); }
      .dshg-line-del { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 9%, transparent); }
      .dshg-line-hunk, .dshg-line-meta { display: block; padding: 2px 12px; }
      .dshg-line-hunk { background: var(--dsw-alias-bg-layer-1, #f8fafc); color: var(--dsw-alias-state-business-primary, #2563eb); border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
      .dshg-line-meta { color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-truncated { padding: 8px 12px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }

      .dshg-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-empty-inline { min-height: 120px; }
      .dshg-empty-icon { color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-empty-title { color: var(--dsw-alias-label-primary, #111); font-size: 13px; font-weight: 600; }
      .dshg-empty-desc { max-width: 360px; font-size: 12px; line-height: 1.5; }
      .dshg-loading { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 12px; }

      /* History --------------------------------------------------------- */
      .dshg-history-columns {
        display: grid; align-items: center; gap: 8px;
        height: 26px; padding: 0 12px; flex: 0 0 auto;
        color: var(--dsw-alias-label-tertiary, #6b7280);
        font-size: 10px; font-weight: 600; letter-spacing: .02em;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        white-space: nowrap;
      }
      .dshg-history { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 0 10px; }
      .dshg-commit-row {
        display: grid; align-items: center; gap: 8px;
        min-height: 32px; padding: 0 12px;
        cursor: pointer; transition: background-color .1s ease;
        border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1, #e5e7eb) 45%, transparent);
      }
      .dshg-commit-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.07)); }
      .dshg-commit-row.active { background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 10%, transparent); }
      .dshg-graph-cell { display: block; overflow: visible; }
      .dshg-commit-main { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
      .dshg-commit-subject { display: flex; align-items: center; gap: 5px; min-width: 0; font-size: 12px; overflow: hidden; }
      .dshg-commit-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-commit-time, .dshg-commit-author {
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10.5px;
      }
      .dshg-sha { color: var(--dsw-alias-label-tertiary, #6b7280); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
      .dshg-merge-mark {
        flex: 0 0 auto; height: 15px; padding: 0 5px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7); color: var(--dsw-alias-label-tertiary, #6b7280);
        font-size: 8.5px; line-height: 15px;
      }
      .dshg-ref { display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; max-width: 150px; height: 17px; padding: 0 6px; border-radius: 999px; font-size: 9.5px; }
      .dshg-ref-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-ref.head { background: color-mix(in srgb, var(--dshg-git-added) 16%, transparent); color: var(--dshg-git-added); font-weight: 600; }
      .dshg-ref.tag { background: color-mix(in srgb, var(--dshg-git-modified) 16%, transparent); color: var(--dshg-git-modified); }
      .dshg-ref.local { background: var(--dsw-alias-bg-layer-1, #f4f5f7); color: var(--dsw-alias-label-secondary, #6b7280); }
      .dshg-ref.remote { background: var(--dsw-alias-bg-layer-1, #f4f5f7); color: var(--dsw-alias-label-tertiary, #6b7280); opacity: .92; }
      .dshg-history-more { display: flex; justify-content: center; padding: 10px; flex: 0 0 auto; }
      .dshg-file-diff { display: inline-flex; gap: 5px; flex: 0 0 auto; font-size: 9.5px; font-variant-numeric: tabular-nums; opacity: .9; }
      .dshg-add { color: var(--dshg-git-added); }
      .dshg-del { color: var(--dshg-git-deleted); }

      /* Shared tooltip for truncated labels (data-dshg-tip). */
      .dshg-tip {
        position: fixed; z-index: 10000; max-width: min(460px, 80vw);
        padding: 5px 9px; border-radius: 8px;
        background: var(--dsw-alias-bg-overlay, #fff);
        color: var(--dsw-alias-label-primary, #111);
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25));
        box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0,0,0,.16));
        font-size: 11px; line-height: 1.45;
        white-space: normal; word-break: break-word;
        pointer-events: none;
      }
      .dshg-tip[hidden] { display: none; }

      .dshg-detail { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
      .dshg-detail-head {
        height: 38px; padding: 0 12px; flex: 0 0 auto;
        display: flex; align-items: center; gap: 8px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
      }
      .dshg-detail-head .dshg-iconbtn { width: 24px; height: 24px; }
      .dshg-detail-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 12px; }
      .dshg-detail-card {
        display: flex; flex-direction: column;
        padding: 16px 14px 12px; border-radius: 14px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: var(--dsw-alias-bg-layer-1, #f8fafc);
      }
      .dshg-avatar {
        width: 46px; height: 46px; margin: 2px auto 8px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4a8cff) 16%, transparent);
        color: var(--dsw-alias-state-business-primary, #4a8cff);
        font-size: 15px; font-weight: 700; letter-spacing: .02em;
      }
      .dshg-detail-author { text-align: center; font-size: 13.5px; font-weight: 650; }
      .dshg-detail-date { text-align: center; margin-top: 2px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }
      .dshg-meta-list { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; }
      .dshg-meta-row {
        display: flex; align-items: center; gap: 6px; min-width: 0;
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; text-decoration: none;
      }
      .dshg-meta-row > svg { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-meta-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-meta-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; }
      .dshg-meta-hash { flex: 0 0 auto; width: 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #6b7280); font-weight: 700; }
      .dshg-meta-copy {
        width: 20px; height: 20px; flex: 0 0 auto; padding: 0;
        border: 0; border-radius: 999px; background: transparent;
        color: var(--dsw-alias-label-tertiary, #6b7280);
        display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
      }
      .dshg-meta-copy:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); color: var(--dsw-alias-label-primary, #111); }
      .dshg-meta-link:hover { color: var(--dsw-alias-state-business-primary, #4a8cff); }
      .dshg-detail-subject { margin-top: 14px; font-size: 13px; font-weight: 650; line-height: 1.45; }
      .dshg-detail-body { margin: 8px 0 0; padding: 0; background: none; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11.5px; line-height: 1.55; }
      .dshg-detail-files-head {
        display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 10px;
        border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10.5px; font-weight: 600;
      }
      .dshg-detail-files-head .dshg-menu-action { height: 22px; padding: 0 8px; }
      .dshg-detail-files-head .dshg-menu-action.active { background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #111); }
      .dshg-detail-files { margin-top: 4px; display: flex; flex-direction: column; }
      .dshg-detail-file {
        display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px;
        padding: 0 6px; border: 0; border-radius: 8px; background: transparent;
        color: inherit; font: inherit; text-align: left; cursor: pointer;
      }
      .dshg-detail-file:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.07)); }
      .dshg-detail-file.active { background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 10%, transparent); }
      .dshg-file-status { flex: 0 0 auto; width: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; font-weight: 700; }
      .dshg-file-status-A { color: var(--dshg-git-added); }
      .dshg-file-status-M { color: var(--dshg-git-modified); }
      .dshg-file-status-D { color: var(--dshg-git-deleted); }
      .dshg-file-status-R, .dshg-file-status-C { color: var(--dshg-git-renamed); }
      .dshg-file-status-T { color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-detail-file-main { flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: 6px; }
      .dshg-detail-file-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--dsw-alias-label-primary, #111); }
      .dshg-detail-file-dir { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-detail-file-stats { flex: 0 0 auto; display: inline-flex; gap: 6px; font-size: 10px; font-variant-numeric: tabular-nums; }
      .dshg-detail-diff { margin-top: 14px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }

      /* Commit bar ------------------------------------------------------ */
      .dshg-commit-bar { flex: 0 0 auto; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; background: var(--dsw-alias-bg-base, #fff); }
      .dshg-commit-inner { width: 100%; display: flex; flex-direction: column; gap: 5px; }
      .dshg-textarea {
        width: 100%; min-height: 38px; max-height: 120px; resize: vertical;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1, #f8fafc); color: inherit;
        padding: 8px 11px; font: inherit; font-size: 12px; line-height: 1.5; outline: none;
        transition: border-color .12s ease;
      }
      .dshg-textarea:focus { border-color: var(--dsw-alias-state-business-primary, #2563eb); }
      .dshg-commit-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dshg-option {
        display: inline-flex; align-items: center; gap: 4px;
        height: 24px; padding: 0 9px; border: 0; border-radius: 999px;
        background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
        font: inherit; font-size: 11px; cursor: pointer;
        transition: background-color .12s ease, color .12s ease;
      }
      .dshg-option:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-option.active { color: var(--dsw-alias-state-business-primary, #2563eb); background: var(--dsw-alias-bg-layer-1, #f4f5f7); }
      .dshg-option:disabled { opacity: .45; cursor: default; }
      .dshg-commit-hint { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46%; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-commit-button { height: 28px; min-width: 96px; border-radius: 999px; background: var(--dsw-alias-state-business-primary, #2563eb); border-color: transparent; color: #fff; font-weight: 600; }
      .dshg-commit-button:hover:not(:disabled) { background: var(--dsw-alias-state-business-primary, #2563eb); filter: brightness(1.07); }
      .dshg-warning { padding: 6px 10px; border-radius: 999px; background: rgba(239,68,68,.10); color: var(--dshg-git-deleted); font-size: 11px; }

      /* Dialogs -------------------------------------------------------- */
      .dshg-modal-backdrop { position: fixed; inset: 0; z-index: 60; background: transparent; }
      .dshg-dialog {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        z-index: 61; display: flex; flex-direction: column;
        width: min(760px, calc(100vw - 48px)); max-height: min(78vh, 760px);
        padding: 16px 16px 12px; border-radius: 12px;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db);
        background: var(--dsw-alias-bg-overlay, #f7f8fa);
        color: var(--dsw-alias-label-primary, #111);
        box-shadow: 0 18px 48px rgba(0, 0, 0, .24);
      }
      .dshg-dialog-graph { height: min(720px, 82vh); max-height: 82vh; }
      .dshg-dialog-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 12px; flex: 0 0 auto;
      }
      .dshg-dialog-heading { min-width: 0; }
      .dshg-dialog-title { font-size: 15px; font-weight: 650; line-height: 1.35; }
      .dshg-dialog-subtitle { margin-top: 2px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }
      .dshg-dialog-close {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; margin: -2px; border: 0; border-radius: 8px;
        background: transparent; color: var(--dsw-alias-label-tertiary, #6b7280);
        cursor: pointer;
      }
      .dshg-dialog-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); color: var(--dsw-alias-label-primary, #111); }
      .dshg-dialog-close:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4a8cff); outline-offset: 1px; }
      .dshg-dialog-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 2px 2px 0; }
      .dshg-dialog-description {
        margin: 8px 0 14px; color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 12px; line-height: 1.5;
      }
      .dshg-dialog-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .dshg-dialog-label { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11.5px; }
      .dshg-dialog-input {
        width: 100%; box-sizing: border-box; padding: 8px 10px;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 8px;
        background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 13px; outline: none;
      }
      .dshg-dialog-input:focus { border-color: var(--dsw-alias-state-business-primary, #4a8cff); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #4a8cff) 24%, transparent); }
      .dshg-branch-field { display: flex; width: 100%; }
      .dshg-branch-field .dshg-pillselect { display: flex; flex: 1 1 auto; width: 100%; }
      .dshg-pillselect-field {
        width: 100%; max-width: none; height: 30px; padding: 0 30px 0 12px;
        border: 1px solid transparent; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-primary, #111);
        gap: 6px; font-size: 13px; text-align: left;
      }
      .dshg-pillselect-field:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-pillselect-field[aria-expanded="true"] { background: var(--dsw-alias-bg-layer-2, #eef2f7); }
      .dshg-field-value {
        flex: 1 1 auto; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; text-align: left;
      }
      /* Full-width popover for the dialog field. The dialog body opts out of
         its own scroll clip so the menu can overhang the card like the panel's
         branch menu does. */
      .dshg-menu-field {
        left: 0; right: 0; width: auto; min-width: 100%; max-width: none;
        max-height: 240px;
      }
      .dshg-menu-field-list { max-height: 176px; }
      .dshg-dialog-worktree { overflow: visible; }
      .dshg-dialog-worktree .dshg-dialog-body { overflow: visible; }
      .dshg-dialog-error { margin-top: 8px; color: var(--dshg-git-deleted); font-size: 12px; line-height: 1.45; }
      .dshg-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; flex: 0 0 auto; margin-top: 14px; }
      .dshg-dialog-button {
        height: 30px; padding: 0 14px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l2, #d1d5db);
        background: var(--dsw-alias-bg-layer-1, #f4f5f7);
        color: var(--dsw-alias-label-primary, #111);
        font: inherit; font-size: 12.5px; cursor: pointer;
      }
      .dshg-dialog-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-dialog-button:disabled { opacity: .55; cursor: default; }
      .dshg-dialog-button-primary {
        border-color: var(--dsw-alias-state-business-primary, #4a8cff);
        background: var(--dsw-alias-state-business-primary, #4a8cff);
        color: #fff;
      }
      .dshg-dialog-button-primary:hover:not(:disabled) { filter: brightness(.94); }
      .dshg-dialog-empty {
        padding: 28px 12px; text-align: center;
        color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 12px;
      }
      .dshg-dialog-empty-error { color: var(--dshg-git-deleted); }

      /* Git graph dialog */
      .dshg-graph-body { display: flex; flex-direction: column; padding: 4px 2px 8px; }
      .dshg-graph-row {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 7px 8px; border-radius: 8px; font-size: 12px;
      }
      .dshg-graph-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); }
      .dshg-graph-lanes {
        display: flex; flex: 0 0 auto; padding-top: 1px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px; line-height: 1.45;
        color: var(--dsw-alias-label-tertiary, #6b7280);
      }
      .dshg-graph-lane { display: inline-block; width: 15px; text-align: center; flex: 0 0 auto; }
      .dshg-graph-lane-node, .dshg-graph-lane-merge { color: var(--dsw-alias-state-business-primary, #4a8cff); font-weight: 700; }
      .dshg-graph-lane-pass { color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-graph-sha {
        flex: 0 0 auto; min-width: 58px; margin-top: 1px;
        padding: 1px 6px; border-radius: 4px;
        background: var(--dsw-alias-bg-layer-2, #eef2f7);
        color: var(--dsw-alias-label-tertiary, #6b7280);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px; line-height: 1.5;
      }
      .dshg-graph-main { display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-width: 0; }
      .dshg-graph-subject {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--dsw-alias-label-primary, #111); font-size: 12.5px; font-weight: 500;
      }
      .dshg-graph-meta {
        display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px;
        color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10.5px;
      }
      .dshg-graph-sep { opacity: .7; }
      .dshg-graph-ref {
        max-width: 120px; overflow: hidden; text-overflow: ellipsis;
        padding: 0 5px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-2, #eef2f7);
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px;
      }
      .dshg-graph-ref.head { background: var(--dsw-alias-state-business-primary, #4a8cff); color: #fff; }
      .dshg-graph-more {
        margin: 6px 8px 0; height: 28px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
        font: inherit; font-size: 11.5px; cursor: pointer;
      }
      .dshg-graph-more:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }

      /* Worktree manager */
      .dshg-worktree-list {
        flex: 1 1 auto; min-height: 170px; overflow-y: auto;
        margin-top: 10px; padding: 4px; border-radius: 10px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: var(--dsw-alias-bg-base, #fff);
      }
      .dshg-worktree-empty {
        padding: 18px 10px; text-align: center;
        color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 12px;
      }
      .dshg-worktree-row {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
        padding: 8px; border-radius: 8px; font-size: 12px;
      }
      .dshg-worktree-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.06)); }
      .dshg-worktree-info { display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-width: 0; }
      .dshg-worktree-headline { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-primary, #111); }
      .dshg-worktree-branch { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
      .dshg-worktree-badge {
        flex: 0 0 auto; padding: 1px 6px; border-radius: 999px;
        background: var(--dsw-alias-bg-layer-2, #eef2f7);
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10px;
      }
      .dshg-worktree-oid {
        flex: 0 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10.5px; color: var(--dsw-alias-label-tertiary, #6b7280);
      }
      .dshg-worktree-path {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10.5px; color: var(--dsw-alias-label-tertiary, #6b7280);
      }
      .dshg-worktree-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: 0 0 auto; }
      .dshg-worktree-check { display: flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 10.5px; cursor: pointer; }
      .dshg-worktree-confirm { display: flex; align-items: center; gap: 8px; margin-top: 2px; color: var(--dshg-git-deleted); font-size: 11px; }

      /* Toast ----------------------------------------------------------- */
      /* Composer chip notices: keep the panel toast styling but place it in
         the viewport, because the hero row is outside the Git panel. */
      .dshg-composer-toast-host {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        z-index: 70; pointer-events: none;
        width: max-content; max-width: calc(100vw - 40px);
      }
      .dshg-composer-toast-host:empty { display: none; }
      .dshg-composer-toast-host .dshg-toast {
        position: static; pointer-events: auto;
        max-width: min(520px, calc(100vw - 40px));
      }

      .dshg-toast {
        position: absolute; top: 54px; right: 14px; z-index: 6;
        display: flex; align-items: flex-start; gap: 8px;
        max-width: min(640px, calc(100% - 28px));
        padding: 9px 12px; border-radius: 14px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
        background: var(--dsw-alias-bg-overlay, #fff);
        box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0,0,0,.14));
        font-size: 12px;
      }
      .dshg-toast.error { border-color: color-mix(in srgb, var(--dshg-git-deleted) 55%, transparent); }
      .dshg-toast-main { flex: 1 1 auto; min-width: 0; }
      .dshg-toast-text { line-height: 1.5; font-size: 12.5px; }
      .dshg-toast-details { margin-top: 6px; color: var(--dsw-alias-label-tertiary, #6b7280); }
      .dshg-toast-details summary {
        display: inline-flex; align-items: center; gap: 5px;
        width: max-content; padding: 2px 0; border-radius: 4px;
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 11.5px; cursor: pointer; list-style: none;
        user-select: none;
      }
      .dshg-toast-details summary::-webkit-details-marker { display: none; }
      .dshg-toast-details summary::before {
        content: ''; width: 0; height: 0;
        border-left: 4px solid transparent; border-right: 4px solid transparent;
        border-top: 5px solid var(--dsw-alias-label-tertiary, #6b7280);
        transform: rotate(-90deg); transition: transform .15s ease;
      }
      .dshg-toast-details[open] summary::before { transform: rotate(0deg); }
      .dshg-toast-details summary:hover { color: var(--dsw-alias-label-primary, #111); }
      .dshg-toast-detail-body {
        max-height: 220px; overflow-y: auto; overflow-x: hidden;
        margin-top: 6px; padding: 8px 10px;
        border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1, #f7f8fa);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px; line-height: 1.6; tab-size: 2;
      }
      .dshg-toast-detail-line {
        color: var(--dsw-alias-label-secondary, #6b7280);
        white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;
      }
      .dshg-toast-detail-gap { height: 6px; }
      .dshg-toast-ref {
        display: flex; align-items: center; gap: 6px; min-width: 0;
        padding: 2px 0;
      }
      .dshg-toast-ref + .dshg-toast-ref { border-top: 1px dashed var(--dsw-alias-border-l1, #e5e7eb); }
      .dshg-toast-ref-name {
        flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; color: var(--dsw-alias-label-primary, #111); font-weight: 500;
      }
      .dshg-toast-ref-oid {
        flex: 0 0 auto; padding: 0 4px; border-radius: 4px;
        background: var(--dsw-alias-bg-layer-2, #eef2f7);
        color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10.5px;
      }
      .dshg-toast-ref-arrow { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, #6b7280); }

      /* Overview -------------------------------------------------------- */
      .dshg-overview { flex: 1 1 auto; display: flex; align-items: flex-start; justify-content: center; padding: 26px 24px; overflow: auto; }
      .dshg-overview-card { width: min(680px, 100%); display: flex; flex-direction: column; gap: 14px; }
      .dshg-overview-head { display: flex; align-items: flex-start; gap: 10px; }
      .dshg-overview-icon { width: 42px; height: 42px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-layer-1, #f4f5f7); color: var(--dsw-alias-state-business-primary, #4a8cff); flex: 0 0 auto; }
      .dshg-overview-heading { min-width: 0; }
      .dshg-overview-title { font-size: 14px; font-weight: 650; }
      .dshg-overview-sub { margin-top: 3px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
      .dshg-metric { border: 0; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; background: var(--dsw-alias-bg-layer-1, #f7f8fa); min-width: 0; }
      .dshg-metric-label { color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
      .dshg-metric strong { font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-metric-sub { color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-overview-last { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; text-align: left; border: 0; border-radius: 14px; background: var(--dsw-alias-bg-layer-1, #f7f8fa); padding: 10px 12px; cursor: pointer; color: inherit; font: inherit; }
      .dshg-overview-last:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); }
      .dshg-overview-last-label { color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
      .dshg-overview-last-subject { grid-column: 1; font-size: 12px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dshg-overview-last-meta { grid-column: 1; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10px; }
      .dshg-overview-last-action { grid-column: 2; grid-row: 1 / span 3; align-self: center; color: var(--dsw-alias-state-business-primary, #4a8cff); font-size: 10.5px; }
      .dshg-overview-empty { border: 1px dashed var(--dsw-alias-border-l2, #d1d5db); border-radius: 14px; padding: 12px; text-align: center; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 11px; }
      .dshg-overview-hints { display: flex; flex-wrap: wrap; gap: 10px; color: var(--dsw-alias-label-tertiary, #6b7280); font-size: 10px; }
      .dshg-overview-hints kbd { font-family: inherit; font-size: 9px; padding: 1px 6px; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 999px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-tertiary, #6b7280); }

      /* Sidebar entry, footer status, document chip --------------------- */
      .dshg-panel-icon { line-height: 0; }
      .dshg-sidebar-status {
        display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 8px; border: 0; border-radius: 999px;
        background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
        font: inherit; cursor: pointer;
      }
      .dshg-sidebar-status:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.10)); color: var(--dsw-alias-label-primary, #111); }
      .dshg-mini-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
      .dshg-side-count { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary, #111); }
      .dshg-doc-status {
        display: inline-flex; align-items: center; gap: 5px;
        height: 22px; padding: 0 8px; border: 0; border-radius: 999px;
        background: transparent; font: inherit;
        color: var(--dsw-alias-label-secondary, #6b7280); font-size: 11px; cursor: pointer;
      }
      .dshg-doc-status:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); color: var(--dsw-alias-label-primary, #111); }
      .dshg-doc-status-badge {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px; font-weight: 700; line-height: 1; color: var(--dshg-tree-color);
        opacity: .9;
      }

      /* Workspace tree decorations (right Sidebar files tab) ------------ */
      .dshg-tree-badge {
        margin-left: auto; flex: 0 0 auto; padding-left: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10px; font-weight: 700; line-height: 1;
        color: var(--dshg-tree-color, var(--dsw-alias-label-tertiary, #6b7280));
        opacity: .85;
      }
      .dshg-tree-dot {
        width: 6px; height: 6px; min-width: 6px; padding: 0;
        border-radius: 50%; background: var(--dshg-tree-color, currentColor);
        opacity: .8;
      }
      [data-dshg-status="modified"] { --dshg-tree-color: var(--dshg-git-modified); }
      [data-dshg-status="added"], [data-dshg-status="untracked"] { --dshg-tree-color: var(--dshg-git-added); }
      [data-dshg-status="deleted"], [data-dshg-status="conflict"] { --dshg-tree-color: var(--dshg-git-deleted); }
      [data-dshg-status="renamed"], [data-dshg-status="copied"] { --dshg-tree-color: var(--dshg-git-renamed); }
      [data-dshg-status="ignored"] { --dshg-tree-color: var(--dshg-git-ignored); }
      [data-dshg-status] > button > svg,
      [data-dshg-status] > button > span > svg { color: var(--dshg-tree-color); opacity: .9; }

      @media (max-width: 900px) {
        .dshg-left { width: 270px; }
        .dshg-btn-label { display: none; }
        .dshg-commit-hint { display: none; }
      }
    `;

    /* ------------------------------------------------------------------ *
     * Workspace tree decorations
     *
     * The right Sidebar's files tab renders `li[data-files-entry][data-files-path]`
     * rows but exposes no per-row slot, so we decorate those rows in place: a
     * MutationObserver keeps badges in sync with the Git status of every
     * repository discovered in the open workspace, without replacing the
     * shipped file tree.
     * ------------------------------------------------------------------ */

    const TREE_STATUS = {
      modified: { badge: 'M', labelKey: 'kindModified' },
      added: { badge: 'A', labelKey: 'kindAdded' },
      untracked: { badge: 'U', labelKey: 'kindUntracked' },
      deleted: { badge: 'D', labelKey: 'kindDeleted' },
      conflict: { badge: '!', labelKey: 'kindConflict' },
      renamed: { badge: 'R', labelKey: 'kindRenamed' },
      copied: { badge: 'C', labelKey: 'kindRenamed' },
    };
    const TREE_PRIORITY = ['conflict', 'deleted', 'modified', 'added', 'untracked', 'renamed', 'copied', 'ignored'];
    const TREE_REFRESH_MS = 4000;
    const TREE_POLL_MS = 12000;

    function treeNormalize(value) {
      return String(value == null ? '' : value).replace(/\\/g, '/').replace(/\/+$/, '');
    }

    function treeKey(value) {
      const normalized = treeNormalize(value);
      return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
    }

    function treePriority(kind) {
      const index = TREE_PRIORITY.indexOf(kind);
      return index === -1 ? TREE_PRIORITY.length : index;
    }

    function treeBadgeOf(node) {
      for (const child of node.children) {
        if (child.classList && child.classList.contains('dshg-tree-badge')) return child;
      }
      return null;
    }

    /** Latest Git status per absolute file path, shared with the document header chip. */
    let treeStatusPaths = new Map();
    /** Latest aggregated Git status per absolute directory path. */
    let treeStatusDirs = new Map();
    /** Absolute paths whose status the document header wants even when the tree is closed. */
    const treeWantedPaths = new Set();

    /** Header chip for the previewed file, fed by the same status cache as the tree badges. */
    function GitDocumentStatus({ absolutePath, openPanel }) {
      const [, force] = useState(0);
      useEffect(() => {
        if (!absolutePath) return undefined;
        const key = treeKey(absolutePath);
        treeWantedPaths.add(key);
        window.dispatchEvent(new Event('dsh-git:refresh'));
        const update = () => force((value) => value + 1);
        window.addEventListener('dsh-git:status', update);
        return () => {
          window.removeEventListener('dsh-git:status', update);
          treeWantedPaths.delete(key);
          window.dispatchEvent(new Event('dsh-git:refresh'));
        };
      }, [absolutePath]);
      if (!absolutePath) return null;
      const found = treeStatusPaths.get(treeKey(absolutePath));
      const status = found ? found.entry : null;
      if (!status) return null;
      const meta = TREE_STATUS[status.kind] || TREE_STATUS.modified;
      const label = t(meta.labelKey);
      return h('button', {
        type: 'button',
        className: 'dshg-doc-status',
        'data-dshg-status': status.kind,
        title: label + ' · ' + absolutePath,
        onClick: openPanel
          ? () => {
              try {
                openPanel();
              } catch (error) {
                console.error('[dsh-git] could not open panel', error);
              }
            }
          : undefined,
      }, h('span', { className: 'dshg-doc-status-badge' }, meta.badge),
        h('span', { className: 'dshg-doc-status-label' }, label));
    }

    /**
     * One floating tooltip for truncated labels marked with `data-dshg-tip`.
     * A shared layer keeps the pills untouched (they live inside `overflow`
     * boxes) and shows the full branch path instantly instead of the browser's
     * delayed native tooltip.
     */
    function installTooltip() {
      const host = document.body || document.documentElement;
      if (!host) return () => {};
      const tip = document.createElement('div');
      tip.className = 'dshg-tip';
      tip.hidden = true;
      host.appendChild(tip);

      let current = null;
      let pointerX = 0;
      let pointerY = 0;

      const hide = () => {
        current = null;
        tip.hidden = true;
      };

      const place = () => {
        const pad = 10;
        const rect = tip.getBoundingClientRect();
        let left = pointerX + 14;
        let top = pointerY + 18;
        if (left + rect.width > window.innerWidth - pad) left = Math.max(pad, pointerX - rect.width - 12);
        if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, pointerY - rect.height - 12);
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
      };

      const show = (target) => {
        const text = target.getAttribute('data-dshg-tip');
        if (!text) return;
        current = target;
        if (tip.textContent !== text) tip.textContent = text;
        tip.hidden = false;
        place();
      };

      const onOver = (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        const target = event.target && event.target.closest
          ? event.target.closest('[data-dshg-tip]')
          : null;
        if (target) show(target);
        else if (current) hide();
      };
      const onMove = (event) => {
        if (!current) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        place();
      };
      const onHide = () => hide();
      const onKey = (event) => {
        if (event.key === 'Escape') hide();
      };

      document.addEventListener('pointerover', onOver, true);
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerdown', onHide, true);
      document.addEventListener('scroll', onHide, true);
      document.addEventListener('keydown', onKey, true);

      return () => {
        document.removeEventListener('pointerover', onOver, true);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerdown', onHide, true);
        document.removeEventListener('scroll', onHide, true);
        document.removeEventListener('keydown', onKey, true);
        tip.remove();
      };
    }

    function installWorkspaceTreeDecorations() {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return () => {};
      }
      let workspaces = null;
      let lastRefresh = 0;
      let refreshing = false;
      let timer = null;
      let pendingForce = false;
      let disposed = false;

      const schedule = (delay, force) => {
        if (disposed) return;
        if (force) pendingForce = true;
        if (timer !== null) return;
        timer = setTimeout(() => {
          const runForce = pendingForce;
          pendingForce = false;
          timer = null;
          void run(runForce);
        }, delay == null ? 120 : delay);
      };

      async function ensureWorkspaces() {
        if (workspaces !== null) return workspaces;
        try {
          const list = await rpc('workspaces');
          workspaces = Array.isArray(list) ? list : [];
        } catch {
          workspaces = [];
        }
        return workspaces;
      }

      function activeRoots() {
        if (!workspaces || workspaces.length === 0) return [];
        const rows = document.querySelectorAll('[data-files-path]');
        const wanted = [...treeWantedPaths];
        const picked = [];
        for (const workspace of workspaces) {
          const rootKey = treeKey(workspace && workspace.path);
          if (!rootKey) continue;
          let hit = false;
          for (const row of rows) {
            const key = treeKey(row.getAttribute('data-files-path'));
            if (key && (key === rootKey || key.startsWith(rootKey + '/'))) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const key of wanted) {
              if (key && (key === rootKey || key.startsWith(rootKey + '/'))) {
                hit = true;
                break;
              }
            }
          }
          if (hit) picked.push(workspace);
        }
        if (picked.length === 0) picked.push(workspaces[0]);
        return picked.slice(0, 4);
      }

      async function refreshStatuses(force) {
        if (disposed || refreshing) return;
        const now = Date.now();
        if (!force && now - lastRefresh < TREE_REFRESH_MS) return;
        refreshing = true;
        lastRefresh = now;
        try {
          await ensureWorkspaces();
          const roots = activeRoots();
          const nextPaths = new Map();
          const nextDirs = new Map();
          await Promise.all(roots.map(async (workspace) => {
            let status;
            try {
              status = await rpc('status-lite', { workspace: workspace.path });
            } catch {
              return;
            }
            if (!status || !status.isRepo || !Array.isArray(status.entries)) return;
            // Each entry names the repository that owns it, so a nested
            // independent project decorates its own files even when the
            // workspace root belongs to a different repository.
            const fallbackRoot = treeNormalize(status.repoRoot || workspace.path);
            for (const entry of status.entries) {
              if (!entry || !entry.path || entry.kind === 'ignored') continue;
              const repoRoot = treeNormalize(entry.repo || fallbackRoot);
              const absolute = treeNormalize(repoRoot + '/' + entry.path);
              nextPaths.set(treeKey(absolute), { entry, absolute });
              const parts = absolute.split('/');
              for (let index = parts.length - 1; index >= 1; index -= 1) {
                const ancestor = parts.slice(0, index).join('/');
                if (/^[A-Za-z]:$/.test(ancestor)) continue;
                const key = treeKey(ancestor);
                if (!key) continue;
                const priority = treePriority(entry.kind);
                const current = nextDirs.get(key);
                if (current) {
                  current.count += 1;
                  if (priority < current.priority) {
                    current.kind = entry.kind;
                    current.priority = priority;
                  }
                } else {
                  nextDirs.set(key, { kind: entry.kind, count: 1, priority });
                }
              }
            }
          }));
          if (!disposed) {
            treeStatusPaths = nextPaths;
            treeStatusDirs = nextDirs;
            window.dispatchEvent(new Event('dsh-git:status'));
          }
        } finally {
          refreshing = false;
        }
      }

      function decorateNode(node) {
        const absolute = node.getAttribute('data-files-path');
        if (!absolute) return;
        const type = node.getAttribute('data-files-entry');
        const key = treeKey(absolute);
        let status = null;
        if (type === 'file') {
          const found = treeStatusPaths.get(key);
          if (found) status = found.entry;
        } else if (type === 'directory') {
          const found = treeStatusDirs.get(key);
          if (found) status = found;
        }
        const host = node.querySelector('button') || node;
        const badge = treeBadgeOf(host);
        if (!status) {
          node.removeAttribute('data-dshg-status');
          if (badge) badge.remove();
          if (host.dataset.dshgTitle !== undefined) {
            host.title = host.dataset.dshgTitle;
            delete host.dataset.dshgTitle;
          }
          return;
        }
        const kind = status.kind;
        const meta = TREE_STATUS[kind] || TREE_STATUS.modified;
        const isFile = type === 'file';
        node.setAttribute('data-dshg-status', kind);
        if (host.dataset.dshgTitle === undefined) host.dataset.dshgTitle = host.title || '';
        host.title = t(meta.labelKey) + ' · ' + absolute + (isFile ? '' : ` · ${status.count}`);
        // ZCode's file tree shows a coloured letter for files and a 6px
        // aggregate dot for directories; no boxed badges.
        const text = isFile ? meta.badge : '';
        let nextBadge = badge;
        if (!nextBadge) {
          nextBadge = document.createElement('span');
          nextBadge.className = 'dshg-tree-badge';
          host.appendChild(nextBadge);
        }
        nextBadge.classList.toggle('dshg-tree-dot', !isFile);
        nextBadge.setAttribute('aria-hidden', isFile ? 'false' : 'true');
        if (nextBadge.textContent !== text) nextBadge.textContent = text;
        nextBadge.setAttribute('data-dshg-kind', kind);
      }

      /** Drag a tree row into the composer: the drop payload is its absolute path. */
      function handleDragStart(event) {
        const target = event.currentTarget;
        const path = target && target.getAttribute ? target.getAttribute('data-files-path') : null;
        if (path) beginFileDrag(event, path);
      }

      function enableDrag(node) {
        if (node.dataset.dshgDraggable === '1') return;
        node.dataset.dshgDraggable = '1';
        node.setAttribute('draggable', 'true');
        node.addEventListener('dragstart', handleDragStart);
      }

      function decorate() {
        for (const node of document.querySelectorAll('[data-files-entry][data-files-path]')) {
          enableDrag(node);
          decorateNode(node);
        }
      }

      async function run(force) {
        // Paint from the last known status first so expanding a folder shows
        // cached badges immediately; the network refresh follows.
        decorate();
        await refreshStatuses(force);
        if (!disposed) decorate();
      }

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target;
          if (target && target.closest && target.closest('[data-files-entry]')) {
            schedule(200);
            return;
          }
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            if ((node.matches && node.matches('[data-files-path]')) ||
                (node.querySelector && node.querySelector('[data-files-path]'))) {
              schedule(200);
              return;
            }
          }
        }
      });
      const root = document.body || document.documentElement;
      if (!root) return () => {};
      observer.observe(root, { childList: true, subtree: true });

      const onVisible = () => {
        if (document.visibilityState === 'visible') schedule(200, true);
      };
      const onExternal = () => schedule(60, true);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      window.addEventListener('dsh-git:refresh', onExternal);

      const poll = setInterval(() => {
        if (document.visibilityState === 'visible' && document.querySelector('[data-files-entry]')) {
          schedule(0, false);
        }
      }, TREE_POLL_MS);

      schedule(400, true);

      return () => {
        disposed = true;
        observer.disconnect();
        clearInterval(poll);
        if (timer !== null) clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
        window.removeEventListener('dsh-git:refresh', onExternal);
        for (const node of document.querySelectorAll('[data-dshg-status], [data-dshg-draggable]')) {
          node.removeAttribute('data-dshg-status');
          node.removeAttribute('data-dshg-draggable');
          node.removeAttribute('draggable');
          node.removeEventListener('dragstart', handleDragStart);
          const host = node.querySelector('button') || node;
          const badge = treeBadgeOf(host);
          if (badge) badge.remove();
        }
      };
    }

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

      ctx.effect(() => installTooltip(), 'dsh-git: tooltip layer');

      ctx.effect(() => installWorkspaceTreeDecorations(), 'dsh-git: workspace tree status');

      // The branch menu can create an isolated checkout and open its blank
      // session. Those verbs live on the Client workspaces / uiWorkspace
      // services (Host owns the registry and session log); keeping them in a
      // bridge means the rest of the panel still mounts in shells that omit
      // them, and the worktree dialog can explain that instead of dying.
      ctx.inject(['workspaces', 'uiWorkspace'], (scope) => {
        const bridge = {
          list() {
            try {
              return scope.workspaces.list.getSnapshot().items;
            } catch {
              return [];
            }
          },
          async start(path) {
            const workspace = await scope.workspaces.create({ path });
            try {
              await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
            } catch (error) {
              try {
                await scope.workspaces.delete(workspace.workspaceId);
              } catch {
                // Leave the registration for the user to clean up rather than
                // masking the original session-open failure.
              }
              throw error;
            }
            return workspace;
          },
          async delete(workspaceId) {
            await scope.workspaces.delete(workspaceId);
          },
        };
        worktreeBridge = bridge;
        return () => {
          if (worktreeBridge === bridge) worktreeBridge = null;
        };
      });

      // The composer chip normally receives `useSessions` through its slot
      // props. Keep a direct lookup as a fallback for shells that expose the
      // session list only through the service.
      ctx.inject(['sessions'], (scope) => {
        const bridge = {
          summary(sessionId) {
            try {
              return scope.sessions.list.getSnapshot().byId[sessionId];
            } catch {
              return undefined;
            }
          },
        };
        sessionBridge = bridge;
        return () => {
          if (sessionBridge === bridge) sessionBridge = null;
        };
      });

      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'git-branch',
        order: 30,
        locale: NS,
      }, ComposerBranchChip));

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

      ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
        name: 'sidebar.right.tab.document.actions',
        id: 'git-status',
        order: 20,
        locale: NS,
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitDocumentStatus));
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});
