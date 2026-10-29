/** Secrets and optional bindings not listed as wrangler [vars]. */
interface Env {
  /** overlay-data-tables Worker. Present on overlay-data-server only. */
  DATA_TABLES?: {
    fetch(
      request: Request,
      options?: { cf?: { cacheKey?: string } },
    ): Promise<Response>;
  };
  MAPBOX_ACCESS_TOKEN?: string;
  TILES_BUCKET: R2Bucket;
  /**
   * Host (or origin) written into TileJSON tile URLs. Defaults to the
   * request origin, which is right for production routes and for a local
   * `wrangler dev` session on `http://localhost:8787`.
   */
  PUBLIC_HOSTNAME?: string;
  /**
   * `host[:port]` list that plays the uploads role (opaque objects). Unset
   * means `uploads.seasketch.org`; a local session sets its own host.
   */
  UPLOADS_HOST?: string;
  JWKS_URL?: string;
  /** When "true", consult ACL docs and require tokens for protected data. */
  AUTH_ACL_ENABLED?: string;
  /**
   * When "true", require an admin map-access or overlay-engine token for
   * `/projects/{slug}/subdivided/...` outputs. Independent of AUTH_ACL_ENABLED
   * so subdivided can be gated first during rollout.
   */
  AUTH_SUBDIVIDED_ACL_ENABLED?: string;
  /** When ACL enabled and doc missing: public unless explicitly "false". */
  AUTH_MISSING_ACL_PUBLIC?: string;
  /**
   * Incoming Webhook URL for ACL-deny rollout alerts (TileJSON / download /
   * FGB / GeoJSON / properties). Set via `wrangler secret put SLACK_WEBHOOK_URL`.
   */
  SLACK_WEBHOOK_URL?: string;
  /** Set to "false" to disable deny Slack alerts without removing the secret. */
  AUTH_DENY_SLACK_ENABLED?: string;
}
