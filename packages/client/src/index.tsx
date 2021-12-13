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
  concat,
} from "@apollo/client";
import { createUploadLink } from "apollo-upload-client";
import { setContext } from "@apollo/client/link/context";
import { BrowserRouter as Router, useHistory } from "react-router-dom";
import { getMainDefinition } from "@apollo/client/utilities";
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
      scope={process.env.REACT_APP_AUTH0_SCOPE}
      audience={process.env.REACT_APP_AUTH0_AUDIENCE}
      cacheLocation="localstorage"
      children={props.children}
    />
  );
}

function ApolloProviderWithToken(props: any) {
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const httpLink = createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT!,
  });

  const getToken = async () => {
    let token: string | null;
    const opts = {
      audience: process.env.REACT_APP_AUTH0_AUDIENCE,
      scope: process.env.REACT_APP_AUTH0_SCOPE,
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
        if (e.error === "consent_required") {
          token = await getAccessTokenWithPopup(opts);
        } else if (e.error === "login_required") {
          token = null;
        } else {
          console.error(e.error);
          throw e;
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
        // eslint-disable-next-line i18next/no-literal-string
        ...(token && token.length ? { authorization: `Bearer ${token}` } : {}),
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
        const token = await getAccessTokenSilently({
          audience: process.env.REACT_APP_AUTH0_AUDIENCE,
          scope: process.env.REACT_APP_AUTH0_SCOPE,
        });
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
