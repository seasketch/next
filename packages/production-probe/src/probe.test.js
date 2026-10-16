import assert from "node:assert/strict";
import test from "node:test";
import { failureText, notifyFailure } from "./notify.js";
import { runProbe } from "./probe.js";
import { decide } from "./rateLimit.js";
import { outcomeAfterRetry } from "./worker.js";

const html = "<!doctype html><html><head><meta name=\"description\" content=\"SeaSketch is the platform\"></head></html>";

function pageResponse() {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function graphqlResponse(data, errors) {
  return Response.json(errors ? { errors } : { data });
}

const healthy = {
  projects: { totalCount: 377 },
  fiji: { slug: "fiji", name: "Blue Prosperity Fiji" },
  survey: {
    id: 23,
    name: "Ocean Uses Survey",
    isDisabled: false,
    project: { slug: "blueazores" },
  },
};

function mockFetch(pages, graphqlBody) {
  return async (url, init) => {
    if (String(url).includes("/graphql")) {
      return graphqlBody;
    }
    const page = pages[String(url)];
    if (!page) {
      return new Response("missing", { status: 404 });
    }
    return page();
  };
}

test("a healthy site passes", async () => {
  const result = await runProbe({
    fetch: mockFetch(
      {
        "https://www.seasketch.org/": pageResponse,
        "https://www.seasketch.org/fiji": pageResponse,
        "https://www.seasketch.org/blueazores/surveys/23/0": pageResponse,
      },
      graphqlResponse(healthy)
    ),
  });
  assert.equal(result.ok, true);
});

test("a missing Fiji project fails that check only", async () => {
  const result = await runProbe({
    fetch: mockFetch(
      {
        "https://www.seasketch.org/": pageResponse,
        "https://www.seasketch.org/fiji": pageResponse,
        "https://www.seasketch.org/blueazores/surveys/23/0": pageResponse,
      },
      graphqlResponse({ ...healthy, fiji: null })
    ),
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((check) => check.name === "fiji project").ok, false);
  assert.equal(result.checks.find((check) => check.name === "project list").ok, true);
});

test("a down homepage fails", async () => {
  const result = await runProbe({
    fetch: mockFetch(
      {
        "https://www.seasketch.org/": () => new Response("nope", { status: 503 }),
        "https://www.seasketch.org/fiji": pageResponse,
        "https://www.seasketch.org/blueazores/surveys/23/0": pageResponse,
      },
      graphqlResponse(healthy)
    ),
  });
  assert.equal(result.checks.find((check) => check.name === "homepage").ok, false);
});

test("20 runs are allowed in an hour, and the 21st waits", () => {
  const start = 1_000_000;
  let hits = [];
  for (let i = 0; i < 20; i++) {
    const decision = decide(hits, start + i * 1000);
    assert.equal(decision.allowed, true);
    hits = decision.hits;
  }
  const blocked = decide(hits, start + 21_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
  const later = decide(hits, start + 60 * 60 * 1000);
  assert.equal(later.allowed, true);
});

test("notifications do not send while disabled", async () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response("no");
  };
  try {
    const sent = await notifyFailure(
      { NOTIFY_ENABLED: "false", SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test" },
      { ok: false, checks: [{ name: "homepage", ok: false, detail: "down" }] }
    );
    assert.deepEqual(sent, { slack: "disabled", email: "disabled" });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

const failed = {
  ok: false,
  checks: [{ name: "homepage", ok: false, detail: "down" }],
  browserMs: 0,
};
const passed = { ok: true, checks: [{ name: "homepage", ok: true, detail: "200" }], browserMs: 10 };

test("a failure is retried before notification", () => {
  const recovered = outcomeAfterRetry(failed, passed);
  assert.equal(recovered.notify, false);
  assert.equal(recovered.result.ok, true);
  assert.equal(recovered.result.attempts, 2);

  const confirmed = outcomeAfterRetry(failed, failed);
  assert.equal(confirmed.notify, true);
  assert.equal(confirmed.result.attempts, 2);
  assert.match(failureText(confirmed.result), /two consecutive runs/);

  const blocked = outcomeAfterRetry(failed, { ok: false, rateLimited: true, checks: [], browserMs: 0 });
  assert.equal(blocked.notify, true);
  assert.equal(blocked.result.attempts, 1);

  const healthy = outcomeAfterRetry(passed, null);
  assert.equal(healthy.notify, false);
  assert.equal(healthy.result.attempts, 1);
});
