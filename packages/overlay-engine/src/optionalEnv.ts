/**
 * Node-only env lookup. Cloudflare Workers do not define `process` unless
 * `nodejs_compat` is enabled, and `typeof` is the check that does not throw.
 */
export function optionalEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}
