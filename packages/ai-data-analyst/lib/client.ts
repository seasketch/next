import type { ErrorObject, ValidateFunction } from "ajv";
import OpenAI from "openai";
import type { OpenAIParameters } from "./prompts";
import {
  attributionParameters,
  attributionPrompt,
} from "./prompts/layers/attribution";
import { titleParameters, titlePrompt } from "./prompts/layers/title";
import {
  attributionFormattingSchema,
  attributionFormattingValidator,
  titleFormattingSchema,
  titleFormattingValidator,
} from "./schemas";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    if (!process.env.CF_AIG_TOKEN || !process.env.CF_AIG_URL) {
      throw new Error("CF_AIG_TOKEN and CF_AIG_URL must be set");
    }
    client = new OpenAI({
      baseURL: process.env.CF_AIG_URL,
      defaultHeaders: {
        "cf-aig-authorization": `Bearer ${process.env.CF_AIG_TOKEN}`,
      },
    });
  }
  return client;
}

function formatAjvErrors(
  errors: ErrorObject[] | null | undefined,
  fallback: string,
) {
  if (!errors?.length) {
    return fallback;
  }
  return errors
    .map((e) => {
      const path = e.instancePath?.length ? e.instancePath : "(root)";
      return `${path} ${e.message ?? ""}`.trim();
    })
    .join("; ");
}

function parseAssistantJson(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
  validator: ValidateFunction,
  responseLabel: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const raw = message?.content;
  if (message?.refusal) {
    return {
      ok: false,
      error: `Model refused to generate ${responseLabel}`,
    };
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Empty or missing assistant message content" };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Assistant response was not valid JSON" };
  }

  if (!validator(data)) {
    return {
      ok: false,
      error: `Invalid ${responseLabel} response: ${formatAjvErrors(
        validator.errors,
        "does not match schema",
      )}`,
    };
  }

  return { ok: true, data };
}

async function chatCompletionWithJsonSchema(
  systemPrompt: string,
  userContent: string,
  params: OpenAIParameters,
  responseName: string,
  schema: typeof titleFormattingSchema | typeof attributionFormattingSchema,
) {
  const openai = getClient();
  return openai.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    reasoning_effort: params.effort,
    verbosity: params.verbosity,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: responseName,
        strict: true,
        schema,
      },
    },
  });
}

function parsedTitleFromAssistantMessage(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): { ok: true; title: string } | { ok: false; error: string } {
  const parsed = parseAssistantJson(message, titleFormattingValidator, "title");
  if (parsed.ok === false) {
    return parsed;
  }
  const title = (parsed.data as { title: string }).title.trim();
  if (title.length === 0) {
    return { ok: false, error: "Title was empty after trimming whitespace" };
  }
  return { ok: true, title };
}

function parsedAttributionFromAssistantMessage(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): { ok: true; attribution: string | null } | { ok: false; error: string } {
  const parsed = parseAssistantJson(
    message,
    attributionFormattingValidator,
    "attribution",
  );
  if (parsed.ok === false) {
    return parsed;
  }
  const raw = (parsed.data as { attribution: string | null }).attribution;
  if (raw === null) {
    return { ok: true, attribution: null };
  }
  const s = raw.trim();
  return { ok: true, attribution: s.length === 0 ? null : s };
}

export type GenerateTitleResult =
  | { title: string; usage: OpenAI.Completions.CompletionUsage }
  | { error: string; usage?: OpenAI.Completions.CompletionUsage };

export async function generateTitle(
  filename: string,
): Promise<GenerateTitleResult> {
  const response = await chatCompletionWithJsonSchema(
    titlePrompt,
    filename,
    titleParameters,
    "title",
    titleFormattingSchema,
  );

  const usage = response.usage;
  const parsed = parsedTitleFromAssistantMessage(response.choices[0]?.message);
  if (parsed.ok === false) {
    const errMsg = parsed.error;
    return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
  }
  if (usage === undefined) {
    return { error: "No usage in response" };
  }
  return { title: parsed.title, usage };
}

export type GenerateAttributionResult =
  | { attribution: string | null; usage: OpenAI.Completions.CompletionUsage }
  | { error: string; usage?: OpenAI.Completions.CompletionUsage };

export async function generateAttribution(
  metadata: string[],
): Promise<GenerateAttributionResult> {
  const response = await chatCompletionWithJsonSchema(
    attributionPrompt,
    metadata.join("\n"),
    attributionParameters,
    "attribution",
    attributionFormattingSchema,
  );

  const usage = response.usage;
  const parsed = parsedAttributionFromAssistantMessage(
    response.choices[0]?.message,
  );
  if (parsed.ok === false) {
    const errMsg = parsed.error;
    return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
  }
  if (usage === undefined) {
    return { error: "No usage in response" };
  }
  return { attribution: parsed.attribution, usage };
}
