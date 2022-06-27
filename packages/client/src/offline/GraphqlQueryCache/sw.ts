import { canonicalStringify } from "@apollo/client/cache";
import { DocumentNode } from "graphql";
import localforage from "localforage";
import debounce from "lodash.debounce";
import { MESSAGE_TYPES } from "../ServiceWorkerWindow";
import { GraphqlQueryCacheCommon, isByArgs, Strategy } from "./shared";

// TODO: clear cache on logout

declare const self: ServiceWorkerGlobalScope;

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
  cachePruningDebounceInterval = process.env.NODE_ENV === "test" ? 1 : 500;

  constructor(endpoint: string, strategies: Strategy[]) {
    super(endpoint, strategies);
    this.restoreEnabledState();
  }

  setStrategyArgs(key: string, values: any[]) {
    return this._setStrategyArgs(key, values);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this._setEnabled(enabled);
  }

  /**
   * Used by ServiceWorker to decide whether the cache should handle a fetch
   * request.
   * @param request Request
   * @returns
   */
  isGraphqlRequest(request: Request) {
    console.warn(request.url, this.endpoint);
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
    if (event.request.headers.get("content-type") !== "application/json") {
      // multipart form data mutation or query
      return fetch(event.request);
    }
    const { operationName, variables, query } = (await event.request
      .clone()
      .json()) as {
      operationName: string;
      variables?: any;
      query: string;
    };
    const strategies = this.matchingStrategies(operationName, variables);
    if (strategies.length && query && query.trim().slice(0, 5) === "query") {
      const cacheReq = this.makeCacheKey(operationName, variables);
      const cached = await this.matchCache(cacheReq, strategies);
      if (cached) {
        this.putToCaches(strategies, cacheReq, cached.clone()).then(() => {
          if (strategies.find((s) => s.swr === true)) {
            this.swr(event.request, cacheReq, variables, strategies);
          }
        });
        return cached;
      } else {
        const response = await fetch(event.request);
        this.putToCaches(strategies, cacheReq, response.clone());
        return response;
      }
    } else {
      try {
        // If an unrelated operation, just pass it along normally
        const response = await fetch(event.request);
        return response;
      } catch (e) {
        // This is will fail only due to a network error, such as being offline
        // or a CORS issue
        // TODO: notify client they could be offline
        return new Response("Failed to fetch", { status: 500 });
      }
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
    try {
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
    } catch (e) {
      // Not necessary to do anything if offline
      // TODO: consider notifying the related client that the user may be
      // offline, or if it's a server error show a toast message
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
    ).then(this.debouncedPruneCaches);
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
  private debouncedPruneCaches = debounce(
    this.pruneCaches,
    this.cachePruningDebounceInterval,
    { maxWait: this.cachePruningDebounceInterval }
  ).bind(this);

  /**
   * It would be pretty bad if the app sent a graphql query for certain data,
   * then received a cache that didn't match that query. Don't let that happen!
   *
   * This doesn't need to be checked all the time. It should just be called
   * within the service worker's install event.
   */
  async invalidateChangedQuerySchemas() {
    let changes = false;
    const cacheKey = "graphql-query-cache-query-hashes";
    const hashes =
      (await localforage.getItem<{ [id: string]: number }>(cacheKey)) || {};
    for (const strategy of this.strategies) {
      const id = this.cacheNameForStrategy(strategy);
      const str = getGqlString(strategy.query);
      if (!str) {
        throw new Error("Could not stringify graphql query");
      }
      const hash = hashCode(str);
      if (hashes[id] !== hash) {
        console.warn(
          `caches for ${id} must be invalidated due to query change`
        );
        hashes[id] = hash;
        caches.delete(id);
        changes = true;
      }
    }
    if (changes) {
      await localforage.setItem(cacheKey, hashes);
    }
  }
}

function getGqlString(doc: DocumentNode) {
  return doc.loc && doc.loc.source.body;
}

/**
 * Returns a hash code from a string
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
