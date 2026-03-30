export interface WorkersAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Whether `COLUMN_INTELLIGENCE_SESSION_AFFINITY` is set (we send `x-session-affinity`).
 * Does not prove Cloudflare cached anything — see {@link extractPromptCacheSignalsFromUsage}.
 */
export function getWorkersAiPromptCacheRequestLogFields(): {
  workersAiPromptCacheAffinity: "off" | "on";
  /** Truncated preview when affinity is on */
  workersAiPromptCacheAffinityKeyPreview?: string;
} {
  const v = process.env.COLUMN_INTELLIGENCE_SESSION_AFFINITY?.trim();
  if (!v) {
    return { workersAiPromptCacheAffinity: "off" };
  }
  const preview = v.length > 20 ? `${v.slice(0, 20)}…` : v;
  return {
    workersAiPromptCacheAffinity: "on",
    workersAiPromptCacheAffinityKeyPreview: preview,
  };
}

/**
 * Collect numeric fields under `usage` whose names suggest prefix-cache reporting.
 * Cloudflare documents cache stats on `usage` but does not publish a stable schema here;
 * this is best-effort for logging. Non-empty with a positive value ⇒ likely a cache hit/report.
 */
export function extractPromptCacheSignalsFromUsage(
  usage: unknown,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return out;
  }
  const walk = (obj: Record<string, unknown>, prefix: string, depth: number): void => {
    if (depth > 5) {
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "number" && Number.isFinite(v) && /cache/i.test(k)) {
        out[path] = v;
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path, depth + 1);
      }
    }
  };
  walk(usage as Record<string, unknown>, "", 0);
  return out;
}

export interface RunWorkersAiJsonResult {
  /** Parsed JSON from the model response */
  parsed: unknown;
  rawText: string;
  usage?: WorkersAiUsage;
}

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

function workersAiResultToParsed(result: unknown): unknown {
  if (result == null || typeof result !== "object") {
    throw new Error("Workers AI returned empty result");
  }
  const r = result as { response?: unknown };
  const resp = r.response;
  if (resp === undefined || resp === null) {
    throw new Error("Workers AI returned no response");
  }
  if (typeof resp === "string") {
    return parseJsonLoose(resp);
  }
  if (typeof resp === "object") {
    return resp;
  }
  throw new Error("Workers AI response has unexpected shape");
}

/**
 * Call Cloudflare Workers AI REST API with chat messages.
 * Use `responseJsonSchema` for JSON mode (`type: "json_schema"`); unsupported
 * models return API errors — use models from the JSON mode list only.
 */
export async function runWorkersAiJson(options: {
  accountId: string;
  apiToken: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  /** Draft-07–style object passed as `response_format.json_schema`. */
  responseJsonSchema?: Record<string, unknown>;
}): Promise<RunWorkersAiJsonResult> {
  const url = workersAiRunModelUrl(options.accountId, options.model);

  const maxTok = Math.max(1, Math.floor(options.maxTokens ?? 512));

  const requestBody: Record<string, unknown> = {
    messages: options.messages,
    max_tokens: maxTok,
    max_new_tokens: maxTok,
    temperature: options.temperature ?? 0.2,
  };
  if (options.responseJsonSchema) {
    requestBody.response_format = {
      type: "json_schema",
      json_schema: options.responseJsonSchema,
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiToken}`,
    "Content-Type": "application/json",
  };
  const affinity = process.env.COLUMN_INTELLIGENCE_SESSION_AFFINITY?.trim();
  if (affinity) {
    headers["x-session-affinity"] = affinity;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const responseJson = (await res.json()) as {
    success?: boolean;
    errors?: unknown[];
    result?: {
      response?: string | Record<string, unknown> | null;
      usage?: WorkersAiUsage;
    };
  };

  if (!res.ok || responseJson.success === false) {
    throw new Error(
      `Workers AI HTTP ${res.status}: ${JSON.stringify(
        responseJson.errors ?? responseJson,
      )}`,
    );
  }

  const result = responseJson.result;
  let parsed: unknown;
  try {
    parsed = workersAiResultToParsed(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg);
  }

  const rawText =
    typeof result?.response === "string"
      ? result.response
      : JSON.stringify(result?.response ?? result ?? {});

  return {
    parsed,
    rawText,
    usage: result?.usage,
  };
}
