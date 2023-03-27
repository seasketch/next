import React from "react";
import {
  useParams,
  Link,
  Switch,
  Route,
  useRouteMatch,
} from "react-router-dom";
import Header from "../header/Header";
import { useTranslation, Trans } from "react-i18next";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
// import AdminApp from "../admin/AdminApp";
const LazyAdminApp = React.lazy(
  () => import(/* webpackChunkName: "AdminApp" */ "../admin/AdminApp")
);
const LazyProjectApp = React.lazy(
  () => import(/* webpackChunkName: "ProjectApp" */ "./ProjectApp")
);

export default function ProjectSimpleNav() {
  const { t } = useTranslation("admin");
  const { slug } = useParams<{ slug: string }>();
  let { path } = useRouteMatch();
  const { data } = useCurrentProjectMetadata();
  return (
    <div>
      <Switch>
        <Route exact path={path}>
          <Header />
          <nav className="max-w-lg mt-4 mx-auto text-center bg-white rounded shadow">
            {data && data.project?.sessionIsAdmin && (
              <Link
                className="inline-block m-4 p-2 px-4 bg-primary-600 text-white shadow rounded"
                to={`/${slug}/admin`}
              >
                <Trans ns="admin">Admin</Trans>
              </Link>
            )}
            <Link
              className="inline-block m-4 p-2 px-4 bg-primary-600 text-white shadow rounded"
              to={`/${slug}/app`}
            >
              <Trans ns="admin">Map</Trans>
            </Link>
          </nav>
        </Route>
        <Route path={`${path}/admin`}>
          <LazyAdminApp />
        </Route>
        <Route path={`${path}/app/:sidebar?`}>
          <LazyProjectApp />
        </Route>
      </Switch>
    </div>
  );
}
