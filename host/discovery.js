/**
 * Workspace-scoped repository discovery and the workspace allow-list.
 */
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { DISCOVERY_CONCURRENCY, DISCOVERY_MAX_DEPTH, DISCOVERY_MAX_DIRS, DISCOVERY_SKIP_DIRS, DISCOVERY_TTL, GitError, cacheKey, dotGitKind, pathIsInside } from './core.js';
import { runGit } from './git.js';
import { cacheRead, cacheWrite, discoveryCache, discoveryInflight } from './state.js';
import { runtime } from './runtime.js';

function workspaceEntries() {
  try {
    return runtime.ctx.workspaceRegistry.list();
  } catch {
    return [];
  }
}

function requireWorkspace(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new GitError('WORKSPACE_REQUIRED', '缺少工作区路径');
  }
  const found = workspaceEntries().find((workspace) => workspace.path === path);
  if (!found) {
    throw new GitError('WORKSPACE_NOT_FOUND', '该路径不是已注册的工作区');
  }
  return found.path;
}


async function scanRepositories(workspacePath, signal) {
  const root = resolve(workspacePath);
  const queue = [{ dir: root, depth: 0 }];
  const found = new Map();
  let cursor = 0;
  let visited = 0;
  let truncated = false;

  const worker = async () => {
    while (cursor < queue.length) {
      if (signal?.aborted) return;
      if (visited >= DISCOVERY_MAX_DIRS) {
        truncated = true;
        return;
      }
      const task = queue[cursor];
      cursor += 1;
      visited += 1;

      let entries;
      try {
        entries = await readdir(task.dir, { withFileTypes: true });
      } catch {
        // Unreadable or vanished directories are skipped, never fatal.
        continue;
      }

      let kind = null;
      let hasHead = false;
      let hasObjects = false;
      let hasRefs = false;
      const children = [];
      const skipped = [];
      for (const entry of entries) {
        const name = entry.name;
        if (name === '.git') {
          kind = entry.isDirectory() ? 'worktree' : 'gitfile';
          continue;
        }
        if (name === 'HEAD' && entry.isFile()) {
          hasHead = true;
          continue;
        }
        if (name === 'objects' && entry.isDirectory()) {
          hasObjects = true;
          continue;
        }
        if (name === 'refs' || name === 'reftable') {
          hasRefs = true;
          continue;
        }
        if (!entry.isDirectory()) continue;
        if (task.depth >= DISCOVERY_MAX_DEPTH) continue;
        const child = join(task.dir, name);
        if (DISCOVERY_SKIP_DIRS.has(name.toLowerCase())) skipped.push(child);
        else children.push(child);
      }

      if (!kind && hasHead && hasObjects && hasRefs) kind = 'bare';
      if (kind) {
        found.set(cacheKey(task.dir), { root: task.dir, kind, isBare: kind === 'bare' });
      }
      if (kind === 'bare') continue;

      // Pruned dependency/cache folders are still probed once for a `.git`
      // entry: a project that happens to be named like one of them survives,
      // even though its own subdirectories are not walked.
      for (const child of skipped) {
        const childKind = await dotGitKind(child);
        if (childKind) {
          found.set(cacheKey(child), { root: child, kind: childKind, isBare: false });
        }
      }
      for (const child of children) queue.push({ dir: child, depth: task.depth + 1 });
    }
  };

  await Promise.all(Array.from({ length: DISCOVERY_CONCURRENCY }, () => worker()));
  if (truncated) {
    runtime.logger?.warn?.(`[dsh-git] repository scan of ${root} stopped after ${DISCOVERY_MAX_DIRS} directories`);
  }

  if (found.size === 0 && !signal?.aborted) {
    // A workspace can also be a subdirectory of a repository whose `.git`
    // lives above it (Zed keeps this case alive as an external work
    // directory). Only fall back when the workspace holds no repo itself, so
    // nested independent projects always win.
    try {
      const top = await runGit(root, ['rev-parse', '--show-toplevel'], { signal, timeoutMs: 10_000 });
      const topLevel = top.code === 0 ? top.stdout.trim() : '';
      if (topLevel && pathIsInside(topLevel, root)) {
        found.set(cacheKey(topLevel), {
          root: resolve(topLevel),
          kind: 'enclosing',
          isBare: false,
          relativePath: '',
        });
      }
    } catch {
      // No enclosing repository: the workspace simply has no Git repository.
    }
  }

  return Array.from(found.values())
    .map((entry) => ({
      ...entry,
      relativePath: entry.relativePath !== undefined
        ? entry.relativePath
        : relative(root, entry.root).replace(/\\/g, '/'),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}


async function listRepositories(workspacePath, signal) {
  const key = cacheKey(workspacePath);
  const cached = cacheRead(discoveryCache, key, DISCOVERY_TTL);
  if (cached !== undefined) return cached;
  const inflight = discoveryInflight.get(key);
  if (inflight) return inflight;
  const promise = scanRepositories(workspacePath, signal)
    .then((value) => {
      // Do not cache an aborted scan: it may be missing directories.
      if (!signal?.aborted) cacheWrite(discoveryCache, key, value);
      return value;
    })
    .finally(() => {
      discoveryInflight.delete(key);
    });
  discoveryInflight.set(key, promise);
  return promise;
}

/** The repository that owns the workspace root, else the shallowest one. */

function primaryRepository(repos) {
  return repos.find((repo) => repo.relativePath === '') || repos[0] || null;
}

/** Resolve a repository from the client: absolute root or workspace-relative. */

function findRepository(workspaceRoot, repos, value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return null;
  const normalized = value.replace(/\\/g, '/');
  const absolute = cacheKey(resolve(workspaceRoot, normalized));
  const relativeValue = normalized.replace(/^\.\//, '').replace(/\/+$/, '');
  return repos.find((repo) => cacheKey(repo.root) === absolute
    || (repo.relativePath !== '' && repo.relativePath === relativeValue)) || null;
}

/** Validate the repository a write operation targets, refusing ambiguity. */

function requireRepositoryForOperation(workspaceRoot, repos, value) {
  if (repos.length === 0) throw new GitError('NOT_A_REPO', '当前工作区没有 Git 仓库');
  if (value == null || value === '') {
    if (repos.length > 1) {
      throw new GitError('REPO_REQUIRED', '工作区中有多个 Git 仓库，请先选择一个仓库');
    }
    return repos[0].root;
  }
  const found = findRepository(workspaceRoot, repos, value);
  if (!found) throw new GitError('REPO_NOT_FOUND', '该仓库不在当前工作区内');
  return found.root;
}

export { findRepository, listRepositories, primaryRepository, requireRepositoryForOperation, requireWorkspace, scanRepositories, workspaceEntries };
