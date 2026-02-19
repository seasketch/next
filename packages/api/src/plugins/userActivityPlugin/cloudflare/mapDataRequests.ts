import {
  cloudflareClient,
  buildMapDataFilter,
  fillTimeSeriesGaps,
  getTimeRange,
  gql,
  UserActivityPeriod,
} from "./client";

interface HttpRequestsResponse {
  viewer?: {
    zones: {
      series: {
        count: number;
        dimensions: {
          ts: string;
          cacheStatus: string;
        };
      }[];
    }[];
  };
}

const MAP_REQUESTS_15M = gql`
  query MapRequests15m(
    $zoneTag: string
    $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        series: httpRequestsAdaptiveGroups(limit: 5000, filter: $filter) {
          count
          dimensions {
            ts: datetimeFifteenMinutes
            cacheStatus
          }
        }
      }
    }
  }
`;

const MAP_REQUESTS_HOURLY = gql`
  query MapRequestsHourly(
    $zoneTag: string
    $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        series: httpRequestsAdaptiveGroups(limit: 5000, filter: $filter) {
          count
          dimensions {
            ts: datetimeHour
            cacheStatus
          }
        }
      }
    }
  }
`;

export async function fetchMapDataRequests(
  period: UserActivityPeriod,
  slug?: string
) {
  // Zones API only supports ~8 days of lookback; skip for longer periods
  if (period === "D30" || period === "D90" || period === "D180") {
    return [];
  }

  const { start, end } = getTimeRange(period);
  const query = period === "H24" ? MAP_REQUESTS_15M : MAP_REQUESTS_HOURLY;

  const filter = buildMapDataFilter(start, end, slug);
  const response = await cloudflareClient.request<HttpRequestsResponse>(
    query,
    {
      zoneTag: process.env.PMTILES_SERVER_ZONE,
      filter,
    }
  );

  const series = response.viewer?.zones[0]?.series;
  if (!series) {
    return [];
  }

  const buckets = new Map<string, { hits: number; other: number }>();

  for (const item of series) {
    const ts = item.dimensions.ts;
    const bucket = buckets.get(ts) || { hits: 0, other: 0 };
    if (item.dimensions.cacheStatus === "hit") {
      bucket.hits += item.count;
    } else {
      bucket.other += item.count;
    }
    buckets.set(ts, bucket);
  }

  const sparse = Array.from(buckets.entries()).map(([ts, { hits, other }]) => {
    const total = hits + other;
    return {
      timestamp: new Date(ts).toISOString(),
      count: total,
      cacheHitRatio: total > 0 ? hits / total : 0,
    };
  });

  return fillTimeSeriesGaps(sparse, period, (ts) => ({
    timestamp: ts,
    count: 0,
    cacheHitRatio: 0,
  }));
}
