/// <reference types="react-scripts" />
declare namespace NodeJS {
  interface ProcessEnv {
    //types of envs
    NODE_ENV: "development" | "production" | "test";
    REACT_APP_MAPBOX_ACCESS_TOKEN: string;
    REACT_APP_AUTH0_CLIENT_ID: string;
    REACT_APP_AUTH0_DOMAIN: string;
    REACT_APP_AUTH0_AUDIENCE: string;
    REACT_APP_AUTH0_SCOPE: string;
    REACT_APP_PUBLIC_URL: string;
    REACT_APP_GRAPHQL_ENDPOINT: string;
    REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT?: string;
  }
}
