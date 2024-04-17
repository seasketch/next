import { GraphQLClient, gql } from "graphql-request";

type Metric = {
  label: string;
  count: number;
};

const client = new GraphQLClient(
  "https://api.cloudflare.com/client/v4/graphql",
  {
    headers: new Headers({
      Authorization: `Bearer ${process.env.CLOUDFLARE_GRAPHQL_TOKEN}`,
    }),
  }
);

interface VisitorMetrics {
  start: Date;
  end: Date;
  slug?: string;
  topReferrers: Metric[];
  topCountries: Metric[];
  topBrowsers: Metric[];
  topDeviceTypes: Metric[];
  topOperatingSystems: Metric[];
}

const countryFormatter = new Intl.DisplayNames(["en"], { type: "region" });

export async function getVisitorMetrics(start: Date, end: Date, slug?: string) {
  const metrics: VisitorMetrics = {
    start,
    end,
    slug,
    topReferrers: [],
    topCountries: [],
    topBrowsers: [],
    topDeviceTypes: [],
    topOperatingSystems: [],
  };

  const filter: any = {
    AND: [
      {
        datetime_geq: start.toISOString(),
        datetime_leq: end.toISOString(),
      },
      {
        siteTag: process.env.CLOUDFLARE_SITE_TAG,
        bot: 0,
      },
    ],
  };

  if (slug) {
    filter.AND.push({
      requestPath_like: `/${slug}%`,
    });
  }

  const response = await client.request<{
    viewer?: {
      accounts: {
        topReferers: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
        countries: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
        topBrowsers: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
        topDeviceTypes: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
        topOSs: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
      }[];
    };
  }>(VISITOR_METRICS_QUERY, {
    accountTag: process.env.CLOUDFLARE_ACCOUNT_TAG,
    filter,
    order: "sum_visits_DESC",
  });

  if (!response.viewer?.accounts[0]) {
    throw new Error("No account found in response");
  }

  metrics.topBrowsers = response.viewer.accounts[0].topBrowsers.map((item) => ({
    label: item.dimensions.metric,
    count: item.sum.visits,
  }));

  metrics.topCountries = response.viewer.accounts[0].countries.map((item) => ({
    label: countryFormatter.of(item.dimensions.metric)?.toString() || "Unknown",
    count: item.sum.visits,
  }));

  metrics.topDeviceTypes = response.viewer.accounts[0].topDeviceTypes.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.sum.visits,
    })
  );

  metrics.topOperatingSystems = response.viewer.accounts[0].topOSs.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.sum.visits,
    })
  );

  metrics.topReferrers = response.viewer.accounts[0].topReferers.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.sum.visits,
    })
  );

  // sort each metric by count, descending
  metrics.topBrowsers.sort((a, b) => b.count - a.count);
  metrics.topCountries.sort((a, b) => b.count - a.count);
  metrics.topDeviceTypes.sort((a, b) => b.count - a.count);
  metrics.topOperatingSystems.sort((a, b) => b.count - a.count);
  metrics.topReferrers.sort((a, b) => b.count - a.count);

  // remove blank and www.seasketch.org referrers
  metrics.topReferrers = metrics.topReferrers.filter(
    (item) =>
      item.label &&
      item.label !== "www.seasketch.org" &&
      item.label !== "seasketch.auth0.com"
  );

  return metrics;
}

export async function getVisitedSlugs(start: Date, end: Date) {
  const filter = {
    AND: [
      {
        datetime_geq: start.toISOString(),
        datetime_leq: end.toISOString(),
      },
      {
        siteTag: process.env.CLOUDFLARE_SITE_TAG,
        bot: 0,
      },
    ],
  };

  const response = await client.request<{
    viewer?: {
      accounts: {
        topPaths: {
          count: number;
          dimensions: {
            metric: string;
          };
          sum: {
            visits: number;
          };
        }[];
      }[];
    };
  }>(TOP_PATHS_QUERY, {
    accountTag: process.env.CLOUDFLARE_ACCOUNT_TAG,
    filter,
    order: "sum_visits_DESC",
  });
  if (!response.viewer?.accounts[0]) {
    throw new Error("No account found in response");
  }
  const account = response.viewer?.accounts[0];
  const slugs = new Set<string>();
  for (const path of account.topPaths) {
    const slug = path.dimensions.metric.split("/")[1];
    if (slug) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

const TOP_PATHS_QUERY = gql`
  query GetRumAnalyticsTopNs {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        topPaths: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 5000
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: requestPath
          }
        }
      }
      __typename
    }
  }
`;

const VISITOR_METRICS_QUERY = gql`
  query GetRumAnalyticsTopNs {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) {
          count
          sum {
            visits
            __typename
          }
          __typename
        }
        topReferers: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: refererHost
            __typename
          }
          __typename
        }
        topBrowsers: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: userAgentBrowser
            __typename
          }
          __typename
        }
        topOSs: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: userAgentOS
            __typename
          }
          __typename
        }
        topDeviceTypes: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: deviceType
            __typename
          }
          __typename
        }
        countries: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [$order]
        ) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            metric: countryName
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

export async function getRealUserVisits(
  start: Date,
  end: Date,
  interval: "24 hours" | "7 days" | "30 days",
  slug?: string
) {
  const filter = {
    AND: [
      {
        datetime_geq: start.toISOString(),
        datetime_leq: end.toISOString(),
      },
      {
        siteTag: process.env.CLOUDFLARE_SITE_TAG,
        bot: 0,
      },
    ],
  };

  if (slug) {
    filter.AND.push({
      // @ts-ignore
      requestPath_like: `/${slug}%`,
    });
  }

  const response = await client.request<{
    viewer?: {
      accounts: {
        series: {
          sum: {
            visits: number;
          };
          dimensions: {
            ts: string;
          };
          avg: {
            sampleInterval: number;
          };
        }[];
      }[];
    };
  }>(
    interval === "24 hours"
      ? REAL_USER_VISITS_BY_15_MINUTES_QUERY
      : interval === "7 days"
      ? REAL_USER_VISITS_BY_HOUR_QUERY
      : REAL_USER_VISITS_BY_DAY_QUERY,
    {
      accountTag: process.env.CLOUDFLARE_ACCOUNT_TAG,
      filter,
    }
  );
  const account = response.viewer?.accounts[0];
  if (!account?.series) {
    throw new Error("No series found in response");
  }
  return account.series
    .map((item) => ({
      count: item.sum.visits,
      datetime: new Date(item.dimensions.ts),
      interval:
        interval === "24 hours"
          ? "15 minutes"
          : interval === "7 days"
          ? "1 hour"
          : "1 day",
    }))
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}

const REAL_USER_VISITS_BY_HOUR_QUERY = gql`
  query RumAnalyticsTimeseriesBydatetimeHourGroupedByall(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            ts: datetimeHour
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const REAL_USER_VISITS_BY_15_MINUTES_QUERY = gql`
  query RumAnalyticsTimeseriesBydatetimeFifteenMinutesGroupedByall(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            ts: datetimeFifteenMinutes
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const REAL_USER_VISITS_BY_DAY_QUERY = gql`
  query RumAnalyticsTimeseriesBydateGroupedByall(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) {
          count
          avg {
            sampleInterval
            __typename
          }
          sum {
            visits
            __typename
          }
          dimensions {
            ts: date
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

export async function getMapDataRequests(
  start: Date,
  end: Date,
  interval: "15 minutes" | "1 hour" | "1 day",
  slug?: string
) {
  const filter = {
    AND: [
      {
        datetime_geq: start.toISOString(),
        datetime_leq: end.toISOString(),
      },
      { requestSource: "eyeball" },
      { clientRequestHTTPHost: "tiles.seasketch.org" },
    ],
  };

  // if (slug) {
  //   filter.AND.push({
  //     // @ts-ignore
  //     requestPath_like: `/projects/${slug}%`,
  //   });
  // }

  const response = await client.request<{
    viewer?: {
      zones: {
        series: {
          sum: {
            visits: number;
          };
          dimensions: {
            cacheStatus: string;
            ts: string;
          };
          count: number;
        }[];
      }[];
    };
  }>(
    interval === "15 minutes"
      ? DATA_REQUESTS_15M_QUERY
      : DATA_REQUESTS_1H_QUERY,
    {
      zoneTag: process.env.PMTILES_SERVER_ZONE,
      filter,
    }
  );

  const zone = response.viewer?.zones[0];
  if (!zone?.series) {
    throw new Error("No series found in response");
  }
  const entries: {
    datetime: Date;
    interval: "15 minutes" | "1 hour" | "1 day";
    hit?: number;
    none?: number;
    miss?: number;
  }[] = [];

  for (const item of zone.series) {
    let datetime = new Date(item.dimensions.ts);
    // if interval === 1 day, coerce the datetime to be the start of the day
    if (interval === "1 day") {
      datetime = new Date(datetime.toISOString().split("T")[0] + "T00:00:00Z");
    }
    // existing record?
    let existing = entries.find(
      (e) => e.datetime.getTime() === datetime.getTime()
    );
    if (!existing) {
      existing = {
        datetime,
        interval,
      };
      entries.push(existing);
    }
    if (item.dimensions.cacheStatus === "hit") {
      existing.hit = (existing.hit || 0) + item.count;
    } else if (item.dimensions.cacheStatus === "none") {
      existing.none = (existing.none || 0) + item.count;
    } else if (item.dimensions.cacheStatus === "miss") {
      existing.hit = (existing.hit || 0) + item.count;
    }
  }

  return entries
    .map((item) => ({
      count: item.hit || 0 + (item.none || 0) + (item.miss || 0),
      interval: item.interval,
      cacheRatio:
        item.hit && item.hit > 0
          ? item.hit / (item.hit + (item.none || 0) + (item.miss || 0))
          : 0,
      datetime: item.datetime,
    }))
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}

const DATA_REQUESTS_15M_QUERY = gql`
  query ZapTimeseriesBydatetimeFifteenMinutesGroupedByall(
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

const DATA_REQUESTS_1H_QUERY = gql`
  query ZapTimeseriesBydatetime1HourGroupedByall(
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

// cached: httpRequestsAdaptiveGroups(filter: $filter, limit: 5) {
//   dimensions {
//     cacheStatus
//   }
//   count
// }
