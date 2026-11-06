// Same bucket, two public hostnames. A stored FlatGeobuf URL uses one of
// these. Reading that key through the R2 binding does not consult ACL.
export const PRODUCTION_BUCKET_HOSTS = [
  "uploads.seasketch.org",
  "tiles.seasketch.org",
];

export function bucketHosts(env: { UPLOADS_HOST?: string }): Set<string> {
  const configured = String(env.UPLOADS_HOST || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  return new Set(configured.length > 0 ? configured : PRODUCTION_BUCKET_HOSTS);
}

export function isBoundBucket(target: URL, hosts: Set<string>): boolean {
  return (
    hosts.has(target.host.toLowerCase()) ||
    hosts.has(target.hostname.toLowerCase())
  );
}
