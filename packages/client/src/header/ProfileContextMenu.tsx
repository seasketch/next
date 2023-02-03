import React, { useContext } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";

export default function ProfileContextMenu(props?: { itemClassName?: string }) {
  const { user, logout } = useAuth0();
  const { t, i18n } = useTranslation(["nav"]);
  const cache = useContext(GraphqlQueryCacheContext);
  if (!user) {
    return null;
  }
  let social: string | false = false;
  if (user?.sub) {
    if (/twitter/.test(user.sub)) {
      social = "twitter";
    } else if (/google/.test(user.sub)) {
      social = "google";
    } else if (/github/.test(user.sub)) {
      social = "github";
    }
  }
  const id = `${user.email || user.name} ${social ? `(${social})` : ""}`;
  return (
    <>
      <div className="px-4 py-3">
        <p className="text-base md:text-sm leading-5">{t("Signed in as")}</p>
        <p
          title={id}
          className="text-base md:text-sm leading-8 md:leading-5 font-medium text-gray-900 truncate"
        >
          {id}
        </p>
      </div>
      <div className="border-t border-gray-100"></div>
      <div className="py-1">
        <Link
          to="/account-settings"
          className="block px-4 py-2 text-base md:text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
          role="menuitem"
        >
          {t("Account settings")}
        </Link>
        <a
          target="_blank"
          rel="nofollow"
          href="mailto:support@seasketch.org"
          className="block px-4 py-2 text-base md:text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
          role="menuitem"
        >
          {t("Contact support")}
        </a>
      </div>
      <div className="border-t border-gray-100"></div>
      <div className="py-1">
        <button
          type="submit"
          className="block w-full text-left px-4 py-2 text-base md:text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
          role="menuitem"
          onClick={() => {
            cache?.logout();
            logout({
              logoutParams: {
                returnTo:
                  window.location.protocol + "//" + window.location.host + "/",
              },
            });
          }}
        >
          {t("Sign out")}
        </button>
      </div>
    </>
  );
}
