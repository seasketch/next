declare namespace NodeJS {
  interface ProcessEnv {
    //types of envs
    NODE_ENV: "development" | "production" | "test" | "staging";
    BUCKET: string;
    NORMALIZED_OUTPUTS_BUCKET: string;
    PGREGION: string;
    PGHOST: string;
    PGPORT: string;
    PGUSER: string;
    PGDATABASE: string;
    PGPASSWORD?: string;
  }
}
