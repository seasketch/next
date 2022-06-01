import { useApolloClient } from "@apollo/client";
import { useEffect, useState } from "react";
import { GraphqlQueryCache } from ".";
import { strategies } from "./strategies";

let Singleton: GraphqlQueryCache;

export default function useGraphqlQueryCache() {
  const client = useApolloClient();
  const [cache, setCache] = useState<GraphqlQueryCache>();
  useEffect(() => {
    if (client && !cache) {
      if (!Singleton) {
        Singleton = new GraphqlQueryCache(
          process.env.REACT_APP_GRAPHQL_ENDPOINT,
          strategies,
          client
        );
      }
      setCache(Singleton);
    }
  }, [client, cache]);
  return cache;
}
