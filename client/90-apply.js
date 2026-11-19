    function apply(ctx) {
      ctx.effect(() => {
        // The sheet is fetched from this plugin's route; the panel's own
        // self-check reports if it never arrives.
        void ensureStyles();
        return () => {
          if (styleState.sheet) {
            try {
              document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || [])
                .filter((sheet) => sheet !== styleState.sheet);
            } catch {
              // The document may already be tearing down.
            }
          }
          if (styleState.link && styleState.link.parentNode) styleState.link.remove();
        };
      }, 'dsh-git: styles');
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-git: dictionaries');
      t = ctx.locale.bind(NS);

      ctx.effect(() => installTooltip(), 'dsh-git: tooltip layer');

      ctx.effect(() => installWorkspaceTreeDecorations(), 'dsh-git: workspace tree status');

      // The branch menu can create an isolated checkout and open its blank
      // session. Those verbs live on the Client workspaces / uiWorkspace
      // services (Host owns the registry and session log); keeping them in a
      // bridge means the rest of the panel still mounts in shells that omit
      // them, and the worktree dialog can explain that instead of dying.
      ctx.inject(['workspaces', 'uiWorkspace'], (scope) => {
        const bridge = {
          list() {
            try {
              return scope.workspaces.list.getSnapshot().items;
            } catch {
              return [];
            }
          },
          async start(path) {
            const workspace = await scope.workspaces.create({ path });
            try {
              await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
            } catch (error) {
              try {
                await scope.workspaces.delete(workspace.workspaceId);
              } catch {
                // Leave the registration for the user to clean up rather than
                // masking the original session-open failure.
              }
              throw error;
            }
            return workspace;
          },
          async delete(workspaceId) {
            await scope.workspaces.delete(workspaceId);
          },
        };
        worktreeBridge = bridge;
        return () => {
          if (worktreeBridge === bridge) worktreeBridge = null;
        };
      });

      // The composer chip normally receives `useSessions` through its slot
      // props. Keep a direct lookup as a fallback for shells that expose the
      // session list only through the service.
      ctx.inject(['sessions'], (scope) => {
        const bridge = {
          summary(sessionId) {
            try {
              return scope.sessions.list.getSnapshot().byId[sessionId];
            } catch {
              return undefined;
            }
          },
        };
        sessionBridge = bridge;
        return () => {
          if (sessionBridge === bridge) sessionBridge = null;
        };
      });

      // Warm the first-paint cache in the background, once the shell has
      // settled, so the panel's first open in this workspace is not a cold read.
      // Read routes only; a failure just means that panel opens cold.
      ctx.effect(() => {
        schedulePrewarm();
        return () => {
          if (prewarmTimer !== null) {
            clearTimeout(prewarmTimer);
            prewarmTimer = null;
          }
          // Drop a prewarm still in flight so it cannot write a seed after the
          // plugin was reloaded.
          prewarmGeneration += 1;
        };
      }, 'dsh-git: first-paint prewarm');

      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'git-branch',
        order: 30,
        locale: NS,
      }, ComposerBranchChip));

      ctx.effect(() => {
        const onKeyDown = (event) => {
          if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
          if (event.key.toLowerCase() !== 'g') return;
          const target = event.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
          event.preventDefault();
          event.stopPropagation();
          try {
            ctx.layout.selectPanel('git');
          } catch (error) {
            console.error('[dsh-git] could not open panel', error);
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, 'dsh-git: open shortcut');

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'git',
        locale: NS,
      }, GitPanelRoot));

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'git',
        order: 5,
        locale: NS,
        label: () => t('panel'),
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitPanelIcon));

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'git-status',
        order: -10,
        locale: NS,
        label: () => t('git'),
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitSidebarStatus));

      ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
        name: 'sidebar.right.tab.document.actions',
        id: 'git-status',
        order: 20,
        locale: NS,
        inject: () => ({ openPanel: () => ctx.layout.selectPanel('git') }),
      }, GitDocumentStatus));
    }

    const shipped = { inject: ['slots', 'locale', 'layout'], apply };
    /**
     * Read-only seam for `test/client.test.mjs`: the first-paint cache and the
     * prewarm planner live in this module's closure and are pure except for
     * `fetch`/storage, so the harness can exercise them without React. It is
     * only attached when the harness opts in, so the module the loader receives
     * is exactly the plugin definition it expects.
     */
    if (window.__DSH_GIT_TEST__ === true) {
      shipped.__paint = {
        readBootSeed,
        readPaintStatus,
        writePaintStatus,
        readPaintGraph,
        writePaintGraph,
        readPaintWorkspaces,
        writePaintWorkspaces,
        pickBootstrapRepo,
        branchFolders,
        pillCounters,
        schedulePrewarm,
        resetPrewarm() {
          if (prewarmTimer !== null) {
            clearTimeout(prewarmTimer);
            prewarmTimer = null;
          }
          prewarmGeneration += 1;
        },
      };
    }
