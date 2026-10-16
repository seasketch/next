const probeUrl =
  process.env.PRODUCTION_PROBE_URL ??
  "https://production-probe.underbluewaters.workers.dev/run";

const response = await fetch(probeUrl, { method: "POST", signal: AbortSignal.timeout(540_000) });
const result = await response.json();
if (result.rateLimited) {
  console.error(`rate limit: 20 runs per hour. Retry in ${result.retryAfter}s`);
  process.exit(1);
}
for (const check of result.checks ?? []) {
  console.log(`${check.ok ? "ok  " : "FAIL"} ${check.name}: ${check.detail}`);
}
if (typeof result.browserMs === "number") {
  console.log(`browser ${result.browserMs}ms`);
}
if (result.attempts > 1) {
  console.log(`attempts ${result.attempts}`);
}
if (!response.ok || !result.ok) {
  process.exit(1);
}
