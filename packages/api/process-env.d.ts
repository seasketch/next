declare namespace NodeJS {
  interface ProcessEnv {
    //types of envs
    NODE_ENV: "development" | "production" | "test" | "staging";
    AUTH0_DOMAIN: string;
    AUTH0_CLIENT_ID: string;
    JWT_AUD: string;
    GRAPHILE_WORKER_CONCURRENCY?: string;
    GRAPHILE_POLL_INTERVAL?: string;
    SSL_CRT_FILE?: string;
    SSL_KEY_FILE?: string;
    /** Defaults to 3857 */
    PORT?: string;
    SENTRY_DSN?: string;
    /** Defaults to production */
    REACT_APP_SENTRY_ENV?: string;
    /** Defaults to 127.0.0.1 */
    REDIS_HOST?: string;
    MAPBOX_ACCESS_TOKEN: string;
    ADMIN_DATABASE_URL: string;
    DATABASE_URL: string;
    S3_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    PUBLIC_UPLOADS_DOMAIN: string;
    UNSPLASH_KEY: string;
    TILE_PACKAGES_BUCKET: string;
    CLIENT_DOMAIN: string;
  }
}
