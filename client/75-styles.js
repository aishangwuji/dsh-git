    const STYLE_URL = '/dsh-git-6b1e/styles.css';
    const styleState = { status: 'idle', cssLength: 0, error: null, sheet: null, link: null };
    let stylePromise = null;

    /** Adopt one sheet on a document or shadow root; returns an undo (or null). */
    function adoptSheet(root, sheet) {
      if (!root || !sheet || !('adoptedStyleSheets' in root)) return null;
      const current = Array.from(root.adoptedStyleSheets || []);
      if (current.includes(sheet)) return () => {};
      root.adoptedStyleSheets = [...current, sheet];
      return () => {
        root.adoptedStyleSheets = Array.from(root.adoptedStyleSheets || [])
          .filter((item) => item !== sheet);
      };
    }

    /** Load the panel stylesheet once; every surface may call this. */
    function ensureStyles() {
      if (stylePromise !== null) return stylePromise;
      stylePromise = (async () => {
        try {
          const response = await fetch(STYLE_URL, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          styleState.cssLength = text.length;
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(text);
          adoptSheet(document, sheet);
          styleState.sheet = sheet;
          styleState.status = 'adopted';
        } catch (error) {
          styleState.error = error && error.message ? error.message : String(error);
          styleState.status = 'link';
          try {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = STYLE_URL;
            link.dataset.dshGitPanel = 'styles';
            const host = document.head || document.documentElement;
            if (host) host.appendChild(link);
            styleState.link = link;
          } catch (fallbackError) {
            styleState.status = 'failed';
            styleState.error = fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError);
          }
        }
        return styleState;
      })();
      return stylePromise;
    }

    /** True when this stylesheet reached the node (sentinel custom property). */
    function stylesActive(node) {
      if (!node) return false;
      try {
        return getComputedStyle(node).getPropertyValue('--dshg-git-styled').trim() === '1';
      } catch {
        return false;
      }
    }

    /** What the panel's self-check reports when the sheet did not arrive. */
    function styleDiagnostics() {
      return {
        status: styleState.status,
        css: styleState.cssLength,
        error: styleState.error,
        adopted: document.adoptedStyleSheets ? document.adoptedStyleSheets.length : -1,
        sheet: styleState.sheet && styleState.sheet.cssRules ? styleState.sheet.cssRules.length : -1,
      };
    }

    /* ------------------------------------------------------------------ *
     * Workspace tree decorations
     *
     * The right Sidebar's files tab renders `li[data-files-entry][data-files-path]`
     * rows but exposes no per-row slot, so we decorate those rows in place: a
     * MutationObserver keeps badges in sync with the Git status of every
     * repository discovered in the open workspace, without replacing the
     * shipped file tree.
     * ------------------------------------------------------------------ */
