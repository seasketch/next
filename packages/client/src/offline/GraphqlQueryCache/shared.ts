import { canonicalStringify } from "@apollo/client/cache";
import { DocumentNode, OperationDefinitionNode } from "graphql";
import localforage from "localforage";

export type StrategyBase = {
  query: DocumentNode;
  queryName: string;
  swr?: boolean;
};

export type StaticStrategy = {
  type: "static";
} & StrategyBase;

export type LRUStrategy = {
  type: "lru";
  limit: number;
} & StrategyBase;

export type ByArgsStrategy = {
  type: "byArgs";
  key: string;
} & StrategyBase;

export type Strategy = StaticStrategy | LRUStrategy | ByArgsStrategy;

export const STRATEGY_ARGS_KEY = `graphql-query-cache-strategy-args`;
export const ENABLED_KEY = `graphql-query-cache-enabled`;

export function enabledByDefault() {
  return process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT
    ? process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT.toUpperCase() !==
        "FALSE"
    : true;
}

export async function isEnabled() {
  const enabled = await localforage.getItem<boolean>(ENABLED_KEY);
  return enabled || enabledByDefault();
}

export abstract class GraphqlQueryCacheCommon {
  endpoint: string;
  strategies: Strategy[];
  strategyArgs: { [key: string]: string[] } = {};
  strategyArgsWereInitialized = false;
  protected enabled?: boolean;
  cachePruningDebounceInterval = process.env.NODE_ENV === "test" ? 1 : 500;

  constructor(endpoint: string, strategies: Strategy[]) {
    this.restoreEnabledState();
    this.endpoint = endpoint;
    this.strategies = strategies;
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
  }

  /**
   * Restores active state from browser storage on initialization and when
   * notified that the cache in the main window changed it's settings
   */
  async restoreEnabledState() {
    this.enabled =
      (await localforage.getItem<boolean>(ENABLED_KEY)) ||
      this.enabledByDefault;
  }

  get enabledByDefault() {
    return enabledByDefault();
  }

  /**
   * If cache is not enabled it will simply pass request through to fetch()
   * @returns Boolean
   */
  async isEnabled() {
    if (this.enabled !== undefined) {
      return this.enabled;
    } else {
      this.enabled = await isEnabled();
      return this.enabled;
    }
  }

  /**
   * Enable or disable the cache
   * @param enabled Boolean
   */
  protected async _setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localforage.setItem(ENABLED_KEY, enabled);
  }

  abstract setEnabled(enabled: boolean): Promise<void>;

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
    this.strategyArgsWereInitialized = true;
  }

  /**
   * Unique ID for the given strategy used to call `caches.open`
   * @param strategy Strategy
   * @returns String
   */
  cacheNameForStrategy(strategy: Strategy) {
    // eslint-disable-next-line i18next/no-literal-string
    return `${process.env.JEST_WORKER_ID || ""}graphql-query-cache-${
      strategy.queryName
    }-${strategy.type}`;
  }

  async getCacheStatus(queryName: string, variables: any) {
    return !!(await this.getCachedResponse(queryName, variables));
  }

  async getCachedResponse(queryName: string, variables: any) {
    const cacheKey = await this.makeCacheKey(queryName, variables);
    return this.matchCache(cacheKey, this.strategies);
  }

  /**
   * Opens the cache for the given strategy
   * @param strategy Strategy
   * @returns Cache
   */
  protected async openCache(strategy: Strategy) {
    return await caches.open(this.cacheNameForStrategy(strategy));
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
  protected makeCacheKey(operationName: string, variables: any) {
    let cacheKey = `${operationName}`;
    if (variables && Object.keys(variables).length) {
      cacheKey += canonicalStringify(variables).replaceAll(/[^\w\d]/g, "-");
    }
    return new Request(
      // eslint-disable-next-line i18next/no-literal-string
      `https://graphql-query-cache/${encodeURI(cacheKey)}${
        process.env.JEST_WORKER_ID || ""
      }`
    );
  }

  /**
   * Returns the first cached response found in the given strategies. Use as
   * an alternative to `window.caches.match()` for a slight performance
   * advantage and to avoid access data from unrelated caches.
   *
   * @param req Request used as cache key
   * @param strategies Related strategies
   * @returns
   */
  protected async matchCache(req: Request, strategies: Strategy[]) {
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
   * Purges caches for all strategies. Use for user signout
   */
  clear() {
    return Promise.all(
      this.strategies.map(async (strategy) => {
        const cacheName = this.cacheNameForStrategy(strategy);
        if (process.env.NODE_ENV === "test") {
          const cache = await caches.open(cacheName);
          for (const k of await cache.keys()) {
            await cache.delete(k);
          }
        }
        return caches.delete(cacheName);
      })
    );
  }

  /**
   * Retrieve the settings for a strategy identified by the `key` option
   *
   * @param key Key specified when constructing the strategy
   * @returns any
   */
  async getStrategyArgs(key: string) {
    if (!this.strategyArgsWereInitialized) {
      await this.updateStrategyArgs();
    }
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
  protected async _setStrategyArgs(key: string, values: any[]) {
    if (!Array.isArray(values)) {
      throw new Error("Values must be an array");
    }
    const strategy = this.strategies.find((s) => isByArgs(s) && s.key === key);
    if (!strategy) {
      throw new Error(`Could not find strategy with key=${key}`);
    }
    this.strategyArgs[key] = values.map((v) => canonicalStringify(v));
    await localforage.setItem(STRATEGY_ARGS_KEY, this.strategyArgs);
  }

  abstract setStrategyArgs(key: string, values: any[]): Promise<void>;
}

/**
 * Type guard for byArgs strategy
 * @param strategy
 * @returns boolean
 */
export function isByArgs(strategy: Strategy): strategy is ByArgsStrategy {
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
  options?: { swr?: boolean }
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
