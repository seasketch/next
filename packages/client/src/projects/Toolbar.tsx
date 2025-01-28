import logo from "../header/seasketch-logo.png";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  LayersButton,
  MapButton,
  SketchingButton,
  ForumsButton,
  AdminButton,
  LanguageButton,
  AboutButton,
  CacheButton,
  MyProfileButton,
  SignInButton,
  SignOutButton,
  EditProfileButton,
} from "./ToolbarButtons";
import { useHistory, useParams, useRouteMatch } from "react-router-dom";
import { MenuToggle } from "./MenuToggle";
import { ProfileStatusButton } from "../header/ProfileStatusButton";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { getLastFormUrl } from "./Forums/Forums";
import LanguageSelector from "../surveys/LanguageSelector";
import { ParticipationStatus } from "../generated/graphql";
import { useAuth0 } from "@auth0/auth0-react";
import { useSketchUIState } from "./Sketches/SketchUIStateContextProvider";
import { useTranslatedProps } from "../components/TranslatedPropControl";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "../auth/JoinProject";
import SignedInAs from "../components/SignedInAs";
import { useContext } from "react";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";
import clsx from "clsx";

export default function Toolbar({
  onExpand,
  dark,
  expanded,
}: {
  onExpand: () => void;
  dark: boolean;
  expanded?: boolean;
}) {
  const { slug, sidebar } = useParams<{ slug: string; sidebar: string }>();
  const history = useHistory();
  const { data } = useCurrentProjectMetadata();
  const { user, logout, loginWithRedirect } = useAuth0();
  const cache = useContext(GraphqlQueryCacheContext);

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
  const sketchingContext = useSketchUIState();

  const userId = user
    ? `${user.email || user.name} ${social ? `(${social})` : ""}`
    : false;

  const { t } = useTranslation("sidebar");

  const openSidebar = (s: string) => () => {
    if (expanded) {
      onExpand();
    }
    if (sidebar === s) {
      if (s === "forums") {
        if (history.location.pathname !== `/${slug}/app/forums`) {
          history.replace(`/${slug}/app/forums`);
        } else {
          history.replace(`/${slug}/app`);
        }
      } else {
        history.replace(`/${slug}/app`);
      }
    } else {
      if (s === "forums") {
        const lastUrl = getLastFormUrl();
        if (lastUrl) {
          history.replace(lastUrl);
        } else {
          history.replace(`/${slug}/app/${s}`);
        }
      } else {
        history.replace(`/${slug}/app/${s}`);
      }
    }
  };
  const showSidebar = useRouteMatch<{ sidebar: string }>(
    // eslint-disable-next-line
    `/${slug}/app/:sidebar`
  );

  const getTranslatedProp = useTranslatedProps(data?.project);

  expanded =
    expanded && !sketchingContext.editorIsOpen && !Boolean(showSidebar);

  return (
    <motion.nav
      role="navigation"
      style={{ boxShadow: "0px -2px 5px rgba(0,0,0,0.5)" }}
      className={`absolute left-0 h-screen bg-cool-gray-800 ${
        expanded ? "text-gray-300" : "text-gray-400"
      } text-gray-700"
      }  z-20 p-0 flex flex-col`}
      variants={{
        expanded: { width: 384 },
        collapsed: { width: 64 },
      }}
      initial={false}
      transition={{ duration: 0.15 }}
      animate={expanded ? "expanded" : "collapsed"}
    >
      <div
        className={clsx(
          expanded && "p-3 pt-0 pb-2 mid-height:min-h-20 min-h-[64px]",
          `flex w-full space-x-2  items-center`,
          !expanded && "justify-center pt-4 mb-3"
        )}
      >
        {expanded && (
          <>
            <div className="flex items-center flex-none py-2 mid-height:py-3 mid-height:pt-4">
              {data?.project?.logoUrl && !data?.project.logoLink && (
                <img
                  alt="Project Logo"
                  src={data?.project?.logoUrl}
                  className="w-12 flex-0 mr-4"
                />
              )}
              {data?.project?.logoUrl && data?.project.logoLink && (
                <a
                  href={data?.project.logoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center w-full"
                >
                  <img
                    alt="Project Logo"
                    src={data?.project?.logoUrl}
                    className="w-12 flex-0"
                  />
                </a>
              )}
            </div>
            <div className="flex-1 max-w-md flex items-center text-xl">
              <h1 className="whitespace-nowrap">{getTranslatedProp("name")}</h1>
            </div>
          </>
        )}
        <MenuToggle
          className={clsx(
            "flex-none",
            dark ? "text-gray-400" : "text-gray-700"
          )}
          onClick={onExpand}
          tabIndex={1}
          isExpanded={expanded}
        />
      </div>

      <div
        className={`pt-0.5 flex flex-col w-full flex-1 ${
          expanded
            ? "justify-start overflow-y-auto overflow-x-hidden -mt-3 space-y-3"
            : "space-y-2 ml-[12px] mt-1"
        }`}
      >
        {data?.project?.aboutPageEnabled && (
          <AboutButton
            tooltip={t("About")}
            className=""
            sidebarOpen={sidebar === "about"}
            onClick={openSidebar("about")}
            anySidebarOpen={!!sidebar}
            expanded={expanded}
          />
        )}
        <MapButton
          tooltip={t("Maps")}
          className=""
          onClick={openSidebar("maps")}
          sidebarOpen={sidebar === "maps"}
          anySidebarOpen={!!sidebar}
          expanded={expanded}
        />
        {data?.project?.hideOverlays !== true && (
          <LayersButton
            sidebarOpen={sidebar === "overlays"}
            onClick={openSidebar("overlays")}
            tooltip={t("Overlay Layers")}
            anySidebarOpen={!!sidebar}
            expanded={expanded}
          />
        )}
        {data?.project?.hideSketches !== true && (
          <SketchingButton
            tooltip={t("Sketches")}
            sidebarOpen={sidebar === "sketches"}
            onClick={openSidebar("sketches")}
            anySidebarOpen={!!sidebar}
            expanded={expanded}
          />
        )}
        {data?.project?.hideForums !== true && (
          <ForumsButton
            tooltip={t("Discussion Forums")}
            sidebarOpen={sidebar === "forums"}
            onClick={openSidebar("forums")}
            anySidebarOpen={!!sidebar}
            expanded={expanded}
          />
        )}

        {data?.project?.isOfflineEnabled && (
          <CacheButton
            tooltip={t("Cache Settings")}
            sidebarOpen={sidebar === "settings"}
            onClick={openSidebar("settings")}
            anySidebarOpen={!!sidebar}
            hidden={!expanded}
            expanded={expanded}
          />
        )}
        {/* <SettingsButton
        tooltip={t("Account Settings")}
        sidebarOpen={sidebar === "settings"}
        onClick={openSidebar("settings")}
        tabIndex={6}
        anySidebarOpen={!!sidebar}
      /> */}
        {!expanded && data?.me && (
          <MyProfileButton
            tooltip={t(`Signed in as ${userId}`)}
            onClick={onExpand}
            anySidebarOpen={!!sidebar}
            details={t(`${userId}`)}
            title={t("Signed in")}
          />
        )}

        {!data?.me && (
          <SignInButton
            tooltip={t("Sign In")}
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
            expanded={expanded}
          />
        )}

        {expanded && (data?.me || user) && (
          <>
            <div
              className="w-full"
              style={{ padding: "0px 19px", paddingTop: 6 }}
            >
              <SignedInAs className="pb-1" tabIndex={-1} />
            </div>

            <EditProfileButton
              tooltip={t("My Profile")}
              onClick={() => {
                if (
                  data?.project?.sessionParticipationStatus !==
                  ParticipationStatus.ParticipantSharedProfile
                ) {
                  history.push(`/${slug}/join`);
                } else {
                  history.push(`/${slug}/profile`);
                }
              }}
              expanded={expanded}
            />
            <SignOutButton
              tooltip={t("Sign Out")}
              onClick={() => {
                cache?.logout();
                logout({
                  logoutParams: {
                    returnTo:
                      window.location.protocol +
                      "//" +
                      window.location.host +
                      "/",
                  },
                });
              }}
              expanded={expanded}
            />
          </>
        )}

        <LanguageSelector
          button={(onClick, lang) => (
            <LanguageButton
              tooltip={lang.localName || lang.name}
              // tabIndex={6}
              onClick={onClick}
              expanded={expanded}
              title={t("Change language")}
              details={lang.localName || lang.name}
            />
          )}
          options={data?.project?.supportedLanguages as string[]}
        />

        {data?.project?.sessionIsAdmin && (
          <AdminButton
            href={`/${slug}/admin`}
            tooltip={t("Project Admin Dashboard")}
            // tabIndex={7}
            anySidebarOpen={!!sidebar}
            expanded={expanded}
            variant="primary"
          />
        )}
      </div>
      <div className="flex flex-col items-center w-full p-4">
        {!expanded && (
          <a className={`w-8`} href="/">
            <motion.img src={logo} alt="SeaSketch Logo" />
          </a>
        )}
        {expanded && (
          <div className="flex justify-start w-full overflow-hidden whitespace-nowrap pb-3 pl-1">
            <div className="flex items-center flex-none">
              <a
                href="/"
                className="focus:outline-0 focus-visible:ring-2 ring-blue-500 rounded-full"
              >
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
              <nav className="text-xs underline mt-1 flex space-x-2">
                {/* <a className="mr-1" href="/about">
                {t("About")}
              </a> */}
                <a
                  className="focus:outline-0 focus-visible:ring-2 ring-blue-500"
                  // className="mx-1"
                  href="/terms-of-use"
                >
                  {t("Terms of Use")}
                </a>
                <a
                  className="focus:outline-0 focus-visible:ring-2 ring-blue-500"
                  href="mailto:support@seasketch.org"
                >
                  {t("Contact Us")}
                </a>
                <a
                  className="focus:outline-0 focus-visible:ring-2 ring-blue-500"
                  target="_blank"
                  rel="noreferrer"
                  href="https://github.com/seasketch/next"
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
        )}
      </div>
    </motion.nav>
  );
}
