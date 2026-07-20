/**
 * ACL namespace for overlay tile auth docs on the shared R2 bucket.
 * Production always uses "prod". Non-production must set TILES_ACL_NAMESPACE
 * so local installs cannot clobber production ACL documents.
 */
export function resolveTilesAclNamespace(): string {
  if (process.env.NODE_ENV === "production") {
    return "prod";
  }
  const ns = process.env.TILES_ACL_NAMESPACE;
  if (!ns || !ns.trim()) {
    throw new Error(
      "TILES_ACL_NAMESPACE must be set when NODE_ENV is not production (e.g. dev-$USER)",
    );
  }
  const trimmed = ns.trim();
  if (trimmed === "prod") {
    throw new Error(
      'Refusing to use TILES_ACL_NAMESPACE="prod" when NODE_ENV is not production',
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(trimmed)) {
    throw new Error(`Invalid TILES_ACL_NAMESPACE: ${trimmed}`);
  }
  return trimmed;
}

export function assertMayWriteTilesAclNamespace(ns: string): void {
  if (ns === "prod" && process.env.NODE_ENV !== "production") {
    throw new Error(
      'Refusing to write ACL namespace "prod" when NODE_ENV is not production',
    );
  }
}
