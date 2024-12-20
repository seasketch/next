import Warning from "../../components/Warning";
import { Trans } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "../../auth/JoinProject";

export default function SignInPrompt() {
  const { loginWithRedirect } = useAuth0();

  return (
    <Warning level="info">
      <Trans ns="forums">
        <button
          className="underline text-primary-500"
          onClick={() => {
            const hasSkippedJoinPrompt = localStorage.getItem(
              HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY
            );
            loginWithRedirect({
              appState: {
                returnTo:
                  hasSkippedJoinPrompt === "true"
                    ? window.location.pathname
                    : window.location.pathname + "?pj",
                promptToJoin: true,
              },
              authorizationParams: {
                redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
              },
            });
          }}
        >
          Sign in
        </button>{" "}
        or{" "}
        <button
          className="underline text-primary-500"
          onClick={() => {
            const hasSkippedJoinPrompt = localStorage.getItem(
              HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY
            );
            loginWithRedirect({
              appState: {
                returnTo:
                  hasSkippedJoinPrompt === "true"
                    ? window.location.pathname
                    : window.location.pathname + "?pj",
                promptToJoin: true,
              },
              authorizationParams: {
                screen_hint: "signup",
                redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
              },
            });
          }}
        >
          register
        </button>{" "}
        for an account to participate in the forum.
      </Trans>
    </Warning>
  );
}
