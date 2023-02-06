import "./wdyr";
import React, { Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./i18n";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  split,
  concat,
  NormalizedCacheObject,
} from "@apollo/client";
import { createUploadLink } from "apollo-upload-client";
import { setContext } from "@apollo/client/link/context";
import { Router, useHistory } from "react-router-dom";
import { getMainDefinition } from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/client/link/ws";
import Spinner from "./components/Spinner";
import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";
import { createBrowserHistory } from "history";
import SW from "./offline/ServiceWorkerWindow";
import { GraphqlQueryCache } from "./offline/GraphqlQueryCache/main";
import { strategies } from "./offline/GraphqlQueryCache/strategies";
import { GraphqlQueryCacheContext } from "./offline/GraphqlQueryCache/useGraphqlQueryCache";
import { OfflineStateDetector } from "./offline/OfflineStateContext";
import { onError } from "@apollo/client/link/error";
import { DialogProvider } from "./components/useDialog";

const history = createBrowserHistory();

const loadingFallback = (
  <div
    style={{ height: "100vh" }}
    className="w-full flex min-h-full h-96 justify-center text-center align-middle items-center content-center justify-items-center place-items-center place-content-center"
  >
    <Spinner />
  </div>
);

export class GraphqlNetworkErrorEventTarget extends EventTarget {
  handleError(e: Error) {
    this.dispatchEvent(new Event("GraphqlNetworkError"));
  }
}

const errorTarget = new GraphqlNetworkErrorEventTarget();

if (process.env.REACT_APP_SENTRY_DSN && process.env.REACT_APP_BUILD) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    release: process.env.REACT_APP_BUILD || "dev",
    environment: process.env.REACT_APP_BUILD ? "production" : "development",
    integrations: [
      new Integrations.BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV5Instrumentation(history),
      }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
}

function Auth0ProviderWithRouter(props: any) {
  const history = useHistory();
  return (
    <Auth0Provider
      onRedirectCallback={(appState) => {
        if (appState?.returnTo) {
          history.replace(appState.returnTo);
        } else {
          if (!/projectInvite/.test(window.location.pathname)) {
            history.replace("/");
          }
        }
      }}
      domain={process.env.REACT_APP_AUTH0_DOMAIN!}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID!}
      authorizationParams={{
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        redirect_uri: `${window.location.origin}/authenticate`,
        scope: process.env.REACT_APP_AUTH0_SCOPE,
      }}
      cacheLocation="localstorage"
      children={props.children}
      useRefreshTokens={true}
    />
  );
}

function ApolloProviderWithToken(props: any) {
  const { getAccessTokenSilently, getAccessTokenWithPopup, logout, user } =
    useAuth0();
  const [client, setClient] =
    useState<ApolloClient<NormalizedCacheObject> | null>(null);
  const [graphqlQueryCache, setGraphqlQueryCache] =
    useState<GraphqlQueryCache>();

  const httpLink = createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT!,
  });

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (networkError) {
      errorTarget.handleError(networkError);
    }
  });

  const getToken = async () => {
    let token: string | null | undefined;
    const opts = {
      authorizationParams: {
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        scope: process.env.REACT_APP_AUTH0_SCOPE,
      },
    };
    if ("Cypress" in window) {
      token = window.localStorage.getItem(
        // eslint-disable-next-line i18next/no-literal-string
        `@@auth0spajs@@::${process.env.REACT_APP_AUTH0_CLIENT_ID!}::${
          process.env.REACT_APP_AUTH0_AUDIENCE
        }::${process.env.REACT_APP_AUTH0_SCOPE!}`
      );
      console.warn("using token from cypress", { token });
    } else {
      try {
        token = await getAccessTokenSilently(opts);
      } catch (e) {
        console.error(e);
        if (e.error === "missing_refresh_token") {
          token = null;
          if (user) {
            logout({
              logoutParams: {
                returnTo: window.location.origin,
              },
            });
          }
        } else if (e.error === "consent_required") {
          token = await getAccessTokenWithPopup(opts);
        } else if (e.error === "login_required") {
          token = null;
        } else if (e.error === "missing_refresh_token") {
          token = null;
        } else {
          console.error(e.error);
          token = null;
        }
      }
    }
    return token;
  };

  const authMiddleware = setContext(async (_, { headers }) => {
    const token = await getToken();
    return {
      headers: {
        ...headers,
        ...(token && token.length
          ? // eslint-disable-next-line i18next/no-literal-string
            { authorization: `Bearer ${token}` }
          : {}),
        "x-ss-slug": window.location.pathname.split("/")[1],
      },
    };
  });

  const wsLink = new WebSocketLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(/http/, "ws"),
    options: {
      reconnect: true,
      lazy: true,
      connectionParams: async () => {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE,
            scope: process.env.REACT_APP_AUTH0_SCOPE,
          },
        });
        return {
          // eslint-disable-next-line i18next/no-literal-string
          Authorization: token ? `Bearer ${token}` : "",
          "x-ss-slug": window.location.pathname.split("/")[1],
        };
      },
    },
  });

  useEffect(() => {
    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      concat(authMiddleware, concat(errorLink, httpLink))
    );

    async function init() {
      const cache = new InMemoryCache({
        typePolicies: {
          Profile: {
            keyFields: ["userId"],
          },
          DataUploadTasks: {
            keyFields: ["id"],
          },
          Project: {
            fields: {
              myFolders: {
                merge(existing = [], incoming: any[]) {
                  return incoming;
                },
              },
              mySketches: {
                merge(existing = [], incoming: any[]) {
                  return incoming;
                },
              },
            },
          },
        },
      });

      const apolloClient = new ApolloClient({
        link: splitLink,
        cache: cache,
        connectToDevTools: process.env.NODE_ENV === "development",
      });
      setClient(apolloClient);
      setGraphqlQueryCache(
        new GraphqlQueryCache(
          process.env.REACT_APP_GRAPHQL_ENDPOINT,
          strategies,
          apolloClient
        )
      );
    }

    init().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (client && graphqlQueryCache) {
    return (
      <ApolloProvider client={client}>
        <GraphqlQueryCacheContext.Provider value={graphqlQueryCache}>
          {props.children}
        </GraphqlQueryCacheContext.Provider>
      </ApolloProvider>
    );
  } else {
    return loadingFallback;
  }
}

ReactDOM.render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div
          style={{ height: "100vh" }}
          className="w-full flex min-h-full h-96 justify-center text-center align-middle items-center content-center justify-items-center place-items-center place-content-center"
        >
          <Spinner />
        </div>
      }
    >
      <OfflineStateDetector graphqlErrorTarget={errorTarget}>
        <Router history={history}>
          <Auth0ProviderWithRouter>
            <ApolloProviderWithToken>
              <DialogProvider>
                <App />
              </DialogProvider>
            </ApolloProviderWithToken>
          </Auth0ProviderWithRouter>
        </Router>
      </OfflineStateDetector>
    </Suspense>
  </React.StrictMode>,
  document.getElementById("root")
);

async function checkBuild(event: string) {
  const build = await SW.getSWBuild();
  if (
    process.env.NODE_ENV === "production" &&
    build !== process.env.REACT_APP_BUILD
  ) {
    // eslint-disable-next-line i18next/no-literal-string
    Sentry.captureMessage(`Client and ServiceWorker builds do not match`, {
      extra: {
        SWBuild: build,
        ClientBuild: process.env.REACT_APP_BUILD,
        event,
      },
    });
  }
}

serviceWorkerRegistration.register({
  onSuccess: async (registration) => {
    checkBuild("onSuccess");
  },
  onUpdate: (registration) => {
    checkBuild("onUpdate");
  },
});
