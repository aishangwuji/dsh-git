import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/**
 * Host half of the Git workbench.
 *
 * The browser never runs `git`: every operation crosses one same-origin JSON
 * route. The route is deliberately boring (argv only, no shell, bounded
 * output, bounded time, an explicit workspace allow-list) so the browser half
 * can stay a pure view.
 */

const ROUTE_PREFIX = '/dsh-git-6b1e';
const MAX_BODY = 1024 * 1024;
const MAX_OUTPUT = 4 * 1024 * 1024;
const STATUS_TIMEOUT = 30_000;
const WRITE_TIMEOUT = 30_000;
const REMOTE_TIMEOUT = 120_000;

const GIT_GLOBAL_ARGS = [
  '--literal-pathspecs',
  '-c', 'core.fsmonitor=false',
  '-c', 'log.showSignature=false',
  '--no-optional-locks',
  '--no-pager',
];

const SAFE_ENV_KEYS = [
  'PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'WINDIR',
  'COMSPEC', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'SSH_AUTH_SOCK',
  'SSH_AGENT_PID', 'LANG', 'LC_ALL',
];

class GitError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'GitError';
    this.code = code;
    this.detail = detail;
  }
}

function sendJson(res, status, value) {
  if (res.headersSent) return;
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        rejectBody(new GitError('BODY_TOO_LARGE', '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function sameOrigin(origin, expected) {
  if (!origin) return true;
  if (!expected) return true;
  try {
    const actual = new URL(origin);
    const want = new URL(expected);
    if (actual.protocol !== want.protocol || actual.port !== want.port) return false;
    if (actual.hostname === want.hostname) return true;
    return isLoopbackHost(actual.hostname) && isLoopbackHost(want.hostname);
  } catch {
    return false;
  }
}

function readCollected(reader) {
  if (!reader) return '';
  try {
    return reader.readFrom(0).text || '';
  } catch {
    return '';
  }
}

function gitEnvironment() {
  const env = {};
  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string') env[key] = value;
  }
  return Object.assign(env, {
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    GIT_EDITOR: 'true',
    GIT_SEQUENCE_EDITOR: 'true',
    GCM_INTERACTIVE: 'never',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
  });
}

export const inject = ['webServer', 'subprocess', 'workspaceRegistry'];

export function apply(ctx) {
  let gitExecutablePromise;
  let cachedGitExecutable;

  const logger = ctx.logger;

  function workspaceEntries() {
    try {
      return ctx.workspaceRegistry.list();
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

  async function resolveGit() {
    if (cachedGitExecutable) return cachedGitExecutable;
    if (!gitExecutablePromise) {
      gitExecutablePromise = (async () => {
        try {
          const resolved = await ctx.subprocess.resolveExecutable('git');
          if (resolved) return resolved;
        } catch {
          // Fall through to the usual install locations below.
        }
        const candidates = process.platform === 'win32'
          ? [
              'C:\\Program Files\\Git\\cmd\\git.exe',
              'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
              `${process.env.LOCALAPPDATA || ''}\\Programs\\Git\\cmd\\git.exe`,
            ]
          : ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
        for (const candidate of candidates) {
          if (candidate && existsSync(candidate)) return candidate;
        }
        throw new GitError('GIT_MISSING', '找不到 Git，请安装 Git 并确保它位于 PATH 中');
      })();
    }
    cachedGitExecutable = await gitExecutablePromise;
    return cachedGitExecutable;
  }

  async function runGit(cwd, args, options = {}) {
    const executable = await resolveGit();
    const controller = new AbortController();
    const external = options.signal;
    const onAbort = () => controller.abort();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener('abort', onAbort, { once: true });
    }
    const timeoutMs = options.timeoutMs ?? 20_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let child;
    try {
      child = ctx.subprocess.spawn({
        argv: [executable, ...GIT_GLOBAL_ARGS, ...args],
        cwd,
        stdio: {
          stdin: options.stdin == null ? 'ignore' : { data: String(options.stdin) },
          stdout: { maxBytes: MAX_OUTPUT },
          stderr: { maxBytes: MAX_OUTPUT },
        },
        graceMs: 500,
        signal: controller.signal,
        env: gitEnvironment(),
      });

      let outcome;
      try {
        outcome = await child.done;
      } catch (error) {
        if (external?.aborted) throw new GitError('CANCELLED', '操作已取消');
        if (controller.signal.aborted) throw new GitError('GIT_TIMEOUT', `Git 操作超时（${timeoutMs}ms）`);
        throw new GitError('GIT_FAILED', `Git 进程失败：${error?.message || String(error)}`);
      }

      const stdout = readCollected(child.collected.stdout);
      const stderr = readCollected(child.collected.stderr);
      if (controller.signal.aborted) {
        if (external?.aborted) throw new GitError('CANCELLED', '操作已取消');
        throw new GitError('GIT_TIMEOUT', `Git 操作超时（${timeoutMs}ms）`);
      }
      return {
        code: outcome.exitCode == null ? -1 : outcome.exitCode,
        signal: outcome.signal,
        stdout,
        stderr,
      };
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw new GitError('GIT_SPAWN_FAILED', `无法启动 Git：${error?.message || String(error)}`);
    } finally {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', onAbort);
    }
  }

  function safeRepoPath(root, value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.includes('\0')) {
      throw new GitError('INVALID_PATH', '非法文件路径');
    }
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
      throw new GitError('INVALID_PATH', '路径必须是仓库内相对路径');
    }
    const parts = normalized.split('/').filter((part) => part.length > 0);
    if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
      throw new GitError('INVALID_PATH', '路径不得包含 . 或 ..');
    }
    const absoluteRoot = resolve(root);
    const absolute = resolve(absoluteRoot, ...parts);
    const prefix = absoluteRoot.endsWith(sep) ? absoluteRoot : absoluteRoot + sep;
    if (absolute !== absoluteRoot && !absolute.startsWith(prefix)) {
      throw new GitError('INVALID_PATH', '路径越出仓库根目录');
    }
    return parts.join('/');
  }

  function safeRef(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 255) {
      throw new GitError('INVALID_REF', '非法分支名');
    }
    if (value.startsWith('-') || value.endsWith('.') || value.endsWith('/') ||
        value.includes('..') || value.includes('@{') || /[\s~^:?*[\\]/.test(value)) {
      throw new GitError('INVALID_REF', '非法分支名');
    }
    return value;
  }

  function safeRemote(value) {
    if (typeof value !== 'string' || value.startsWith('-') || value.includes('..') ||
        !/^[A-Za-z0-9._-]+$/.test(value)) {
      throw new GitError('INVALID_REMOTE', '非法远程名');
    }
    return value;
  }

  function safeSha(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{7,64}$/i.test(value)) {
      throw new GitError('INVALID_SHA', '非法提交 SHA');
    }
    return value;
  }

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

  /* ------------------------------------------------------------------ *
   * Short-lived caches
   *
   * Every `git` invocation is a process spawn, so the status read is
   * assembled from the fewest commands possible and cached briefly: the
   * workbench polls, and the workspace tree asks for the same status while
   * a folder is being opened.
   * ------------------------------------------------------------------ */

  const REPO_ROOT_TTL = 60_000;
  const STATUS_LITE_TTL = 1500;
  const AUX_TTL = 30_000;
  const repoRootCache = new Map();
  const bareCache = new Map();
  const auxCache = new Map();
  const statusLiteValues = new Map();
  const statusLiteInflight = new Map();

  function cacheKey(value) {
    const absolute = resolve(String(value || '.'));
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  }

  function cacheRead(map, key, ttl) {
    const hit = map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > ttl) {
      map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function cacheWrite(map, key, value) {
    map.set(key, { at: Date.now(), value });
  }

  /** Drop the short-lived status caches for one repository after a write. */
  function invalidateRepo(root) {
    const key = cacheKey(root);
    repoRootCache.delete(key);
    bareCache.delete(key);
    auxCache.delete(key);
    statusLiteValues.delete(key);
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

  async function resolveRepoRoot(workspacePath, signal) {
    const key = cacheKey(workspacePath);
    const cached = cacheRead(repoRootCache, key, REPO_ROOT_TTL);
    if (cached !== undefined) return cached;
    const top = await runGit(workspacePath, ['rev-parse', '--show-toplevel'], { signal, timeoutMs: 10_000 });
    if (top.code !== 0) {
      cacheWrite(repoRootCache, key, null);
      return null;
    }
    const root = top.stdout.trim();
    if (!root) throw new GitError('REPO_ROOT_FAILED', '无法确定仓库根目录');
    cacheWrite(repoRootCache, key, root);
    return root;
  }

  async function readStatusLite(workspacePath, signal) {
    const repoRoot = await resolveRepoRoot(workspacePath, signal);
    if (!repoRoot) return { isRepo: false, workspaceRoot: workspacePath };
    const rootKey = cacheKey(repoRoot);
    const cached = statusLiteValues.get(rootKey);
    if (cached && Date.now() - cached.at < STATUS_LITE_TTL) return cached.value;
    const inflight = statusLiteInflight.get(rootKey);
    if (inflight) return inflight;
    const promise = (async () => {
      const status = await runGit(repoRoot, [
        'status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', '.',
      ], { signal, timeoutMs: STATUS_TIMEOUT });
      if (status.code !== 0) {
        throw new GitError('STATUS_FAILED', status.stderr.trim() || 'git status 执行失败', status.stdout.trim());
      }
      const value = {
        isRepo: true,
        isBare: false,
        workspaceRoot: workspacePath,
        repoRoot,
        entries: parseStatus(status.stdout),
      };
      statusLiteValues.set(rootKey, { at: Date.now(), value });
      return value;
    })();
    statusLiteInflight.set(rootKey, promise);
    try {
      return await promise;
    } finally {
      statusLiteInflight.delete(rootKey);
    }
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

  async function readStatus(workspacePath, signal) {
    const repoRoot = await resolveRepoRoot(workspacePath, signal);
    if (!repoRoot) {
      return { isRepo: false, workspaceRoot: workspacePath };
    }

    const rootKey = cacheKey(repoRoot);
    let isBare = cacheRead(bareCache, rootKey, REPO_ROOT_TTL);
    if (isBare === undefined) {
      const bare = await runGit(repoRoot, ['rev-parse', '--is-bare-repository'], { signal, timeoutMs: 10_000 });
      isBare = bare.code === 0 && bare.stdout.trim() === 'true';
      cacheWrite(bareCache, rootKey, isBare);
    }
    if (isBare) {
      return { isRepo: true, isBare: true, workspaceRoot: workspacePath, repoRoot };
    }

    // `--branch` folds branch, upstream, ahead/behind into the same porcelain
    // read, so a full status no longer spawns `symbolic-ref` + `rev-list`.
    const status = await runGit(repoRoot, [
      'status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all', '--no-renames', '--', '.',
    ], { signal, timeoutMs: STATUS_TIMEOUT });

    if (status.code !== 0) {
      throw new GitError('STATUS_FAILED', status.stderr.trim() || 'git status 执行失败', status.stdout.trim());
    }

    const records = status.stdout.split('\0');
    const hasHeader = records.length > 0 && records[0].startsWith('## ');
    const branchInfo = hasHeader
      ? parseBranchHeader(records[0])
      : { branch: null, detached: false, hasCommits: true, upstream: null, ahead: 0, behind: 0 };
    const entries = parseStatus(hasHeader ? records.slice(1).join('\0') : status.stdout);

    statusLiteValues.set(rootKey, {
      at: Date.now(),
      value: { isRepo: true, isBare: false, workspaceRoot: workspacePath, repoRoot, entries },
    });

    const { remotes, identity } = await readAux(repoRoot, signal);

    let stagedCount = 0;
    let unstagedCount = 0;
    let conflictCount = 0;
    let untrackedCount = 0;
    for (const entry of entries) {
      if (entry.conflict) conflictCount += 1;
      if (entry.kind === 'untracked') untrackedCount += 1;
      if (entry.staged || entry.partial) stagedCount += 1;
      if (!entry.staged || entry.partial) unstagedCount += 1;
    }

    return {
      isRepo: true,
      isBare: false,
      workspaceRoot: workspacePath,
      repoRoot,
      ...branchInfo,
      head: null,
      remotes,
      identity,
      entries,
      counts: {
        changed: entries.length,
        staged: stagedCount,
        unstaged: unstagedCount,
        conflicts: conflictCount,
        untracked: untrackedCount,
      },
    };
  }

  async function readGraph(workspacePath, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo || status.isBare) return { commits: [] };
    const root = status.repoRoot;

    const log = await runGit(root, [
      'log', '--topo-order', '--format=%H%x00%P%x00%an%x00%at%x00%s', '-n', '200', '--all',
    ], { signal, timeoutMs: 30_000 });

    if (log.code !== 0) return { commits: [] };

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

    const refsResult = await runGit(root, [
      'for-each-ref', '--format=%(objectname)%00%(refname)%00%(HEAD)',
      'refs/heads', 'refs/remotes', 'refs/tags',
    ], { signal, timeoutMs: 15_000 });

    if (refsResult.code === 0) {
      const refsBySha = new Map();
      for (const line of refsResult.stdout.split('\n')) {
        if (!line) continue;
        const [oid, refname, head] = line.split('\0');
        if (!oid || !refname) continue;
        let label;
        if (refname.startsWith('refs/heads/')) label = refname.slice('refs/heads/'.length);
        else if (refname.startsWith('refs/remotes/')) {
          if (refname.endsWith('/HEAD')) continue;
          label = refname.slice('refs/remotes/'.length);
        } else if (refname.startsWith('refs/tags/')) label = `tag: ${refname.slice('refs/tags/'.length)}`;
        else continue;
        if (head === '*') label = `HEAD -> ${label}`;
        const list = refsBySha.get(oid) || [];
        list.push(label);
        refsBySha.set(oid, list);
      }
      const rank = (ref) => (ref.startsWith('HEAD ->') ? 0 : ref.startsWith('tag:') ? 1 : 2);
      for (const commit of commits) {
        const refs = (refsBySha.get(commit.sha) || []).sort((a, b) => rank(a) - rank(b));
        commit.refs = refs.slice(0, 4);
      }
    }

    return { commits };
  }

  async function readCommit(workspacePath, shaValue, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    const root = status.repoRoot;
    const sha = safeSha(shaValue);

    const meta = await runGit(root, [
      'show', '-s', '--format=%H%x00%an%x00%at%x00%s%x00%b', sha,
    ], { signal, timeoutMs: 20_000 });
    if (meta.code !== 0) throw new GitError('COMMIT_NOT_FOUND', meta.stderr.trim() || '提交不存在');

    const [oid, author, timestamp, subject, ...bodyParts] = meta.stdout.split('\0');
    const patch = await runGit(root, [
      'show', '--no-color', '--no-ext-diff', '--format=', '--stat', '--patch', sha,
    ], { signal, timeoutMs: 30_000 });

    return {
      sha: oid || sha,
      author: author || '',
      timestamp: Number(timestamp) || 0,
      subject: subject || '',
      body: bodyParts.join('\0').trim(),
      patch: patch.stdout || '',
      truncated: patch.stdout.length >= MAX_OUTPUT - 1,
    };
  }

  async function readDiff(workspacePath, payload, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    const root = status.repoRoot;
    const path = safeRepoPath(root, payload.path);
    const args = ['diff', '--no-color', '--no-ext-diff'];
    if (payload.staged === true) args.push('--cached');
    args.push('--', path);
    const diff = await runGit(root, args, { signal, timeoutMs: 20_000 });
    if (diff.code !== 0) throw new GitError('DIFF_FAILED', diff.stderr.trim() || '读取 diff 失败');
    return { text: diff.stdout, truncated: diff.stdout.length >= MAX_OUTPUT - 1 };
  }

  async function stagePaths(workspacePath, pathsValue, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    const root = status.repoRoot;
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

  async function unstagePaths(workspacePath, pathsValue, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    const root = status.repoRoot;
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

  async function commit(workspacePath, payload, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    const root = status.repoRoot;

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

  async function fetchRemote(workspacePath, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    if (status.remotes.length === 0) throw new GitError('NO_REMOTE', '没有配置远程仓库');
    const result = await runGit(status.repoRoot, ['fetch', '--all'], { signal, timeoutMs: REMOTE_TIMEOUT });
    if (result.code !== 0) throw remoteFailure(result);
    return { output: `${result.stdout}\n${result.stderr}`.trim() };
  }

  async function pullRemote(workspacePath, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    if (!status.branch) throw new GitError('DETACHED_HEAD', '分离 HEAD 状态下无法拉取');
    const hasUpstream = Boolean(status.upstream);
    const args = ['pull', '--no-edit'];
    if (!hasUpstream) {
      const remote = await remoteForBranch(status.repoRoot, status.branch, signal);
      args.push(remote, safeRef(status.branch));
    }
    const result = await runGit(status.repoRoot, args, { signal, timeoutMs: REMOTE_TIMEOUT });
    if (result.code !== 0) throw remoteFailure(result);
    return { output: `${result.stdout}\n${result.stderr}`.trim() };
  }

  async function pushRemote(workspacePath, signal) {
    const status = await readStatus(workspacePath, signal);
    if (!status.isRepo) throw new GitError('NOT_A_REPO', '当前工作区不是 Git 仓库');
    if (!status.branch) throw new GitError('DETACHED_HEAD', '分离 HEAD 状态下无法推送');

    const upstream = await runGit(status.repoRoot, ['rev-parse', '--verify', '--quiet', '@{u}'], { signal, timeoutMs: 10_000 });
    const args = ['push', '--porcelain'];
    if (upstream.code !== 0) {
      const remote = await remoteForBranch(status.repoRoot, status.branch, signal);
      args.push('-u', remote, `${safeRef(status.branch)}:${safeRef(status.branch)}`);
    }
    const result = await runGit(status.repoRoot, args, { signal, timeoutMs: REMOTE_TIMEOUT });
    if (result.code !== 0) throw remoteFailure(result);
    return { output: `${result.stdout}\n${result.stderr}`.trim() };
  }

  async function initRepo(workspacePath, signal) {
    const root = requireWorkspace(workspacePath);
    const check = await runGit(root, ['rev-parse', '--is-inside-work-tree'], { signal, timeoutMs: 10_000 });
    if (check.code === 0 && check.stdout.trim() === 'true') {
      return readStatus(root, signal);
    }
    invalidateRepo(root);
    let result = await runGit(root, ['init', '-b', 'main'], { signal, timeoutMs: WRITE_TIMEOUT });
    if (result.code !== 0) {
      result = await runGit(root, ['init'], { signal, timeoutMs: WRITE_TIMEOUT });
      if (result.code !== 0) throw new GitError('INIT_FAILED', result.stderr.trim() || '初始化仓库失败');
      await runGit(root, ['symbolic-ref', 'HEAD', 'refs/heads/main'], { signal, timeoutMs: 10_000 });
    }
    return readStatus(root, signal);
  }

  async function dispatch(payload, signal) {
    const body = payload && typeof payload === 'object' ? payload : {};
    const op = body.op;
    if (op === 'workspaces') {
      return workspaceEntries().map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
        path: workspace.path,
      }));
    }

    const workspace = requireWorkspace(body.workspace);

    switch (op) {
      case 'status':
        return readStatus(workspace, signal);
      case 'status-lite':
        return readStatusLite(workspace, signal);
      case 'graph':
        return readGraph(workspace, signal);
      case 'commit-detail':
        return readCommit(workspace, body.sha, signal);
      case 'diff':
        return readDiff(workspace, body, signal);
      case 'stage':
        return stagePaths(workspace, body.paths, signal);
      case 'unstage':
        return unstagePaths(workspace, body.paths, signal);
      case 'commit':
        return commit(workspace, body, signal);
      case 'fetch':
        return fetchRemote(workspace, signal);
      case 'pull':
        return pullRemote(workspace, signal);
      case 'push':
        return pushRemote(workspace, signal);
      case 'init':
        return initRepo(workspace, signal);
      default:
        throw new GitError('UNKNOWN_OP', `未知操作：${String(op)}`);
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' } });
          return;
        }

        let expectedOrigin = null;
        try {
          expectedOrigin = ctx.webServer.getOrigin();
        } catch {
          expectedOrigin = null;
        }
        if (!sameOrigin(req.headers.origin, expectedOrigin)) {
          sendJson(res, 403, { ok: false, error: { code: 'ORIGIN_REJECTED', message: '请求来源不被允许' } });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(await readBody(req));
        } catch (error) {
          sendJson(res, 400, { ok: false, error: { code: 'BAD_REQUEST', message: error?.message || '请求格式错误' } });
          return;
        }

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        try {
          const value = await dispatch(payload, controller.signal);
          sendJson(res, 200, { ok: true, value });
        } catch (error) {
          if (error instanceof GitError) {
            sendJson(res, 200, {
              ok: false,
              error: { code: error.code, message: error.message, detail: error.detail },
            });
          } else {
            logger?.warn?.('[dsh-git] operation failed', error);
            sendJson(res, 500, {
              ok: false,
              error: { code: 'INTERNAL', message: error?.message || '内部错误' },
            });
          }
        }
      } catch (error) {
        logger?.warn?.('[dsh-git] route failed', error);
        sendJson(res, 500, { ok: false, error: { code: 'INTERNAL', message: error?.message || '内部错误' } });
      }
    },
  }), 'dsh-git: HTTP route');

  logger?.info?.('[dsh-git] Git workbench ready');
}
