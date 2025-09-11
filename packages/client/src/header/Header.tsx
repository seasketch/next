import { useState, useEffect, useCallback, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import logo from "./seasketch-logo.png";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProfileContextMenu from "./ProfileContextMenu";
import ProfileControl from "./ProfileControl";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";

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
    to: "/partners",
    label: "Funders & Partners",
    id: "nav-partners",
  },
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

const featureLinks = [
  {
    to: "/uses/map-portal",
    label: "Map Portal",
    description:
      "Publish, explore, and share authoritative ocean data. Create a common picture of your ocean environment.",
    id: "nav-map-portal",
  },
  {
    to: "/uses/surveys",
    label: "Ocean Use Surveys",
    description: "Gather essential spatial data with Ocean Use Surveys",
    id: "nav-surveys",
  },
  {
    to: "/uses/planning",
    label: "Planning Tools",
    description:
      "Design and evaluate scenarios, including MPAs and Ocean Uses.",
    id: "nav-planning",
  },
];

export default function Header() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { t } = useTranslation("nav");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const hoverCloseTimeout = useRef<number | null>(null);
  const [openByKeyboard, setOpenByKeyboard] = useState(false);
  const firstFeatureRef = useRef<HTMLAnchorElement | null>(null);
  const featureItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const currentProjectQuery = useCurrentProjectMetadata();

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
    if (featuresOpen && openByKeyboard && firstFeatureRef.current) {
      firstFeatureRef.current.focus();
      setOpenByKeyboard(false);
    }
  }, [featuresOpen, openByKeyboard]);

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
                        onOpenChange={() => {}}
                      >
                        <Popover.Trigger asChild>
                          <button
                            className={`
                              inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-200
                              hover:text-white focus:outline-none focus-visible:ring-1
                              focus:text-white
                            `}
                            id={link.id}
                            aria-haspopup="menu"
                            aria-expanded={featuresOpen}
                            aria-controls="features-menu"
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" ||
                                e.key === " " ||
                                e.key === "ArrowDown"
                              ) {
                                e.preventDefault();
                                setFeaturesOpen(true);
                                setOpenByKeyboard(true);
                              } else if (e.key === "Escape") {
                                setFeaturesOpen(false);
                              }
                            }}
                            onMouseEnter={() => {
                              if (hoverCloseTimeout.current) {
                                window.clearTimeout(hoverCloseTimeout.current);
                                hoverCloseTimeout.current = null;
                              }
                              setFeaturesOpen(true);
                            }}
                            onMouseLeave={() => {
                              hoverCloseTimeout.current = window.setTimeout(
                                () => setFeaturesOpen(false),
                                120
                              );
                            }}
                          >
                            {link.label}
                            <ChevronDownIcon aria-hidden className="h-4 w-4" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            sideOffset={8}
                            align="start"
                            className="z-50 w-96 rounded-xl border border-white/10 bg-slate-900/85 p-2 shadow-md backdrop-blur-md ring-1 ring-white/10 focus:outline-none"
                            id="features-menu"
                            role="menu"
                            aria-labelledby={link.id}
                            onOpenAutoFocus={(e) => {
                              if (openByKeyboard) {
                                e.preventDefault();
                                requestAnimationFrame(() => {
                                  firstFeatureRef.current?.focus();
                                  setOpenByKeyboard(false);
                                });
                              }
                            }}
                            onEscapeKeyDown={() => setFeaturesOpen(false)}
                            onPointerDownOutside={() => setFeaturesOpen(false)}
                            onFocusOutside={() => setFeaturesOpen(false)}
                            onMouseEnter={() => {
                              if (hoverCloseTimeout.current) {
                                window.clearTimeout(hoverCloseTimeout.current);
                                hoverCloseTimeout.current = null;
                              }
                              setFeaturesOpen(true);
                            }}
                            onMouseLeave={() => {
                              hoverCloseTimeout.current = window.setTimeout(
                                () => setFeaturesOpen(false),
                                120
                              );
                            }}
                          >
                            <div className="grid">
                              {featureLinks.map((f, i) => (
                                <Link
                                  to={f.to}
                                  key={f.to}
                                  id={f.id}
                                  role="menuitem"
                                  className="group rounded-lg px-4 py-3 text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                  ref={(el) => {
                                    if (i === 0) firstFeatureRef.current = el;
                                    featureItemRefs.current[i] = el;
                                  }}
                                  onClick={() => {
                                    if (hoverCloseTimeout.current) {
                                      window.clearTimeout(
                                        hoverCloseTimeout.current
                                      );
                                      hoverCloseTimeout.current = null;
                                    }
                                    setFeaturesOpen(false);
                                  }}
                                  onKeyDown={(e) => {
                                    const items = featureItemRefs.current;
                                    const lastIndex = items.length - 1;
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const next = i === lastIndex ? 0 : i + 1;
                                      items[next]?.focus();
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const prev = i === 0 ? lastIndex : i - 1;
                                      items[prev]?.focus();
                                    } else if (e.key === "Home") {
                                      e.preventDefault();
                                      items[0]?.focus();
                                    } else if (e.key === "End") {
                                      e.preventDefault();
                                      items[lastIndex]?.focus();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      setFeaturesOpen(false);
                                    } else if (e.key === " ") {
                                      e.preventDefault();
                                      (
                                        e.currentTarget as HTMLAnchorElement
                                      ).click();
                                    }
                                  }}
                                >
                                  <div className="text-sm font-bold text-white">
                                    {f.label}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-300">
                                    {f.description}
                                  </div>
                                </Link>
                              ))}
                            </div>
                            {/* <Popover.Arrow className="fill-slate-900/95" /> */}
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    ) : (
                      <NavLink
                        key={link.to}
                        exact={link.to === "/"}
                        to={link.to}
                        className={`
                      px-3 py-2 rounded-md text-sm font-medium text-slate-200
                    hover:text-white  focus:outline-none focus-visible:ring-1
                    
                    `}
                        id={link.id}
                        activeClassName="bg-gray-900 text-white"
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
          {navigationLinks.map((link) => (
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
          ))}

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
