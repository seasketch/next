import {
  cloudflareClient,
  buildRumFilter,
  fillTimeSeriesGaps,
  getTimeChunks,
  gql,
  UserActivityPeriod,
} from "./client";

interface RumTimeseriesResponse {
  viewer?: {
    accounts: {
      series: {
        sum: { visits: number };
        dimensions: { ts: string };
      }[];
    }[];
  };
}

const VISITORS_15M = gql`
  query Visitors15m(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          sum {
            visits
          }
          dimensions {
            ts: datetimeFifteenMinutes
          }
        }
      }
    }
  }
`;

const VISITORS_HOURLY = gql`
  query VisitorsHourly(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          sum {
            visits
          }
          dimensions {
            ts: datetimeHour
          }
        }
      }
    }
  }
`;

const VISITORS_DAILY = gql`
  query VisitorsDaily(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          sum {
            visits
          }
          dimensions {
            ts: date
          }
        }
      }
    }
  }
`;

function queryForPeriod(period: UserActivityPeriod) {
  switch (period) {
    case "H24":
      return VISITORS_15M;
    case "D7":
      return VISITORS_HOURLY;
    case "D30":
    case "D90":
    case "D180":
      return VISITORS_DAILY;
  }
}

export async function fetchVisitors(period: UserActivityPeriod, slug?: string) {
  const chunks = getTimeChunks(period);
  const query = queryForPeriod(period);

  const responses = await Promise.all(
    chunks.map((chunk) =>
      cloudflareClient.request<RumTimeseriesResponse>(query, {
        accountTag: process.env.CLOUDFLARE_ACCOUNT_TAG,
        filter: buildRumFilter(chunk.start, chunk.end, slug),
      })
    )
  );

  const allPoints = responses.flatMap(
    (r) => r.viewer?.accounts[0]?.series ?? []
  );

  const sparse = allPoints.map((item) => ({
    timestamp: new Date(item.dimensions.ts).toISOString(),
    count: item.sum.visits,
  }));

  return fillTimeSeriesGaps(sparse, period, (ts) => ({
    timestamp: ts,
    count: 0,
  }));
}
