import { useContext } from "react";
import { createContext } from "react";
import { GraphqlQueryCache } from ".";

export default function useGraphqlQueryCache() {
  const cache = useContext(GraphqlQueryCacheContext);
  return cache;
}

export const GraphqlQueryCacheContext = createContext<GraphqlQueryCache | null>(
  null
);
