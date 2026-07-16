/** Secrets and optional bindings not listed as wrangler [vars]. */
interface Env {
  MAPBOX_ACCESS_TOKEN?: string;
  TILES_BUCKET: R2Bucket;
  PUBLIC_HOSTNAME?: string;
  JWKS_URL?: string;
  AUTH_LEGACY_PROJECT_PATHS?: string;
}
