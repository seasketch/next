import {
  ProjectMetadataDocument,
  SurveyDocument,
} from "../../generated/queries";
import { DocumentNode, OperationDefinitionNode } from "graphql";

type StrategyBase = {
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

export const OFFLINE_SURVEYS_KEY = "selected-offline-surveys";

export const offlineSurveyChoiceStrategy = byArgsStrategy(
  SurveyDocument,
  OFFLINE_SURVEYS_KEY,
  {
    swr: true,
  }
);

export const surveyLRUStrategy = lruStrategy(SurveyDocument, 3, { swr: true });

export const strategies = [
  lruStrategy(ProjectMetadataDocument, 5, { swr: true }),
  surveyLRUStrategy,
  offlineSurveyChoiceStrategy,
];
