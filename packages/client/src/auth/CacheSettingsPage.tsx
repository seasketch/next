/* eslint-disable i18next/no-literal-string */
import { useAuth0 } from "@auth0/auth0-react";
import { useOnlineState } from "beautiful-react-hooks";
import { Trans } from "react-i18next";
import Warning from "../components/Warning";
import { CacheSettingCards } from "../offline/ClientCacheSettingsCards";
import useIsSuperuser from "../useIsSuperuser";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "./JoinProject";

export default function CacheSettingsPage() {
  const isSuperuser = useIsSuperuser();
  const { user, loginWithRedirect } = useAuth0();
  const online = useOnlineState();
  return (
    // <CenteredCardListLayout>
    <div className="space-y-5">
      {online && !Boolean(user) && (
        <Warning level="info">
          <Trans>
            Offline cache settings can only be configured by signed in users.
            Please{" "}
            <button
              className="underline"
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
                    redirect_uri: `${window.location.protocol}//${window.location.host}/authenticate`,
                  },
                });
              }}
            >
              sign in
            </button>{" "}
            to adjust these settings.
          </Trans>
        </Warning>
      )}
      {!online && Boolean(user) && (
        <Warning>
          <Trans>These settings cannot be altered when offline.</Trans>
        </Warning>
      )}
      {Boolean(user) && (
        <>
          <CacheSettingCards
            className={
              !online ? "pointer-events-none opacity-50 select-none" : ""
            }
          />
        </>
      )}
    </div>
    // </CenteredCardListLayout>
  );
}
