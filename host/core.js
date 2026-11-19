/**
 * Errors, limits, and the only path/ref validators. Everything here is pure.
 */
import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTE_PREFIX = '/dsh-git-6b1e';
/** The panel stylesheet, served next to the RPC route as real CSS text. */

const STYLE_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css');

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

function cacheKey(value) {
  const absolute = resolve(String(value || '.'));
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
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

export { DISCOVERY_CONCURRENCY, DISCOVERY_MAX_DEPTH, DISCOVERY_MAX_DIRS, DISCOVERY_SKIP_DIRS, DISCOVERY_TTL, GIT_GLOBAL_ARGS, GitError, MAX_BODY, MAX_OUTPUT, REMOTE_TIMEOUT, REPO_READ_CONCURRENCY, ROUTE_PREFIX, SAFE_ENV_KEYS, STATUS_TIMEOUT, STYLE_FILE, WORKTREE_BRANCH_PREFIX, WORKTREE_NAME_MAX, WRITE_TIMEOUT, addCounts, cacheKey, countEntries, dotGitKind, emptyCounts, normalizeWorktreeName, pathIsInside, safeRef, safeRemote, safeRepoPath, safeSha };
