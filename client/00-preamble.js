    const React = require('react');
    const { createPortal } = require('react-dom');
    const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;
    const h = React.createElement;

    const NS = 'dsh.git';
    const RPC_PATH = '/dsh-git-6b1e/rpc';
    const GRAPH_COLORS = [
      'var(--dsw-alias-brand-primary, #3b82f6)',
      'var(--dsw-alias-state-success-primary, #22c55e)',
      'var(--dsw-alias-state-warn-primary, #eab308)',
      'var(--dsw-alias-state-error-primary, #ef4444)',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#ec4899',
    ];

    let t = (key) => key;
    /**
     * Workspace/session bridge filled by `ctx.inject(['workspaces',
     * 'uiWorkspace'])` in apply(). Keeping it module-level lets the panel stay
     * usable in shells that omit those services, while the worktree flow can
     * report a readable error instead of crashing the panel.
     */
    let worktreeBridge = null;
    /** Session summary lookup used by the composer chip when its slot props omit hooks. */
    let sessionBridge = null;
