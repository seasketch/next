/** Same defaults as API worker; change here for both Lambda and graphile-worker. */
export type ColumnIntelligenceProvider = "cloudflare" | "openai";

export const COLUMN_INTELLIGENCE_PROVIDER: ColumnIntelligenceProvider =
  "openai";

export const COLUMN_INTELLIGENCE_CLOUDFLARE_MODEL =
  "@cf/meta/llama-3.1-8b-instruct";
