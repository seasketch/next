import { runBrowserChecks } from "./browser.js";
import { notifyFailure } from "./notify.js";
import { runProbe } from "./probe.js";

export { ProbeRateLimit } from "./rateLimit.js";

async function takeSlot(env) {
  const id = env.PROBE_LIMIT.idFromName("production-probe");
  const response = await env.PROBE_LIMIT.get(id).fetch("https://probe-limit/");
  return response.json();
}

const RETRY_PAUSE_MS = 5_000;

async function runOnce(env) {
  const slot = await takeSlot(env);
  if (!slot.allowed) {
    console.log(JSON.stringify({ msg: "production-probe", rateLimited: true, retryAfter: slot.retryAfter }));
    return { ok: false, rateLimited: true, retryAfter: slot.retryAfter, checks: [], browserMs: 0 };
  }
  const http = await runProbe({
    siteOrigin: env.SITE_ORIGIN,
    graphqlUrl: env.GRAPHQL_URL,
  });
  let browser = { checks: [], durationMs: 0 };
  if (http.ok) {
    browser = await runBrowserChecks(env.BROWSER, env.SITE_ORIGIN);
  }
  const result = {
    ok: http.ok && browser.checks.every((check) => check.ok),
    checks: [...http.checks, ...browser.checks],
    browserMs: browser.durationMs,
  };
  console.log(JSON.stringify({ msg: "production-probe", ...result }));
  return result;
}

/**
 * A passing run, or a rate limit, is final. A failure is run once more
 * before anyone is notified. The retry uses its own rate-limit slot.
 *
 * @param {{ ok: boolean, rateLimited?: boolean, checks: unknown[], browserMs: number, retryAfter?: number }} first
 * @param {{ ok: boolean, rateLimited?: boolean, checks: unknown[], browserMs: number, retryAfter?: number } | null} second
 */
export function outcomeAfterRetry(first, second) {
  if (first.ok || first.rateLimited) {
    return { result: { ...first, attempts: first.rateLimited ? 0 : 1 }, notify: false };
  }
  if (!second || second.rateLimited) {
    return { result: { ...first, attempts: 1 }, notify: true };
  }
  if (second.ok) {
    return { result: { ...second, attempts: 2 }, notify: false };
  }
  return { result: { ...second, attempts: 2 }, notify: true };
}

async function execute(env) {
  const first = await runOnce(env);
  if (first.ok || first.rateLimited) {
    return outcomeAfterRetry(first, null).result;
  }
  console.log(JSON.stringify({ msg: "production-probe-retry" }));
  await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
  const second = await runOnce(env);
  const outcome = outcomeAfterRetry(first, second);
  if (outcome.notify) {
    const notify = await notifyFailure(env, outcome.result);
    console.log(JSON.stringify({ msg: "production-probe-notify", ...notify }));
  } else if (outcome.result.ok) {
    console.log(JSON.stringify({ msg: "production-probe-recovered" }));
  }
  return outcome.result;
}

function failureError(result) {
  return new Error(
    result.checks
      .filter((check) => !check.ok)
      .map((check) => `${check.name}: ${check.detail}`)
      .join("; ")
  );
}

export default {
  async scheduled(controller, env) {
    const result = await execute(env);
    if (result.rateLimited) {
      return;
    }
    if (!result.ok) {
      // The failure was already retried inside this invocation.
      controller.noRetry();
      throw failureError(result);
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/run") {
      const result = await execute(env);
      const status = result.rateLimited ? 429 : result.ok ? 200 : 500;
      return Response.json(result, { status });
    }
    return new Response("production-probe", { status: 200 });
  },
};
