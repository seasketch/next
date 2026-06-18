import { useState, useEffect, useCallback, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import logo from "./seasketch-logo.png";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProfileContextMenu from "./ProfileContextMenu";
import ProfileControl from "./ProfileControl";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { useCaseLinks } from "../homepage/useCases";

const navigationLinks = [
  {
    to: "/projects",
    label: "Projects",
    id: "nav-projects",
  },
  {
    to: "/features",
    label: "Features",
    id: "nav-features",
  },
  {
    to: "/case-studies",
    label: "Case Studies",
    id: "nav-case-studies",
  },
  // {
  //   to: "/#funders",
  //   label: "Funders & Partners",
  //   id: "nav-partners",
  // },
  {
    to: "/team",
    label: "Team",
    id: "nav-team",
  },
  // {
  //   to: "/api",
  //   label: t("Developer API"),
  //   id: "nav-api",
  // },
  // {
  //   to: "/team",
  //   label: t("Team"),
  //   id: "nav-team",
  // },
];

export default function Header() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { t } = useTranslation("nav");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const hoverCloseTimeout = useRef<number | null>(null);
  const currentProjectQuery = useCurrentProjectMetadata();
  const location = useLocation();

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

  useEffect(() => {
    if (hoverCloseTimeout.current) {
      window.clearTimeout(hoverCloseTimeout.current);
    }
    setFeaturesOpen(false);
  }, [location.pathname, location.hash]);

  const openFeaturesMenu = () => {
    if (hoverCloseTimeout.current) {
      window.clearTimeout(hoverCloseTimeout.current);
    }
    setFeaturesOpen(true);
  };

  const scheduleFeaturesMenuClose = () => {
    if (hoverCloseTimeout.current) {
      window.clearTimeout(hoverCloseTimeout.current);
    }
    hoverCloseTimeout.current = window.setTimeout(() => {
      setFeaturesOpen(false);
    }, 100);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {
              <div className="flex-shrink-0 flex items-center text-lg text-gray-200 pr-4 mr-4 border-r border-gray-700">
                {/* <img
                  className="block h-10 mr-2"
                  style={{ width: 47 }}
                  src={logo}
                  alt={t("SeaSketch logo")}
                /> */}
                {currentProjectQuery.data?.project?.name || ""}
              </div>
            }
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
              {
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigationLinks.map((link) =>
                    link.to === "/features" ? (
                      <Popover.Root
                        key={link.to}
                        open={featuresOpen}
                        onOpenChange={setFeaturesOpen}
                      >
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            onMouseEnter={openFeaturesMenu}
                            onMouseLeave={scheduleFeaturesMenuClose}
                            className={`
                              inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-200
                              hover:text-white focus:outline-none focus-visible:ring-1
                            `}
                            id={link.id}
                          >
                            {link.label}
                            <ChevronDownIcon aria-hidden className="h-4 w-4" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            align="start"
                            sideOffset={8}
                            onCloseAutoFocus={(event) => event.preventDefault()}
                            onMouseEnter={openFeaturesMenu}
                            onMouseLeave={scheduleFeaturesMenuClose}
                            className="z-30 w-80 rounded-2xl bg-slate-900 p-5 text-slate-100 shadow-xl focus:outline-none"
                          >
                            <h2 className="text-base font-semibold text-sky-200">
                              What can SeaSketch do?
                            </h2>
                            <div className="mt-4 space-y-1">
                              {useCaseLinks.map((feature) => (
                                <Link
                                  key={feature.to}
                                  to={feature.to}
                                  id={`nav-${feature.id}`}
                                  onClick={() => setFeaturesOpen(false)}
                                  className="block rounded-xl px-3 py-2 hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
                                >
                                  <span className="block text-sm font-medium text-white">
                                    {feature.navLabel}
                                  </span>
                                  <span className="mt-1 block text-xs leading-5 text-slate-300">
                                    {feature.summary}
                                  </span>
                                </Link>
                              ))}
                            </div>
                            <Popover.Arrow className="fill-slate-900" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    ) : (
                      <NavLink
                        key={link.to}
                        exact={link.to === "/"}
                        to={link.to}
                        onClick={() => {
                          window.scrollTo(0, 0);
                        }}
                        className={`
                      px-3 py-2 rounded-md text-sm font-medium text-slate-200
                    hover:text-white  focus:outline-none focus-visible:ring-1
                    
                    `}
                        id={link.id}
                        activeStyle={{ color: "white" }}
                      >
                        {link.label}
                      </NavLink>
                    )
                  )}
                </div>
              }
            </div>
          </div>
          <ProfileControl />
          {
            <div className="-mr-2 flex md:hidden">
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
            </div>
          }
        </div>
      </div>
      {
        <div
          className={`${
            profileModalOpen ? "md:hidden" : "hidden"
          } bg-white absolute top left w-full h-content shadow-xl z-10 pt-2`}
        >
          {navigationLinks.map((link) =>
            link.to === "/features" ? (
              <div key={link.to}>
                <a
                  href="/#use-cases"
                  id={`modal-` + link.id}
                  className={`block w-full text-left px-4 py-2 text-base leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900 font-semibold`}
                >
                  {link.label}
                </a>
                {useCaseLinks.map((feature) => (
                  <NavLink
                    key={feature.to}
                    to={feature.to}
                    id={`modal-nav-${feature.id}`}
                    className={`block w-full text-left px-8 py-2 text-sm leading-5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900`}
                  >
                    {feature.navLabel}
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink
                key={link.to}
                exact={link.to === "/"}
                to={link.to}
                id={`modal-` + link.id}
                className={`block w-full text-left px-4 py-2 text-base leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900 font-semibold
                    `}
              >
                {link.label}
              </NavLink>
            )
          )}

          {<div className="border-t border-gray-100 mt-2"></div>}

          {isAuthenticated && currentProjectQuery.data?.me?.id ? (
            <ProfileContextMenu itemClassName="text-base" />
          ) : (
            <button
              type="submit"
              className="block w-full text-left px-4 py-2 text-base md:text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
              role="menuitem"
              id="modal-sign-in"
              onClick={() =>
                loginWithRedirect({
                  appState: {
                    returnTo: window.location.pathname,
                  },

                  authorizationParams: {
                    redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
                  },
                })
              }
            >
              {t("Sign in")}
            </button>
          )}
        </div>
      }
    </header>
  );
}
