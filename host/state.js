/**
 * Short-lived caches, the per-repository write queue, and the destructive-operation guard.
 */
import { resolve } from 'node:path';
import { GitError, cacheKey } from './core.js';

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

export { AUX_TTL, SNAPSHOT_FAILURE_TTL, STATUS_LITE_TTL, SUMMARY_TTL, WRITE_OPS, auxCache, cacheRead, cacheWrite, discoveryCache, discoveryInflight, invalidateRepo, invalidateWorkspace, lockKeyOf, requireConfirm, snapshotFailures, statusLiteInflight, statusLiteValues, withRepoLock, writeQueues };
