/**
 * Work-tree status: snapshots, counts, auxiliary reads, and the workbench status page.
 */
import { basename, join, resolve } from 'node:path';
import { GitError, REPO_READ_CONCURRENCY, STATUS_TIMEOUT, addCounts, cacheKey, countEntries, emptyCounts } from './core.js';
import { findRepository, listRepositories, primaryRepository, requireRepositoryForOperation } from './discovery.js';
import { runGit } from './git.js';
import { AUX_TTL, SNAPSHOT_FAILURE_TTL, STATUS_LITE_TTL, SUMMARY_TTL, auxCache, cacheRead, cacheWrite, snapshotFailures, statusLiteInflight, statusLiteValues } from './state.js';

function classifyStatus(index, worktree) {
  const pair = `${index}${worktree}`;
  if (pair === '??') {
    return { kind: 'untracked', badge: 'U', stage: 'unstaged', staged: false, partial: false, deleted: false, conflict: false };
  }
  if (pair === '!!') {
    return { kind: 'ignored', badge: '', stage: 'unstaged', staged: false, partial: false, deleted: false, conflict: false };
  }
  if (['AA', 'DD', 'AU', 'UA', 'DU', 'UD', 'UU'].includes(pair)) {
    return { kind: 'conflict', badge: '!', stage: 'unstaged', staged: false, partial: false, deleted: false, conflict: true };
  }

  let kind = 'modified';
  if (index === 'D' || worktree === 'D') kind = 'deleted';
  else if (index === 'M' || worktree === 'M' || index === 'T' || worktree === 'T') kind = 'modified';
  else if (index === 'A' || worktree === 'A') kind = 'added';
  else if (index === 'R' || worktree === 'R') kind = 'renamed';
  else if (index === 'C' || worktree === 'C') kind = 'copied';

  const stage = index === ' ' ? 'unstaged' : worktree === ' ' ? 'staged' : 'partial';
  return {
    kind,
    badge: kind === 'deleted' ? 'D' : kind === 'added' ? 'A' : kind === 'renamed' ? 'R' : 'M',
    stage,
    staged: stage !== 'unstaged',
    partial: stage === 'partial',
    deleted: kind === 'deleted',
    conflict: false,
  };
}

function parseStatus(stdout) {
  const entries = [];
  for (const record of stdout.split('\0')) {
    if (!record || record.length < 4) continue;
    const index = record[0];
    const worktree = record[1];
    if (record[2] !== ' ') continue;
    const path = record.slice(3);
    if (!path || path.endsWith('/')) continue;
    const classified = classifyStatus(index, worktree);
    if (classified.kind === 'ignored') continue;
    entries.push({
      path,
      index,
      worktree,
      ...classified,
    });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

function summarizeRepository(repo, snapshot, error) {
  return {
    root: repo.root,
    name: basename(repo.root),
    relativePath: repo.relativePath,
    kind: repo.kind,
    isBare: Boolean(snapshot && snapshot.isBare),
    hasCommits: Boolean(snapshot && snapshot.hasCommits),
    branch: snapshot ? snapshot.branch : null,
    detached: Boolean(snapshot && snapshot.detached),
    upstream: snapshot ? snapshot.upstream : null,
    ahead: (snapshot && snapshot.ahead) || 0,
    behind: (snapshot && snapshot.behind) || 0,
    counts: snapshot ? snapshot.counts : emptyCounts(),
    error: error || null,
  };
}

/** Parse the `## branch...upstream [ahead N, behind M]` header of porcelain v1. */

function parseBranchHeader(record) {
  const text = record.slice(2).trim();
  if (text.startsWith('No commits yet on ')) {
    return {
      branch: text.slice('No commits yet on '.length).trim() || null,
      detached: false,
      hasCommits: false,
      upstream: null,
      ahead: 0,
      behind: 0,
    };
  }
  if (text.startsWith('HEAD (no branch)')) {
    return { branch: null, detached: true, hasCommits: true, upstream: null, ahead: 0, behind: 0 };
  }
  const bracket = /\[(.*?)\]\s*$/.exec(text);
  const main = bracket ? text.slice(0, bracket.index).trim() : text;
  const parts = main.split('...');
  let ahead = 0;
  let behind = 0;
  if (bracket) {
    for (const piece of bracket[1].split(',')) {
      const match = /(ahead|behind)\s+(\d+)/.exec(piece.trim());
      if (!match) continue;
      if (match[1] === 'ahead') ahead = Number(match[2]) || 0;
      else behind = Number(match[2]) || 0;
    }
  }
  return {
    branch: parts[0] || null,
    detached: !parts[0],
    hasCommits: true,
    upstream: parts[1] || null,
    ahead,
    behind,
  };
}

/**
 * One `git status` read per repository, shared by the workbench poll, the
 * file tree, and the repository switcher. `--branch` folds branch, upstream
 * and ahead/behind into the same porcelain output, so a repository costs a
 * single spawn here instead of the old `symbolic-ref` + `rev-list` trio.
 *
 * `maxAge` lets the workbench keep the selected repository fresh while the
 * other repositories only feed the switcher's change counts.
 */

async function readRepoSnapshot(repoRoot, signal, maxAge = STATUS_LITE_TTL) {
  const rootKey = cacheKey(repoRoot);
  const cached = statusLiteValues.get(rootKey);
  if (cached && Date.now() - cached.at < maxAge) return cached.value;
  // A work tree that cannot be read (an uninitialised submodule, a locked
  // index) stays broken for a while; retrying it on every poll would spawn
  // Git for nothing, so remember the failure briefly.
  const failed = cacheRead(snapshotFailures, rootKey, SNAPSHOT_FAILURE_TTL);
  if (failed !== undefined) throw new GitError(failed.code, failed.message, failed.detail);
  const inflight = statusLiteInflight.get(rootKey);
  if (inflight) return inflight;
  const promise = (async () => {
    const status = await runGit(repoRoot, [
      'status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all', '--no-renames', '--', '.',
    ], { signal, timeoutMs: STATUS_TIMEOUT });
    if (status.code !== 0) {
      // A bare repository has no work tree, so `git status` refuses to run.
      // It is still a repository we report, just without file statuses.
      const bare = await runGit(repoRoot, ['rev-parse', '--is-bare-repository'], { signal, timeoutMs: 10_000 });
      if (bare.code === 0 && bare.stdout.trim() === 'true') {
        const bareValue = {
          repoRoot,
          isBare: true,
          hasCommits: false,
          branch: null,
          detached: false,
          upstream: null,
          ahead: 0,
          behind: 0,
          entries: [],
          counts: emptyCounts(),
        };
        statusLiteValues.set(rootKey, { at: Date.now(), value: bareValue });
        return bareValue;
      }
      throw new GitError('STATUS_FAILED', status.stderr.trim() || 'git status 执行失败', status.stdout.trim());
    }

    const records = status.stdout.split('\0');
    const hasHeader = records.length > 0 && records[0].startsWith('## ');
    const branchInfo = hasHeader
      ? parseBranchHeader(records[0])
      : { branch: null, detached: false, hasCommits: true, upstream: null, ahead: 0, behind: 0 };
    const entries = parseStatus(hasHeader ? records.slice(1).join('\0') : status.stdout);
    const value = {
      repoRoot,
      isBare: false,
      ...branchInfo,
      entries,
      counts: countEntries(entries),
    };
    statusLiteValues.set(rootKey, { at: Date.now(), value });
    return value;
  })().catch((error) => {
    if (error instanceof GitError && error.code === 'STATUS_FAILED') {
      cacheWrite(snapshotFailures, rootKey, {
        code: error.code,
        message: error.message,
        detail: error.detail,
      });
    }
    throw error;
  });
  statusLiteInflight.set(rootKey, promise);
  try {
    return await promise;
  } finally {
    statusLiteInflight.delete(rootKey);
  }
}

/** Run `fn` over `items` with bounded concurrency; each outcome is boxed. */

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { value: await fn(items[index]) };
      } catch (error) {
        results[index] = { error };
      }
    }
  };
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}

/**
 * Snapshot every discovered repository, keeping one failure local. When
 * `freshRoot` is given, only that repository is re-read aggressively; the
 * others reuse the switcher cache for a few seconds.
 */

async function readWorkspaceRepositories(repos, signal, freshRoot) {
  const freshKey = freshRoot ? cacheKey(freshRoot) : null;
  const outcomes = await mapLimit(repos, REPO_READ_CONCURRENCY, (repo) => {
    const maxAge = freshKey && cacheKey(repo.root) !== freshKey ? SUMMARY_TTL : STATUS_LITE_TTL;
    return readRepoSnapshot(repo.root, signal, maxAge);
  });
  return outcomes.map((outcome, index) => {
    const repo = repos[index];
    if (outcome && outcome.value) return { repo, snapshot: outcome.value, error: null };
    const error = outcome ? outcome.error : null;
    return {
      repo,
      snapshot: null,
      error: error instanceof GitError ? error.code : 'INTERNAL',
    };
  });
}

/** Aggregate file status for the whole workspace, for the tree and sidebar. */

async function readStatusLite(workspacePath, signal) {
  const workspaceRoot = resolve(workspacePath);
  const repos = await listRepositories(workspaceRoot, signal);
  if (repos.length === 0) return { isRepo: false, workspaceRoot, repos: [] };

  const results = await readWorkspaceRepositories(repos, signal);
  const summaries = [];
  const entries = [];
  const counts = emptyCounts();
  for (const { repo, snapshot, error } of results) {
    summaries.push(summarizeRepository(repo, snapshot, error));
    if (!snapshot) continue;
    for (const entry of snapshot.entries) entries.push({ ...entry, repo: repo.root });
    addCounts(counts, snapshot.counts);
  }

  const primary = primaryRepository(repos);
  const primarySummary = summaries.find((summary) => summary.root === primary.root) || summaries[0];
  return {
    isRepo: true,
    workspaceRoot,
    repoRoot: primary.root,
    relativePath: primary.relativePath,
    isBare: primarySummary.isBare,
    branch: primarySummary.branch,
    detached: primarySummary.detached,
    upstream: primarySummary.upstream,
    ahead: primarySummary.ahead,
    behind: primarySummary.behind,
    repos: summaries,
    entries,
    counts,
  };
}


async function readBranch(root, signal) {
  const symbolic = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  const branch = symbolic.code === 0 ? symbolic.stdout.trim() : null;
  const head = await runGit(root, ['rev-parse', '--short', 'HEAD'], { signal, timeoutMs: 10_000 });
  const hasCommits = head.code === 0;
  let upstream = null;
  let ahead = 0;
  let behind = 0;
  if (branch && hasCommits) {
    const upstreamResult = await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { signal, timeoutMs: 10_000 });
    if (upstreamResult.code === 0) {
      upstream = upstreamResult.stdout.trim() || null;
      if (upstream) {
        const counts = await runGit(root, ['rev-list', '--left-right', '--count', '@{u}...HEAD'], { signal, timeoutMs: 10_000 });
        if (counts.code === 0) {
          const [left, right] = counts.stdout.trim().split(/\s+/).map((value) => Number(value) || 0);
          behind = left || 0;
          ahead = right || 0;
        }
      }
    }
  }
  return {
    branch,
    detached: !branch && hasCommits,
    hasCommits,
    head: hasCommits ? head.stdout.trim() : null,
    upstream,
    ahead,
    behind,
  };
}


async function readIdentity(root, signal) {
  const result = await runGit(root, ['config', '--get-regexp', '^user\\.(name|email)$'], { signal, timeoutMs: 5_000 });
  let name = null;
  let email = null;
  if (result.code === 0) {
    for (const line of result.stdout.split('\n')) {
      const match = /^user\.(name|email)\s+(.*)$/.exec(line.trim());
      if (!match) continue;
      if (match[1] === 'name') name = match[2];
      else email = match[2];
    }
  }
  return { name, email };
}


async function readRemotes(root, signal) {
  const result = await runGit(root, ['remote'], { signal, timeoutMs: 10_000 });
  return result.code === 0
    ? result.stdout.split('\n').map((value) => value.trim()).filter(Boolean)
    : [];
}


async function readAux(root, signal) {
  const key = cacheKey(root);
  const cached = cacheRead(auxCache, key, AUX_TTL);
  if (cached !== undefined) return cached;
  const [remotes, identity] = await Promise.all([
    readRemotes(root, signal),
    readIdentity(root, signal),
  ]);
  const value = { remotes, identity };
  cacheWrite(auxCache, key, value);
  return value;
}

/** Per-file `+additions/-deletions` for the work tree or the index. */

async function readNumstat(root, cached, signal) {
  const args = ['diff', '--numstat', '--no-renames', '-z'];
  if (cached) args.push('--cached');
  args.push('--');
  const result = await runGit(root, args, { signal, timeoutMs: 20_000 });
  const stats = new Map();
  if (result.code !== 0) return stats;
  for (const record of result.stdout.split('\0')) {
    if (!record) continue;
    const [added, deleted, filePath] = record.split('\t');
    if (!filePath) continue;
    stats.set(filePath, {
      additions: added === '-' ? 0 : Number(added) || 0,
      deletions: deleted === '-' ? 0 : Number(deleted) || 0,
    });
  }
  return stats;
}

/** Aggregate `+additions/-deletions` across a commit range. */

async function readNumstatRange(root, range, signal) {
  const result = await runGit(root, ['diff', '--numstat', '--no-renames', '-z', range], {
    signal,
    timeoutMs: 30_000,
  });
  const stats = { files: 0, additions: 0, deletions: 0 };
  if (result.code !== 0) return stats;
  for (const record of result.stdout.split('\0')) {
    if (!record) continue;
    const [added, deleted, filePath] = record.split('\t');
    if (!filePath) continue;
    stats.files += 1;
    stats.additions += added === '-' ? 0 : Number(added) || 0;
    stats.deletions += deleted === '-' ? 0 : Number(deleted) || 0;
  }
  return stats;
}

/** Parse `git fetch --all --porcelain` into changed ref updates. */

async function readRepoStatus(repoRoot, signal) {
  const snapshot = await readRepoSnapshot(repoRoot, signal);
  if (snapshot.isBare) {
    return { ...snapshot, remotes: [], identity: { name: null, email: null } };
  }
  const [aux, unstagedStats, stagedStats] = await Promise.all([
    readAux(repoRoot, signal),
    readNumstat(repoRoot, false, signal),
    readNumstat(repoRoot, true, signal),
  ]);
  const entries = snapshot.entries.map((entry) => {
    const staged = entry.staged ? stagedStats.get(entry.path) : null;
    const unstaged = !entry.staged || entry.partial ? unstagedStats.get(entry.path) : null;
    if (!staged && !unstaged) return entry;
    return {
      ...entry,
      additions: (staged ? staged.additions : 0) + (unstaged ? unstaged.additions : 0),
      deletions: (staged ? staged.deletions : 0) + (unstaged ? unstaged.deletions : 0),
    };
  });
  return { ...snapshot, ...aux, entries };
}

/** Resolve the repository a scoped operation targets. */

async function operationRepo(workspacePath, repoValue, signal) {
  const workspaceRoot = resolve(workspacePath);
  const repos = await listRepositories(workspaceRoot, signal);
  return requireRepositoryForOperation(workspaceRoot, repos, repoValue);
}

/**
 * Status for the workbench: the selected repository carries the full status,
 * while every discovered repository contributes a switcher summary. With no
 * selection the primary repository (the workspace root one) is used.
 */

async function readStatus(workspacePath, repoValue, signal) {
  const workspaceRoot = resolve(workspacePath);
  const repos = await listRepositories(workspaceRoot, signal);
  if (repos.length === 0) return { isRepo: false, workspaceRoot, repos: [] };

  const selected = repoValue == null || repoValue === ''
    ? primaryRepository(repos)
    : findRepository(workspaceRoot, repos, repoValue);
  if (!selected) throw new GitError('REPO_NOT_FOUND', '该仓库不在当前工作区内');

  // The switcher summaries and the selected repository's full status are two
  // independent reads that share one `git status` for the selected repository
  // (deduplicated inside `readRepoSnapshot`). Running them together saves a
  // whole Git spawn of latency on the panel's first screen.
  const statusPromise = readRepoStatus(selected.root, signal).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  const [results, statusOutcome] = await Promise.all([
    readWorkspaceRepositories(repos, signal, selected.root),
    statusPromise,
  ]);
  const summaries = results.map(({ repo, snapshot, error }) => summarizeRepository(repo, snapshot, error));
  const current = results.find((item) => item.repo.root === selected.root);
  if (statusOutcome.error) {
    if (statusOutcome.error instanceof GitError && statusOutcome.error.code === 'CANCELLED') {
      throw statusOutcome.error;
    }
    const detail = statusOutcome.error instanceof GitError
      ? statusOutcome.error.code
      : (statusOutcome.error && statusOutcome.error.message) || null;
    throw new GitError('STATUS_FAILED', '读取 Git 状态失败', detail);
  }
  if (!current || !current.snapshot) {
    if (current && current.error === 'CANCELLED') throw new GitError('CANCELLED', '操作已取消');
    throw new GitError('STATUS_FAILED', '读取 Git 状态失败', current ? current.error : null);
  }

  const snapshot = statusOutcome.value;
  const primary = primaryRepository(repos);
  return {
    isRepo: true,
    workspaceRoot,
    repos: summaries,
    primary: primary ? primary.root : selected.root,
    ...snapshot,
    repoRoot: selected.root,
    relativePath: selected.relativePath,
    head: null,
  };
}

export { classifyStatus, mapLimit, operationRepo, parseBranchHeader, parseStatus, readAux, readBranch, readIdentity, readNumstat, readNumstatRange, readRemotes, readRepoSnapshot, readRepoStatus, readStatus, readStatusLite, readWorkspaceRepositories, summarizeRepository };
