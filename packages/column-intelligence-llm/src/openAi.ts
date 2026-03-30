import OpenAI from "openai";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { WorkersAiUsage } from "./cloudflareAi";

/** Dashboard “geostats analyzer” stored prompt (default version). */
const COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_ID =
  "pmpt_69580f3787408194b62cc9a882890b600f72cf9bb906b8cf";
// const COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_VERSION = "6";

export interface RunOpenAiJsonResult {
  parsed: unknown;
  rawText: string;
  usage?: WorkersAiUsage;
}

function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (fence) {
    t = fence[1]!.trim();
  }
  return JSON.parse(t) as unknown;
}

function normalizeResponsesUsage(usage: unknown): WorkersAiUsage | undefined {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return undefined;
  }
  const u = usage as Record<string, unknown>;
  const input = u.input_tokens;
  const output = u.output_tokens;
  const total = u.total_tokens;
  const out: WorkersAiUsage = {};
  if (typeof input === "number") {
    out.prompt_tokens = input;
  }
  if (typeof output === "number") {
    out.completion_tokens = output;
  }
  if (typeof total === "number") {
    out.total_tokens = total;
  } else if (typeof input === "number" && typeof output === "number") {
    out.total_tokens = input + output;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function responseOutputText(response: Response): string {
  if (response.output_text.trim().length > 0) {
    return response.output_text;
  }
  const parts: string[] = [];
  for (const item of response.output) {
    if (item.type !== "message") {
      continue;
    }
    for (const c of item.content) {
      if (
        c.type === "output_text" &&
        "text" in c &&
        typeof c.text === "string"
      ) {
        parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

/**
 * Runs the configured stored prompt (Responses API). The template variable
 * `geostats` should receive the same JSON string as {@link buildUserPrompt}.
 */
export async function runOpenAiJson(options: {
  apiKey: string;
  geostats: string;
}): Promise<RunOpenAiJsonResult> {
  const client = new OpenAI({ apiKey: options.apiKey });
  console.log("running openai json", options.geostats);
  console.time("openai json");
  const response = (await client.responses.create({
    stream: false,
    prompt: {
      id: COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_ID,
      // version: COLUMN_INTELLIGENCE_OPENAI_STORED_PROMPT_VERSION,
      variables: {
        geostats: options.geostats,
      },
    },
  } as unknown as ResponseCreateParamsNonStreaming)) as Response;
  console.timeEnd("openai json");

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI response error");
  }

  const rawText = responseOutputText(response);
  if (!rawText) {
    throw new Error("OpenAI returned no text content");
  }

  return {
    parsed: parseJsonLoose(rawText),
    rawText,
    usage: normalizeResponsesUsage(response.usage),
  };
}
