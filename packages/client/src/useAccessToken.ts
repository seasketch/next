import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export default function useAccessToken() {
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const [state, setState] = useState<string | null>();
  useEffect(() => {
    const opts = {
      audience: process.env.REACT_APP_AUTH0_AUDIENCE,
      scope: process.env.REACT_APP_AUTH0_SCOPE,
    };
    let token: string | null = null;
    if ("Cypress" in window) {
      token = window.localStorage.getItem(
        // eslint-disable-next-line i18next/no-literal-string
        `@@auth0spajs@@::${process.env.REACT_APP_AUTH0_CLIENT_ID!}::${
          process.env.REACT_APP_AUTH0_AUDIENCE
        }::${process.env.REACT_APP_AUTH0_SCOPE!}`
      );
      setState(token);
    } else {
      getAccessTokenSilently(opts)
        .then((token) => {
          setState(token);
        })
        .catch((e) => {
          if (e.error === "consent_required") {
            getAccessTokenWithPopup(opts).then((token) => {
              setState(token);
            });
          } else if (e.error === "login_required") {
            setState(null);
          } else {
            console.error(e.error);
            // Don't throw an uncaught error here as it might upset offline use
            // throw e;
          }
        });
    }
  }, [getAccessTokenSilently, getAccessTokenWithPopup, setState]);
  return state;
}
