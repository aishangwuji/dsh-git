    function cx(...values) {
      return values.filter(Boolean).join(' ');
    }

    function basename(path) {
      const index = path.lastIndexOf('/');
      return index === -1 ? path : path.slice(index + 1);
    }

    /** Display label for a repository: workspace-relative path, else folder name. */
    function repoLabel(repo) {
      if (!repo) return '';
      if (repo.relativePath) return repo.relativePath;
      const root = String(repo.root || '');
      const parts = root.split(/[\\/]/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : root;
    }

    /** A repository at the top of the workspace (a project, not a dependency). */
    function repoIsProject(repo) {
      const relativePath = repo && repo.relativePath ? repo.relativePath : '';
      return relativePath === '' || relativePath.indexOf('/') === -1;
    }

    function repoChanged(repo) {
      return Boolean(repo && repo.counts && repo.counts.changed > 0);
    }

    /** Closest repository whose root contains this one (root repo included). */
    function nearestAncestorRepo(repos, repo) {
      if (!repo || !repo.relativePath) return null;
      const own = repo.relativePath;
      let best = null;
      for (const candidate of repos) {
        if (!candidate || samePath(candidate.root, repo.root)) continue;
        const prefix = candidate.relativePath || '';
        if (prefix && !own.startsWith(`${prefix}/`)) continue;
        if (!best || (best.relativePath || '').length < prefix.length) best = candidate;
      }
      return best;
    }

    /**
     * Short label for the switcher: top-level projects use their folder name;
     * nested repositories drop their nearest ancestor's prefix and are marked
     * as nested, so a submodule list stays readable.
     */
    function repoSelectLabel(repos, repo) {
      if (!repo) return '';
      if (!repo.relativePath) return repoLabel(repo);
      const ancestor = nearestAncestorRepo(repos, repo);
      if (!ancestor || !ancestor.relativePath) return repoLabel(repo);
      return `↳ ${repo.relativePath.slice(ancestor.relativePath.length + 1)}`;
    }

    function repoOptionLabel(repos, repo) {
      const label = repoSelectLabel(repos, repo);
      if (repo && repo.error) return `${label} ${t('repoUnavailable')}`;
      const changed = repo && repo.counts ? repo.counts.changed || 0 : 0;
      return changed > 0 ? `${label} · ${changed}` : label;
    }

    function repoOptionCount(groups) {
      return groups.reduce((total, group) => total + group.items.length, 0);
    }

    /**
     * Group repositories for the switcher. Pending changes always surface,
     * top-level projects come next, and clean dependency repositories stay
     * behind the "all repositories" toggle; unusable ones (for example an
     * uninitialised submodule) are listed last and cannot be selected.
     */
    function repoGroups(repos, selectedRoot, showAll) {
      const isSelected = (repo) => samePath(repo.root, selectedRoot);
      const available = repos.filter((repo) => !repo.error);
      const broken = repos.filter((repo) => repo.error);
      const visible = showAll
        ? available
        : available.filter((repo) => repoIsProject(repo) || repoChanged(repo) || isSelected(repo));
      const byPath = (a, b) => repoLabel(a).localeCompare(repoLabel(b));
      const changed = visible.filter(repoChanged).sort((a, b) => {
        const left = a.counts ? a.counts.changed : 0;
        const right = b.counts ? b.counts.changed : 0;
        return right - left || byPath(a, b);
      });
      const clean = visible.filter((repo) => !repoChanged(repo)).sort(byPath);
      const groups = [];
      if (changed.length > 0) groups.push({ key: 'changed', label: t('repoGroupChanged'), items: changed });
      const projects = clean.filter(repoIsProject);
      if (projects.length > 0) groups.push({ key: 'projects', label: t('repoGroupProjects'), items: projects });
      const nested = clean.filter((repo) => !repoIsProject(repo));
      if (nested.length > 0) groups.push({ key: 'nested', label: t('repoGroupNested'), items: nested });
      const visibleBroken = (showAll || available.length === 0 ? broken : broken.filter(repoIsProject)).sort(byPath);
      if (visibleBroken.length > 0) {
        groups.push({ key: 'unavailable', label: t('repoGroupUnavailable'), items: visibleBroken });
      }
      return groups;
    }

    function samePath(left, right) {
      const normalize = (value) => String(value == null ? '' : value).replace(/\\/g, '/').replace(/\/+$/, '');
      return normalize(left) === normalize(right);
    }

    /** Pure mirror of `git check-ref-format --branch`; the host stays the authority. */
    function validateBranchName(name) {
      if (name === '') return 'empty';
      if (name === '@') return 'at-sign';
      if (name.startsWith('-')) return 'leading-dash';
      if (name.endsWith('.')) return 'trailing-dot';
      if (name.endsWith('.lock')) return 'lock-suffix';
      if (name.includes('..')) return 'double-dot';
      if (name.includes('@{')) return 'at-brace';
      if (name.includes('//')) return 'double-slash';
      if (/\s/.test(name)) return 'space';
      if (/[~^:?*[\\]/.test(name)) return 'forbidden-char';
      if (/[\u0000-\u001f\u007f]/.test(name)) return 'control-char';
      for (const component of name.split('/')) {
        if (component === '') return 'empty-component';
        if (component.startsWith('.')) return 'dot-component';
        if (component.endsWith('.lock')) return 'lock-suffix';
      }
      return null;
    }

    /** Same normalization as the host: lowercase, safe path/branch component. */
    function sanitizeWorktreeName(value) {
      const cleaned = String(value == null ? '' : value).trim().toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-.]+/, '')
        .replace(/[-.]+$/, '')
        .slice(0, 64);
      if (cleaned === '' || cleaned === '.' || cleaned === '..') return null;
      if (cleaned.includes('..') || cleaned.endsWith('.lock')) return null;
      return cleaned;
    }

    /** Lane topology for the graph dialog, matching the host's topo order. */
    function computeLanes(rows) {
      const later = new Set();
      for (const row of rows) {
        for (const parent of row.parents || []) later.add(parent);
      }
      const lanes = [];
      const result = [];
      for (const row of rows) {
        let nodeColumn = lanes.findIndex((pending) => pending === row.sha);
        if (nodeColumn === -1) {
          lanes.push(row.sha);
          nodeColumn = lanes.length - 1;
        }
        const columns = [];
        for (let index = 0; index < lanes.length; index += 1) {
          const pending = lanes[index];
          if (pending === null) columns.push('gap');
          else if (index === nodeColumn) columns.push((row.parents || []).length > 1 ? 'merge' : 'node');
          else if (pending === row.sha) columns.push('gap');
          else if (typeof pending === 'string' && later.has(pending)) columns.push('pass');
          else columns.push('gap');
        }
        const parents = (row.parents || []).filter((parent) => later.has(parent));
        const [first, ...rest] = parents;
        for (let index = 0; index < lanes.length; index += 1) {
          if (lanes[index] === row.sha && index !== nodeColumn) lanes[index] = null;
        }
        lanes[nodeColumn] = first === undefined ? null : first;
        for (const parent of rest) {
          if (!lanes.includes(parent)) lanes.push(parent);
        }
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
        result.push({ columns, nodeColumn, merge: (row.parents || []).length > 1 });
      }
      return result;
    }

    function laneChar(glyph) {
      if (glyph === 'node') return '●';
      if (glyph === 'merge') return '◆';
      if (glyph === 'pass') return '│';
      return ' ';
    }

    /** Absolute filesystem path of a repository-relative entry. */
    function joinAbsolute(root, relativePath) {
      const base = String(root || '').replace(/[\\/]+$/, '');
      const separator = base.includes('\\') ? '\\' : '/';
      const tail = String(relativePath || '').split('/').filter(Boolean).join(separator);
      return tail ? `${base}${separator}${tail}` : base;
    }

    function fileUriOf(absolutePath) {
      const forward = String(absolutePath || '').replace(/\\/g, '/');
      if (/^[A-Za-z]:/.test(forward)) return `file:///${forward}`;
      return forward.startsWith('/') ? `file://${forward}` : `file:///${forward}`;
    }

    /**
     * Drag payload for the conversation composer. Zed inserts the dropped
     * file's path; here the plain-text payload is the absolute path, which a
     * contenteditable composer inserts as-is on drop.
     */
    function beginFileDrag(event, absolutePath) {
      if (!event || !event.dataTransfer || !absolutePath) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', absolutePath);
      try {
        event.dataTransfer.setData('text/uri-list', fileUriOf(absolutePath));
      } catch {
        // Some browsers reject custom types; plain text is enough.
      }
    }

    /* ------------------------------ history filters ------------------------------ */
    /** The history pane's server-side filter state. Empty means "no filter". */
    function defaultFilters() {
      return { author: '', path: '', since: '', until: '', order: 'newest' };
    }

    function isDefaultFilters(filters) {
      if (!filters) return true;
      return !filters.author && !filters.path && !filters.since && !filters.until
        && filters.order !== 'oldest';
    }

    /** `graph` request fragment: an absent filter is simply not sent. */
    function graphRequest(filters) {
      const payload = {};
      if (!filters) return payload;
      if (filters.author) payload.author = filters.author;
      if (filters.path) payload.path = filters.path;
      if (filters.since) payload.since = filters.since;
      if (filters.until) payload.until = filters.until;
      if (filters.order === 'oldest') payload.order = 'oldest';
      return payload;
    }

    /** Local-midnight (or Jan 1) boundary for a date preset; '' means "all time". */
    function sinceForPreset(key) {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (key === 'today') return midnight.toISOString();
      if (key === '7d') return new Date(midnight.getTime() - 6 * 86400000).toISOString();
      if (key === '30d') return new Date(midnight.getTime() - 29 * 86400000).toISOString();
      if (key === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
      return '';
    }

    /**
     * The composer pill's counters. Only non-zero values are emitted — a pill
     * that always shows `±0 ↑0 ↓0` is noise, and the point of the counters is
     * to say "something moved" at a glance.
     */
