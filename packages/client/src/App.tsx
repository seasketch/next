import React, { Suspense, useEffect, useState } from "react";
import { Switch, Route, Redirect } from "react-router-dom";
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

const LazyProjectApp = React.lazy(() => import("./projects/ProjectApp"));
const LazyProjectAdmin = React.lazy(() => import("./admin/AdminApp"));
const LazyAuthLanding = React.lazy(() => import("./auth/ProjectInviteLanding"));
const LazySurveyApp = React.lazy(() => import("./surveys/SurveyApp"));
const LazySurveyFormEditor = React.lazy(
  () => import("./admin/surveys/SurveyFormEditor")
);

function App() {
  const { user } = useAuth0();
  const { t } = useTranslation(["homepage"]);
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
            <Route
              path={[
                "/signin",
                "/projects",
                "/new-project",
                "/authenticate",
                "/",
                "/api",
                "/team",
              ]}
              exact
            >
              <Header />
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
              <Route exact path="/api"></Route>
              <Route exact path="/team"></Route>
              <Route path="/new-project">
                <NewProjectPage />
              </Route>
              <Route path="/authenticate">
                <span>
                  <Trans>authenticating...</Trans>
                </span>
              </Route>
              <Route exact path="/">
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
              <Route path="/:slug">
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
                <Route path="/:slug/app/:sidebar?">
                  <LazyProjectApp />
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
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <ProjectAccessGate>
                    <LazySurveyApp />
                  </ProjectAccessGate>
                </Route>
              </Route>
            </Switch>
            <GlobalErrorHandler />
          </GlobalErrorHandlerContext.Provider>
        </Suspense>
      </HeadProvider>
    </div>
  );
}

export default App;
