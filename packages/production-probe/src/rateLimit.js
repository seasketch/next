const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 20;

/**
 * Sliding window. `hits` is timestamps, oldest first.
 * @param {number[]} hits
 * @param {number} now
 */
export function decide(hits, now) {
  const recent = hits.filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= LIMIT) {
    return {
      allowed: false,
      hits: recent,
      retryAfter: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)),
    };
  }
  recent.push(now);
  return { allowed: true, hits: recent, remaining: LIMIT - recent.length };
}

export class ProbeRateLimit {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch() {
    const now = Date.now();
    const stored = (await this.ctx.storage.get("hits")) ?? [];
    const decision = decide(stored, now);
    if (decision.allowed) {
      await this.ctx.storage.put("hits", decision.hits);
    }
    return Response.json(decision, { status: decision.allowed ? 200 : 429 });
  }
}
