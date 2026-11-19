/**
 * Route-level checks for the Git workbench host.
 *
 * Run: node test/host.test.mjs
 *
 * The fixture mirrors the layout this panel has to understand: one plain folder
 * that collects several independent projects, a repository nested inside another
 * repository and hidden from it by `.gitignore`, a linked worktree (`.git`
 * file), a bare checkout, a pruned dependency folder, and a workspace that sits
 * inside a repository living above it.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { apply } from '../index.js';

const GIT = process.env.DSH_GIT_TEST_BINARY || 'git';
const ROUTE = '/dsh-git-6b1e/rpc';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function git(cwd, ...args) {
  return execFileSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
}

/** Minimal stand-in for the Harness `subprocess` service used by the plugin. */
function makeSubprocess(handlers) {
  return {
    async resolveExecutable(name) {
      return name === 'git' ? GIT : name;
    },
    spawn(options) {
      const [file, ...args] = options.argv;
      handlers.spawns.push({ cwd: options.cwd, argv: options.argv });
      const child = spawn(file, args, {
        cwd: options.cwd,
        env: { ...process.env, ...(options.env || {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const maxBytes = (options.stdio && options.stdio.stdout && options.stdio.stdout.maxBytes) || 1024 * 1024;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        if (stdout.length < maxBytes) stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length < maxBytes) stderr += chunk;
      });
      const onAbort = () => {
        try {
          child.kill();
        } catch {
          // The process may already be gone.
        }
      };
      if (options.signal) {
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener('abort', onAbort, { once: true });
      }
      const done = new Promise((resolveDone) => {
        child.on('error', (error) => resolveDone({ exitCode: -1, signal: null, error }));
        child.on('close', (code, signal) => resolveDone({ exitCode: code, signal }));
      });
      const stdin = options.stdio && options.stdio.stdin;
      if (stdin && stdin.data != null) child.stdin.end(String(stdin.data));
      else child.stdin.end();
      const reader = (read) => ({ readFrom: () => ({ text: read() }) });
      return { done, collected: { stdout: reader(() => stdout), stderr: reader(() => stderr) } };
    },
  };
}

function makeContext(workspaces, handlers) {
  return {
    logger: { info() {}, warn() {}, debug() {} },
    effect(fn) {
      const dispose = fn();
      if (typeof dispose === 'function') handlers.disposers.push(dispose);
      return dispose;
    },
    webServer: {
      getOrigin: () => null,
      register(route) {
        handlers.route = route;
        return () => {
          handlers.route = null;
        };
      },
    },
    subprocess: makeSubprocess(handlers),
    workspaceRegistry: { list: () => workspaces },
  };
}

async function buildFixture(base) {
  const workspace = join(base, 'ws');
  const alpha = join(workspace, 'alpha');
  const beta = join(alpha, 'beta');
  const delta = join(workspace, 'delta');
  const bare = join(workspace, 'bare.git');
  const outer = join(base, 'outer');
  const sub = join(outer, 'sub');

  await mkdir(alpha, { recursive: true });
  git(alpha, 'init', '-b', 'main');
  git(alpha, 'config', 'user.name', 'Fixture');
  git(alpha, 'config', 'user.email', 'fixture@example.com');
  await writeFile(join(alpha, '.gitignore'), 'beta/\nnode_modules/\n');
  await writeFile(join(alpha, 'tracked.txt'), 'one\n');
  await writeFile(join(alpha, 'changed.txt'), 'one\n');
  git(alpha, 'add', '-A');
  git(alpha, 'commit', '-m', 'alpha root');
  await writeFile(join(alpha, 'changed.txt'), 'two\n');
  await writeFile(join(alpha, 'fresh.txt'), 'fresh\n');

  // An independent project inside alpha, hidden from alpha's index.
  await mkdir(beta, { recursive: true });
  git(beta, 'init', '-b', 'main');
  git(beta, 'config', 'user.name', 'Fixture');
  git(beta, 'config', 'user.email', 'fixture@example.com');
  await writeFile(join(beta, 'inner.txt'), 'inner\n');
  git(beta, 'add', '-A');
  git(beta, 'commit', '-m', 'beta root');

  // A dependency folder that must never be scanned.
  await mkdir(join(alpha, 'node_modules', 'pkg', '.git'), { recursive: true });

  // A nested project alpha does not ignore: git reports it as one untracked
  // directory, so its files must never leak into alpha's file list.
  const epsilon = join(alpha, 'epsilon');
  await mkdir(epsilon, { recursive: true });
  git(epsilon, 'init', '-b', 'main');
  git(epsilon, 'config', 'user.name', 'Fixture');
  git(epsilon, 'config', 'user.email', 'fixture@example.com');
  await writeFile(join(epsilon, 'loose.txt'), 'loose\n');

  // A project whose folder name matches a pruned build folder must survive:
  // the folder is not walked, but it is probed for a `.git` entry.
  const target = join(alpha, 'target');
  await mkdir(target, { recursive: true });
  git(target, 'init', '-b', 'main');
  git(target, 'config', 'user.name', 'Fixture');
  git(target, 'config', 'user.email', 'fixture@example.com');
  await writeFile(join(target, 'built.txt'), 'built\n');
  git(target, 'add', '-A');
  git(target, 'commit', '-m', 'target root');

  // A linked worktree (`.git` file) and a bare checkout (no `.git` at all).
  git(alpha, 'worktree', 'add', delta, '-b', 'linked');
  git(workspace, 'init', '--bare', bare);

  // A plain folder with no repository of its own.
  await mkdir(join(workspace, 'gamma'), { recursive: true });
  await writeFile(join(workspace, 'gamma', 'note.txt'), 'note\n');

  // A checkout whose git dir is missing: the shape of an uninitialised
  // submodule. It must not break the workspace status, and it must not be
  // re-probed on every poll.
  const broken = join(workspace, 'broken');
  await mkdir(broken, { recursive: true });
  await writeFile(join(broken, '.git'), 'gitdir: ../missing/.git\n');
  await writeFile(join(broken, 'orphan.txt'), 'orphan\n');

  // A repository that contains the second workspace root.
  await mkdir(sub, { recursive: true });
  git(outer, 'init', '-b', 'main');
  git(outer, 'config', 'user.name', 'Fixture');
  git(outer, 'config', 'user.email', 'fixture@example.com');
  await writeFile(join(sub, 'file.txt'), 'file\n');
  git(outer, 'add', '-A');
  git(outer, 'commit', '-m', 'outer root');

  return {
    workspace,
    alpha,
    beta,
    epsilon,
    target,
    broken,
    delta,
    bare,
    outer,
    sub,
    other: join(workspace, 'gamma'),
  };
}

async function main() {
  const base = await mkdtemp(join(tmpdir(), 'dsh-git-panel-'));
  const fixture = await buildFixture(base);
  const dshHome = join(base, 'dsh-home');
  process.env.DSH_HOME = dshHome;
  const handlers = { route: null, disposers: [], spawns: [] };
  const workspaces = [
    { id: 'ws', title: 'fixture', path: fixture.workspace },
    { id: 'ws2', title: 'enclosing', path: fixture.sub },
    { id: 'ws3', title: 'plain', path: fixture.other },
  ];

  apply(makeContext(workspaces, handlers));
  assert.ok(handlers.route, 'the plugin registers its HTTP route');

  const server = createServer((req, res) => handlers.route.handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const rpc = async (payload) => {
    const response = await fetch(`http://127.0.0.1:${port}${ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  };
  const ok = async (payload) => {
    const json = await rpc(payload);
    assert.equal(json.ok, true, `expected ok for ${JSON.stringify(payload.op)}: ${JSON.stringify(json.error)}`);
    return json.value;
  };
  const fail = async (payload, code) => {
    const json = await rpc(payload);
    assert.equal(json.ok, false, `expected failure for ${JSON.stringify(payload.op)}`);
    assert.equal(json.error.code, code);
    return json.error;
  };

  try {
    // 1. Workspace listing stays intact.
    const listed = await ok({ op: 'workspaces' });
    assert.deepEqual(listed.map((item) => item.path), [fixture.workspace, fixture.sub, fixture.other]);

    // 2. Discovery finds every independent project, including the one ignored
    //    by its parent repository, and prunes dependency folders.
    const status = await ok({ op: 'status', workspace: fixture.workspace });
    assert.equal(status.isRepo, true);
    const relativePaths = status.repos.map((repo) => repo.relativePath);
    assert.deepEqual(relativePaths, ['alpha', 'alpha/beta', 'alpha/epsilon', 'alpha/target', 'bare.git', 'broken', 'delta'], 'nested repos are discovered');
    assert.equal(status.repoRoot, fixture.alpha, 'the shallowest repository is primary');
    assert.equal(status.branch, 'main');
    assert.equal(status.counts.changed, 2, 'primary repo reports its own changed files');
    assert.equal(status.repos.find((repo) => repo.relativePath === 'alpha/beta').counts.changed, 0);
    assert.equal(status.repos.find((repo) => repo.relativePath === 'alpha/epsilon').counts.changed, 1);
    assert.deepEqual(
      status.entries.map((entry) => entry.path),
      ['changed.txt', 'fresh.txt'],
      'a nested project never leaks its files into the parent repository',
    );

    // 3. Selecting the nested repository scopes every read to it.
    const nested = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(nested.repoRoot, fixture.beta);
    assert.equal(nested.branch, 'main');
    assert.deepEqual(nested.entries, []);
    const nestedByRelativePath = await ok({ op: 'status', workspace: fixture.workspace, repo: 'alpha/beta' });
    assert.equal(nestedByRelativePath.repoRoot, fixture.beta);
    await fail({ op: 'status', workspace: fixture.workspace, repo: 'nope' }, 'REPO_NOT_FOUND');
    await fail({ op: 'status', workspace: fixture.workspace, repo: join(base, 'outside') }, 'REPO_NOT_FOUND');

    // 3b. A repository whose git dir is missing is reported, not thrown: one
    //     broken checkout must not take the whole workspace down.
    const brokenSummary = status.repos.find((repo) => repo.relativePath === 'broken');
    assert.equal(brokenSummary.error, 'STATUS_FAILED');
    const brokenSpawns = handlers.spawns.filter((entry) => entry.cwd === fixture.broken).length;
    assert.ok(brokenSpawns >= 2, `broken repository should have been probed, saw ${brokenSpawns} spawns`);

    // 4. The aggregate read backs the file tree and the sidebar: entries from
    //    every repository, each tagged with the repository that owns it.
    const lite = await ok({ op: 'status-lite', workspace: fixture.workspace });
    assert.equal(lite.isRepo, true);
    assert.equal(lite.counts.changed, 3, 'changed files are summed across repositories');
    const alphaEntries = lite.entries.filter((entry) => entry.repo === fixture.alpha);
    assert.deepEqual(alphaEntries.map((entry) => entry.path).sort(), ['changed.txt', 'fresh.txt']);
    const epsilonEntries = lite.entries.filter((entry) => entry.repo === fixture.epsilon);
    assert.deepEqual(epsilonEntries.map((entry) => entry.kind), ['untracked']);
    assert.equal(epsilonEntries[0].path, 'loose.txt');
    assert.equal(
      handlers.spawns.filter((entry) => entry.cwd === fixture.broken).length,
      brokenSpawns,
      'a broken repository is not re-probed while its failure is cached',
    );

    // 5. A bare checkout is reported without work-tree status.
    const bare = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.bare });
    assert.equal(bare.isBare, true);
    assert.deepEqual(bare.entries, []);

    // 6. Linked worktrees resolve through their `.git` file.
    const worktree = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.delta });
    assert.equal(worktree.repoRoot, fixture.delta);
    assert.equal(worktree.branch, 'linked');

    // 7. Ambiguous writes are refused instead of guessing a repository.
    await fail({ op: 'stage', workspace: fixture.workspace, paths: ['fresh.txt'] }, 'REPO_REQUIRED');
    await fail({ op: 'commit', workspace: fixture.workspace, message: 'nope' }, 'REPO_REQUIRED');
    await fail({ op: 'graph', workspace: fixture.workspace }, 'REPO_REQUIRED');

    // 8. Scoped reads work for the nested repository.
    const betaGraph = await ok({ op: 'graph', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(betaGraph.commits.length, 1);
    assert.equal(betaGraph.commits[0].subject, 'beta root');
    const detail = await ok({
      op: 'commit-detail', workspace: fixture.workspace, repo: fixture.beta, sha: betaGraph.commits[0].sha,
    });
    assert.match(detail.patch, /inner\.txt/);

    // 8b. A remote URL becomes a browsable commit link.
    git(fixture.beta, 'remote', 'add', 'origin', 'https://github.com/acme/beta.git');
    const detailed = await ok({
      op: 'commit-detail', workspace: fixture.workspace, repo: fixture.beta, sha: betaGraph.commits[0].sha,
    });
    assert.deepEqual(detailed.webUrl, {
      url: `https://github.com/acme/beta/commit/${betaGraph.commits[0].sha}`,
      host: 'github.com',
    });
    git(fixture.beta, 'remote', 'remove', 'origin');
    const withoutRemote = await ok({
      op: 'commit-detail', workspace: fixture.workspace, repo: fixture.beta, sha: betaGraph.commits[0].sha,
    });
    assert.equal(withoutRemote.webUrl, null);

    // 9. Staging, diffing, unstaging, and committing stay inside the selected
    //    repository and never touch its parent.
    await writeFile(join(fixture.beta, 'second.txt'), 'second\n');
    // Status reads are cached for a short window for the poll; wait it out so
    // this observes the file the way a later poll would.
    await wait(1600);
    const betaStatus = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(betaStatus.counts.changed, 1);
    await ok({ op: 'stage', workspace: fixture.workspace, repo: fixture.beta, paths: ['second.txt'] });
    const staged = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(staged.counts.staged, 1);
    const diff = await ok({ op: 'diff', workspace: fixture.workspace, repo: fixture.beta, path: 'second.txt', staged: true });
    assert.match(diff.text, /second\.txt/);
    await ok({ op: 'unstage', workspace: fixture.workspace, repo: fixture.beta, paths: ['second.txt'] });
    await ok({ op: 'stage', workspace: fixture.workspace, repo: fixture.beta, paths: ['second.txt'] });
    const committed = await ok({
      op: 'commit', workspace: fixture.workspace, repo: fixture.beta, message: 'beta second',
    });
    assert.match(committed.sha, /^[0-9a-f]{7,}$/);
    const afterCommit = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(afterCommit.counts.changed, 0);
    const alphaAfter = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.alpha });
    assert.equal(alphaAfter.counts.changed, 2, 'committing in beta leaves alpha untouched');

    // 10. Branches: local and remote lists, switching, and tracking checkout.
    const initialBranches = await ok({ op: 'branches', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(initialBranches.current, 'main');
    assert.deepEqual(initialBranches.local.map((item) => item.name), ['main']);
    assert.deepEqual(initialBranches.remote, []);
    git(fixture.target, 'branch', 'feature');
    const listedBranches = await ok({ op: 'branches', workspace: fixture.workspace, repo: fixture.target });
    assert.deepEqual(listedBranches.local.map((item) => item.name), ['main', 'feature']);
    assert.equal(listedBranches.local[0].current, true);
    const switched = await ok({
      op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'feature',
    });
    assert.equal(switched.branch, 'feature');
    assert.equal(switched.created, false);
    const onFeature = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(onFeature.branch, 'feature');
    await fail({
      op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'missing-branch',
    }, 'BRANCH_NOT_FOUND');
    // A dirty file that the target branch would overwrite must be refused, not
    // silently discarded.
    await writeFile(join(fixture.target, 'built.txt'), 'feature side\n');
    git(fixture.target, 'commit', '-am', 'feature side');
    await ok({ op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'main' });
    await writeFile(join(fixture.target, 'built.txt'), 'dirty working tree\n');
    await fail({
      op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'feature',
    }, 'CHECKOUT_DIRTY');
    git(fixture.target, 'checkout', '--', 'built.txt');

    // 10b. Remote branches are listed with their remote prefix, and checking
    //      one out without a local counterpart creates a tracking branch.
    git(fixture.target, 'remote', 'add', 'origin', fixture.bare);
    git(fixture.target, 'push', '-q', '-u', 'origin', 'main');
    git(fixture.target, 'push', '-q', 'origin', 'feature');
    const withRemote = await ok({ op: 'branches', workspace: fixture.workspace, repo: fixture.target });
    const remoteNames = withRemote.remote.map((item) => item.name).sort();
    assert.deepEqual(remoteNames, ['origin/feature', 'origin/main']);
    const remoteFeature = withRemote.remote.find((item) => item.name === 'origin/feature');
    assert.equal(remoteFeature.remote, 'origin');
    assert.equal(remoteFeature.branch, 'feature');
    assert.equal(withRemote.upstream, 'origin/main');
    git(fixture.target, 'branch', '-D', 'feature');
    const tracked = await ok({
      op: 'checkout',
      workspace: fixture.workspace,
      repo: fixture.target,
      branch: 'feature',
      remoteBranch: 'origin/feature',
    });
    assert.equal(tracked.branch, 'feature');
    assert.equal(tracked.created, true);
    const onTracked = await ok({ op: 'status', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(onTracked.branch, 'feature');
    assert.equal(onTracked.upstream, 'origin/feature');
    await ok({ op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'main' });
    const missingRemote = await fail({
      op: 'checkout',
      workspace: fixture.workspace,
      repo: fixture.target,
      branch: 'nope',
      remoteBranch: 'origin/nope',
    }, 'BRANCH_NOT_FOUND');
    assert.equal(missingRemote.code, 'BRANCH_NOT_FOUND');

    // 10c. The branch menu creates a branch from HEAD and refuses duplicates
    //      or names Git itself rejects.
    const createdBranch = await ok({
      op: 'create-branch', workspace: fixture.workspace, repo: fixture.beta, name: 'feature/panel-flow',
    });
    assert.equal(createdBranch.branch, 'feature/panel-flow');
    assert.equal(createdBranch.created, true);
    const betaBranches = await ok({ op: 'branches', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(betaBranches.current, 'feature/panel-flow');
    await fail({
      op: 'create-branch', workspace: fixture.workspace, repo: fixture.beta, name: 'feature/panel-flow',
    }, 'BRANCH_ALREADY_EXISTS');
    await fail({
      op: 'create-branch', workspace: fixture.workspace, repo: fixture.beta, name: '..',
    }, 'INVALID_REF');

    // 10d. Managed worktrees: create, list, dirty guard, force removal, branch
    //      retention/deletion, and the primary/unmanaged refusals.
    const initialWorktrees = await ok({ op: 'worktrees', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(initialWorktrees.worktrees.length, 1);
    assert.equal(initialWorktrees.worktrees[0].main, true);
    assert.equal(initialWorktrees.worktrees[0].branch, 'feature/panel-flow');

    const added = await ok({
      op: 'worktree-add',
      workspace: fixture.workspace,
      repo: fixture.beta,
      name: 'Fix Login Race',
      baseRef: 'main',
    });
    assert.equal(added.name, 'fix-login-race');
    assert.equal(added.branch, 'wt/fix-login-race');
    assert.ok(added.path.startsWith(join(dshHome, 'worktrees')), added.path);
    assert.match(added.path, /[\\/]worktrees[\\/][^\\/]+[\\/]fix-login-race$/);

    const withWorktree = await ok({ op: 'worktrees', workspace: fixture.workspace, repo: fixture.beta });
    assert.equal(withWorktree.worktrees.length, 2);
    const managedRow = withWorktree.worktrees.find((row) => row.path === added.path);
    assert.ok(managedRow);
    assert.equal(managedRow.main, false);
    assert.equal(managedRow.managed, true);
    assert.equal(managedRow.branch, 'wt/fix-login-race');

    await fail({
      op: 'worktree-add',
      workspace: fixture.workspace,
      repo: fixture.beta,
      name: 'fix-login-race',
      baseRef: 'main',
    }, 'WORKTREE_PATH_EXISTS');
    await fail({
      op: 'worktree-add',
      workspace: fixture.workspace,
      repo: fixture.beta,
      name: '..',
      baseRef: 'main',
    }, 'WORKTREE_NAME_INVALID');
    await fail({
      op: 'worktree-add',
      workspace: fixture.workspace,
      repo: fixture.beta,
      name: 'missing-base',
      baseRef: 'no-such-branch',
    }, 'WORKTREE_BASE_NOT_FOUND');

    await writeFile(join(added.path, 'dirty.txt'), 'dirty\n');
    await fail({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: added.path,
    }, 'WORKTREE_DIRTY');

    // A force removal deletes the dirty checkout, so it must carry the caller's
    // explicit confirmation; without it the host refuses before touching disk.
    await fail({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: added.path,
      force: true,
    }, 'CONFIRM_REQUIRED');

    const removed = await ok({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: added.path,
      force: true,
      confirm: true,
    });
    assert.equal(removed.removed, true);
    assert.equal(removed.branchDeleted, false);
    assert.ok(git(fixture.beta, 'branch', '--list', 'wt/fix-login-race').trim());

    const second = await ok({
      op: 'worktree-add',
      workspace: fixture.workspace,
      repo: fixture.beta,
      name: 'clean-up',
      baseRef: 'main',
    });
    // Deleting the branch during removal loses its commits: same explicit gate.
    await fail({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: second.path,
      deleteBranch: true,
    }, 'CONFIRM_REQUIRED');
    const removedWithBranch = await ok({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: second.path,
      deleteBranch: true,
      confirm: true,
    });
    assert.equal(removedWithBranch.branchDeleted, true);
    assert.equal(git(fixture.beta, 'branch', '--list', 'wt/clean-up').trim(), '');

    await fail({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.beta,
      path: fixture.beta,
    }, 'WORKTREE_IS_MAIN');

    // A linked worktree outside the managed home is listed by Git but must
    // never be removable through this route.
    const alphaWorktrees = await ok({ op: 'worktrees', workspace: fixture.workspace, repo: fixture.alpha });
    const linkedRow = alphaWorktrees.worktrees.find((row) => row.path === fixture.delta);
    assert.ok(linkedRow, JSON.stringify(alphaWorktrees.worktrees));
    assert.equal(linkedRow.managed, false);
    await fail({
      op: 'worktree-remove',
      workspace: fixture.workspace,
      repo: fixture.alpha,
      path: fixture.delta,
    }, 'WORKTREE_NOT_MANAGED');

    // 10e. The workbench history follows the checked-out branch; switching
    //      branches changes the visible commit set.
    const mainHistory = await ok({ op: 'graph', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(mainHistory.commits.length, 1);
    assert.equal(mainHistory.commits[0].subject, 'target root');
    assert.equal(mainHistory.hasMore, false);

    await ok({ op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'feature' });
    const featureHistory = await ok({ op: 'graph', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(featureHistory.commits[0].subject, 'feature side');
    assert.ok(featureHistory.commits.some((commit) => commit.subject === 'target root'));
    await ok({ op: 'checkout', workspace: fixture.workspace, repo: fixture.target, branch: 'main' });

    // 10f. The explicit all-refs graph still pages across every branch and
    //      carries typed refs and per-file commit details.
    const pageOne = await ok({
      op: 'graph', workspace: fixture.workspace, repo: fixture.target, limit: 1, all: true,
    });
    assert.equal(pageOne.commits.length, 1);
    assert.equal(pageOne.hasMore, true);
    const pageTwo = await ok({
      op: 'graph', workspace: fixture.workspace, repo: fixture.target, limit: 1, skip: 1, all: true,
    });
    assert.equal(pageTwo.commits.length, 1);
    assert.equal(pageTwo.hasMore, false);
    assert.notEqual(pageOne.commits[0].sha, pageTwo.commits[0].sha);
    const headRefs = pageTwo.commits[0].refs;
    assert.ok(headRefs.some((ref) => ref.kind === 'head' && ref.name === 'main'), JSON.stringify(headRefs));
    assert.ok(headRefs.some((ref) => ref.kind === 'remote' && ref.name === 'origin/main'));
    assert.ok(pageOne.commits[0].refs.some((ref) => ref.kind === 'local' && ref.name === 'feature'));

    const commitDetail = await ok({
      op: 'commit-detail', workspace: fixture.workspace, repo: fixture.target, sha: pageTwo.commits[0].sha,
    });
    assert.equal(commitDetail.sha, pageTwo.commits[0].sha);
    assert.ok(commitDetail.files.length >= 1);
    assert.equal(commitDetail.stats.files, commitDetail.files.length);
    assert.ok(commitDetail.stats.additions + commitDetail.stats.deletions >= 1);
    const builtFile = commitDetail.files.find((file) => file.path === 'built.txt');
    assert.ok(builtFile, JSON.stringify(commitDetail.files));
    assert.equal(builtFile.status, 'A');
    const filePatch = await ok({
      op: 'commit-detail',
      workspace: fixture.workspace,
      repo: fixture.target,
      sha: pageTwo.commits[0].sha,
      path: builtFile.path,
    });
    assert.equal(filePatch.path, 'built.txt');
    assert.match(filePatch.patch, /built\.txt/);
    assert.equal(filePatch.patch.trim(), commitDetail.patch.trim());

    // 10g. Fetch/pull/push return the rough numbers the toast summarizes:
    //      changed refs and drift, pulled commits/files, pushed commit count.
    const remoteWork = join(base, 'remote-work');
    execFileSync(GIT, ['clone', '-q', '-b', 'main', fixture.bare, remoteWork], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    git(remoteWork, 'config', 'user.name', 'Fixture');
    git(remoteWork, 'config', 'user.email', 'fixture@example.com');
    await writeFile(join(remoteWork, 'remote.txt'), 'remote\n');
    git(remoteWork, 'add', '-A');
    git(remoteWork, 'commit', '-m', 'remote update');
    git(remoteWork, 'push', '-q', 'origin', 'main');

    const fetched = await ok({ op: 'fetch', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(fetched.remotes, 1);
    assert.equal(fetched.updatedRefs, 1);
    assert.equal(fetched.updatedBranches, 1);
    assert.equal(fetched.updatedTags, 0);
    assert.equal(fetched.behind, 1);
    assert.equal(fetched.ahead, 0);
    assert.ok(fetched.updates.some((update) => update.ref === 'refs/remotes/origin/main'));

    const pulled = await ok({ op: 'pull', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(pulled.updated, true);
    assert.equal(pulled.commits, 1);
    assert.equal(pulled.files, 1);
    assert.ok(pulled.additions >= 1);

    const noPush = await ok({ op: 'push', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(noPush.updated, false);
    assert.equal(noPush.newBranch, false);

    await writeFile(join(fixture.target, 'local.txt'), 'local\n');
    git(fixture.target, 'add', '-A');
    git(fixture.target, 'commit', '-m', 'local update');
    await wait(1600);
    const pushed = await ok({ op: 'push', workspace: fixture.workspace, repo: fixture.target });
    assert.equal(pushed.updated, true);
    assert.equal(pushed.newBranch, false);
    assert.equal(pushed.pushedCommits, 1);

    // 11. A workspace inside a repository reports the enclosing repository
    //     (Zed keeps this as an external work directory) with the root as cwd.
    const enclosing = await ok({ op: 'status', workspace: fixture.sub });
    assert.equal(enclosing.isRepo, true);
    assert.equal(enclosing.repos.length, 1);
    assert.equal(enclosing.repoRoot, fixture.outer);
    assert.equal(enclosing.relativePath, '');

    // 12. A folder without any repository reports no repository at all.
    const plain = await ok({ op: 'status', workspace: fixture.other });
    assert.equal(plain.isRepo, false);
    assert.deepEqual(plain.repos, []);

    console.log('host route checks passed');
  } finally {
    for (const dispose of handlers.disposers) {
      try {
        dispose();
      } catch {
        // Disposal is best effort in the harness.
      }
    }
    await new Promise((resolve) => server.close(resolve));
    await rm(base, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});










