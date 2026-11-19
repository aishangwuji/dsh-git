import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

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

/**
 * Repository discovery follows Zed's worktree scan: a directory that contains a
 * `.git` entry *is* a repository, `.git` internals are never walked, and a
 * repository nested inside another one is an independent project rather than an
 * exclusion. The walk is bounded by depth and by a directory budget so a
 * workspace that also holds `node_modules`, virtualenvs, or build output stays
 * cheap. Dependency and cache folders are not walked, but each one is still
 * probed for a `.git` entry, so a repository is never lost because of its name.
 */
const DISCOVERY_TTL = 30_000;
const DISCOVERY_MAX_DEPTH = 8;
const DISCOVERY_MAX_DIRS = 6_000;
const DISCOVERY_CONCURRENCY = 8;
const REPO_READ_CONCURRENCY = 6;
const DISCOVERY_SKIP_DIRS = new Set([
  'node_modules', 'bower_components', 'jspm_packages',
  '.venv', 'venv', 'env', 'virtualenv', 'site-packages',
  '__pycache__', '.mypy_cache', '.pytest_cache', '.ruff_cache', '.tox',
  'target', 'dist', 'build', 'out', '.output', '.next', '.nuxt', '.svelte-kit',
  '.cache', '.parcel-cache', '.turbo', '.gradle', '.dart_tool', '.pub-cache',
  'coverage', 'htmlcov', '.terraform', '.serverless',
  'pods', 'deriveddata', 'vendor', '.bundle',
  '.idea', '.vs', '.vscode-test',
]);

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

/** Worktree branch and directory namespace owned by this panel. */
const WORKTREE_BRANCH_PREFIX = 'wt/';
const WORKTREE_NAME_MAX = 64;

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

  /* ------------------------------------------------------------------ *
   * Managed worktrees
   *
   * A managed worktree lives under `<DSH_HOME>/worktrees/<repo-key>/<name>`.
   * The repository key mirrors the graph plugin's layout (sanitized basename
   * plus a short hash of the root), so two checkouts with the same folder name
   * can never share a worktree and a worktree created by either surface is
   * still recognizable here.
   * ------------------------------------------------------------------ */

  function normalizeWorktreeName(value) {
    if (typeof value !== 'string') return null;
    const cleaned = value.trim().toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+/, '')
      .replace(/[-.]+$/, '')
      .slice(0, WORKTREE_NAME_MAX);
    if (cleaned === '' || cleaned === '.' || cleaned === '..') return null;
    if (cleaned.includes('..') || cleaned.endsWith('.lock')) return null;
    return cleaned;
  }

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

  const STATUS_LITE_TTL = 1500;
  const SUMMARY_TTL = 8_000;
  const SNAPSHOT_FAILURE_TTL = 30_000;
  const AUX_TTL = 30_000;
  const discoveryCache = new Map();
  const discoveryInflight = new Map();
  const auxCache = new Map();
  const statusLiteValues = new Map();
  const statusLiteInflight = new Map();
  const snapshotFailures = new Map();

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
    auxCache.delete(key);
    statusLiteValues.delete(key);
    snapshotFailures.delete(key);
  }

  /** Drop the discovered repository list for one workspace (after `git init`). */
  function invalidateWorkspace(workspacePath) {
    discoveryCache.delete(cacheKey(workspacePath));
  }

  /* ------------------------------------------------------------------ *
   * Write serialization and destructive-operation guards
   *
   * Two panel instances can be open at once (the main Git tab and the sidebar
   * seat), and the client's own `busy` flag only covers one of them, so writes
   * are serialized here — per repository — and the same checkout never runs two
   * `git` writes concurrently. The queue is a promise chain per lock key whose
   * tail never rejects, so one failed write cannot poison the next waiter.
   *
   * Destructive operations additionally require `confirm: true` from the
   * caller. The UI is expected to have asked the user first; the flag is the
   * record that it did, so a stale panel or a code path that forgot the dialog
   * cannot silently delete a branch or wipe a dirty worktree.
   * ------------------------------------------------------------------ */

  const WRITE_OPS = new Set([
    'stage', 'unstage', 'commit', 'checkout', 'create-branch',
    'worktree-add', 'worktree-remove', 'init', 'fetch', 'pull', 'push',
  ]);
  const writeQueues = new Map();

  /** The repository a write targets, as a lock key (falls back to the workspace). */
  function lockKeyOf(workspacePath, repoValue) {
    const workspaceRoot = resolve(workspacePath);
    const target = repoValue == null || repoValue === ''
      ? workspaceRoot
      : resolve(workspaceRoot, String(repoValue));
    return cacheKey(target);
  }

  /** Run `run` after every earlier write for the same key has settled. */
  function withRepoLock(key, run) {
    const previous = writeQueues.get(key) || Promise.resolve();
    const next = previous.then(run, run);
    const tail = next.then(() => {}, () => {});
    writeQueues.set(key, tail);
    tail.then(() => {
      if (writeQueues.get(key) === tail) writeQueues.delete(key);
    });
    return next;
  }

  /** Refuse a destructive operation unless the caller confirmed it. */
  function requireConfirm(body, action) {
    if (body && body.confirm === true) return;
    throw new GitError('CONFIRM_REQUIRED', `需要确认后才能执行：${action}`, action);
  }

  function emptyCounts() {
    return { changed: 0, staged: 0, unstaged: 0, conflicts: 0, untracked: 0 };
  }

  function countEntries(entries) {
    const counts = emptyCounts();
    counts.changed = entries.length;
    for (const entry of entries) {
      if (entry.conflict) counts.conflicts += 1;
      if (entry.kind === 'untracked') counts.untracked += 1;
      if (entry.staged || entry.partial) counts.staged += 1;
      if (!entry.staged || entry.partial) counts.unstaged += 1;
    }
    return counts;
  }

  function addCounts(total, part) {
    if (!part) return total;
    total.changed += part.changed || 0;
    total.staged += part.staged || 0;
    total.unstaged += part.unstaged || 0;
    total.conflicts += part.conflicts || 0;
    total.untracked += part.untracked || 0;
    return total;
  }

  /** True when `child` is `parent` or lives below it (case-correct on Windows). */
  function pathIsInside(parent, child) {
    const base = cacheKey(parent);
    const target = cacheKey(child);
    const prefix = base.endsWith(sep) ? base : base + sep;
    return target === base || target.startsWith(prefix);
  }

  /** The kind of `.git` entry in a directory, or null when there is none. */
  async function dotGitKind(dir) {
    try {
      const info = await stat(join(dir, '.git'));
      return info.isDirectory() ? 'worktree' : 'gitfile';
    } catch {
      return null;
    }
  }

  /**
   * Walk a workspace for repositories, in the spirit of Zed's worktree scan.
   *
   * The `.git` entry of a directory is read from the same `readdir` that lists
   * its children, so the scan needs no extra stat per directory. A worktree
   * (`.git` directory) and a gitfile (linked worktree or submodule, `.git`
   * file) both count; a bare checkout (`HEAD` + `objects` + a ref store and no
   * `.git`) counts too, and is never walked because it has no work tree.
   */
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
      logger?.warn?.(`[dsh-git] repository scan of ${root} stopped after ${DISCOVERY_MAX_DIRS} directories`);
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

  /** Commit list with graph data; `limit`/`skip` page the history. */
  async function readGraph(workspacePath, repoValue, payload, signal) {
    const root = await operationRepo(workspacePath, repoValue, signal);

    const limit = Math.min(Math.max(Number(payload && payload.limit) || 200, 1), 500);
    const skip = Math.max(Number(payload && payload.skip) || 0, 0);
    // The workbench history follows the checked-out branch; the explicit
    // Git-graph dialog asks for `all: true` when it wants every ref.
    const allRefs = payload && payload.all === true;
    const logArgs = [
      'log', '--topo-order', '--format=%H%x00%P%x00%an%x00%at%x00%s', '-n', String(limit + 1),
      allRefs ? '--all' : 'HEAD',
    ];
    if (skip > 0) logArgs.push(`--skip=${skip}`);
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
  async function readBranches(workspacePath, repoValue, signal) {
    const root = await operationRepo(workspacePath, repoValue, signal);
    const snapshot = await readRepoSnapshot(root, signal);
    if (snapshot.isBare) return { local: [], remote: [], current: null, upstream: null, detached: false };

    const [localResult, remoteResult] = await Promise.all([
      runGit(root, ['for-each-ref', '--format=%(refname:short)%00%(HEAD)', 'refs/heads'], { signal, timeoutMs: 15_000 }),
      runGit(root, ['for-each-ref', '--format=%(refname:short)%00%(symref)', 'refs/remotes'], { signal, timeoutMs: 15_000 }),
    ]);
    if (localResult.code !== 0) {
      throw new GitError('GIT_COMMAND_FAILED', localResult.stderr.trim() || '读取分支失败');
    }
    if (remoteResult.code !== 0) {
      throw new GitError('GIT_COMMAND_FAILED', remoteResult.stderr.trim() || '读取远端分支失败');
    }

    const local = [];
    for (const line of localResult.stdout.split('\n')) {
      if (!line) continue;
      const [name, head] = line.split('\0');
      if (!name) continue;
      local.push({ name, current: head === '*' });
    }
    local.sort((a, b) => (b.current - a.current) || a.name.localeCompare(b.name));

    const remotes = (await readAux(root, signal)).remotes;
    const longestFirst = remotes.slice().sort((a, b) => b.length - a.length);
    const remote = [];
    for (const line of remoteResult.stdout.split('\n')) {
      if (!line) continue;
      const [name, symref] = line.split('\0');
      if (!name) continue;
      // `refs/remotes/origin/HEAD` is a symbolic alias, not a branch.
      if (symref) continue;
      const remoteName = longestFirst.find((item) => name === item || name.startsWith(`${item}/`)) || '';
      const shortName = remoteName ? name.slice(remoteName.length + 1) : name;
      if (!shortName) continue;
      remote.push({ name, remote: remoteName, branch: shortName });
    }
    remote.sort((a, b) => a.name.localeCompare(b.name));

    return {
      local,
      remote,
      current: snapshot.branch || null,
      upstream: snapshot.upstream || null,
      detached: Boolean(snapshot.detached),
    };
  }

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
    if (WRITE_OPS.has(op)) {
      // One write at a time per repository, whatever panel sent it.
      return withRepoLock(lockKeyOf(workspace, body.repo), () => runOperation(op, workspace, body, signal));
    }
    return runOperation(op, workspace, body, signal);
  }

  /** The operation switch; write operations arrive here already holding the lock. */
  async function runOperation(op, workspace, body, signal) {
    switch (op) {
      case 'status':
        return readStatus(workspace, body.repo, signal);
      case 'status-lite':
        return readStatusLite(workspace, signal);
      case 'graph':
        return readGraph(workspace, body.repo, body, signal);
      case 'branches':
        return readBranches(workspace, body.repo, signal);
      case 'checkout':
        return checkoutBranch(workspace, body.repo, body, signal);
      case 'create-branch':
        return createBranch(workspace, body.repo, body, signal);
      case 'worktrees':
        return listWorktrees(workspace, body.repo, signal);
      case 'worktree-add':
        return addWorktree(workspace, body.repo, body, signal);
      case 'worktree-remove':
        return removeWorktree(workspace, body.repo, body, signal);
      case 'commit-detail':
        return readCommit(workspace, body.repo, body, signal);
      case 'diff':
        return readDiff(workspace, body.repo, body, signal);
      case 'stage':
        return stagePaths(workspace, body.repo, body.paths, signal);
      case 'unstage':
        return unstagePaths(workspace, body.repo, body.paths, signal);
      case 'commit':
        return commit(workspace, body.repo, body, signal);
      case 'fetch':
        return fetchRemote(workspace, body.repo, signal);
      case 'pull':
        return pullRemote(workspace, body.repo, signal);
      case 'push':
        return pushRemote(workspace, body.repo, signal);
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
