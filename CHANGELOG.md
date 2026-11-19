# Changelog

Notable changes to `@aishangwuji/dsh-git`. Entries name the behaviour they change,
not the files they touch; anything older than 0.1.3 is in the git log.

## 0.2.1

### Fixed

- **The panel no longer loses its stylesheet.** The rules used to travel as a
  60 KB template literal inside the client bundle. On the way to the page that
  literal arrived empty — measured from inside the panel itself as
  `style=3 adopted=1 sheet=0`, while the file on disk still carried 386 CSS
  rules. The stylesheet is now a real file served by the plugin route
  (`GET /dsh-git-6b1e/styles.css`), which the client fetches and adopts as a
  constructable stylesheet, with a `<link rel="stylesheet">` to the same URL as
  the fallback.
- **The panel checks that its stylesheet actually reached it**, using a sentinel
  custom property only that sheet defines. When it did not, the panel renders a
  diagnostic row with inline styles (the only styling that survives a refused
  stylesheet) and prints `status/css/rules/adopted/err`. `err=HTTP 405` means the
  running Host predates the route: DSH needs a restart, because a page reload
  re-reads `client.js` only.

### Changed

- **Host logic is split by domain.** `index.js` went from 2131 lines to 179, with
  `host/{core,git,state,discovery,status,history,write,worktrees,route,runtime}.js`
  behind it. `ctx` and the logger are the only things crossing module boundaries,
  through one binding; every function kept its name and signature.
- **The client artifact keeps its single file but is built from 19 fragments** in
  `client/` (`npm run build:client`). `client.js` is committed, so installing
  stays build-free, and `npm run check:client` fails when the artifact no longer
  matches its sources.

### Added

- Invariants that keep both splits honest: host modules import only Node builtins
  or relative paths, no host module may exceed 600 lines, `index.js` stays under
  400, no client fragment may exceed 1200, and the committed client artifact must
  match its sources in CI.

## 0.2.0

### Added

- Branch tree in the branch switcher: HEAD/local/remote/tag groups, ahead/behind
  per branch, and worktrees marked as checked out.
- History filters — author, time preset, path, sort order — executed by Git, with
  pagination running over the same filter.
- Composer pill showing the counters that are non-zero (±changed, ↑ahead, ↓behind).

### Changed

- Write operations are serialized per repository on the Host, and destructive
  operations require an explicit `confirm: true`.
- CI runs an invariant suite plus two render checks (cold panel and seeded panel).

## 0.1.3

### Changed

- The panel paints from a cache immediately (seed + prewarm) instead of showing an
  empty surface until Git answers.

### Fixed

- Cold starts render a skeleton instead of a blank panel.
