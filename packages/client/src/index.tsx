import "./wdyr";
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import "./i18n";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  split,
  ApolloLink,
  concat,
} from "@apollo/client";
import { createUploadLink } from "apollo-upload-client";
import { setContext } from "@apollo/client/link/context";
import { BrowserRouter as Router, useHistory } from "react-router-dom";
import {
  relayStylePagination,
  getMainDefinition,
} from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/client/link/ws";

function Auth0ProviderWithRouter(props: any) {
  const history = useHistory();
  return (
    <Auth0Provider
      {...props}
      onRedirectCallback={(appState) => {
        if (appState.returnTo) {
          history.replace(appState.returnTo);
        } else {
          history.replace("/");
        }
      }}
      scope="openid profile email permissions"
      cacheLocation="localstorage"
    >
      {props.children}
    </Auth0Provider>
  );
}

function ApolloProviderWithToken(props: any) {
  const auth = useAuth0();
  const httpLink = createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT!,
  });
  const authMiddleware = setContext(async (_, { headers }) => {
    // @ts-ignore
    const idClaims = await auth.getIdTokenClaims();

    const token = idClaims?.__raw || null;
    // get the authentication token from local storage if it exists
    // return the headers to the context so httpLink can read them
    return {
      headers: {
        ...headers,
        // eslint-disable-next-line
        authorization: token ? `Bearer ${token}` : "",
        "x-ss-slug": window.location.pathname.split("/")[1],
      },
    };
  });

  const wsLink = new WebSocketLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(/http/, "ws"),
    options: {
      reconnect: true,
      // lazy: true,
      connectionParams: async () => {
        const idClaims = await auth.getIdTokenClaims();
        const token = idClaims?.__raw || null;
        return {
          // eslint-disable-next-line i18next/no-literal-string
          Authorization: token ? `Bearer ${token}` : "",
          "x-ss-slug": window.location.pathname.split("/")[1],
        };
      },
    },
  });
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    concat(authMiddleware, httpLink)
  );
  const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    connectToDevTools: true,
  });
  return <ApolloProvider client={client}>{props.children}</ApolloProvider>;
}

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <Auth0ProviderWithRouter
        domain={process.env.REACT_APP_AUTH0_DOMAIN!}
        clientId={process.env.REACT_APP_AUTH0_CLIENT_ID!}
        redirectUri={`${window.location.origin}/authenticate`}
        cacheLocation="localstorage"
      >
        <ApolloProviderWithToken>
          <App />
        </ApolloProviderWithToken>
      </Auth0ProviderWithRouter>
    </Router>
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorkerRegistration.unregister();
