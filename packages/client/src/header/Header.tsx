import React, { useState, useEffect, useCallback } from "react";
import logo from "./seasketch-logo.png";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation, Link, NavLink, useParams } from "react-router-dom";
import { ProfileStatusButton } from "./ProfileStatusButton";
import { useTranslation } from "react-i18next";
import ProfileContextMenu from "./ProfileContextMenu";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import ProfileControl from "./ProfileControl";

export default function Header() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const { t, i18n } = useTranslation(["nav"]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const currentProjectQuery = useCurrentProjectMetadataQuery();

  const handleDocumentClick = useCallback(() => setProfileModalOpen(false), [
    setProfileModalOpen,
  ]);

  useEffect(() => {
    if (profileModalOpen) {
      document.addEventListener("click", handleDocumentClick);
    }
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  });

  const navigationLinks = [
    {
      to: "/",
      label: t("About"),
      id: "nav-about"
    },
    {
      to: "/projects",
      label: t("Projects"),
      id: "nav-projects"
    },
    {
      to: "/api",
      label: t("Developer API"),
      id: "nav-api"
    },
    {
      to: "/team",
      label: t("Team"),
      id: "nav-team"
    },
  ];
  return (
    <nav className="bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {(
              <div className="flex-shrink-0 flex items-center text-lg text-gray-200 pr-4 mr-4 border-r border-gray-700">
                {/* <img
                  className="block h-10 mr-2"
                  style={{ width: 47 }}
                  src={logo}
                  alt={t("SeaSketch logo")}
                /> */}
                {currentProjectQuery.data?.currentProject?.name || ""}
              </div>
            )}
            <Link to="/">
              <div className="flex-shrink-0 flex items-center text-lg text-gray-200">
                <img
                  className="block h-10 mr-2"
                  style={{ width: 47, height: "auto" }}
                  src={logo}
                  alt={t("SeaSketch logo")}
                  id="seasketch-logo"
                />
                {
                  // eslint-disable-next-line
                }
                SeaSketch
              </div>
            </Link>
            <div className="hidden md:block">
              {(
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigationLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      exact={link.to === "/"}
                      to={link.to}
                      className={`
                      px-3 py-2 rounded-md text-sm font-medium text-gray-300
                    hover:text-white hover:bg-gray-700 focus:outline-none 
                    focus:text-white focus:bg-gray-700
                    `}
                      id={link.id}
                      activeClassName="bg-gray-900 text-white"
                      activeStyle={{ color: "white" }}
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ProfileControl />
          { <div className="-mr-2 flex md:hidden">
            {/*<!-- Mobile menu button -->*/}
            <button
              onClick={() => setProfileModalOpen(true)}
              className={`
              inline-flex items-center justify-center p-2 rounded-md 
            text-gray-400 hover:text-white hover:bg-gray-700 
              focus:outline-none focus:bg-gray-700 focus:text-white
            `}
              id="collapsed-nav"
            >
              {/*<!-- Menu open: "hidden", Menu closed: "block" -->*/}
              <svg
                className="block h-6 w-6"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/*<!-- Menu open: "block", Menu closed: "hidden" -->*/}
              <svg
                className="hidden h-6 w-6"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div> }
        </div>
      </div>
      { <div
        className={`${
          profileModalOpen ? "md:hidden" : "hidden"
        } bg-white absolute top left w-full h-full pt-2`}
      >
        {navigationLinks.map((link) => (
            <NavLink
              key={link.to}
              exact={link.to === "/"}
              to={link.to}
              className={`block w-full text-left px-4 py-2 text-base leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900 font-semibold
                    `}
            >
              {link.label}
            </NavLink>
          ))}

        {(
          <div className="border-t border-gray-100 mt-2"></div>
        )}

        {isAuthenticated ? (
          <ProfileContextMenu itemClassName="text-base" />
        ) : (
          
          <button
            type="submit"
            className="block w-full text-left px-4 py-2 text-base md:text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
            role="menuitem"
            onClick={() =>
              loginWithRedirect({
                appState: {
                  returnTo: window.location.pathname,
                },
                redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
              })
            }
          >
            {t("Sign in")}
          </button>
        )}
      </div> }
    </nav>
  );
}
