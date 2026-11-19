/**
 * Managed worktrees: where they live, how they are read, and their create/remove paths.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { GitError, REMOTE_TIMEOUT, STATUS_TIMEOUT, WORKTREE_BRANCH_PREFIX, WRITE_TIMEOUT, cacheKey, normalizeWorktreeName, pathIsInside, safeRef } from './core.js';
import { runGit } from './git.js';
import { invalidateRepo, invalidateWorkspace, requireConfirm } from './state.js';
import { operationRepo } from './status.js';

/* ------------------------------------------------------------------ *
 * Managed worktrees
 *
 * A managed worktree lives under `<DSH_HOME>/worktrees/<repo-key>/<name>`.
 * The repository key mirrors the graph plugin's layout (sanitized basename
 * plus a short hash of the root), so two checkouts with the same folder name
 * can never share a worktree and a worktree created by either surface is
 * still recognizable here.
 * ------------------------------------------------------------------ */
function dshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.trim() !== '') return resolve(configured.trim());
  return join(homedir(), '.dsh');
}

function worktreesHome() {
  return join(dshHome(), 'worktrees');
}

function worktreeRepoKey(root) {
  const base = normalizeWorktreeName(basename(root)) || 'repo';
  const hash = createHash('sha1').update(cacheKey(root)).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

function worktreePathFor(root, name) {
  return join(worktreesHome(), worktreeRepoKey(root), name);
}

/**
 * A managed path is exactly two levels below the managed home:
 * `<repo-key>/<name>`. This is deliberately stricter than "inside the
 * home", so a crafted nested path can never turn removal into a recursive
 * delete of an arbitrary directory.
 */

function isManagedWorktreePath(home, candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const base = resolve(home);
  const target = resolve(candidate);
  if (!pathIsInside(base, target)) return false;
  const parts = relative(base, target).split(sep).filter(Boolean);
  return parts.length === 2 && parts.every((part) => part !== '.' && part !== '..');
}

/** Parse `git worktree list --porcelain` into UI rows. */

function parseWorktreeList(stdout, home) {
  const rows = [];
  let current = null;
  const flush = () => {
    if (!current || !current.path) return;
    rows.push({
      path: resolve(current.path),
      head: current.head || '',
      branch: current.branch || '',
      bare: Boolean(current.bare),
      detached: Boolean(current.detached),
      main: rows.length === 0,
      managed: isManagedWorktreePath(home, current.path),
    });
  };
  for (const line of stdout.split('\n')) {
    if (line === '') {
      flush();
      current = null;
      continue;
    }
    if (line.startsWith('worktree ')) {
      flush();
      current = { path: line.slice('worktree '.length).trim() };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length).trim();
    else if (line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length).trim();
    } else if (line === 'detached') current.detached = true;
    else if (line === 'bare') current.bare = true;
  }
  flush();
  return rows;
}


async function listWorktrees(workspacePath, repoValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const result = await runGit(root, ['worktree', 'list', '--porcelain'], { signal, timeoutMs: 20_000 });
  if (result.code !== 0) {
    throw new GitError('WORKTREE_LIST_FAILED', result.stderr.trim() || '读取 worktree 失败', result.stdout.trim());
  }
  return {
    root,
    home: worktreesHome(),
    worktrees: parseWorktreeList(result.stdout, worktreesHome()),
  };
}


async function addWorktree(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const name = normalizeWorktreeName(payload.name);
  if (!name) throw new GitError('WORKTREE_NAME_INVALID', 'worktree 名称不合法');

  const baseInput = typeof payload.baseRef === 'string' && payload.baseRef.trim() !== ''
    ? payload.baseRef.trim()
    : null;
  const baseRef = baseInput ? safeRef(baseInput) : 'HEAD';
  const branch = `${WORKTREE_BRANCH_PREFIX}${name}`;
  safeRef(branch);
  const target = worktreePathFor(root, name);

  if (existsSync(target)) {
    throw new GitError('WORKTREE_PATH_EXISTS', '目标目录已存在', target);
  }

  const branchCheck = await runGit(root, [
    'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`,
  ], { signal, timeoutMs: 10_000 });
  if (branchCheck.code === 0) {
    throw new GitError('BRANCH_ALREADY_EXISTS', `分支 ${branch} 已存在`, branch);
  }

  const baseCheck = await runGit(root, [
    'rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`,
  ], { signal, timeoutMs: 10_000 });
  if (baseCheck.code !== 0) {
    throw new GitError('WORKTREE_BASE_NOT_FOUND', '基线分支不存在', baseRef);
  }

  await mkdir(dirname(target), { recursive: true });
  const result = await runGit(root, [
    'worktree', 'add', '-b', branch, target, baseRef,
  ], { signal, timeoutMs: REMOTE_TIMEOUT });
  if (result.code !== 0) {
    const text = `${result.stderr}\n${result.stdout}`.trim();
    if (/already exists/i.test(text)) {
      throw new GitError('WORKTREE_PATH_EXISTS', 'worktree 已存在', text);
    }
    throw new GitError('WORKTREE_ADD_FAILED', text || '创建 worktree 失败', text);
  }

  invalidateRepo(root);
  invalidateWorkspace(workspacePath);
  const head = await runGit(root, ['rev-parse', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  return {
    root,
    path: target,
    name,
    branch,
    baseRef,
    head: head.code === 0 ? head.stdout.trim() : null,
  };
}


async function removeWorktree(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(resolve(workspacePath), repoValue, signal);
  if (typeof payload.path !== 'string' || payload.path.trim() === '') {
    throw new GitError('WORKTREE_NOT_FOUND', 'worktree 不存在');
  }
  const requested = resolve(payload.path.trim());
  const home = worktreesHome();
  const listed = await runGit(root, ['worktree', 'list', '--porcelain'], { signal, timeoutMs: 20_000 });
  if (listed.code !== 0) {
    throw new GitError('WORKTREE_LIST_FAILED', listed.stderr.trim() || '读取 worktree 失败', listed.stdout.trim());
  }
  const rows = parseWorktreeList(listed.stdout, home);
  const entry = rows.find((row) => cacheKey(row.path) === cacheKey(requested));
  if (!entry) throw new GitError('WORKTREE_NOT_FOUND', 'worktree 不存在', requested);
  if (entry.main) throw new GitError('WORKTREE_IS_MAIN', '不能移除主检出', requested);
  if (!isManagedWorktreePath(home, entry.path)) {
    throw new GitError('WORKTREE_NOT_MANAGED', '只能移除由面板托管的 worktree', entry.path);
  }

  // Removing a checkout with `--force` deletes uncommitted files, and
  // `deleteBranch` force-deletes a branch: both lose data that Git cannot
  // recover, so they need the caller's explicit confirmation.
  const force = payload.force === true;
  if (force || payload.deleteBranch === true) requireConfirm(payload, 'worktree-remove');

  if (!force) {
    const dirty = await runGit(entry.path, [
      'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.',
    ], { signal, timeoutMs: STATUS_TIMEOUT });
    if (dirty.code === 0 && dirty.stdout.length > 0) {
      throw new GitError('WORKTREE_DIRTY', 'worktree 中还有未提交的更改', dirty.stdout);
    }
  }

  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(entry.path);
  const result = await runGit(root, args, { signal, timeoutMs: REMOTE_TIMEOUT });
  if (result.code !== 0) {
    const text = `${result.stderr}\n${result.stdout}`.trim();
    if (/contains modified or untracked files|use --force/i.test(text)) {
      throw new GitError('WORKTREE_DIRTY', 'worktree 中还有未提交的更改', text);
    }
    throw new GitError('WORKTREE_REMOVE_FAILED', text || '移除 worktree 失败', text);
  }

  let branchDeleted = false;
  if (payload.deleteBranch === true && entry.branch.startsWith(WORKTREE_BRANCH_PREFIX)) {
    const removeBranch = await runGit(root, ['branch', '-D', entry.branch], { signal, timeoutMs: WRITE_TIMEOUT });
    branchDeleted = removeBranch.code === 0;
  }

  invalidateRepo(root);
  invalidateWorkspace(workspacePath);
  return {
    removed: true,
    path: entry.path,
    branch: entry.branch,
    branchDeleted,
  };
}

export { addWorktree, dshHome, isManagedWorktreePath, listWorktrees, parseWorktreeList, removeWorktree, worktreePathFor, worktreeRepoKey, worktreesHome };
