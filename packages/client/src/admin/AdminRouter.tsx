import React from "react";
import { Route, Switch, useRouteMatch } from "react-router-dom";
import Spinner from "../components/Spinner";
import PhoneAccessGate from "./PhoneAccessGate";
import UserSettingsSidebarSkeleton from "./users/UserSettingsSidebarSkeleton";
import { useTranslation } from "react-i18next";

const LazyBasicSettings = React.lazy(
  /* webpackChunkName: "AdminSettings" */ () => import("./Settings")
);
const LazyDataSettings = React.lazy(
  () =>
    import(/* webpackChunkName: "AdminDataSettings" */ "./data/DataSettings")
);
const LazyUserSettings = React.lazy(
  () =>
    import(/* webpackChunkName: "AdminUserSettings" */ "./users/UserSettings")
);
const LazySurveyAdmin = React.lazy(
  () => import(/* webpackChunkName: "AdminSurveys" */ "./surveys/SurveyAdmin")
);

const LazyForumAdmin = React.lazy(
  () => import(/* webpackChunkName: "AdminForums" */ "./forums/ForumsAdmin")
);
const LazyOfflineAdmin = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminOffline" */ "../offline/AdminOfflineSettingsPage"
    )
);
const LazyActivityAdmin = React.lazy(
  () => import(/* webpackChunkName: "Activity" */ "./activity/ProjectDashboard")
);

const LazyBasemapTilingSettingsPage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminEditBasemapPage" */ "../offline/BasemapTilingSettingsPage"
    )
);

const LazySketchingAdmin = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminSketching" */ "./sketchClasses/SketchClassAdmin"
    )
);

const LazyGeographyAdmin = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminGeography" */ "./Geography/GeographyAdmin"
    )
);

export default function AdminRouter() {
  let { path } = useRouteMatch();
  const { t } = useTranslation("admin");

  return (
    <Switch key="route-switch">
      <Route exact path={`${path}`}>
        <React.Suspense fallback={<div></div>}>
          <LazyBasicSettings />
        </React.Suspense>
      </Route>
      <Route exact path={`${path}/activity`}>
        <React.Suspense fallback={<Spinner />}>
          <LazyActivityAdmin />
        </React.Suspense>
      </Route>
      <Route
        path={[
          `${path}/users`,
          `${path}/users`,
          `${path}/users/participants`,
          `${path}/users/invited`,
          `${path}/users/admins`,
          `${path}/users/invites/unsent`,
          `${path}/users/invites/sent`,
          `${path}/users/invites/bounced`,
          `${path}/users/invites/requests`,
          `${path}/users/groups/:group`,
        ]}
      >
        <React.Suspense fallback={<UserSettingsSidebarSkeleton />}>
          <LazyUserSettings />
        </React.Suspense>
      </Route>
      <Route path={`${path}/data`}>
        {/* <div className="h-screen"> */}
        <PhoneAccessGate
          heading={t("Data Layers")}
          message={t(
            "Data layer administration requires at least a tablet-sized screen."
          )}
        >
          <React.Suspense fallback={<div></div>}>
            <LazyDataSettings />
          </React.Suspense>
        </PhoneAccessGate>
        {/* </div> */}
      </Route>
      <Route path={`${path}/sketching`}>
        <React.Suspense fallback={<Spinner />}>
          <LazySketchingAdmin />
        </React.Suspense>
      </Route>
      <Route exact path={`${path}/forums/:id?`}>
        <React.Suspense fallback={<Spinner />}>
          <LazyForumAdmin />
        </React.Suspense>
      </Route>
      <Route path={`${path}/surveys/:surveyId?`}>
        <React.Suspense fallback={<Spinner />}>
          <LazySurveyAdmin />
        </React.Suspense>
      </Route>
      <Route
        exact
        path={`${path}/offline/basemap/:id`}
        render={(history) => {
          const { id } = history.match.params;
          const search = new URLSearchParams(history.location.search || "");
          return (
            <LazyBasemapTilingSettingsPage
              id={parseInt(id)}
              returnToUrl={search.get("returnToUrl")}
            />
          );
        }}
      ></Route>
      <Route path={`${path}/offline/:subpath?`}>
        <React.Suspense fallback={<Spinner />}>
          <LazyOfflineAdmin />
        </React.Suspense>
      </Route>
      <Route path={`${path}/geography`}>
        <React.Suspense fallback={<Spinner />}>
          <LazyGeographyAdmin />
        </React.Suspense>
      </Route>
    </Switch>
  );
}
