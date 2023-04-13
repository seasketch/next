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
    CYPRESS_BASE_URL?: string;
    REACT_APP_GRAPHQL_ENDPOINT: string;
    REACT_APP_CLOUDFRONT_DOCS_DISTRO: string;
    REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT?: string;
    REACT_APP_SENTRY_ENV?: string;
    REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT: string;
  }
}
