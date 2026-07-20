import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped timing for Server-Timing headers.
 *
 * Cloudflare freezes performance.now() between I/O as a Spectre mitigation:
 * the clock only advances after async ops (R2, streams, etc.). Durations here
 * are approximate and mainly useful for comparing relative cost of I/O stages
 * on cache misses — not for microsecond-precise CPU profiling.
 *
 * Chrome DevTools draws each Server-Timing metric as an independent duration
 * bar ending at TTFB — there is no nesting or start-time in the spec. We only
 * emit mutually exclusive stage durations (header / tile / tilejson) plus
 * total, and put overlapping details (R2 read count, decompress) in desc so
 * DevTools doesn't imply parallel work when values overlap.
 */
export class RequestTiming {
  private stages = new Map<string, number>();
  private r2Reads = 0;
  private prefixCacheHits = 0;
  private decompressMs = 0;

  /** Time an async stage and accumulate its duration under `name`. */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.addStage(name, performance.now() - start);
    }
  }

  /** Add duration to a named stage (sums if called repeatedly). */
  addStage(name: string, durationMs: number) {
    this.stages.set(name, (this.stages.get(name) ?? 0) + durationMs);
  }

  /** Count one R2 range/object read for Server-Timing `desc`. */
  recordR2(_durationMs: number) {
    this.r2Reads += 1;
  }

  /** Count a PoP Cache hit for the PMTiles archive prefix. */
  recordPrefixCacheHit() {
    this.prefixCacheHits += 1;
  }

  /** Accumulate gzip decompress wall time for Server-Timing `desc`. */
  recordDecompress(durationMs: number) {
    this.decompressMs += durationMs;
  }

  /** Format a Server-Timing header value, or "" when nothing was recorded. */
  toHeader(): string {
    const parts: string[] = [];

    const total = this.stages.get("total");
    if (total !== undefined) {
      const details: string[] = [];
      if (this.r2Reads > 0) {
        details.push(`r2=${this.r2Reads}`);
      }
      if (this.prefixCacheHits > 0) {
        details.push(`prefix-cache=${this.prefixCacheHits}`);
      }
      // Only mention decompress when the clock actually moved; Spectre
      // rounding often reports 0 for fast stream work nested in R2 awaits.
      if (this.decompressMs >= 0.5) {
        details.push(`decompress=${this.decompressMs.toFixed(0)}ms`);
      }
      let part = `total;dur=${total.toFixed(1)}`;
      if (details.length) {
        part += `;desc="${details.join(", ")}"`;
      }
      parts.push(part);
    }

    // Stages are sequential and should roughly sum to total. Emitting them
    // (and not a separate r2 duration) keeps Chrome's bars comparable.
    for (const name of ["header", "tile", "tilejson"] as const) {
      const dur = this.stages.get(name);
      if (dur === undefined || dur < 0.5) {
        continue;
      }
      parts.push(`${name};dur=${dur.toFixed(1)}`);
    }

    return parts.join(", ");
  }
}

const storage = new AsyncLocalStorage<RequestTiming>();

/** Current request's RequestTiming from AsyncLocalStorage, if any. */
export function getTiming(): RequestTiming | undefined {
  return storage.getStore();
}

/** Run `fn` with `timing` bound as the request-scoped RequestTiming store. */
export function withTiming<T>(
  timing: RequestTiming,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(timing, fn);
}
