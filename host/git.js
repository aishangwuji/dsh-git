/**
 * The single argv-only git entry point, its executable resolution, and its environment.
 */
import { existsSync } from 'node:fs';
import { GIT_GLOBAL_ARGS, GitError, MAX_OUTPUT, SAFE_ENV_KEYS } from './core.js';
import { runtime } from './runtime.js';

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


let gitExecutablePromise;

let cachedGitExecutable;


async function resolveGit() {
  if (cachedGitExecutable) return cachedGitExecutable;
  if (!gitExecutablePromise) {
    gitExecutablePromise = (async () => {
      try {
        const resolved = await runtime.ctx.subprocess.resolveExecutable('git');
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
    child = runtime.ctx.subprocess.spawn({
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

export { gitEnvironment, readCollected, resolveGit, runGit };
