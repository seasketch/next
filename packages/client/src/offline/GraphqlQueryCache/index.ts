import { ApolloClient } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/cache";
import { DocumentNode, OperationDefinitionNode } from "graphql";
import localforage from "localforage";
import debounce from "lodash.debounce";
import ServiceWorkerWindow, { MESSAGE_TYPES } from "../ServiceWorkerWindow";

// TODO: clear cache on logout

declare const self: ServiceWorkerGlobalScope | undefined;

type StrategyBase = {
  query: DocumentNode;
  queryName: string;
  swr?: boolean;
};

type StaticStrategy = {
  type: "static";
} & StrategyBase;

type LRUStrategy = {
  type: "lru";
  limit: number;
} & StrategyBase;

type ByArgsStrategy = {
  type: "byArgs";
  key: string;
} & StrategyBase;

type Strategy = StaticStrategy | LRUStrategy | ByArgsStrategy;

const STRATEGY_ARGS_KEY = `graphql-query-cache-strategy-args`;
const ENABLED_KEY = `graphql-query-cache-enabled`;

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
export class GraphqlQueryCache {
  endpoint: string;
  strategies: Strategy[];
  strategyArgs: { [key: string]: string[] } = {};
  apolloClient?: ApolloClient<any>;
  private enabled?: boolean;

  constructor(
    endpoint: string,
    strategies: Strategy[],
    apolloClient?: ApolloClient<any>
  ) {
    this.restoreEnabledState();
    this.endpoint = endpoint;
    this.strategies = strategies;
    if ("serviceWorker" in navigator && !apolloClient) {
      throw new Error(
        "ApolloClient must be set when using outside a service worker"
      );
    }
    this.apolloClient = apolloClient;
    // Validate strategy configuration
    const strategiesByKey: { [key: string]: Strategy } = {};
    const strategiesById: { [id: string]: Strategy } = {};
    for (const strategy of strategies) {
      // Make sure there isn't more than one strategy with the same key
      if (isByArgs(strategy)) {
        if (strategiesByKey[strategy.key]) {
          throw new Error(
            `More than one GraphqlQueryCache strategy with key "${strategy.key}"`
          );
        }
        strategiesByKey[strategy.key] = strategy;
      }
      // Make sure there isn't more than one strategy for the same query & type
      const id = this.cacheNameForStrategy(strategy);
      if (strategiesById[id]) {
        throw new Error(
          `More than one GraphqlQueryCache strategy of the same type for the same Query. ${id}`
        );
      }
      strategiesById[id] = strategy;
    }
    // Pull serialized configuration from localforage
    this.updateStrategyArgs();
    // Setup swr event listeners
    if ("serviceWorker" in navigator && apolloClient) {
      import("../../generated/graphql").then((graphql) => {
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
            const docs = (graphql as unknown) as {
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
      });
    }
  }

  /**
   * If cache is not enabled it will simply pass request through to fetch()
   * @returns Boolean
   */
  async isEnabled() {
    if (this.enabled !== undefined) {
      return this.enabled;
    } else {
      const enabled = await localforage.getItem(ENABLED_KEY);
      this.enabled = Boolean(
        enabled ||
          (process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE
            ? process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE.toUpperCase() ===
              "TRUE"
            : false)
      );
      return this.enabled;
    }
  }

  /**
   * Enable or disable the cache
   * @param enabled Boolean
   */
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localforage.setItem(ENABLED_KEY, enabled);
    if ("serviceWorker" in navigator) {
      ServiceWorkerWindow.updateGraphqlQueryCacheStrategyEnabled(enabled);
    }
  }

  /**
   * Restores active state from browser storage on initialization and when
   * notified that the cache in the main window changed it's settings
   */
  async restoreEnabledState() {
    this.enabled = Boolean(await localforage.getItem(ENABLED_KEY));
  }

  /**
   * Restores serialized state of complex strategies like `byArgs` from
   * localforage. Happens upon initialization and should also be called within
   * the service worker whenever a user changes setting from the main window
   */
  async updateStrategyArgs() {
    const allArgs = (await localforage.getItem(STRATEGY_ARGS_KEY)) as {
      [key: string]: string[];
    };
    for (const key in allArgs) {
      if (Boolean(this.strategies.find((s) => isByArgs(s) && s.key === key))) {
        this.strategyArgs[key] = allArgs[key];
      }
    }
  }

  /**
   * Retrieve the settings for a strategy identified by the `key` option
   *
   * @param key Key specified when constructing the strategy
   * @returns any
   */
  getStrategyArgs(key: string) {
    const strategy = this.strategies.find((s) => isByArgs(s) && s.key === key);
    if (!strategy) {
      throw new Error(`Could not find strategy with key=${key}`);
    }
    if (Array.isArray(this.strategyArgs[key])) {
      return this.strategyArgs[key].map((args) => JSON.parse(args));
    } else {
      return [];
    }
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
  async setStrategyArgs(key: string, values: any[]) {
    if (!Array.isArray(values)) {
      throw new Error("Values must be an array");
    }
    const strategy = this.strategies.find((s) => isByArgs(s) && s.key === key);
    if (!strategy) {
      throw new Error(`Could not find strategy with key=${key}`);
    }
    this.strategyArgs[key] = values.map((v) => canonicalStringify(v));
    await localforage.setItem(STRATEGY_ARGS_KEY, this.strategyArgs);
    if ("serviceWorker" in navigator) {
      ServiceWorkerWindow.updateGraphqlQueryCacheStrategyArgs();
    }
  }

  /**
   * Used by ServiceWorker to decide whether the cache should handle a fetch
   * request.
   * @param request Request
   * @returns
   */
  isGraphqlRequest(request: Request) {
    return request.method === "POST" && request.url === this.endpoint;
  }

  /**
   * Identifies strategies that apply to the given query and variables
   * @param operationName Query name
   * @param variables Variables as a plain json object (not a VariableDefinitionNode )
   * @returns Strategy[]
   */
  matchingStrategies(operationName: string, variables: any) {
    return this.strategies.filter((s) => {
      if (isByArgs(s)) {
        const strategyArgs = this.strategyArgs[s.key] || [];
        return (
          s.queryName === operationName &&
          strategyArgs.indexOf(canonicalStringify(variables)) !== -1
        );
      } else {
        return s.queryName === operationName;
      }
    });
  }

  /**
   * Can be used by event.respondWith in a ServiceWorker to intercept requests
   * and provide cached responses. In case the request does not match any known
   * strategies it will simply respond with an unmodified network fetch.
   *
   * If a strategy employs the swr flag, it will kick off the revalidation and
   * cache update process.
   *
   * @param url URL object (parsed in service worker fetch handler)
   * @param event FetchEvent
   * @returns Promise<Response>
   */
  async handleRequest(url: URL, event: FetchEvent): Promise<Response> {
    if (!(await this.isEnabled())) {
      return fetch(event.request);
    }
    const {
      operationName,
      variables,
      query,
    } = (await event.request.clone().json()) as {
      operationName: string;
      variables?: any;
      query: string;
    };
    const strategies = this.matchingStrategies(operationName, variables);
    if (strategies.length && query && query.slice(0, 5) === "query") {
      const cacheReq = this.makeCacheKey(operationName, variables);
      const cached = await this.matchCache(cacheReq, strategies);
      if (cached) {
        this.putToCaches(strategies, cacheReq, cached.clone());
        if (strategies.find((s) => s.swr === true)) {
          this.swr(event.request, cacheReq, variables, strategies);
        }
        return cached;
      } else {
        const response = await fetch(event.request);
        this.putToCaches(strategies, cacheReq, response.clone());
        return response;
      }
    } else {
      // If the request is a mutation, just pass it along normally
      return fetch(event.request);
    }
  }

  /**
   * Implements the revalidation component of stale-while-revalidate. SWR means
   * that first requests are responded to with cached data (if available), then
   * a request is made in the background to update the cache with the most up to
   * date information. The swr function running in ServiceWorker notifies the
   * main window client via postMessage when a cache has been revalidated, and
   * it will update the Apollo cache.
   *
   * Using swr means cached data is immediately displayed in the client, then
   * updated as soon as the revalidation request is fetched.
   *
   * @param request Original fetch request
   * @param cacheKey Request that acts as the cache key
   * @param variables Variables included in graphql request (as plain object)
   * @param strategies Array of impacted strategies
   */
  private async swr(
    request: Request,
    cacheKey: Request,
    variables: any,
    strategies: Strategy[]
  ) {
    const queryName = strategies[0].queryName;
    // 1) fetch in background
    const response = await fetch(request);
    if (response.ok) {
      // 2) update caches for each strategy (all with same query, regardless of swr flag)
      // make sure to await this operation so the cache is ready for
      await this.putToCaches(strategies, cacheKey, response);
      // 3) signal to main window that cache has been updated
      if (!("serviceWorker" in navigator) && self) {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({
            type: MESSAGE_TYPES.GRAPHQL_CACHE_REVALIDATION,
            queryName,
            variables,
          });
        }
        // 4) update apollo cache in main window...
        //    see postmessage handler in constructor
      }
    }
  }

  /**
   * For each given strategy, updates the cache with the latest response. Uses
   * `deleteAndPut` which effectively makes each cache an LRU queue.
   *
   * @param strategies Strategy[] Strategies to be updated
   * @param cacheReq Request that acts as a cache key
   * @param response Response from server
   * @returns
   */
  private async putToCaches(
    strategies: Strategy[],
    cacheReq: Request,
    response: Response
  ) {
    return Promise.all(
      strategies.map(async (strategy) => {
        const cache = await this.openCache(strategy);
        return this.deleteAndPut(cache, cacheReq, response);
      })
    ).then(() => {
      this.debouncedPruneCaches();
    });
  }

  // This will effectively make each cache an lru queue since
  // cache.keys() will order by insertion
  private async deleteAndPut(cache: Cache, req: Request, response: Response) {
    await cache.delete(req);
    await cache.put(req, response.clone());
  }

  private pruneCaches() {
    Promise.all(
      this.strategies.map(async (strategy) => {
        const cache = await this.openCache(strategy);
        const keys = await cache.keys();
        switch (strategy.type) {
          case "static":
            if (keys.length > 1) {
              keys.slice(0, keys.length - 2).forEach((k) => cache.delete(k));
            }
            break;
          case "lru":
            if (keys.length > strategy.limit) {
              keys
                .slice(0, keys.length - strategy.limit)
                .forEach((k) => cache.delete(k));
            }
            break;
          case "byArgs":
            // Do nothing. Stale items may hang around but they won't be matched
            break;
          default:
            break;
        }
      })
    );
  }

  /**
   * Happens after request handling, when caches have already been populated.
   * Used to make sure each cache is under any entry limits.
   */
  debouncedPruneCaches = debounce(this.pruneCaches, 500);

  /**
   * Returns the first cached response found in the given strategies. Use as
   * an alternative to `window.caches.match()` for a slight performance
   * advantage and to avoid access data from unrelated caches.
   *
   * @param req Request used as cache key
   * @param strategies Related strategies
   * @returns
   */
  private async matchCache(req: Request, strategies: Strategy[]) {
    for (const strategy of strategies) {
      const cache = await this.openCache(strategy);
      const match = await cache.match(req);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  /**
   * Returns a response that can act as a cache key for any strategy. The
   * original requests cannot be used since they use the POST method. Constructs
   * a request using a simple url composed of the query name + canonical
   * stringified form of the variables for uniqueness.
   *
   * @param operationName Query name
   * @param variables Query variables as a plain object
   * @returns Response
   */
  private makeCacheKey(operationName: string, variables: any) {
    let cacheKey = `${operationName}`;
    if (variables && Object.keys(variables).length) {
      cacheKey += `(${canonicalStringify(variables)})`;
    }
    return new Request(
      // eslint-disable-next-line i18next/no-literal-string
      `https://graphql-query-cache/${encodeURI(cacheKey)}`
    );
  }

  /**
   * Opens the cache for the given strategy
   * @param strategy Strategy
   * @returns Cache
   */
  private async openCache(strategy: Strategy) {
    return await caches.open(this.cacheNameForStrategy(strategy));
  }

  /**
   * Unique ID for the given strategy used to call `caches.open`
   * @param strategy Strategy
   * @returns String
   */
  cacheNameForStrategy(strategy: Strategy) {
    // eslint-disable-next-line i18next/no-literal-string
    return `graphql-query-cache-${strategy.queryName}-${strategy.type}`;
  }
}

/**
 * Type guard for byArgs strategy
 * @param strategy
 * @returns boolean
 */
function isByArgs(strategy: Strategy): strategy is ByArgsStrategy {
  return strategy.type === "byArgs";
}

/**
 * Static cache strategies will store a single cached response for a given query
 * Not particularly useful for queries that have variables, unless the same vars
 * are always used.
 *
 * @param query DocumentNode GraphQL query document
 * @param options.swr Boolean Whether to enable stale-while-revalidate for this cache
 * @returns
 */
export function staticStrategy(
  query: DocumentNode,
  options?: { swr?: boolean }
): StaticStrategy {
  options = options || { swr: false };
  options.swr = options.swr || false;
  return {
    type: "static",
    query,
    queryName: operationName(query),
    swr: options.swr,
  };
}

/**
 * Stores results of queries up to the given entry `limit`, after which the
 * least-recently-used entries will be removed to make space for new entries.
 *
 * Useful for working with queries that will be called with different variables
 *
 * @param query DocumentNode GraphQL query document
 * @param limit Integer Number of cache entries to store
 * @param options.swr Boolean Whether to enable stale-while-revalidate for this cache
 * @returns
 */
export function lruStrategy(
  query: DocumentNode,
  limit: number,
  options: { swr?: boolean }
): LRUStrategy {
  options = options || { swr: false };
  options.swr = options.swr || false;
  return {
    type: "lru",
    query,
    queryName: operationName(query),
    limit,
    swr: options.swr,
  };
}

/**
 * Caches the given query if variables match those set using `setStrategyArgs()`
 *
 * Example query:
 *
 * ```graphql
 * query ProjectBySlug($slug: String!) {
 *   projectBySlug(slug: $slug) {
 *     id
 *     name
 *   }
 * }
 * ```
 *
 * With following strategy you could cache certain projects for offline use.
 *
 * ```typescript
 *
 * const graphqlQueryCache = new GraphqlQueryCache("https://...", [
 *   byArgsStrategy(
 *     namedOperations.Query.ProjectsBySlug,
 *     "selected-offline-projects",
 *     {swr: true}
 *   );
 * ]);
 *
 * graphqlQueryCache.setStrategyArgs("selected-offline-projects", [
 *   {slug: "maldives"},
 *   {slug: "azores"}
 * ]);
 * ```
 *
 * In this way the user could be enabled to cache specific data they need for
 * offline use.
 *
 * @param query DocumentNode GraphQL query document
 * @param key String Used to identify strategy for providing arguments. Must be unique.
 * @param options.swr Boolean Whether to enable stale-while-revalidate for this cache
 * @returns
 */
export function byArgsStrategy(
  query: DocumentNode,
  key: string,
  options?: { swr?: boolean }
): ByArgsStrategy {
  options = options || { swr: false };
  options.swr = options.swr || false;
  return {
    type: "byArgs",
    query,
    queryName: operationName(query),
    key,
    swr: options.swr,
  };
}

/**
 * Extracts the first operation name from a given DocumentNode. Assumes only
 * a single operation per request, which is typical when using Apollo though
 * usage of plugins to consolidate queries into a single request would pose
 * problems.
 *
 * @param doc DocumentNode Graphql query document
 * @returns
 */
function operationName(doc: DocumentNode): string {
  const op = doc.definitions.find(
    (d: any) => d.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  if (op?.name) {
    return op.name.value;
  } else {
    throw new Error("Could not find OperationDefinition");
  }
}
