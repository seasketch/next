/** Secrets and optional bindings not listed as wrangler [vars]. */
interface Env {
  MAPBOX_ACCESS_TOKEN?: string;
  TILES_BUCKET: R2Bucket;
  PUBLIC_HOSTNAME?: string;
  JWKS_URL?: string;
  /** When "true", consult ACL docs and require tokens for protected data. */
  AUTH_ACL_ENABLED?: string;
  /** When ACL enabled and doc missing: public unless explicitly "false". */
  AUTH_MISSING_ACL_PUBLIC?: string;
}
