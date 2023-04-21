import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Switch, Route, Redirect, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import SignInPage from "./SignInPage";
import ProjectsPage from "./homepage/ProjectsPage";
import Header from "./header/Header";
import NewProjectCTA from "./homepage/NewProjectCTA";
import NewProjectPage from "./homepage/NewProjectPage";
import Spinner from "./components/Spinner";
import { ProjectAccessGate } from "./auth/ProjectAccessGate";
import GlobalErrorHandler, {
  GlobalErrorHandlerContext,
} from "./components/GlobalErrorHandler";
import { HeadProvider, Meta } from "react-head";
import { useAuth0 } from "@auth0/auth0-react";
import * as Sentry from "@sentry/react";
import { CameraOptions } from "mapbox-gl";
import { ClientCacheManagerProvider } from "./offline/ClientCacheManager";
import OfflineToastNotification from "./offline/OfflineToastNotification";
import OfflineResponsesToastNotification from "./offline/OfflineResponsesToastNotification";
import DeveloperApiPage from "./DeveloperAPIPage";

const LazyProjectApp = React.lazy(
  () => import(/* webpackChunkName: "ProjectApp" */ "./projects/ProjectApp")
);
const LazyProjectAdmin = React.lazy(
  () => import(/* webpackChunkName: "AdminApp" */ "./admin/AdminApp")
);
const LazyAuthLanding = React.lazy(
  () =>
    import(
      /* webpackChunkName: "ProjectInviteLanding" */ "./auth/ProjectInviteLanding"
    )
);
const LazySurveyApp = React.lazy(
  () => import(/* webpackChunkName: "SurveyApp" */ "./surveys/SurveyApp")
);
const LazyBasemapEditor = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminEditBasemapPage" */ "./admin/data/EditBasemapPage"
    )
);
const LazySurveyFormEditor = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminSurveyFormEditor" */ "./admin/surveys/SurveyFormEditor"
    )
);
const LazySubmitOfflineResponsesPage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "OfflineSurveys" */ "./offline/SubmitOfflineResponsesPage"
    )
);

const LazyFullScreenOfflinePage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "OfflineSurveys" */ "./offline/FullScreenOfflineNavigation"
    )
);

const LazyAccountSettingsPage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AccountSettingsPage" */ "./auth/CacheSettingsPage"
    )
);

const LazyJoinProject = React.lazy(
  () => import(/* webpackChunkName: "JoinProject" */ "./auth/JoinProject")
);

const LazyTermsOfUse = React.lazy(
  () => import(/* webpackChunkName: "TermsOfUse" */ "./TermsOfUse")
);

const LazyPrivacyPolicy = React.lazy(
  () => import(/* webpackChunkName: "PrivacyPolicy" */ "./PrivacyPolicy")
);

function App() {
  const { user } = useAuth0();
  const { t } = useTranslation("homepage");
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (user) {
      Sentry.setUser({ email: user.email, id: user.sub });
    } else {
      Sentry.configureScope((scope) => scope.setUser(null));
    }
  }, [user]);
  return (
    <div className="App">
      <HeadProvider>
        <Meta name="theme-color" content="#267588" />
        <Suspense
          fallback={
            <div
              style={{ height: "100vh" }}
              className="w-full flex min-h-full h-96 justify-center text-center align-middle items-center content-center justify-items-center place-items-center place-content-center"
            >
              <Spinner />
            </div>
          }
        >
          <GlobalErrorHandlerContext.Provider value={{ error, setError }}>
            <ClientCacheManagerProvider>
              <AuthoritativeDomainPrompt />
              <Route
                path={[
                  "/signin",
                  "/projects",
                  "/new-project",
                  "/authenticate",
                  "/",
                  "/api",
                  "/team",
                  "/submit-offline-surveys",
                  "/terms-of-use",
                  "/privacy-policy",
                ]}
                exact
              >
                <Header />
              </Route>
              <Route
                path={["/projects", "/new-project", "/api", "/team"]}
                exact
              >
                <OfflineToastNotification />
                <OfflineResponsesToastNotification />
              </Route>
              <Switch>
                <Route path="/auth/projectInvite">
                  <LazyAuthLanding />
                </Route>
                <Route path="/signin">
                  <SignInPage />
                </Route>
                <Route exact path="/projects">
                  <ProjectsPage />
                </Route>
                <Route exact path="/api">
                  <DeveloperApiPage />
                </Route>
                <Route exact path="/team"></Route>
                <Route exact path="/terms-of-use">
                  <LazyTermsOfUse />
                </Route>
                <Route exact path="/privacy-policy">
                  <LazyPrivacyPolicy />
                </Route>
                <Route path="/new-project">
                  <NewProjectPage />
                </Route>
                <Route path="/authenticate">
                  <span>
                    <Trans ns="homepage">authenticating...</Trans>
                  </span>
                </Route>
                <Route path="/account-settings">
                  <LazyAccountSettingsPage />
                </Route>
                <Route path="/submit-offline-surveys">
                  <LazySubmitOfflineResponsesPage />
                </Route>
                <Route exact path="/">
                  <OfflineResponsesToastNotification />
                  <LazyFullScreenOfflinePage />
                  <div className="p-4 pb-12 bg-white">
                    <h1 className="mx-auto max-w-xl mt-2 mb-8 text-3xl text-left sm:text-center leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10">
                      {t(
                        "SeaSketch Supports Collaborative Planning for our Oceans"
                      )}
                    </h1>
                    <p className="max-w-4xl mx-auto">
                      {t(`SeaSketch puts powerful tools into the hands of ocean planners,
              stakeholders and the public that were once limited to GIS
              professionals, enabling participatory marine spatial planning
              processes that are closely tied to the relevant science and
              information. SeaSketch is being used around the globe in small
              agency teams and large community-driven initiatives to make better
              management decisions every day.`)}
                    </p>
                  </div>
                  <NewProjectCTA />
                </Route>
                <Route
                  exact
                  path="/:slug"
                  render={(params) => (
                    <Redirect to={`/${params.match.params.slug}/app`} />
                  )}
                />
                <Route exact path="/:slug/join">
                  {/* <ProjectAccessGate> */}
                  <LazyJoinProject />
                  {/* </ProjectAccessGate> */}
                </Route>
                <Route path="/:slug">
                  <Route
                    exact
                    path={`/:slug/edit-basemap/:id`}
                    render={(history) => {
                      const { id } = history.match.params;
                      const search = new URLSearchParams(
                        history.location.search || ""
                      );
                      const encodedCameraOptions = search.get("camera");
                      let cameraOptions: CameraOptions | undefined = undefined;
                      if (encodedCameraOptions) {
                        try {
                          const decoded = atob(encodedCameraOptions);
                          cameraOptions = JSON.parse(decoded);
                        } catch (e) {
                          console.warn(
                            "Problem decoding cameraOptions search parameter"
                          );
                          console.warn(e);
                        }
                      }
                      return (
                        <ProjectAccessGate admin={true}>
                          <LazyBasemapEditor
                            id={parseInt(id)}
                            returnToUrl={search.get("returnToUrl")}
                            cameraOptions={cameraOptions}
                          />
                        </ProjectAccessGate>
                      );
                    }}
                  ></Route>

                  <Route
                    path="/:slug/survey-editor/:surveyId/:subpath?"
                    render={(history) => {
                      const { slug, surveyId, subpath } = history.match.params;
                      let formElementId: number | null = null;
                      let route: "formElement" | "basic" | "logic" =
                        "formElement";
                      if (subpath) {
                        if (subpath === "basic") {
                          route = "basic";
                        } else if (subpath === "logic") {
                          route = "logic";
                        } else {
                          formElementId = parseInt(subpath);
                        }
                      }
                      return (
                        <ProjectAccessGate admin={true}>
                          <LazySurveyFormEditor
                            slug={slug}
                            surveyId={parseInt(surveyId)}
                            formElementId={formElementId}
                            route={route}
                          />
                        </ProjectAccessGate>
                      );
                    }}
                  ></Route>
                  <Route path="/:slug/admin">
                    <LazyProjectAdmin />
                  </Route>
                  <Route path={["/:slug/profile", "/:slug/app/:sidebar?"]}>
                    <ProjectAccessGate>
                      <LazyProjectApp />
                    </ProjectAccessGate>
                  </Route>
                  <Route
                    path="/:slug/surveys/:surveyId"
                    exact
                    render={(history) => {
                      const { slug, surveyId } = history.match.params;
                      return <Redirect to={`/${slug}/surveys/${surveyId}/0`} />;
                    }}
                  />
                  <Route path="/:slug/surveys/:surveyId/:position/:practice?">
                    <LazySurveyApp />
                  </Route>
                </Route>
              </Switch>
              <GlobalErrorHandler />
            </ClientCacheManagerProvider>
          </GlobalErrorHandlerContext.Provider>
        </Suspense>
      </HeadProvider>
    </div>
  );
}

export default App;

/**
 * If window.location.hostname is "next.seasket.ch", show a prompt for the
 * user to access seasketch from www.seasketch.org by showing a link. The
 * user may dismiss the prompt, and if so the dismissal will be remembered in localstorage
 */
function AuthoritativeDomainPrompt() {
  const { t } = useTranslation("homepage");
  const [dismissed, setDismissed] = useState(
    localStorage.getItem("authoritativeDomainPromptDismissed") === "true"
  );
  const location = useLocation();

  const wwwLink = useMemo(() => {
    const url = new URL(window.location.toString());
    url.hostname = "www.seasketch.org";
    return url.toString();
  }, [window.location.toString()]);

  const top = useMemo(() => {
    switch (location.pathname) {
      case "/":
      case "/about":
      case "/api":
      case "/projects":
        return false;
      default:
        return true;
    }
  }, [location.pathname]);

  if (window.location.hostname === "next.seasket.ch" && !dismissed) {
    return (
      <div
        className={`z-50 fixed left-0 right-0 bg-yellow-100 p-4 text-gray-800  ${
          top
            ? "top-0 shadow border-b border-gray-800"
            : "bottom-0 border-t border-gray-300"
        }`}
      >
        <div className="flex flex-row items-center">
          <span className="flex-grow">
            <Trans ns="homepage">
              You are accessing SeaSketch from the beta domain next.seasket.ch.
              For the best experience, please use{" "}
              <a className="text-primary-500 underline" href={wwwLink}>
                www.seasketch.org
              </a>
              . If you are using offline features{" "}
              <a
                className="text-primary-500 underline"
                href="https://github.com/seasketch/next/wiki/Offline-instructions-for-domain-change"
              >
                read these instructions
              </a>
              .
            </Trans>
          </span>
          <button
            className="ml-4"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem(
                "authoritativeDomainPromptDismissed",
                "true"
              );
            }}
          >
            {t("Dismiss")}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
