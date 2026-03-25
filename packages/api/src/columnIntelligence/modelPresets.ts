/**
 * Preset Workers AI model IDs for column-intelligence experiments.
 * Set COLUMN_INTELLIGENCE_MODEL in the environment to one of these (or any
 * valid @cf/... id from the catalog).
 *
 * Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
 */
export const COLUMN_INTELLIGENCE_MODEL_PRESETS = {
  /** Balanced quality/latency; good default */
  LLAMA_3_1_8B: "@cf/meta/llama-3.1-8b-instruct",
  /** Smallest/fastest; lowest cost */
  LLAMA_3_2_3B: "@cf/meta/llama-3.2-3b-instruct",
  /** Strong instruction following (v0.2 is @hf/…; v0.1 is @cf/mistral/mistral-7b-instruct-v0.1) */
  MISTRAL_7B: "@hf/mistral/mistral-7b-instruct-v0.2",
  /** Solid generalist */
  GEMMA2_9B: "@cf/google/gemma-2-9b-it",
  /** Good structured output */
  QWEN_7B: "@cf/qwen/qwen2.5-7b-instruct",
} as const;

export type ColumnIntelligenceModelPreset =
  keyof typeof COLUMN_INTELLIGENCE_MODEL_PRESETS;
