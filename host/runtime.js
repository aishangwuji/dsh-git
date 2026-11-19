/**
 * Process-wide bindings the host helpers need: the Cordis context (workspace
 * registry, subprocess service) and the plugin logger. Bound once in
 * `apply()`, read by the modules that cannot take them as arguments.
 */
export const runtime = { ctx: null, logger: null };

export function bindRuntime(ctx) {
  runtime.ctx = ctx;
  runtime.logger = ctx && ctx.logger ? ctx.logger : null;
}
