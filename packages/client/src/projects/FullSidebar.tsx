import React, { ReactNode } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AdminIcon,
  ForumsIcon,
  LayerIcon,
  MapIcon,
  SketchingIcon,
} from "./MiniSidebarButtons";
import logo from "../header/seasketch-logo.png";
import { useAuth0 } from "@auth0/auth0-react";
import { ProfileStatusButton } from "../header/ProfileStatusButton";

export default function FullSidebar({
  open,
  onClose,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  dark: boolean;
}) {
  const history = useHistory();
  const { t } = useTranslation("sidebar");
  const { slug } = useParams<{ slug: string }>();
  const { loginWithRedirect } = useAuth0();
  const { data, loading, error, refetch } = useCurrentProjectMetadataQuery();
  const { user, logout } = useAuth0();
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
  const userId = user
    ? `${user.email || user.name} ${social ? `(${social})` : ""}`
    : false;

  // if (!data?.currentProject && !loading && !error) {
  //   refetch();
  //   return <div></div>;
  // }

  const chooseSidebar = (sidebar: string) => () => {
    history.replace(`/${slug}/app/${sidebar}`);
    onClose();
  };

  const project = data?.currentProject;
  return (
    <motion.div
      variants={{
        closed: {
          translateX: -384,
          transition: {
            bounce: false,
            duration: 0.3,
          },
        },
        open: {
          translateX: 0,
          transition: {
            type: "spring",
            // ease: "easeOut",
            duration: 0.4,
          },
        },
      }}
      style={{ boxShadow: open ? "rgb(0 0 0 / 23%) 2px 0px 5px 0px" : "none" }}
      className={`absolute left-0 h-full z-20 p-5 w-full md:w-96 ${
        dark ? "text-gray-200 bg-cool-gray-800" : "text-gray-900 bg-white "
      }`}
      animate={open ? "open" : "closed"}
      initial={false}
    >
      <div className="flex w-full">
        <div className="flex-grow-0 flex items-center">
          {project?.logoUrl && (
            <img
              alt="SeaSketch Logo"
              src={project?.logoUrl}
              className="w-12 flex-0 mr-4"
            />
          )}
        </div>
        <div className="flex-1 max-w-md flex items-center text-xl">
          <h1 className=" ">{project?.name}</h1>
        </div>
        <button
          onClick={onClose}
          className=" w-10 h-10 rounded-full p-1 relative -right-2 flex items-center "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>
      <nav className="my-8">
        {/* <NavItem
          label={t("Project Homepage")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        /> */}
        <NavItem
          onClick={chooseSidebar("maps")}
          label={t("Maps")}
          icon={MapIcon}
        />
        <NavItem
          label={t("Overlay Layers")}
          icon={LayerIcon}
          onClick={chooseSidebar("overlays")}
        />
        <NavItem
          label={t("Sketching Tools")}
          onClick={chooseSidebar("sketches")}
          icon={
            <span
              className="inline-block -mb-0.5 relative"
              style={{ left: -0.75 }}
            >
              {SketchingIcon}
            </span>
          }
        />
        <NavItem
          label={t("Discussion Forums")}
          icon={ForumsIcon}
          onClick={chooseSidebar("forums")}
        />
        {project?.sessionIsAdmin && (
          <NavItem
            onClick={() => history.push("./admin")}
            label={t("Project Administration")}
            icon={AdminIcon}
          />
        )}
      </nav>
      {user && (
        <>
          <nav className="mt-4">
            <div className="flex mb-1">
              <ProfileStatusButton />
              <div className="ml-2">
                <p className="text-base md:text-sm leading-5">
                  {t("Signed in as")}
                </p>
                <p
                  title={userId as string}
                  className="text-base md:text-sm leading-8 md:leading-5 font-medium truncate"
                >
                  {userId}
                </p>
              </div>
            </div>
            <div className="py-1">
              <NavItem
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                }
                label={t("Account Settings")}
                onClick={() => history.push("./account-settings")}
              />
              <a
                target="_blank"
                rel="noreferrer"
                href="mailto:support@seasketch.org"
                className="flex p-1 rounded my-2 hover:bg-gray-900 hover:bg-opacity-20 w-full"
                role="menuitem"
              >
                <div className="w-6 h-6 mr-3 opacity-80">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                {t("Contact support")}
              </a>
              <NavItem
                icon={
                  <svg
                    className="left-0.5 relative"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                }
                label={t("Sign Out")}
                onClick={() =>
                  logout({
                    returnTo:
                      window.location.protocol +
                      "//" +
                      window.location.host +
                      "/",
                  })
                }
              />
            </div>
          </nav>
        </>
      )}
      {!user && (
        <NavItem
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
          label={t("Sign In")}
          onClick={() => {
            loginWithRedirect({
              appState: {
                returnTo: window.location.pathname,
              },
              redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
            });
          }}
        />
      )}

      <div className="fixed bottom-0 mb-7">
        <div className=" flex">
          <div className="flex items-center">
            <a href="/">
              <img
                alt="SeaSketch Logo"
                src={logo}
                className="mr-4"
                style={{ width: 64 }}
              />
            </a>
          </div>
          <div className="flex-col items-center">
            <div className="text-xs">{t("Powered by")}</div>
            <h2 className="text-xl">SeaSketch</h2>
            <nav className="text-xs underline mt-1">
              <a className="mr-1" href="/about">
                {t("About")}
              </a>
              <a className="mx-1" href="/tou">
                {t("Terms of Use")}
              </a>
              <a className="mx-1" href="mailto:support@seasketch.org">
                {t("Contact")}
              </a>
              <a
                className="mx-1"
                target="_blank"
                rel="noreferrer"
                href="https://github.com/seasketch/next/deployments"
              >
                {
                  // eslint-disable-next-line i18next/no-literal-string
                  "Build "
                }
                {process.env.REACT_APP_BUILD || "local"}
              </a>
            </nav>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NavItem({
  onClick,
  label,
  icon,
  target,
}: {
  onClick?: () => void;
  label: string;
  icon?: ReactNode;
  target?: string;
}) {
  const className =
    "flex p-1 rounded my-2 hover:bg-gray-900 hover:bg-opacity-20 w-full";
  return (
    <button className={className} onClick={onClick}>
      <div className="w-6 h-6 mr-3 opacity-80">{icon}</div>
      {label}
    </button>
  );
}
