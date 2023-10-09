declare namespace NodeJS {
  interface ProcessEnv {
    //types of envs
    NODE_ENV: "development" | "production" | "test" | "staging";
    BUCKET: string;
    PGREGION: string;
    PGHOST: string;
    PGPORT: string;
    PGUSER: string;
    PGDATABASE: string;
    PGPASSWORD?: string;
    UPLOADS_BASE_URL: string;
    RESOURCES_REMOTE: string;
    TILES_REMOTE: string;
    TILES_BASE_URL: string;
  }
}
