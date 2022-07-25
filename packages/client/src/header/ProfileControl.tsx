import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { ProfileStatusButton } from "./ProfileStatusButton";
import { useTranslation } from "react-i18next";
import ProfileContextMenu from "./ProfileContextMenu";

export default function ProfileControl() {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { loginWithRedirect } = useAuth0();
  const { t } = useTranslation(["nav"]);
  const handleDocumentClick = useCallback(
    () => setProfileModalOpen(false),
    [setProfileModalOpen]
  );

  useEffect(() => {
    if (profileModalOpen) {
      document.addEventListener("click", handleDocumentClick);
    }
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  });
  return (
    <div>
      <div className="hidden md:block">
        <div className="ml-4 flex items-center md:ml-6">
          <div className="ml-3 relative">
            <div>
              <ProfileStatusButton onClick={() => setProfileModalOpen(true)}>
                <button
                  title="Sign In"
                  onClick={() =>
                    loginWithRedirect({
                      appState: {
                        returnTo: window.location.pathname,
                      },
                      redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
                    })
                  }
                  className={`
                        px-3 py-2 rounded-md text-sm font-medium text-gray-300 
                      hover:text-white hover:bg-gray-700 focus:outline-none 
                      focus:text-white focus:bg-gray-700
                      `}
                >
                  {t("Sign In")}
                </button>
              </ProfileStatusButton>
            </div>
            <div
              className={`z-50 origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg ${
                profileModalOpen ? "" : "hidden"
              }`}
            >
              <div
                className="rounded-md bg-white ring-1 ring-black ring-opacity-5"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="options-menu"
              >
                <ProfileContextMenu />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
