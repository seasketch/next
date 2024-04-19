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
    /** s3 bucket where offline tile packages are stored */
    TILE_PACKAGES_BUCKET: string;
    /* Used when generating various links. Include protocol */
    CLIENT_DOMAIN: string;
    SPATIAL_UPLOADS_BUCKET: string;
    NORMALIZED_SPATIAL_UPLOADS_BUCKET: string;
    SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER?: string;
    SPATIAL_UPLOADS_LAMBDA_ARN?: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT: string;
    CLOUDFLARE_IMAGES_ACCOUNT: string;
    CLOUDFLARE_IMAGES_TOKEN: string;
    CLOUDFLARE_IMAGES_ACCOUNT_HASH: string;
    /** May be comma seperated list. First issuer should be the primary host */
    ISSUER?: string;
    /* Used for generating email verification links */
    API_ROOT: string;
    /* Lambda used for taking screenshots of map bookmakrs */
    SCREENSHOTTER_FUNCTION_ARN: string;
    /* For discussion forum and survey file uploads */
    R2_FILE_UPLOADS_BUCKET: string;
    CLOUDFLARE_ACCOUNT_TAG: string;
    CLOUDFLARE_SITE_TAG: string;
    PMTILES_SERVER_ZONE: string;
  }
}
