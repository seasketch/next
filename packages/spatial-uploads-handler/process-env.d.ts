declare namespace NodeJS {
  interface ProcessEnv {
    PGREGION: string;
    PGPORT: number;
    PGUSER: string;
    PGDATABASE: string;
    PGPASSWORD: string;
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    BUCKET: string;
    NORMALIZED_OUTPUTS_BUCKET: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT: string;
    SLACK_TOKEN?: string;
    SLACK_CHANNEL?: string;
  }
}
