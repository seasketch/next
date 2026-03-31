import type { ErrorObject, ValidateFunction } from "ajv";
import type { JSONSchema4 } from "json-schema";
import OpenAI from "openai";
import type { OpenAIParameters } from "./prompts";
import {
  attributionFormattingSchema,
  attributionParameters,
  attributionFormattingValidator,
  attributionPrompt,
} from "./prompts/layers/attribution";
import {
  columnIntelligenceSchema,
  columnIntelligenceValidator,
  columnIntelligenceParameters,
  columnIntelligencePrompt,
} from "./prompts/layers/columnIntelligence";
import {
  titleFormattingSchema,
  titleFormattingValidator,
  titleParameters,
  titlePrompt,
} from "./prompts/layers/title";
import { pruneGeostats } from "./geostats/shrinkGeostats";
import { deriveValueSteps } from "./geostats/valueSteps";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    if (!process.env.CF_AIG_TOKEN || !process.env.CF_AIG_URL) {
      throw new Error("CF_AIG_TOKEN and CF_AIG_URL must be set");
    }
    client = new OpenAI({
      apiKey: process.env.CF_AIG_TOKEN,
      baseURL: process.env.CF_AIG_URL,
      // defaultHeaders: {
      //   "cf-aig-authorization": `Bearer ${process.env.CF_AIG_TOKEN}`,
      // },
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

type JsonValidator = ValidateFunction | ((data: unknown) => boolean);

function parseAssistantJson(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
  validator: JsonValidator,
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
    const errors =
      typeof validator === "function" &&
      "errors" in validator &&
      Array.isArray((validator as ValidateFunction).errors)
        ? (validator as ValidateFunction).errors
        : undefined;
    return {
      ok: false,
      error: `Invalid ${responseLabel} response: ${formatAjvErrors(
        errors,
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
  schema: JSONSchema4,
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

export type ColumnIntelligence = {
  best_label_column?: string;
  best_category_column?: string;
  best_numeric_column?: string;
  best_date_column?: string;
  best_popup_description_column?: string;
  best_id_column?: string;
  junk_columns: string[];
  chosen_presentation_type:
    | "RGB_RASTER"
    | "CATEGORICAL_RASTER"
    | "CONTINUOUS_RASTER"
    | "SIMPLE_POLYGON"
    | "CATEGORICAL_POLYGON"
    | "CONTINUOUS_POLYGON"
    | "SIMPLE_POINT"
    | "MARKER_IMAGE"
    | "CATEGORICAL_POINT"
    | "PROPORTIONAL_SYMBOL"
    | "CONTINUOUS_POINT"
    | "HEATMAP"
    | "SIMPLE_LINE"
    | "CONTINUOUS_LINE"
    | "CATEGORICAL_LINE";
  chosen_presentation_column?: string;
  best_group_by_column?: string;
  palette?: string;
  custom_palette?: Record<string, string> | null;
  show_labels: boolean;
  labels_min_zoom?: number;
  interactivity_type:
    | "BANNER"
    | "TOOLTIP"
    | "POPUP"
    | "ALL_PROPERTIES_POPUP"
    | "NONE";
  notes: string;
  value_steps?:
    | "CONTINUOUS"
    | "NATURAL_BREAKS"
    | "QUANTILES"
    | "EQUAL_INTERVALS";
  value_steps_n?: number;
};

function parsedColumnIntelligenceFromAssistantMessage(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): { ok: true; result: ColumnIntelligence } | { ok: false; error: string } {
  const parsed = parseAssistantJson(
    message,
    columnIntelligenceValidator,
    "column intelligence",
  );
  if (parsed.ok === false) {
    return parsed;
  }
  return { ok: true, result: parsed.data as ColumnIntelligence };
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

export type GenerateColumnIntelligenceResult =
  | { result: ColumnIntelligence; usage: OpenAI.Completions.CompletionUsage }
  | { error: string; usage?: OpenAI.Completions.CompletionUsage };

export async function generateColumnIntelligence(
  filename: string,
  geostats: unknown,
): Promise<GenerateColumnIntelligenceResult> {
  const prunedGeostats = pruneGeostats(geostats);
  const response = await chatCompletionWithJsonSchema(
    columnIntelligencePrompt,
    JSON.stringify({ filename, geostats: prunedGeostats }),
    columnIntelligenceParameters,
    "column_intelligence",
    columnIntelligenceSchema,
  );

  const usage = response.usage;
  const parsed = parsedColumnIntelligenceFromAssistantMessage(
    response.choices[0]?.message,
  );
  if (parsed.ok === false) {
    const errMsg = parsed.error;
    return usage === undefined ? { error: errMsg } : { error: errMsg, usage };
  }
  if (usage === undefined) {
    return { error: "No usage in response" };
  }

  const continuousTypes = new Set([
    "CONTINUOUS_RASTER",
    "CONTINUOUS_POINT",
    "CONTINUOUS_POLYGON",
  ]);
  const valueSteps = continuousTypes.has(parsed.result.chosen_presentation_type)
    ? deriveValueSteps(
        geostats,
        parsed.result.chosen_presentation_column ?? undefined,
      )
    : undefined;

  return {
    result: {
      ...parsed.result,
      ...(valueSteps
        ? {
            value_steps: valueSteps.value_steps,
            value_steps_n: valueSteps.value_steps_n,
          }
        : {}),
    },
    usage,
  };
}
