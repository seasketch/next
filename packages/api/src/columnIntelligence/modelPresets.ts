/**
 * Preset Workers AI model IDs for column intelligence. All must appear on
 * Cloudflare’s JSON mode list or the API will reject `response_format`:
 * https://developers.cloudflare.com/workers-ai/features/json-mode/
 *
 * These presets avoid `@hf` Mistral/Hermes and Llama‑3.0 8B, which have been
 * unreliable in practice; they stick to `@cf/meta` Llama 3.1+ and one small AWQ
 * coder model that tends to follow instructions well.
 *
 * Set COLUMN_INTELLIGENCE_MODEL to one of these or another JSON-mode model id.
 */
export const COLUMN_INTELLIGENCE_MODEL_PRESETS = {
  /** Default — balanced quality/latency; known good for this task */
  LLAMA_3_1_8B: "@cf/meta/llama-3.1-8b-instruct",
  /** Mid-size Llama 3.2; stronger than 8B, still lighter than 70B */
  LLAMA_3_2_11B_VISION: "@cf/meta/llama-3.2-11b-vision-instruct",
  /** Full 70B — best quality on the JSON list, higher latency/cost */
  LLAMA_3_1_70B: "@cf/meta/llama-3.1-70b-instruct",
  /** FP8 70B — Cloudflare’s faster 70B tier when you need more capacity than 8B */
  LLAMA_3_3_70B_FP8_FAST: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  /** 6.7B AWQ — smallest/fastest listed option; strong on structured instructions */
  DEEPSEEK_CODER_6_7B_AWQ: "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
} as const;

export type ColumnIntelligenceModelPreset =
  keyof typeof COLUMN_INTELLIGENCE_MODEL_PRESETS;

/** Models documented to support Workers AI JSON mode (sync with Cloudflare docs). */
export const WORKERS_AI_JSON_MODE_MODEL_IDS: ReadonlySet<string> = new Set([
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.2-11b-vision-instruct",
  "@hf/nousresearch/hermes-2-pro-mistral-7b",
  "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
]);

export function isWorkersAiJsonModeModel(model: string): boolean {
  return WORKERS_AI_JSON_MODE_MODEL_IDS.has(model.trim());
}

/**
 * Some TGI-backed models cap completion (`max_new_tokens`) at 1024; the REST
 * layer may not map `max_tokens` → TGI correctly, so callers also send
 * `max_new_tokens` from `runWorkersAiJson` in cloudflareAi.ts.
 */
const MODEL_MAX_COMPLETION_TOKENS: Readonly<Partial<Record<string, number>>> = {
  "@hf/nousresearch/hermes-2-pro-mistral-7b": 1024,
};

export function clampMaxCompletionTokensForModel(
  model: string,
  requested: number,
): number {
  const cap = MODEL_MAX_COMPLETION_TOKENS[model.trim()];
  const n = Math.floor(requested);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  if (cap != null) {
    return Math.min(n, cap);
  }
  return n;
}
