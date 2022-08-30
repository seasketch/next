import { ApolloClient, useApolloClient } from "@apollo/client";
import { useAuth0 } from "@auth0/auth0-react";
import jwt from "jsonwebtoken";
import { useCallback, useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router";
import {
  ConfirmProjectInviteDocument,
  ConfirmProjectInviteMutationResult,
  ProjectInviteTokenClaims,
  VerifyProjectInviteDocument,
  VerifyProjectInviteQueryResult,
} from "../generated/graphql";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";

export enum IngressState {
  /** There was an error either decoding the token or verifying its signature */
  Error,
  /** Invite token expired */
  Expired,
  /** Token was already used and invite accepted */
  AlreadyAccepted,
  /** Waiting for server to verify the token signature */
  Verifying,
  /** Waiting for the server to confirm (accept) the invite */
  Confirming,
  /** Valid token, user is not logged in */
  LoggedOut,
  /** Valid token. User is logged in with the same canonical email as in the invite. In this case the invite should be immediately confirmed and the user logged in */
  LoggedInWithMatchingEmail,
  /** Valid token. User is logged in from an account with an email different from the invite (which could be intentional) */
  LoggedInWithDifferentEmail,
}

interface IngressFlowData {
  state: IngressState;
  error?: Error;
  tokenString?: string;
  claims?: ProjectInviteTokenClaims;
  /** Indicates an account exists in SeaSketch with a matching canonical email */
  accountExistsWithRecipientEmail?: boolean;
  signInAndConfirm: (ignoreCurrentEmail?: boolean) => void;
  registerAndConfirm: (ignoreCurrentEmail?: boolean) => void;
  confirmWithCurrentAccount: () => void;
}

/**
 * Manages the workflow for accepting a project invite as the user ingresses
 * from their email client. Tokens must be decoded on the client to determine
 * their claims, have their signature verified on the server, and ultimately the
 * invite may be confirmed if necessary conditions are satisfied.
 *
 * This flow is described in a diagram here:
 * https://github.com/seasketch/next/wiki/User-Ingress#project-invites
 *
 * @param tokenString project invite token, likely embedded in a query parameter
 */
export function useProjectInviteIngressFlow(): IngressFlowData {
  const [state, setState] = useState<{
    tokenString?: string;
    claims?: ProjectInviteTokenClaims;
    error?: Error;
    used?: boolean;
    state: IngressState;
  }>({
    state: IngressState.Verifying,
  });
  // First, setup client state by retrieving the token from the url search param
  // and decoding jwt
  const location = useLocation();
  const auth0 = useAuth0();
  const client = useApolloClient();
  const history = useHistory();

  const confirmWithCurrentAccount = useCallback(
    function () {
      const params = new URLSearchParams(location.search);
      const tokenString = params.get("token");
      if (!tokenString) {
        throw new Error("Token search param not found");
      }
      client
        .mutate({
          mutation: ConfirmProjectInviteDocument,
          variables: {
            token: tokenString,
          },
        })
        .then((results) => {
          const data = (results as ConfirmProjectInviteMutationResult).data;
          if (!data?.confirmProjectInvite?.projectSlug) {
            setState((prev) => ({
              ...prev,
              error: new Error(`Invalid response from server`),
              state: IngressState.Error,
            }));
          } else {
            history.replace(`/${data.confirmProjectInvite.projectSlug}/join`);
            // Note that our token isn't replaced so email verification claims
            // won't be updated
          }
        })
        .catch((e) => {
          setState((prev) => ({
            ...prev,
            error: e,
            state: IngressState.Error,
          }));
        });
    },
    [client, history, location.search]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenString = params.get("token");
    if (!tokenString?.length) {
      setState((prev) => ({
        ...prev,
        // eslint-disable-next-line i18next/no-literal-string
        error: new Error(`Search parameter "token" not found.`),
        state: IngressState.Error,
      }));
    } else {
      const claims = jwt.decode(tokenString) as ProjectInviteTokenClaims;
      if (!claims) {
        setState((prev) => ({
          ...prev,
          // eslint-disable-next-line i18next/no-literal-string
          error: new Error(`Could not parse invite token`),
          state: IngressState.Error,
        }));
      } else if (!claims.email) {
        setState((prev) => ({
          ...prev,
          claims,
          // eslint-disable-next-line i18next/no-literal-string
          error: new Error(`Missing email parameter in token`),
          state: IngressState.Error,
        }));
      } else if (!claims.projectName) {
        setState((prev) => ({
          ...prev,
          claims,
          // eslint-disable-next-line i18next/no-literal-string
          error: new Error(`Missing projectName parameter in token`),
          state: IngressState.Error,
        }));
      } else if (!claims.inviteId) {
        setState((prev) => ({
          ...prev,
          claims,
          // eslint-disable-next-line i18next/no-literal-string
          error: new Error(`Missing inviteId parameter in token`),
          state: IngressState.Error,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          claims,
          state: IngressState.Verifying,
          tokenString: tokenString,
        }));
        client
          .query({
            query: VerifyProjectInviteDocument,
            variables: {
              token: tokenString,
            },
          })
          .then((response) => {
            if (!response.data.verifyProjectInvite) {
              setState((prev) => ({
                ...prev,
                error: new Error(`Invalid response from server`),
                state: IngressState.Error,
              }));
            } else {
              const { error, existingAccount, claims } =
                (response as VerifyProjectInviteQueryResult).data
                  ?.verifyProjectInvite || {};
              if (error) {
                if (/expired/i.test(error)) {
                  // TODO: include project admin email as a recourse for user
                  setState((prev) => ({
                    ...prev,
                    state: IngressState.Expired,
                    accountExistsWithRecipientEmail: existingAccount,
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    error: new Error(error),
                    state: IngressState.Error,
                    accountExistsWithRecipientEmail: existingAccount,
                  }));
                }
              } else if (claims?.wasUsed) {
                setState((prev) => ({
                  ...prev,
                  state: IngressState.AlreadyAccepted,
                  accountExistsWithRecipientEmail: existingAccount,
                }));
              } else {
                if (
                  auth0.user &&
                  (auth0.user.email === claims?.email ||
                    /\/confirm?/.test(location.pathname))
                ) {
                  setState((prev) => {
                    return {
                      ...prev,
                      state: IngressState.Confirming,
                    };
                  });
                  confirmWithCurrentAccount();
                } else if (auth0.user) {
                  setState((prev) => ({
                    ...prev,
                    state: IngressState.LoggedInWithDifferentEmail,
                    accountExistsWithRecipientEmail: existingAccount,
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    state: IngressState.LoggedOut,
                    accountExistsWithRecipientEmail: existingAccount,
                  }));
                }
              }
            }
          })
          .catch((e) => {
            setState((prev) => ({
              ...prev,
              error: e,
              state: IngressState.Error,
            }));
          });
      }
    }
  }, [location, auth0.user, client, confirmWithCurrentAccount]);

  const cache = useContext(GraphqlQueryCacheContext);

  const redirectAndConfirm = (
    screenHint: "signup" | "signin",
    tokenString: string,
    ignoreCurrentEmail?: boolean
  ) => {
    cache?.logout();
    if (!state?.claims) {
      throw new Error("Decoded token not found");
    }
    auth0.loginWithRedirect({
      // eslint-disable-next-line i18next/no-literal-string
      appState: {
        projectInvite: state.claims,
        tokenString: state.tokenString,
      },
      screen_hint: screenHint,
      login_hint: ignoreCurrentEmail ? undefined : state.claims.email,
      // @ts-ignore
      // eslint-disable-next-line i18next/no-literal-string
      redirectUri: `${window.location.protocol}//${window.location.host}/auth/projectInvite/confirm?token=${tokenString}`,
      max_age: 0,
    });
  };

  return {
    ...state,
    signInAndConfirm: (ignoreCurrentEmail?: boolean) =>
      redirectAndConfirm("signin", state.tokenString!, ignoreCurrentEmail),
    registerAndConfirm: (ignoreCurrentEmail?: boolean) =>
      redirectAndConfirm("signup", state.tokenString!, ignoreCurrentEmail),
    confirmWithCurrentAccount,
  };
}
