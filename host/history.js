/**
 * History reads: the filtered commit graph, commit details, diffs, and the branch tree.
 */
import { join } from 'node:path';
import { GitError, MAX_OUTPUT, safeRepoPath, safeSha } from './core.js';
import { runGit } from './git.js';
import { operationRepo, readAux, readRepoSnapshot } from './status.js';
import { parseWorktreeList, worktreesHome } from './worktrees.js';
import { commit } from './write.js';

/** One optional string filter, trimmed and bounded, or `` when absent. */
function graphFilterText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text === '' || text.includes('\0')) return '';
  return text.slice(0, maxLength);
}

/**
 * Commit list with graph data; `limit`/`skip` page the history and the
 * optional `author` / `since` / `until` / `path` / `order` filters narrow it.
 * Filtering happens in Git, not in the browser: a filtered history must page
 * through the filtered set, and the client only ever holds one page.
 */

async function readGraph(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);

  const limit = Math.min(Math.max(Number(payload && payload.limit) || 200, 1), 500);
  const skip = Math.max(Number(payload && payload.skip) || 0, 0);
  // The workbench history follows the checked-out branch; the explicit
  // Git-graph dialog asks for `all: true` when it wants every ref.
  const allRefs = payload && payload.all === true;
  const author = graphFilterText(payload && payload.author, 200);
  const since = graphFilterText(payload && payload.since, 64);
  const until = graphFilterText(payload && payload.until, 64);
  const pathFilter = graphFilterText(payload && payload.path, 4096)
    ? safeRepoPath(root, graphFilterText(payload && payload.path, 4096))
    : '';
  const oldestFirst = Boolean(payload) && payload.order === 'oldest';

  const logArgs = [
    'log', '--topo-order', '--format=%H%x00%P%x00%an%x00%at%x00%s', '-n', String(limit + 1),
  ];
  // `--reverse` after `-n` gives the newest page in ascending order, which is
  // what an "oldest first" toggle is supposed to show.
  if (oldestFirst) logArgs.push('--reverse');
  if (author) logArgs.push(`--author=${author}`);
  if (since) logArgs.push(`--since=${since}`);
  if (until) logArgs.push(`--until=${until}`);
  logArgs.push(allRefs ? '--all' : 'HEAD');
  if (skip > 0) logArgs.push(`--skip=${skip}`);
  // The path filter goes after `--` so a file named like a revision is never
  // read as one.
  if (pathFilter) logArgs.push('--', pathFilter);
  // The log, the ref table and the bare check are independent reads, so they
  // run together: the history page costs one Git round trip instead of three,
  // and the bare check is a cheap `rev-parse` rather than a full worktree
  // status scan the history never uses.
  const [log, refsResult, bare] = await Promise.all([
    runGit(root, logArgs, { signal, timeoutMs: 30_000 }),
    // Refs are read for the visible page only; `skip` pages are appended by
    // the client, so a later page still carries its own refs.
    runGit(root, [
      'for-each-ref', '--format=%(objectname)%00%(refname)%00%(HEAD)',
      'refs/heads', 'refs/remotes', 'refs/tags',
    ], { signal, timeoutMs: 15_000 }),
    runGit(root, ['rev-parse', '--is-bare-repository'], { signal, timeoutMs: 10_000 }),
  ]);

  // A bare checkout has no work tree and the panel shows no history for it.
  if (bare.code === 0 && bare.stdout.trim() === 'true') return { commits: [], hasMore: false };
  if (log.code !== 0) return { commits: [], hasMore: false };

  const commits = [];
  for (const line of log.stdout.split('\n')) {
    if (!line) continue;
    const fields = line.split('\0');
    if (fields.length < 5) continue;
    const [sha, parents, author, timestamp, ...subjectParts] = fields;
    commits.push({
      sha,
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      author,
      timestamp: Number(timestamp) || 0,
      subject: subjectParts.join('\0'),
      refs: [],
    });
  }

  const hasMore = commits.length > limit;
  if (hasMore) commits.length = limit;

  if (refsResult.code === 0) {
    const refsBySha = new Map();
    for (const line of refsResult.stdout.split('\n')) {
      if (!line) continue;
      const [oid, refname, head] = line.split('\0');
      if (!oid || !refname) continue;
      let name;
      let kind;
      if (refname.startsWith('refs/heads/')) {
        name = refname.slice('refs/heads/'.length);
        kind = 'local';
      } else if (refname.startsWith('refs/remotes/')) {
        if (refname.endsWith('/HEAD')) continue;
        name = refname.slice('refs/remotes/'.length);
        kind = 'remote';
      } else if (refname.startsWith('refs/tags/')) {
        name = refname.slice('refs/tags/'.length);
        kind = 'tag';
      } else {
        continue;
      }
      if (head === '*') kind = 'head';
      const list = refsBySha.get(oid) || [];
      list.push({ name, kind });
      refsBySha.set(oid, list);
    }
    const rank = { head: 0, tag: 1, local: 2, remote: 3 };
    for (const commit of commits) {
      const refs = (refsBySha.get(commit.sha) || []).sort((a, b) => rank[a.kind] - rank[b.kind]);
      commit.refs = refs.slice(0, 5);
    }
  }

  return { commits, hasMore };
}

/** Changed files of a commit, without rename pairs (one path per entry). */

async function readCommitFiles(root, sha, signal) {
  const [numstat, nameStatus] = await Promise.all([
    runGit(root, ['show', '--numstat', '--format=', '--no-renames', sha], { signal, timeoutMs: 20_000 }),
    runGit(root, ['show', '--name-status', '--format=', '--no-renames', sha], { signal, timeoutMs: 20_000 }),
  ]);

  const statusByPath = new Map();
  if (nameStatus.code === 0) {
    for (const line of nameStatus.stdout.split('\n')) {
      if (!line) continue;
      const [status, filePath] = line.split('\t');
      if (status && filePath) statusByPath.set(filePath, status.charAt(0));
    }
  }

  const files = [];
  let additions = 0;
  let deletions = 0;
  if (numstat.code === 0) {
    for (const line of numstat.stdout.split('\n')) {
      if (!line) continue;
      const [added, deleted, filePath] = line.split('\t');
      if (!filePath) continue;
      const binary = added === '-' || deleted === '-';
      const adds = binary ? 0 : Number(added) || 0;
      const dels = binary ? 0 : Number(deleted) || 0;
      additions += adds;
      deletions += dels;
      files.push({
        path: filePath,
        status: statusByPath.get(filePath) || 'M',
        additions: adds,
        deletions: dels,
        binary,
      });
    }
  }

  return { files, stats: { files: files.length, additions, deletions } };
}

/**
 * Commit detail. With `path` it returns only that file's patch, which lets the
 * details pane show one file at a time instead of dumping the whole commit.
 */
/** Turn the origin remote into a browsable commit URL (GitHub/GitLab/Gitee). */

function commitWebUrl(remoteUrl, sha) {
  let url = String(remoteUrl || '').trim();
  if (!url) return null;
  if (url.startsWith('git@')) {
    const match = /^git@([^:]+):(.+)$/.exec(url);
    if (!match) return null;
    url = `https://${match[1]}/${match[2]}`;
  } else if (url.startsWith('ssh://')) {
    try {
      const parsed = new URL(url);
      url = `https://${parsed.hostname}${parsed.pathname}`;
    } catch {
      return null;
    }
  } else if (url.startsWith('http://')) {
    url = url.replace(/^http:\/\//, 'https://');
  }
  url = url.replace(/\.git$/, '').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+\/.+/.test(url)) return null;
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
  })();
  if (!host) return null;
  const suffix = host.includes('bitbucket') ? `/commits/${sha}` : `/commit/${sha}`;
  return { url: `${url}${suffix}`, host };
}

async function readCommit(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const sha = safeSha(payload.sha);
  const onlyPath = typeof payload.path === 'string' && payload.path
    ? safeRepoPath(root, payload.path)
    : null;

  const meta = await runGit(root, [
    'show', '-s', '--format=%H%x00%an%x00%ae%x00%at%x00%P%x00%s%x00%b', sha,
  ], { signal, timeoutMs: 20_000 });
  if (meta.code !== 0) throw new GitError('COMMIT_NOT_FOUND', meta.stderr.trim() || '提交不存在');

  const [oid, author, email, timestamp, parentsText, subject, ...bodyParts] = meta.stdout.split('\0');

  if (onlyPath) {
    const filePatch = await runGit(root, [
      'show', '--no-color', '--no-ext-diff', '--format=', sha, '--', onlyPath,
    ], { signal, timeoutMs: 30_000 });
    if (filePatch.code !== 0) {
      throw new GitError('GIT_COMMAND_FAILED', filePatch.stderr.trim() || '读取文件差异失败');
    }
    return {
      sha: oid || sha,
      path: onlyPath,
      patch: filePatch.stdout || '',
      truncated: filePatch.stdout.length >= MAX_OUTPUT - 1,
    };
  }

  const [filesResult, patch, remote] = await Promise.all([
    readCommitFiles(root, sha, signal),
    runGit(root, ['show', '--no-color', '--no-ext-diff', '--format=', sha], { signal, timeoutMs: 30_000 }),
    runGit(root, ['remote', 'get-url', 'origin'], { signal, timeoutMs: 10_000 }),
  ]);

  return {
    sha: oid || sha,
    author: author || '',
    email: email || '',
    timestamp: Number(timestamp) || 0,
    subject: subject || '',
    body: bodyParts.join('\0').trim(),
    parents: (parentsText || '').split(' ').filter(Boolean),
    files: filesResult.files,
    stats: filesResult.stats,
    webUrl: commitWebUrl(remote.code === 0 ? remote.stdout : '', oid || sha),
    patch: patch.stdout || '',
    truncated: patch.stdout.length >= MAX_OUTPUT - 1,
  };
}

async function readDiff(workspacePath, repoValue, payload, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const path = safeRepoPath(root, payload.path);
  const args = ['diff', '--no-color', '--no-ext-diff'];
  if (payload.staged === true) args.push('--cached');
  args.push('--', path);
  const diff = await runGit(root, args, { signal, timeoutMs: 20_000 });
  if (diff.code !== 0) throw new GitError('DIFF_FAILED', diff.stderr.trim() || '读取 diff 失败');
  return { text: diff.stdout, truncated: diff.stdout.length >= MAX_OUTPUT - 1 };
}

function parseUpstreamTrack(text) {
  const value = String(text || '');
  if (value.includes('gone')) return { ahead: 0, behind: 0, gone: true };
  const ahead = /ahead (\d+)/.exec(value);
  const behind = /behind (\d+)/.exec(value);
  return {
    ahead: ahead ? Number(ahead[1]) : 0,
    behind: behind ? Number(behind[1]) : 0,
    gone: false,
  };
}

/**
 * Branch tree data: local branches with their upstream drift and the worktree
 * that already has them checked out, remote branches, tags, and the current
 * HEAD. One `for-each-ref` covers all three ref stores, and one
 * `git worktree list` marks branches that are busy in another checkout, so a
 * long branch list stays a single round trip.
 */

async function readBranches(workspacePath, repoValue, signal) {
  const root = await operationRepo(workspacePath, repoValue, signal);
  const snapshot = await readRepoSnapshot(root, signal);
  if (snapshot.isBare) return { local: [], remote: [], tags: [], current: null, upstream: null, detached: false };

  const [refsResult, worktreeResult, aux] = await Promise.all([
    runGit(root, [
      'for-each-ref',
      '--format=%(refname)%00%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track)%00%(HEAD)%00%(committerdate:unix)',
      'refs/heads', 'refs/remotes', 'refs/tags',
    ], { signal, timeoutMs: 15_000 }),
    runGit(root, ['worktree', 'list', '--porcelain'], { signal, timeoutMs: 15_000 }),
    readAux(root, signal),
  ]);
  if (refsResult.code !== 0) {
    throw new GitError('GIT_COMMAND_FAILED', refsResult.stderr.trim() || '读取分支失败');
  }

  // Which branch is checked out where: a branch already busy in another
  // worktree cannot be checked out here, and the UI says so instead of
  // letting `git checkout` fail.
  const worktreeByBranch = new Map();
  if (worktreeResult.code === 0) {
    for (const row of parseWorktreeList(worktreeResult.stdout, worktreesHome())) {
      if (row.branch) worktreeByBranch.set(row.branch, { path: row.path, main: row.main });
    }
  }

  const remotes = aux.remotes;
  const longestFirst = remotes.slice().sort((a, b) => b.length - a.length);
  const local = [];
  const remote = [];
  const tags = [];
  for (const line of refsResult.stdout.split('\n')) {
    if (!line) continue;
    const [refname, short, sha, upstream, track, head] = line.split('\0');
    if (!refname || !short) continue;
    if (refname.startsWith('refs/heads/')) {
      const drift = parseUpstreamTrack(track);
      const mark = worktreeByBranch.get(short);
      local.push({
        name: short,
        sha,
        current: head === '*',
        upstream: upstream || null,
        ahead: drift.ahead,
        behind: drift.behind,
        gone: drift.gone,
        worktree: mark ? mark.path : null,
        worktreeMain: mark ? mark.main : false,
      });
      continue;
    }
    if (refname.startsWith('refs/remotes/')) {
      // `refs/remotes/<remote>/HEAD` is a symbolic alias, not a branch.
      if (short.endsWith('/HEAD')) continue;
      const remoteName = longestFirst.find((item) => short === item || short.startsWith(`${item}/`)) || '';
      const branchName = remoteName ? short.slice(remoteName.length + 1) : short;
      if (!branchName) continue;
      remote.push({ name: short, sha, remote: remoteName, branch: branchName });
      continue;
    }
    if (refname.startsWith('refs/tags/')) {
      tags.push({ name: short, sha });
    }
  }
  local.sort((a, b) => (b.current - a.current) || a.name.localeCompare(b.name));
  remote.sort((a, b) => a.name.localeCompare(b.name));
  tags.sort((a, b) => a.name.localeCompare(b.name));

  return {
    local,
    remote,
    tags,
    current: snapshot.branch || null,
    upstream: snapshot.upstream || null,
    detached: Boolean(snapshot.detached),
  };
}

export { commitWebUrl, graphFilterText, parseUpstreamTrack, readBranches, readCommit, readCommitFiles, readDiff, readGraph };
