import { ReactNode, useContext, useEffect } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import {
  ForumsIcon,
  LayerIcon,
  MapIcon,
  SketchingIcon,
} from "./MiniSidebarButtons";
import logo from "../header/seasketch-logo.png";
import { useAuth0 } from "@auth0/auth0-react";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import SignedInAs from "../components/SignedInAs";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "../auth/JoinProject";
import { ParticipationStatus } from "../generated/graphql";
import { CogIcon, TranslateIcon } from "@heroicons/react/solid";
import { getLastFormUrl } from "./Forums/Forums";
import { useSketchUIState } from "./Sketches/SketchUIStateContextProvider";
import LanguageSelector from "../surveys/LanguageSelector";
import Button from "../components/Button";
import { useTranslatedProps } from "../components/TranslatedPropControl";

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
  const { t, i18n } = useTranslation("sidebar");
  const { slug } = useParams<{ slug: string }>();
  const { loginWithRedirect } = useAuth0();
  const { data, loading } = useCurrentProjectMetadata();
  const { user, logout } = useAuth0();
  const cache = useContext(GraphqlQueryCacheContext);
  const sketchingContext = useSketchUIState();
  const lang = (i18n.language || "EN").toUpperCase();

  open = open && !sketchingContext.editorIsOpen;

  useEffect(() => {
    if (/pj/.test(window.location.search)) {
      if (
        data?.project?.sessionParticipationStatus &&
        data?.project?.sessionParticipationStatus !==
        ParticipationStatus.ParticipantSharedProfile
      ) {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/join?redirectUrl=${window.location.pathname}`);
      } else {
        // remove the entire search string from the path to remove ?pj
        history.push(window.location.pathname);
      }
    }
  }, [data?.project?.sessionParticipationStatus, history, slug]);

  const chooseSidebar = (sidebar: string) => () => {
    if (sidebar === "forums") {
      const lastUrl = getLastFormUrl();
      if (lastUrl) {
        history.replace(lastUrl);
      } else {
        history.replace(`/${slug}/app/${sidebar}`);
      }
    } else {
      history.replace(`/${slug}/app/${sidebar}`);
    }
    onClose();
  };

  const getTranslatedProp = useTranslatedProps(data?.project);

  const project = data?.project;
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
      className={`absolute left-0 h-full overflow-y-auto z-20 p-5 w-full md:w-96 ${dark ? "text-gray-200 bg-cool-gray-800" : "text-gray-900 bg-white "
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
          <h1 className=" ">{getTranslatedProp("name")}</h1>
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
            className="w-full h-full"
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
        {data?.project?.hideOverlays !== true &&
          <NavItem
            label={t("Overlay Layers")}
            icon={LayerIcon}
            onClick={chooseSidebar("overlays")}
          />}
        {data?.project?.hideSketches !== true && <NavItem
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
        />}
        {data?.project?.hideForums !== true &&
          <NavItem
            label={t("Discussion Forums")}
            icon={ForumsIcon}
            onClick={chooseSidebar("forums")}
          />
        }
        {project?.isOfflineEnabled && (
          <NavItem
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                />
              </svg>
            }
            label={t("Cache Settings")}
            onClick={chooseSidebar("settings")}
          />
        )}
        <a
          target="_blank"
          rel="noreferrer"
          href={`mailto:${data?.project?.supportEmail || "support@seasketch.org"
            }`}
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
        {!user && !data?.me && (
          <>
            <LanguageSelector
              button={(onClick, lang) => (
                <NavItem
                  icon={<TranslateIcon className="w-6 h-6 inline -mr-0.5 " />}
                  onClick={onClick}
                  label={lang.localName || lang.name}
                />
              )}
              options={data?.project?.supportedLanguages as string[]}
            />
          </>
        )}
      </nav>

      {user && data?.me && (
        <>
          <nav className="mt-4">
            <SignedInAs className="pb-1" />
            <LanguageSelector
              button={(onClick, lang) => (
                <NavItem
                  icon={<TranslateIcon className="w-6 h-6 inline mr-1 " />}
                  onClick={onClick}
                  label={lang.localName || lang.name}
                />
              )}
              options={data?.project?.supportedLanguages as string[]}
            />
            <NavItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                    clipRule="evenodd"
                  />
                </svg>
              }
              label={t("My Profile")}
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
            />
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
            />
          </nav>
        </>
      )}
      {(!user || (!loading && !data?.me)) && (
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
        />
      )}
      {project?.sessionIsAdmin && (
        <Link
          to="./admin"
          className="bg-cool-gray-700 bg-opacity-50 block w-full p-4 rounded text-center mt-8 hover:bg-opacity-40"
        >
          <CogIcon className="w-6 h-6 inline-block mr-3 -mt-0.5 text-gray-300" />
          <span className="flex-1">{t("Project Admin Dashboard")}</span>
        </Link>
      )}

      <div className="fixed bottom-0 mb-7">
        {/* {project?.sessionIsAdmin && (
          <NavItem
            onClick={() => history.push("./admin")}
            label={t("Project Administration")}
            icon={AdminIcon}
          />
        )} */}
        <div className="flex">
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
            <nav className="text-xs underline mt-1 flex space-x-2">
              {/* <a className="mr-1" href="/about">
                {t("About")}
              </a> */}
              <a
                // className="mx-1"
                href="/terms-of-use"
              >
                {t("Terms of Use")}
              </a>
              <a href="mailto:support@seasketch.org">{t("Contact Us")}</a>
              <a
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
  label: string | ReactNode;
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
