import {
  cloudflareClient,
  buildRumFilter,
  getTimeChunks,
  getTimeRange,
  gql,
  UserActivityPeriod,
} from "./client";

interface MetricDimension {
  dimensions: { metric: string };
  sum: { visits: number };
}

interface VisitorMetricsResponse {
  viewer?: {
    accounts: {
      topReferers: MetricDimension[];
      topBrowsers: MetricDimension[];
      topOSs: MetricDimension[];
      topDeviceTypes: MetricDimension[];
      countries: MetricDimension[];
    }[];
  };
}

const VISITOR_METRICS_QUERY = gql`
  query VisitorMetrics(
    $accountTag: string
    $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        topReferers: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            metric: refererHost
          }
        }
        topBrowsers: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            metric: userAgentBrowser
          }
        }
        topOSs: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            metric: userAgentOS
          }
        }
        topDeviceTypes: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            metric: deviceType
          }
        }
        countries: rumPageloadEventsAdaptiveGroups(
          filter: $filter
          limit: 15
          orderBy: [sum_visits_DESC]
        ) {
          sum {
            visits
          }
          dimensions {
            metric: countryName
          }
        }
      }
    }
  }
`;

const countryFormatter = new Intl.DisplayNames(["en"], { type: "region" });

function toSortedLabelCounts(items: MetricDimension[]) {
  return items
    .map((item) => ({
      label: item.dimensions.metric,
      count: item.sum.visits,
    }))
    .sort((a, b) => b.count - a.count);
}

type AccountMetrics = NonNullable<VisitorMetricsResponse["viewer"]>["accounts"][0];

function mergeMetricDimensions(...arrays: MetricDimension[][]): MetricDimension[] {
  const map = new Map<string, number>();
  for (const arr of arrays) {
    for (const item of arr) {
      const key = item.dimensions.metric;
      map.set(key, (map.get(key) ?? 0) + item.sum.visits);
    }
  }
  return Array.from(map.entries()).map(([metric, visits]) => ({
    dimensions: { metric },
    sum: { visits },
  }));
}

function mergeAccounts(accounts: AccountMetrics[]): AccountMetrics {
  return {
    topReferers: mergeMetricDimensions(...accounts.map((a) => a.topReferers)),
    topBrowsers: mergeMetricDimensions(...accounts.map((a) => a.topBrowsers)),
    topOSs: mergeMetricDimensions(...accounts.map((a) => a.topOSs)),
    topDeviceTypes: mergeMetricDimensions(...accounts.map((a) => a.topDeviceTypes)),
    countries: mergeMetricDimensions(...accounts.map((a) => a.countries)),
  };
}

export async function fetchVisitorMetrics(
  period: UserActivityPeriod,
  slug?: string
) {
  const range = getTimeRange(period);
  const chunks = getTimeChunks(period, range);

  const responses = await Promise.all(
    chunks.map((chunk) =>
      cloudflareClient.request<VisitorMetricsResponse>(VISITOR_METRICS_QUERY, {
        accountTag: process.env.CLOUDFLARE_ACCOUNT_TAG,
        filter: buildRumFilter(chunk.start, chunk.end, slug),
      })
    )
  );

  const accountResults = responses
    .map((r) => r.viewer?.accounts[0])
    .filter((a): a is AccountMetrics => !!a);

  if (accountResults.length === 0) {
    return {
      topReferrers: [],
      topCountries: [],
      topBrowsers: [],
      topOperatingSystems: [],
      topDeviceTypes: [],
    };
  }

  const account = accountResults.length === 1
    ? accountResults[0]
    : mergeAccounts(accountResults);

  const topReferrers = toSortedLabelCounts(account.topReferers).filter(
    (item) =>
      item.label &&
      item.label !== "www.seasketch.org" &&
      item.label !== "seasketch.auth0.com"
  );

  const topCountries = account.countries
    .map((item) => ({
      label:
        countryFormatter.of(item.dimensions.metric)?.toString() || "Unknown",
      count: item.sum.visits,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    topReferrers,
    topCountries,
    topBrowsers: toSortedLabelCounts(account.topBrowsers),
    topOperatingSystems: toSortedLabelCounts(account.topOSs),
    topDeviceTypes: toSortedLabelCounts(account.topDeviceTypes),
  };
}
