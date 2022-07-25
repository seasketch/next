import { ApolloClient } from "@apollo/client";
import { DocumentNode } from "graphql";
import ServiceWorkerWindow, { MESSAGE_TYPES } from "../ServiceWorkerWindow";
import * as graphql from "../../generated/graphql";
import { GraphqlQueryCacheCommon, Strategy } from "./shared";

// TODO: clear cache on logout

/**
 * Saves query results to CacheStorage for use offline or just to improve
 * performance. Requests to be cached are identified by the configured
 * persistence strategies. These strategies include the following:
 *
 *   1) Static - The simplest strategy, a single entry is saved for the named
 *   query. New queries with different arguments replace the old entry.
 *   2) LRU - Least-recently-used caches queries up to a specified limit. Useful
 *   if you have a query that may be requested with different arguments. It can
 *   be configured to cache the most recent 5 query/variable combinations.
 *   3) The byArgs strategy enables each client to specify a list of variables
 *   that should be cached for the named query. For example, if there's a
 *   ProjectById(id: Int!) query, users could use
 *   `gqlQueryCache.setStrategyArgs(key, [{id: 4}, {id:5}])` to specify Projects
 *   they'd like to make available offline.
 *
 * @param endpoint Typically https://host/graphql
 * @param strategies Use lruStrategy(), staticStrategy(), byArgsStrategy() to create these configs
 * @param apolloClient Need to be set in the main window client to update apollo's cache when implementing stale-white-revalidate
 */
export class GraphqlQueryCache extends GraphqlQueryCacheCommon {
  strategyArgs: { [key: string]: string[] } = {};
  apolloClient?: ApolloClient<any>;
  cachePruningDebounceInterval = process.env.NODE_ENV === "test" ? 1 : 500;

  constructor(
    endpoint: string,
    strategies: Strategy[],
    apolloClient: ApolloClient<any>
  ) {
    super(endpoint, strategies);
    this.apolloClient = apolloClient;
    // Setup swr event listeners
    navigator.serviceWorker.addEventListener("message", async (e) => {
      if (
        e.data.type &&
        e.data.type === MESSAGE_TYPES.GRAPHQL_CACHE_REVALIDATION &&
        e.data.queryName &&
        e.data.variables
      ) {
        const { queryName, variables } = e.data as {
          queryName: string;
          variables: any;
        };
        const docs = graphql as unknown as {
          [key: string]: DocumentNode;
        };
        if (`${queryName}Document` in docs) {
          const query = docs[`${queryName}Document`];
          const cacheKey = this.makeCacheKey(queryName, variables);
          const response = await caches.match(cacheKey);
          if (response) {
            const { data } = await response.json();
            if (data) {
              apolloClient.cache.writeQuery({
                query,
                data,
                variables,
              });
            }
          }
        } else {
          throw new Error(`Unrecognized query ${queryName}`);
        }
      }
    });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this._setEnabled(enabled);
    ServiceWorkerWindow.updateGraphqlQueryCacheStrategyEnabled(enabled);
  }

  /**
   * Sets argument values for a strategy identified by the `key` option.
   *
   * Example usage
   *
   * ```ts
   * gqlQueryCache.setStrategyArgs(
   *  'selected-offline-projects',
   *  [{slug: "maldives"}, {slug: "azores"}]
   * );
   * ```
   * @param key
   * @param values
   */
  async setStrategyArgs(key: string, values: any[]): Promise<void> {
    this._setStrategyArgs(key, values);
    ServiceWorkerWindow.updateGraphqlQueryCacheStrategyArgs();
  }

  async clearResponse(strategy: Strategy, args: any) {
    const cache = await this.openCache(strategy);
    const cacheKey = this.makeCacheKey(strategy.queryName, args);
    return cache.delete(cacheKey);
  }

  async getState() {
    const strategyStats: {
      id: string;
      type: string;
      queryName: string;
      entries: number;
      bytes: number;
      limit?: number;
    }[] = [];
    for (const strategy of this.strategies) {
      const { keys, bytes } = await getCacheSize(
        this.cacheNameForStrategy(strategy)
      );
      strategyStats.push({
        id: this.cacheNameForStrategy(strategy),
        type: strategy.type,
        queryName: strategy.queryName,
        entries: keys,
        bytes,
        limit: strategy.type === "lru" ? strategy.limit : undefined,
      });
    }
    return {
      bytes: strategyStats.reduce((bytes, stats) => {
        bytes += stats.bytes;
        return bytes;
      }, 0),
      strategies: strategyStats,
    };
  }

  /**
   * Clears all cache responses
   */
  async logout() {
    for (const strategy of this.strategies) {
      await caches.delete(this.cacheNameForStrategy(strategy));
    }
  }
}

export async function getCacheSize(cacheName: string) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let cacheSize = 0;

  await Promise.all(
    keys.map(async (key) => {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        cacheSize += blob.size;
      }
    })
  );
  return {
    keys: keys.length,
    bytes: cacheSize,
  };
}
