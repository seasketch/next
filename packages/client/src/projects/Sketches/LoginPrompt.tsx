import { Trans } from "react-i18next";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "../../auth/JoinProject";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPrompt({ hidden }: { hidden?: boolean }) {
  const { loginWithRedirect } = useAuth0();

  return (
    <div style={{ display: hidden ? "none" : "block" }}>
      <h2 className="p-4">
        <Trans i18nKey={"SignInToSketch"} ns="sketching">
          Please{" "}
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
            sign in
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
            create an account
          </button>{" "}
          to start creating sketches.
        </Trans>
      </h2>
    </div>
  );
}
