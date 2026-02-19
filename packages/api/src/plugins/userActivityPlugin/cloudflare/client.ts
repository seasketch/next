import { GraphQLClient, gql } from "graphql-request";

export type UserActivityPeriod = "H24" | "D7" | "D30" | "D90" | "D180";

export const cloudflareClient = new GraphQLClient(
  "https://api.cloudflare.com/client/v4/graphql",
  {
    headers: new Headers({
      Authorization: `Bearer ${process.env.CLOUDFLARE_GRAPHQL_TOKEN}`,
    }),
  }
);

export function getTimeRange(period: UserActivityPeriod): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "H24":
      start.setTime(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "D7":
      start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "D30":
      start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "D90":
      start.setTime(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "D180":
      start.setTime(end.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
  }
  return { start, end };
}

const MAX_CHUNK_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Splits a time range into chunks of ≤90 days to stay within
 * Cloudflare's ~93-day max query duration.
 */
export function getTimeChunks(period: UserActivityPeriod): { start: Date; end: Date }[] {
  const { start, end } = getTimeRange(period);
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= MAX_CHUNK_MS) {
    return [{ start, end }];
  }
  const chunks: { start: Date; end: Date }[] = [];
  let cursor = start.getTime();
  while (cursor < end.getTime()) {
    const chunkEnd = Math.min(cursor + MAX_CHUNK_MS, end.getTime());
    chunks.push({ start: new Date(cursor), end: new Date(chunkEnd) });
    cursor = chunkEnd;
  }
  return chunks;
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getIntervalMs(period: UserActivityPeriod): number {
  switch (period) {
    case "H24":
      return FIFTEEN_MIN_MS;
    case "D7":
      return ONE_HOUR_MS;
    case "D30":
    case "D90":
    case "D180":
      return ONE_DAY_MS;
  }
}

/**
 * Fills gaps in a time series so every expected interval has an entry.
 * Cloudflare omits intervals with zero activity.
 */
export function fillTimeSeriesGaps<T>(
  points: { timestamp: string; [key: string]: any }[],
  period: UserActivityPeriod,
  makeZero: (isoTimestamp: string) => T
): T[] {
  const { start, end } = getTimeRange(period);
  const intervalMs = getIntervalMs(period);
  const isDaily = intervalMs === ONE_DAY_MS;

  // Normalize start to interval boundary
  const startMs = isDaily
    ? Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    : Math.floor(start.getTime() / intervalMs) * intervalMs;
  const endMs = end.getTime();

  // Index existing data by normalized timestamp
  const existing = new Map<number, T>();
  for (const p of points) {
    const d = new Date(p.timestamp);
    const key = isDaily
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      : Math.floor(d.getTime() / intervalMs) * intervalMs;
    existing.set(key, p as unknown as T);
  }

  const filled: T[] = [];
  for (let t = startMs; t <= endMs; t += intervalMs) {
    const entry = existing.get(t);
    if (entry) {
      filled.push(entry);
    } else {
      filled.push(makeZero(new Date(t).toISOString()));
    }
  }
  return filled;
}

export function buildRumFilter(start: Date, end: Date, slug?: string) {
  const filter: any = {
    AND: [
      { datetime_geq: start.toISOString(), datetime_leq: end.toISOString() },
      { siteTag: process.env.CLOUDFLARE_SITE_TAG, bot: 0 },
    ],
  };
  if (slug) {
    filter.AND.push({ requestPath_like: `/${slug}%` });
  }
  return filter;
}

export function buildMapDataFilter(start: Date, end: Date, slug?: string) {
  const filter: any = {
    AND: [
      { datetime_geq: start.toISOString(), datetime_leq: end.toISOString() },
      { requestSource: "eyeball" },
      { clientRequestHTTPHost: "tiles.seasketch.org" },
    ],
  };
  if (slug) {
    filter.AND.push({ clientRequestPath_like: `/projects/${slug}%` });
  }
  return filter;
}

export { gql };
