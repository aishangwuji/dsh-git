/**
 * Write operations: staging, commits, checkout, branch creation, fetch/pull/push, init.
 */
import { GitError, REMOTE_TIMEOUT, WRITE_TIMEOUT, safeRef, safeRemote, safeRepoPath } from './core.js';
import { requireWorkspace } from './discovery.js';
import { runGit } from './git.js';
import { invalidateRepo, invalidateWorkspace } from './state.js';
import { operationRepo, readNumstatRange, readRemotes, readRepoSnapshot, readRepoStatus, readStatus } from './status.js';

function parseFetchPorcelain(stdout) {
  const updates = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length < 3) continue;
    const [oldOid, newOid, ref] = fields.slice(-3);
    if (!ref || !ref.startsWith('refs/') || ref.endsWith('/HEAD')) continue;
    if (!/^[0-9a-f]{7,64}$/i.test(oldOid) || !/^[0-9a-f]{7,64}$/i.test(newOid)) continue;
    if (oldOid === newOid) continue;
    updates.push({ ref, old: oldOid, new: newOid });
  }
  return updates;
}

/** Full status of one repository: file entries plus stats, remotes, identity. */

async function stagePaths(workspacePath, repoValue, pathsValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  if (!Array.isArray(pathsValue) || pathsValue.length === 0) return { staged: 0 };
  const paths = pathsValue.map((value) => safeRepoPath(root, value));

  for (let offset = 0; offset < paths.length; offset += 64) {
    const batch = paths.slice(offset, offset + 64);
    const result = await runGit(root, ['add', '-A', '--', ...batch], { signal, timeoutMs: WRITE_TIMEOUT });
    if (result.code !== 0) throw new GitError('STAGE_FAILED', result.stderr.trim() || '暂存失败');
  }
  invalidateRepo(root);
  return { staged: paths.length };
}


async function unstagePaths(workspacePath, repoValue, pathsValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  if (!Array.isArray(pathsValue) || pathsValue.length === 0) return { unstaged: 0 };
  const paths = pathsValue.map((value) => safeRepoPath(root, value));

  const head = await runGit(root, ['rev-parse', '--verify', 'HEAD'], { signal, timeoutMs: 10_000 });
  const hasHead = head.code === 0;

  for (let offset = 0; offset < paths.length; offset += 64) {
    const batch = paths.slice(offset, offset + 64);
    const args = hasHead
      ? ['reset', '-q', 'HEAD', '--', ...batch]
      : ['update-index', '--force-remove', '--', ...batch];
    const result = await runGit(root, args, { signal, timeoutMs: WRITE_TIMEOUT });
    if (result.code !== 0) throw new GitError('UNSTAGE_FAILED', result.stderr.trim() || '取消暂存失败');
  }
  invalidateRepo(root);
  return { unstaged: paths.length };
}


async function commit(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const status = await readRepoStatus(root, signal);

  const message = typeof payload.message === 'string' ? payload.message : '';
  if (!message.trim()) throw new GitError('EMPTY_MESSAGE', '提交信息不能为空');
  if (message.includes('\0')) throw new GitError('INVALID_MESSAGE', '提交信息包含非法字符');
  if (message.length > 100_000) throw new GitError('MESSAGE_TOO_LARGE', '提交信息过长');

  const amend = payload.amend === true;
  const signoff = payload.signoff === true;
  if (amend && !status.hasCommits) throw new GitError('NOTHING_TO_AMEND', '尚无提交可以修正');
  if (status.counts.conflicts > 0) {
    throw new GitError('COMMIT_FAILED', '存在未解决的冲突，请先解决并暂存', 'conflicts present');
  }

  if (!status.identity.name || !status.identity.email) {
    throw new GitError('IDENTITY_MISSING', '请先配置 Git 的 user.name 与 user.email');
  }

  const staged = status.entries.filter((entry) => entry.staged || entry.partial);
  if (staged.length === 0 && !amend) {
    const tracked = status.entries.filter((entry) => entry.kind !== 'untracked' && entry.kind !== 'ignored');
    if (tracked.length === 0) throw new GitError('NOTHING_TO_COMMIT', '没有可提交的更改');
    const add = await runGit(root, ['add', '-u', '--', '.'], { signal, timeoutMs: WRITE_TIMEOUT });
    if (add.code !== 0) throw new GitError('STAGE_FAILED', add.stderr.trim() || '暂存已跟踪更改失败');
  }

  const args = ['commit', '--quiet', '--cleanup=whitespace', '-F', '-'];
  if (amend) args.push('--amend');
  if (signoff) args.push('--signoff');

  const result = await runGit(root, args, {
    signal,
    stdin: message,
    timeoutMs: REMOTE_TIMEOUT,
  });

  if (result.code !== 0) {
    const detail = `${result.stderr}\n${result.stdout}`.trim();
    throw new GitError('COMMIT_FAILED', detail || '提交失败', detail);
  }

  const head = await runGit(root, ['rev-parse', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  invalidateRepo(root);
  return {
    sha: head.code === 0 ? head.stdout.trim() : null,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}


async function remoteForBranch(root, branch, signal) {
  const config = await runGit(root, ['config', '--get', `branch.${branch}.remote`], { signal, timeoutMs: 10_000 });
  let remote = config.code === 0 ? config.stdout.trim() : '';
  if (!remote) {
    const remotes = await readRemotes(root, signal);
    remote = remotes.includes('origin') ? 'origin' : remotes[0] || '';
  }
  if (!remote) throw new GitError('NO_REMOTE', '没有配置远程仓库');
  return safeRemote(remote);
}

function remoteFailure(result) {
  const text = `${result.stderr}\n${result.stdout}`;
  if (/non-fast-forward|fetch first|\[rejected\]|failed to push some refs/i.test(text)) {
    return new GitError('NON_FAST_FORWARD', '远端包含本地没有的提交，请先拉取再推送', text);
  }
  if (/Authentication failed|could not read Username|Permission denied \(publickey\)|terminal prompts disabled|could not read Password/i.test(text)) {
    return new GitError('AUTH_FAILED', '认证失败。请先在终端配置凭据或 ssh-agent，再重试', text);
  }
  if (/CONFLICT|Automatic merge failed|fix conflicts/i.test(text)) {
    return new GitError('PULL_CONFLICT', '拉取产生冲突，请在终端或 Git 面板中解决', text);
  }
  if (/No such remote|does not appear to be a git repository/i.test(text)) {
    return new GitError('REMOTE_NOT_FOUND', '远程仓库不存在或不可访问', text);
  }
  return new GitError('GIT_COMMAND_FAILED', result.stderr.trim() || result.stdout.trim() || 'Git 命令失败', text);
}


async function fetchRemote(workspacePath, repoValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const status = await readRepoStatus(root, signal);
  if (status.remotes.length === 0) throw new GitError('NO_REMOTE', '没有配置远程仓库');
  const result = await runGit(root, ['fetch', '--all', '--porcelain'], { signal, timeoutMs: REMOTE_TIMEOUT });
  if (result.code !== 0) throw remoteFailure(result);

  const updates = parseFetchPorcelain(result.stdout);
  invalidateRepo(root);
  let behind = 0;
  let ahead = 0;
  if (!status.isBare) {
    try {
      const after = await readRepoSnapshot(root, signal);
      behind = after.behind || 0;
      ahead = after.ahead || 0;
    } catch {
      // The fetch succeeded; a status read failure only drops the hint.
    }
  }
  return {
    remotes: status.remotes.length,
    updatedRefs: updates.length,
    updatedBranches: updates.filter((update) => update.ref.startsWith('refs/remotes/')).length,
    updatedTags: updates.filter((update) => update.ref.startsWith('refs/tags/')).length,
    updates: updates.slice(0, 100),
    behind,
    ahead,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}


async function pullRemote(workspacePath, repoValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const status = await readRepoStatus(root, signal);
  if (!status.branch) throw new GitError('DETACHED_HEAD', '分离 HEAD 状态下无法拉取');
  const hasUpstream = Boolean(status.upstream);
  const args = ['pull', '--no-edit'];
  if (!hasUpstream) {
    const remote = await remoteForBranch(root, status.branch, signal);
    args.push(remote, safeRef(status.branch));
  }

  const beforeHead = await runGit(root, ['rev-parse', 'HEAD'], { signal, timeoutMs: 10_000 });
  const result = await runGit(root, args, { signal, timeoutMs: REMOTE_TIMEOUT });
  if (result.code !== 0) throw remoteFailure(result);
  invalidateRepo(root);

  let updated = false;
  let commits = 0;
  let stats = { files: 0, additions: 0, deletions: 0 };
  const before = beforeHead.code === 0 ? beforeHead.stdout.trim() : '';
  const afterHead = await runGit(root, ['rev-parse', 'HEAD'], { signal, timeoutMs: 10_000 });
  const after = afterHead.code === 0 ? afterHead.stdout.trim() : '';
  if (before && after && before !== after) {
    updated = true;
    const count = await runGit(root, ['rev-list', '--count', `${before}..${after}`], {
      signal,
      timeoutMs: 20_000,
    });
    commits = count.code === 0 ? Number(count.stdout.trim()) || 0 : 0;
    stats = await readNumstatRange(root, `${before}..${after}`, signal);
  }

  return {
    updated,
    commits,
    ...stats,
    branch: status.branch,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}


async function pushRemote(workspacePath, repoValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const status = await readRepoStatus(root, signal);
  if (!status.branch) throw new GitError('DETACHED_HEAD', '分离 HEAD 状态下无法推送');

  const upstream = await runGit(root, ['rev-parse', '--verify', '--quiet', '@{u}'], { signal, timeoutMs: 10_000 });
  const newBranch = upstream.code !== 0;
  const args = ['push', '--porcelain'];
  if (newBranch) {
    const remote = await remoteForBranch(root, status.branch, signal);
    args.push('-u', remote, `${safeRef(status.branch)}:${safeRef(status.branch)}`);
  }
  const result = await runGit(root, args, { signal, timeoutMs: REMOTE_TIMEOUT });
  if (result.code !== 0) throw remoteFailure(result);
  invalidateRepo(root);

  const updated = newBranch || (status.ahead || 0) > 0;
  return {
    branch: status.branch,
    newBranch,
    updated,
    pushedCommits: updated && !newBranch ? status.ahead || 0 : 0,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}


async function initRepo(workspacePath, signal) {
  const root = requireWorkspace(workspacePath);
  // The workspace may already be a repository, or may be a plain folder that
  // collects independent projects; `git init` only ever targets its root, so
  // the discovered list has to be re-read afterwards.
  invalidateWorkspace(root);
  const check = await runGit(root, ['rev-parse', '--is-inside-work-tree'], { signal, timeoutMs: 10_000 });
  if (check.code === 0 && check.stdout.trim() === 'true') {
    invalidateWorkspace(root);
    return readStatus(root, null, signal);
  }
  invalidateRepo(root);
  let result = await runGit(root, ['init', '-b', 'main'], { signal, timeoutMs: WRITE_TIMEOUT });
  if (result.code !== 0) {
    result = await runGit(root, ['init'], { signal, timeoutMs: WRITE_TIMEOUT });
    if (result.code !== 0) throw new GitError('INIT_FAILED', result.stderr.trim() || '初始化仓库失败');
    await runGit(root, ['symbolic-ref', 'HEAD', 'refs/heads/main'], { signal, timeoutMs: 10_000 });
  }
  invalidateWorkspace(root);
  return readStatus(root, null, signal);
}

/**
 * Branches of one repository, split into local and remote, like Zed's
 * switcher. Remote names keep the `<remote>/` prefix so a branch can be
 * checked out with a tracking local branch.
 */
/** `%(upstream:track)` output → drift against the upstream. */

function checkoutFailure(text) {
  if (/local changes would be overwritten|would be overwritten by checkout|Please commit your changes or stash/i.test(text)) {
    return new GitError('CHECKOUT_DIRTY', '本地更改会被覆盖，请先提交或暂存后再切换分支', text);
  }
  if (/not a git repository/i.test(text)) {
    return new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库', text);
  }
  return new GitError('CHECKOUT_FAILED', text || '切换分支失败', text);
}

/**
 * Switch branches. A remote branch without a local counterpart is checked
 * out with `--track`, which creates the tracking branch. Git itself refuses
 * the move when the working tree would be overwritten, so the error surfaces
 * as a checkout conflict instead of a silently discarded file.
 */

async function checkoutBranch(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const branch = safeRef(payload.branch);
  const remoteBranch = typeof payload.remoteBranch === 'string' && payload.remoteBranch
    ? safeRef(payload.remoteBranch)
    : null;

  if (remoteBranch) {
    const remoteExists = await runGit(root, [
      'rev-parse', '--verify', '--quiet', `refs/remotes/${remoteBranch}`,
    ], { signal, timeoutMs: 10_000 });
    if (remoteExists.code !== 0) throw new GitError('BRANCH_NOT_FOUND', '远端分支不存在', remoteBranch);
  }

  const localExists = (await runGit(root, [
    'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`,
  ], { signal, timeoutMs: 10_000 })).code === 0;

  if (!remoteBranch && !localExists) throw new GitError('BRANCH_NOT_FOUND', '分支不存在', branch);

  let result;
  let created = false;
  if (remoteBranch && !localExists) {
    result = await runGit(root, ['checkout', '--quiet', '--track', remoteBranch], { signal, timeoutMs: REMOTE_TIMEOUT });
    created = result.code === 0;
  } else {
    result = await runGit(root, ['checkout', '--quiet', branch], { signal, timeoutMs: REMOTE_TIMEOUT });
  }
  if (result.code !== 0) throw checkoutFailure(`${result.stderr}\n${result.stdout}`.trim());

  invalidateRepo(root);
  const head = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  return { branch: head.code === 0 ? head.stdout.trim() : branch, created };
}

function branchCreateFailure(result) {
  const text = `${result.stderr}\n${result.stdout}`.trim();
  if (/already exists/i.test(text)) {
    return new GitError('BRANCH_ALREADY_EXISTS', '该分支已存在', text);
  }
  if (/not a valid object name|invalid reference|not a commit/i.test(text)) {
    return new GitError('BRANCH_CREATE_FAILED', '无法从当前 HEAD 创建分支', text);
  }
  if (/not a git repository/i.test(text)) {
    return new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库', text);
  }
  return new GitError('BRANCH_CREATE_FAILED', text || '创建分支失败', text);
}

/**
 * Create a local branch from the current HEAD and switch to it, the
 * `git switch -c` shape ZCode exposes in its branch menu. `check-ref-format`
 * stays the authority for names; the UI mirror only short-circuits obvious
 * mistakes before a round trip.
 */

async function createBranch(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const name = safeRef(payload.name);
  const check = await runGit(root, ['check-ref-format', '--branch', name], { signal, timeoutMs: 10_000 });
  if (check.code !== 0) throw new GitError('INVALID_REF', '分支名不合法', `${check.stderr}\n${check.stdout}`.trim());

  const existing = await runGit(root, [
    'rev-parse', '--verify', '--quiet', `refs/heads/${name}`,
  ], { signal, timeoutMs: 10_000 });
  if (existing.code === 0) throw new GitError('BRANCH_ALREADY_EXISTS', '该分支已存在', name);

  const result = await runGit(root, ['checkout', '--quiet', '-b', name], {
    signal,
    timeoutMs: REMOTE_TIMEOUT,
  });
  if (result.code !== 0) throw branchCreateFailure(result);

  invalidateRepo(root);
  const head = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  return { branch: head.code === 0 ? head.stdout.trim() : name, created: true };
}

export { branchCreateFailure, checkoutBranch, checkoutFailure, commit, createBranch, fetchRemote, initRepo, parseFetchPorcelain, pullRemote, pushRemote, remoteFailure, remoteForBranch, stagePaths, unstagePaths };
