    function tf(key, vars) {
      let text = String(t(key));
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    }

    function errorText(error) {
      const code = error && error.code ? error.code : null;
      if (code) {
        const key = `err_${code}`;
        const translated = t(key);
        if (translated !== key) return translated;
      }
      return (error && (error.message || (error.rpcError && error.rpcError.message))) || t('err_UNKNOWN');
    }

    /** One-line summary for the fetch toast: refs, remotes, and branch drift. */
    function fetchSummary(result) {
      const remotes = Number(result && result.remotes) || 0;
      const refs = Number(result && result.updatedRefs) || 0;
      const behind = Number(result && result.behind) || 0;
      const ahead = Number(result && result.ahead) || 0;
      if (refs === 0) {
        let text = tf('fetchUpToDate', { remotes });
        if (behind > 0) text += ` · ${tf('fetchBehind', { count: behind })}`;
        if (ahead > 0) text += ` · ${tf('fetchAhead', { count: ahead })}`;
        return text;
      }
      let text = tf('fetchUpdated', { refs, remotes });
      if (behind > 0) text += ` · ${tf('fetchBehind', { count: behind })}`;
      if (ahead > 0) text += ` · ${tf('fetchAhead', { count: ahead })}`;
      return text;
    }

    /** Expandable fetch detail: one old..new line per changed ref. */
    function fetchDetail(result) {
      const lines = ((result && result.updates) || []).slice(0, 80).map((update) => {
        const ref = String(update.ref || '')
          .replace(/^refs\/remotes\//, '')
          .replace(/^refs\/tags\//, 'tag: ')
          .replace(/^refs\/heads\//, '');
        const oldOid = String(update.old || '').slice(0, 7);
        const newOid = String(update.new || '').slice(0, 7);
        return `${ref}  ${oldOid} → ${newOid}`;
      });
      if (result && result.output && lines.length === 0) lines.push(String(result.output));
      return lines.join('\n').slice(0, 4000);
    }

    /** One-line summary for the pull toast. */
    function pullSummary(result) {
      if (!result || !result.updated) return t('pullUpToDate');
      let text = tf('pullUpdated', {
        commits: Number(result.commits) || 0,
        files: Number(result.files) || 0,
      });
      const additions = Number(result.additions) || 0;
      const deletions = Number(result.deletions) || 0;
      if (additions + deletions > 0) text += ` · +${additions} −${deletions}`;
      return text;
    }

    /** One-line summary for the push toast. */
    function pushSummary(result) {
      if (!result) return t('pushUpToDate');
      if (result.newBranch) return tf('pushNewBranch', { branch: result.branch || '' });
      if (!result.updated) return t('pushUpToDate');
      return tf('pushUpdated', { commits: Number(result.pushedCommits) || 0 });
    }
