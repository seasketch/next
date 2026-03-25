export interface WorkersAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface RunWorkersAiJsonResult {
  /** Parsed JSON from the model response */
  parsed: unknown;
  rawText: string;
  usage?: WorkersAiUsage;
}

/**
 * Build `/accounts/{id}/ai/run/{model}` like the dashboard curl: model is multiple
 * path segments (`@cf/meta/...`), not one segment with escaped slashes — otherwise
 * Cloudflare returns 400 code 7000 "No route for that URI".
 */
/** Strip optional ```json fences and trim before JSON.parse */
function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (fence) {
    t = fence[1]!.trim();
  }
  return JSON.parse(t) as unknown;
}

export function workersAiRunModelUrl(accountId: string, model: string): string {
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId.trim(),
  )}/ai/run`;
  const m = model.trim();
  const tail = m
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/${tail}`;
}

/**
 * Call Cloudflare Workers AI REST API with chat messages.
 * Note: Some models reject `response_format: { type: "json_object" }` (error 9015:
 * expected `json_schema`). We ask for JSON in the system prompt instead.
 */
export async function runWorkersAiJson(options: {
  accountId: string;
  apiToken: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<RunWorkersAiJsonResult> {
  const url = workersAiRunModelUrl(options.accountId, options.model);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: options.messages,
      max_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.2,
    }),
  });

  const body = (await res.json()) as {
    success?: boolean;
    errors?: unknown[];
    result?: {
      response?: string;
      usage?: WorkersAiUsage;
    };
  };

  if (!res.ok || body.success === false) {
    throw new Error(
      `Workers AI HTTP ${res.status}: ${JSON.stringify(body.errors ?? body)}`,
    );
  }

  const result = body.result;
  const rawText =
    typeof result?.response === "string"
      ? result.response
      : JSON.stringify(result ?? {});

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(rawText) as unknown;
  } catch {
    throw new Error("Workers AI returned non-JSON text");
  }

  return {
    parsed,
    rawText,
    usage: result?.usage,
  };
}
