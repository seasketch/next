import React, { useState, useEffect, useMemo, useContext } from "react";
import { useParams, NavLink, Redirect, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ProfileStatusButton } from "../header/ProfileStatusButton";
import { Trans } from "react-i18next";
import AdminMobileHeader, {
  AdminMobileHeaderState,
  AdminMobileHeaderContext,
} from "./AdminMobileHeaderContext";
import { useAuth0 } from "@auth0/auth0-react";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { ParticipationStatus } from "../generated/graphql";
import useDialog from "../components/useDialog";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";
import LanguageSelector from "../surveys/LanguageSelector";
import TranslateIcon from "@heroicons/react/outline/TranslateIcon";
import { useLocalStorage } from "beautiful-react-hooks";
import { BookOpenIcon } from "@heroicons/react/outline";
import { GlobeIcon } from "@radix-ui/react-icons";
import AdminRouter from "./AdminRouter";

interface Section {
  breadcrumb: string;
  icon: React.ReactNode;
  path: string;
  new?: boolean;
}

const iconClassName =
  "mr-3 h-6 w-6 text-primary-300  transition ease-in-out duration-150";

export default function AdminApp() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useCurrentProjectMetadata();
  const { alert } = useDialog();

  const history = useHistory();
  const { t } = useTranslation("admin");

  useEffect(() => {
    if (
      data?.project?.sessionParticipationStatus &&
      data?.project?.sessionParticipationStatus !==
        ParticipationStatus.ParticipantSharedProfile
    ) {
      alert(t("The admin dashboard is limited to project participants"), {
        description: t(
          "You must join the project and share a profile to enable admin privileges."
        ),
      }).then(() => {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/join?redirectUrl=${window.location.pathname}`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project?.sessionParticipationStatus, alert, slug]);

  const sections: Section[] = [
    {
      breadcrumb: t("Back to Project"),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={iconClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
          />
        </svg>
      ),
      path: "/app",
    },

    {
      breadcrumb: t("Settings"),
      icon: (
        <svg
          className={iconClassName}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
      ),
      path: "/admin",
    },
    {
      breadcrumb: t("Activity"),
      new: true,
      icon: (
        <svg
          className={iconClassName}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      path: "/admin/activity",
    },
    {
      breadcrumb: "Users & Groups",
      icon: (
        <svg
          className={iconClassName}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      path: "/admin/users",
    },
    {
      breadcrumb: "Data Layers",
      icon: (
        <svg
          viewBox="2 1 21 21"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClassName}
        >
          <g data-name="Layer 2">
            <path
              d="M21 11.35a1 1 0 00-.61-.86l-2.15-.92 2.26-1.3a1 1 0 00.5-.92 1 1 0 00-.61-.86l-8-3.41a1 1 0 00-.78 0l-8 3.41a1 1 0 00-.61.86 1 1 0 00.5.92l2.26 1.3-2.15.92a1 1 0 00-.61.86 1 1 0 00.5.92l2.26 1.3-2.15.92a1 1 0 00-.61.86 1 1 0 00.5.92l8 4.6a1 1 0 001 0l8-4.6a1 1 0 00.5-.92 1 1 0 00-.61-.86l-2.15-.92 2.26-1.3a1 1 0 00.5-.92zm-9-6.26l5.76 2.45L12 10.85 6.24 7.54zm-.5 7.78a1 1 0 001 0l3.57-2 1.69.72L12 14.85l-5.76-3.31 1.69-.72zm6.26 2.67L12 18.85l-5.76-3.31 1.69-.72 3.57 2.05a1 1 0 001 0l3.57-2.05z"
              data-name="layers"
            ></path>
          </g>
        </svg>
      ),
      path: "/admin/data",
    },
    ...(data?.project?.enableReportBuilder === true
      ? [
          {
            breadcrumb: "Geography",
            icon: (
              <svg
                viewBox="0 0 24 24"
                height="64"
                width="64"
                focusable="false"
                role="img"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className={iconClassName}
              >
                <path
                  fill-rule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM6.262 6.072a8.25 8.25 0 1 0 10.562-.766 4.5 4.5 0 0 1-1.318 1.357L14.25 7.5l.165.33a.809.809 0 0 1-1.086 1.085l-.604-.302a1.125 1.125 0 0 0-1.298.21l-.132.131c-.439.44-.439 1.152 0 1.591l.296.296c.256.257.622.374.98.314l1.17-.195c.323-.054.654.036.905.245l1.33 1.108c.32.267.46.694.358 1.1a8.7 8.7 0 0 1-2.288 4.04l-.723.724a1.125 1.125 0 0 1-1.298.21l-.153-.076a1.125 1.125 0 0 1-.622-1.006v-1.089c0-.298-.119-.585-.33-.796l-1.347-1.347a1.125 1.125 0 0 1-.21-1.298L9.75 12l-1.64-1.64a6 6 0 0 1-1.676-3.257l-.172-1.03Z"
                  clip-rule="evenodd"
                />
              </svg>
            ),
            path: "/admin/geography",
          },
        ]
      : []),
    {
      breadcrumb: "Sketch Classes",
      icon: (
        <svg
          viewBox="0 0 448 512"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClassName}
        >
          <path
            fill="currentColor"
            d="M384 352c-.35 0-.67.1-1.02.1l-39.2-65.32c5.07-9.17 8.22-19.56 8.22-30.78s-3.14-21.61-8.22-30.78l39.2-65.32c.35.01.67.1 1.02.1 35.35 0 64-28.65 64-64s-28.65-64-64-64c-23.63 0-44.04 12.95-55.12 32H119.12C108.04 44.95 87.63 32 64 32 28.65 32 0 60.65 0 96c0 23.63 12.95 44.04 32 55.12v209.75C12.95 371.96 0 392.37 0 416c0 35.35 28.65 64 64 64 23.63 0 44.04-12.95 55.12-32h209.75c11.09 19.05 31.49 32 55.12 32 35.35 0 64-28.65 64-64 .01-35.35-28.64-64-63.99-64zm-288 8.88V151.12A63.825 63.825 0 00119.12 128h208.36l-38.46 64.1c-.35-.01-.67-.1-1.02-.1-35.35 0-64 28.65-64 64s28.65 64 64 64c.35 0 .67-.1 1.02-.1l38.46 64.1H119.12A63.748 63.748 0 0096 360.88zM272 256c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zM400 96c0 8.82-7.18 16-16 16s-16-7.18-16-16 7.18-16 16-16 16 7.18 16 16zM64 80c8.82 0 16 7.18 16 16s-7.18 16-16 16-16-7.18-16-16 7.18-16 16-16zM48 416c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zm336 16c-8.82 0-16-7.18-16-16s7.18-16 16-16 16 7.18 16 16-7.18 16-16 16z"
          ></path>
        </svg>
      ),
      path: "/admin/sketching",
    },
    {
      breadcrumb: "Forums",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={iconClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      path: "/admin/forums",
    },
    {
      breadcrumb: "Surveys",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={iconClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      path: "/admin/surveys",
    },
    ...(data?.project?.isOfflineEnabled
      ? [
          {
            breadcrumb: "Offline Support",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={iconClassName}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                />
              </svg>
            ),
            path: "/admin/offline",
          },
        ]
      : []),
    {
      breadcrumb: "Administrator Guide",
      icon: <BookOpenIcon className={iconClassName} />,
      path: "https://docs.seasketch.org/seasketch-documentation",
    },
  ];
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileHeaderState, setMobileHeaderState] =
    useState<AdminMobileHeaderState>({});

  const isFullscreenRoute = useMemo(
    () => /offline\/basemap/.test(window.location.pathname),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window.location.pathname]
  );

  if (data && data.project?.sessionIsAdmin === false) {
    return <Redirect to={`/${slug}`} />;
  }

  return (
    <AdminMobileHeaderContext.Provider
      value={{ ...mobileHeaderState, setState: setMobileHeaderState }}
    >
      {isFullscreenRoute ? (
        <AdminRouter />
      ) : (
        <>
          <AdminMobileHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />
          <div className="pt-12 md:pt-0 flex bg-gray-100">
            {/* <!-- Off-canvas menu for mobile --> */}
            <MobileSidebar
              sections={sections}
              slug={slug}
              projectName={data?.project?.name || "▌"}
              open={mobileSidebarOpen}
              onRequestClose={() => setMobileSidebarOpen(false)}
              supportedLanguages={
                (data?.project?.supportedLanguages as string[]) || []
              }
            />

            {/* <!-- Static sidebar for desktop --> */}
            <StaticSidebar
              sections={sections}
              slug={slug}
              projectName={data?.project?.name || "▌"}
              supportedLanguages={
                (data?.project?.supportedLanguages as string[]) || []
              }
            />
            <div key="main-container" className="flex w-0 flex-1 max-h-screen">
              {/* Header (mobile-only) */}
              <main
                key="main"
                className="flex-1 relative overflow-x-hidden focus:outline-none max-h-full overflow-y-auto"
                tabIndex={0}
              >
                <AdminRouter />
              </main>
            </div>
          </div>
        </>
      )}
      {/* <!-- Replace with your content --> */}
      {/* <!-- /End replace --> */}
    </AdminMobileHeaderContext.Provider>
  );
}

function SidebarContents(props: {
  slug: string;
  projectName: string;
  sections: Section[];
  supportedLanguages: string[];
}) {
  const [newDismissed, setNewDismissed] = useLocalStorage(
    "new-dismissed-activity",
    false
  );

  const showNewFlag = !newDismissed && new Date() < new Date("2024-05-28");
  const cache = useContext(GraphqlQueryCacheContext);
  const { t } = useTranslation("admin");
  const { user, logout } = useAuth0();
  let social: string | false = false;
  if (user && user.sub) {
    if (/twitter/.test(user.sub)) {
      social = "twitter";
    } else if (/google/.test(user.sub)) {
      social = "google";
    } else if (/github/.test(user.sub)) {
      social = "github";
    }
  }
  const userId = user
    ? `${user.name || user.email} ${social ? `(${social})` : ""}`
    : undefined;

  return (
    <div
      onClick={(e) => {
        // @ts-ignore
        if (e.target.tagName === "A") {
        } else {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }}
    >
      <div className="flex-row items-center flex-shrink-0 px-4 text-white">
        <span className="text-xl font-semibold">{props.projectName}</span>{" "}
        <span className="block text-sm">
          <Trans ns={["admin"]}>Admin Dashboard</Trans>
        </span>
      </div>
      <div className="mt-5 flex-1 flex flex-col">
        <nav className="flex-1 px-2 bg-gray-800 space-y-1">
          {props.sections.map((section) => (
            <NavLink
              exact={section.path === "/admin"}
              key={section.path}
              onClick={(e) => {
                if (section.new) {
                  setNewDismissed(true);
                } else if (/http.*:\/\//.test(section.path)) {
                  window.open(section.path, "_blank");
                  e.preventDefault();
                  e.stopPropagation();
                } else {
                  return;
                }
              }}
              to={`/${props.slug}${section.path}`}
              activeClassName="bg-primary-600 text-white"
              className="group flex items-center px-2 py-2 md:text-sm leading-5 font-medium text-indigo-100 rounded-md hover:text-white hover:bg-primary-600 focus:outline-none focus:text-white focus:bg-primary-600 transition ease-in-out duration-75"
            >
              {section.icon}
              {section.breadcrumb}
              {section.new && showNewFlag && (
                <span className="ml-auto inline-block text-xs bg-indigo-500 text-white font-semibold rounded-full px-2 py-0.5">
                  {t("New")}
                </span>
              )}
            </NavLink>
          ))}
          {userId && (
            <>
              <div className="flex w-full pl-1 pt-2 pb-1">
                <ProfileStatusButton className="flex-none" />
                <div className="ml-2 flex-1 text-gray-300">
                  <p className="text-base md:text-sm leading-5">
                    {t("Signed in as")}
                  </p>
                  <p
                    title={userId}
                    className="text-base md:text-sm leading-8 md:leading-5 font-medium truncate"
                  >
                    {userId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  cache?.logout();
                  logout({
                    logoutParams: {
                      returnTo: window.location.origin,
                    },
                  });
                }}
                className="group flex items-center px-2 py-2 md:text-sm leading-5 font-medium text-gray-300 rounded-md hover:text-white hover:bg-primary-600 focus:outline-none focus:text-white focus:bg-primary-600 transition ease-in-out duration-75 w-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className={`${iconClassName} left-0.5 relative`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <Trans ns="admin">Sign Out</Trans>
              </button>
            </>
          )}
          <LanguageSelector
            button={(onClick, lang) => (
              <button
                className="w-full group flex items-center px-2 py-2 md:text-sm leading-5 font-medium text-indigo-100 rounded-md hover:text-white hover:bg-primary-600 focus:outline-none focus:text-white focus:bg-primary-600 transition ease-in-out duration-75"
                onClick={onClick}
              >
                <TranslateIcon className="w-6 h-6 inline mr-3 text-primary-300 " />
                <span>{lang.localName || lang.name}</span>
              </button>
            )}
            options={props.supportedLanguages}
          />
        </nav>
      </div>
    </div>
  );
}

function StaticSidebar({
  sections,
  projectName,
  slug,
  userId,
  supportedLanguages,
}: {
  sections: Section[];
  projectName: string;
  slug: string;
  userId?: string;
  supportedLanguages: string[];
}) {
  return (
    <div className="hidden md:flex md:flex-shrink-0 min-h-screen">
      <div className="flex flex-col w-56">
        <div className="flex flex-col flex-grow bg-gray-800 pt-5 pb-4 overflow-y-auto text-white">
          <SidebarContents
            sections={sections}
            slug={slug}
            projectName={projectName}
            supportedLanguages={supportedLanguages}
          />
        </div>
      </div>
    </div>
  );
}

function MobileSidebar({
  sections,
  projectName,
  slug,
  onRequestClose,
  open,
  userId,
  supportedLanguages,
}: {
  sections: Section[];
  projectName: string;
  slug: string;
  onRequestClose: () => void;
  open: boolean;
  userId?: string;
  supportedLanguages: string[];
}) {
  useEffect(() => {
    if (open) {
      document.addEventListener("click", onRequestClose);
    }
    return () => {
      document.removeEventListener("click", onRequestClose);
    };
  });
  return (
    <div className={`md:hidden ${open ? "flex" : "hidden"}`}>
      <div className="fixed inset-0 flex z-40">
        <div className="fixed inset-0">
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-gray-800`}
        >
          <div className="absolute top-0 right-0 -mr-14 p-1">
            <button
              className="flex items-center justify-center h-12 w-12 rounded-full focus:outline-none focus:bg-gray-600"
              aria-label="Close sidebar"
            >
              <svg
                className="h-6 w-6 text-white"
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
          <SidebarContents
            sections={sections}
            slug={slug}
            projectName={projectName}
            supportedLanguages={supportedLanguages}
          />
        </div>
        <div className="flex-shrink-0 w-14">
          {/* <!-- Dummy element to force sidebar to shrink to fit close icon --> */}
        </div>
      </div>
    </div>
  );
}
