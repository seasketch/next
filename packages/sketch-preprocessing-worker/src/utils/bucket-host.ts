// Hosts listed in UPLOADS_HOST are this deployment's bucket. The Worker
// reads those objects through the R2 binding, so ACL does not apply.
// The variable is a required Worker secret. Local `npm run dev` sets it
// to the local uploads host.

export function bucketHosts(env: { UPLOADS_HOST?: string }): Set<string> {
  const configured = String(env.UPLOADS_HOST || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  if (configured.length === 0) {
    throw new Error("UPLOADS_HOST is required");
  }
  return new Set(configured);
}

export function isBoundBucket(target: URL, hosts: Set<string>): boolean {
  return (
    hosts.has(target.host.toLowerCase()) ||
    hosts.has(target.hostname.toLowerCase())
  );
}
