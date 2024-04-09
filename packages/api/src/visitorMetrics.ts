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

  const filter = {
    AND: [
      {
        datetime_geq: start.toISOString(),
        datetime_leq: end.toISOString(),
      },
      {
        siteTag: process.env.CLOUDFLARE_SITE_TAG,
      },
    ],
  };

  const response = await client.request<{
    viewer?: {
      accounts: {
        topReferers: {
          count: number;
          dimensions: {
            metric: string;
          };
        }[];
        countries: {
          count: number;
          dimensions: {
            metric: string;
          };
        }[];
        topBrowsers: {
          count: number;
          dimensions: {
            metric: string;
          };
        }[];
        topDeviceTypes: {
          count: number;
          dimensions: {
            metric: string;
          };
        }[];
        topOSs: {
          count: number;
          dimensions: {
            metric: string;
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
    count: item.count,
  }));

  metrics.topCountries = response.viewer.accounts[0].countries.map((item) => ({
    label: countryFormatter.of(item.dimensions.metric)?.toString() || "Unknown",
    count: item.count,
  }));

  metrics.topDeviceTypes = response.viewer.accounts[0].topDeviceTypes.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.count,
    })
  );

  metrics.topOperatingSystems = response.viewer.accounts[0].topOSs.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.count,
    })
  );

  metrics.topReferrers = response.viewer.accounts[0].topReferers.map(
    (item) => ({
      label: item.dimensions.metric,
      count: item.count,
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
