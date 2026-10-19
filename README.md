# DSH Git Workbench

A local Harness plugin that adds a **Git** panel to the Web UI.

## What it does

- Lists every changed file in the selected workspace as a colored tree:
  - modified = amber
  - deleted = red, with a strikethrough ghost row
  - added / untracked = green
  - conflict = red `!`
- Stages and unstages individual files, whole directories, all changes, or the staged set.
- Commits staged changes, or auto-stages tracked changes when nothing is staged
  (`Commit tracked changes`); supports amend and sign-off.
- Fetches, pulls, and pushes through the same Git binary the terminal uses.
- Shows a commit graph (topo order, lanes, refs) with commit details and patch.
- Keyboard shortcuts while the panel is focused:
  - `Ctrl/Cmd+Enter` commit
  - `Alt+S` stage all, `Alt+Shift+S` unstage all
  - `Alt+G` then `F` fetch, `P` push, `L` pull, `H` history
  - `Ctrl/Cmd+Shift+G` opens the Git panel from anywhere (unless typing)

## Design notes

- The browser never runs Git. A same-origin host route (`/dsh-git-6b1e`) accepts
  JSON requests, validates the workspace against the Harness workspace registry,
  and spawns Git with an argv array only (no shell).
- Commands run through the Harness `subprocess` service with bounded output,
  a hard timeout, and a scrubbed environment.
- Operations are serialized per panel; the UI keeps commit drafts per workspace
  and polls status every five seconds while visible.
- The panel is registered as a `main` slot keyed `git` and a
  `sidebar.panellist` icon with the same id, so it is reachable from the sidebar.
- This first version intentionally does **not** implement hunk-level staging,
  stash, worktrees, submodules, LFS, or credential prompts. Use the terminal for
  interactive authentication (or configure ssh-agent / a credential helper).

## Files

- `index.js` — host route and all Git operations.
- `client.js` — React view registered into `main` and `sidebar.panellist`.
- `cordis.patch.yml` — inserts the host plugin row.
- `locale/*.json`, `icon.svg` — plugin manager metadata and artwork.
