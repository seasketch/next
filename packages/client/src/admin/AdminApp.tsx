import React, { useState, useEffect } from "react";
import {
  useRouteMatch,
  useParams,
  Link,
  NavLink,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../header/seasketch-logo.png";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import { ProfileStatusButton } from "../header/ProfileStatusButton";
import ProfileContextMenu from "../header/ProfileContextMenu";
import useBreadcrumbs from "use-react-router-breadcrumbs";
import { useAuth0 } from "@auth0/auth0-react";

const LazyBasicSettings = React.lazy(() => import("./Settings"));
const LazyDataSettings = React.lazy(() => import("./data/DataSettings"));

interface Section {
  breadcrumb: string;
  icon: React.ReactNode;
  path: string;
}

const iconClassName =
  "mr-3 h-6 w-6 text-indigo-400 group-hover:text-indigo-300 group-focus:text-indigo-300 transition ease-in-out duration-150";

const sections: Section[] = [
  {
    breadcrumb: "Settings",
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
    breadcrumb: "Activity",
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
        <title>LayersOutline icon</title>
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
        <title>DrawPolygon icon</title>
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
];

export default function AdminApp() {
  const { slug } = useParams<{ slug: string }>();
  const routeConfig = [
    ...sections,
    ...[
      {
        breadcrumb: "Add Data",
        path: "/admin/data/add-data",
      },
      {
        breadcrumb: "ArcGIS Server",
        path: "/admin/data/add-data/arcgis",
      },
    ],
  ]
    .map((section) => ({
      ...section,
      path: `/:slug${section.path}`,
    }))
    .filter((route) => route.breadcrumb !== "Settings");
  let { path, url } = useRouteMatch();
  const breadcrumbs = useBreadcrumbs(routeConfig, { disableDefaults: true });

  const { t, i18n } = useTranslation(["admin"]);
  const { data, loading, error } = useCurrentProjectMetadataQuery({
    variables: {
      slug: slug || "",
    },
  });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const handleDocumentClick = () => {
    setProfileModalOpen(false);
    setMobileSidebarOpen(false);
  };
  useEffect(() => {
    if (profileModalOpen) {
      document.addEventListener("click", handleDocumentClick);
    }
    if (mobileSidebarOpen) {
      document.addEventListener("click", handleDocumentClick);
    }
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  });

  if (data && data.projectBySlug?.sessionIsAdmin === false) {
    return <Redirect to={`/${slug}`} />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* <!-- Off-canvas menu for mobile --> */}
      <div className={`md:hidden ${mobileSidebarOpen ? "flex" : "hidden"}`}>
        <div className="fixed inset-0 flex z-40">
          {/* <!--
        Off-canvas menu overlay, show/hide based on off-canvas menu state.

        Entering: "transition-opacity ease-linear duration-300"
          From: "opacity-0"
          To: "opacity-100"
        Leaving: "transition-opacity ease-linear duration-300"
          From: "opacity-100"
          To: "opacity-0"
      --> */}
          <div className="fixed inset-0">
            <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
          </div>
          {/* <!--
        Off-canvas menu, show/hide based on off-canvas menu state.

        Entering: "transition ease-in-out duration-300 transform"
          From: "-translate-x-full"
          To: "translate-x-0"
        Leaving: "transition ease-in-out duration-300 transform"
          From: "translate-x-0"
          To: "-translate-x-full"
      --> */}
          <div
            className={`relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-indigo-800`}
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
              slug={slug}
              projectName={data?.projectBySlug?.name || "▌"}
            />
          </div>
          <div className="flex-shrink-0 w-14">
            {/* <!-- Dummy element to force sidebar to shrink to fit close icon --> */}
          </div>
        </div>
      </div>

      {/* <!-- Static sidebar for desktop --> */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-56">
          {/* <!-- Sidebar component, swap this element with another sidebar if you like --> */}
          <div className="flex flex-col flex-grow bg-indigo-800 pt-5 pb-4 overflow-y-auto text-white">
            <SidebarContents
              slug={slug}
              projectName={data?.projectBySlug?.name || "▌"}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="relative z-10 flex-shrink-0 flex h-12 bg-white shadow">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:bg-gray-100 focus:text-gray-600 md:hidden"
            aria-label="Open sidebar"
          >
            <svg
              className="h-6 w-6"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <nav className="flex items-center text-sm leading-5 font-medium">
                {breadcrumbs.length === 0 && (
                  <span className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out">
                    Settings
                  </span>
                )}
                {breadcrumbs.map((b, i) => {
                  return (
                    <div key={b.key}>
                      <NavLink
                        activeStyle={{ pointerEvents: "none" }}
                        // isActive={b.match.url === }
                        exact
                        to={b.match.url}
                        className="text-gray-500 hover:text-gray-700 transition duration-150 ease-in-out text-sm mr-2 sm:mr-0"
                      >
                        {b.breadcrumb}
                      </NavLink>
                      {i < breadcrumbs.length - 1 && (
                        <svg
                          className="hidden flex-shrink-0 sm:inline -mt-0.5 mx-2 h-5 w-5 text-gray-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              {/* <!-- Profile dropdown --> */}
              <div className="ml-3 relative">
                <ProfileStatusButton
                  onClick={() => setProfileModalOpen(true)}
                />
                {/* <!--
              Profile dropdown panel, show/hide based on dropdown state.

              Entering: "transition ease-out duration-100"
                From: "transform opacity-0 scale-95"
                To: "transform opacity-100 scale-100"
              Leaving: "transition ease-in duration-75"
                From: "transform opacity-100 scale-100"
                To: "transform opacity-0 scale-95"
            --> */}
                <div
                  className={`origin-top-right absolute right-4 mt-2 w-48 rounded-md shadow-lg ${
                    !profileModalOpen && "hidden"
                  }`}
                >
                  <div
                    className="py-1 rounded-md bg-white shadow-xs"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu"
                  >
                    <ProfileContextMenu />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main
          className="flex-1 relative overflow-y-auto focus:outline-none"
          tabIndex={0}
        >
          <Switch>
            <Route exact path={`${path}`}>
              <React.Suspense fallback={<div></div>}>
                <LazyBasicSettings />
              </React.Suspense>
            </Route>
            <Route exact path={`${path}/activity`}></Route>
            <Route exact path={`${path}/users`}></Route>
            <Route path={`${path}/data`}>
              <React.Suspense fallback={<div></div>}>
                <LazyDataSettings />
              </React.Suspense>
            </Route>
            <Route exact path={`${path}/sketching`}></Route>
            <Route exact path={`${path}/forums`}></Route>
            <Route exact path={`${path}/surveys`}></Route>
          </Switch>
          {/* <!-- Replace with your content --> */}
          {/* <!-- /End replace --> */}
        </main>
      </div>
    </div>
  );
}

function SidebarContents(props: { slug: string; projectName: string }) {
  return (
    <>
      <div className="flex-row items-center flex-shrink-0 px-4 text-white">
        <span className="text-xl font-semibold">{props.projectName}</span>{" "}
        <span className="block text-sm">Admin Dashboard</span>
      </div>
      <div className="mt-5 flex-1 flex flex-col">
        <nav className="flex-1 px-2 bg-indigo-800 space-y-1">
          {sections.map((section) => (
            <NavLink
              exact
              key={section.path}
              to={`/${props.slug}${section.path}`}
              activeClassName="bg-indigo-900 text-white"
              className="group flex items-center px-2 py-2 md:text-sm leading-5 font-medium text-indigo-300 rounded-md hover:text-white hover:bg-indigo-700 focus:outline-none focus:text-white focus:bg-indigo-700 transition ease-in-out duration-75"
            >
              {section.icon}
              {section.breadcrumb}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
