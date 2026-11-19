import { readFile } from 'node:fs/promises';
import { GitError, ROUTE_PREFIX, STYLE_FILE } from './host/core.js';
import { requireWorkspace, workspaceEntries } from './host/discovery.js';
import { readBranches, readCommit, readDiff, readGraph } from './host/history.js';
import { readBody, sameOrigin, sendJson } from './host/route.js';
import { WRITE_OPS, lockKeyOf, withRepoLock } from './host/state.js';
import { readStatus, readStatusLite } from './host/status.js';
import { addWorktree, listWorktrees, removeWorktree } from './host/worktrees.js';
import { checkoutBranch, commit, createBranch, fetchRemote, initRepo, pullRemote, pushRemote, stagePaths, unstagePaths } from './host/write.js';
import { bindRuntime, runtime } from './host/runtime.js';

/**
 * Host half of the Git workbench.
 *
 * The browser never runs `git`: every operation crosses one same-origin JSON
 * route. The route is deliberately boring (argv only, no shell, bounded
 * output, bounded time, an explicit workspace allow-list) so the browser half
 * can stay a pure view.
 */

export const inject = ['webServer', 'subprocess', 'workspaceRegistry'];

export function apply(ctx) {
  bindRuntime(ctx);
  const logger = runtime.logger;

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

        const pathname = new URL(req.url === undefined ? '/' : req.url, 'http://dsh.internal').pathname;
        if (pathname === `${ROUTE_PREFIX}/styles.css`) {
          // The panel stylesheet travels as a real file instead of a template
          // literal inside the client bundle: text a browser fetches cannot be
          // rewritten or dropped by whatever transforms the bundle on its way
          // to the page.
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET' } });
            return;
          }
          let css = null;
          try {
            css = await readFile(STYLE_FILE, 'utf8');
          } catch (error) {
            logger?.warn?.('[dsh-git] styles.css is missing', error);
          }
          if (css === null) {
            sendJson(res, 404, { ok: false, error: { code: 'STYLESHEET_MISSING', message: '样式表文件缺失' } });
            return;
          }
          const text = req.method === 'HEAD' ? '' : css;
          res.writeHead(200, {
            'content-type': 'text/css; charset=utf-8',
            'cache-control': 'no-cache',
            'content-length': Buffer.byteLength(text),
          });
          res.end(text);
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' } });
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
