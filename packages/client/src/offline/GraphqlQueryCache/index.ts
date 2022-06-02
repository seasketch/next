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

export class GraphqlQueryCache {
  endpoint: string;
  strategies: Strategy[];
  strategyArgs: { [key: string]: string[] } = {};
  apolloClient?: ApolloClient<any>;

  constructor(
    endpoint: string,
    strategies: Strategy[],
    apolloClient?: ApolloClient<any>
  ) {
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
      const id = this.idForStrategy(strategy);
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
              const cacheKey = this.makeCacheRequest(queryName, variables);
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

  isGraphqlRequest(request: Request) {
    return request.method === "POST" && request.url === this.endpoint;
  }

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

  async handleRequest(url: URL, event: FetchEvent): Promise<Response> {
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
      const cacheReq = this.makeCacheRequest(operationName, variables);
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
      }
      // 4) run query again from main window... see event handler in constructor
    }
  }

  // No need to await on this to return response, but response must be cloned
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

  debouncedPruneCaches = debounce(this.pruneCaches, 500);

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

  private makeCacheRequest(operationName: string, variables: any) {
    let cacheKey = `${operationName}`;
    if (variables && Object.keys(variables).length) {
      cacheKey += `(${canonicalStringify(variables)})`;
    }
    return new Request(
      // eslint-disable-next-line i18next/no-literal-string
      `https://graphql-query-cache/${encodeURI(cacheKey)}`
    );
  }

  private async openCache(strategy: Strategy) {
    return await caches.open(this.idForStrategy(strategy));
  }

  idForStrategy(strategy: Strategy) {
    // eslint-disable-next-line i18next/no-literal-string
    return `graphql-query-cache-${strategy.queryName}-${strategy.type}`;
  }
}

function isByArgs(strategy: Strategy): strategy is ByArgsStrategy {
  return strategy.type === "byArgs";
}

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
