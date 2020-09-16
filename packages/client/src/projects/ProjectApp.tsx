import React, { Suspense } from "react";
import {
  useParams,
  Link,
  Switch,
  Route,
  useRouteMatch,
} from "react-router-dom";
import Header from "../header/Header";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";
import AdminApp from "../admin/AdminApp";

export default function ProjectApp() {
  const { slug } = useParams();
  let { path, url } = useRouteMatch();
  const { data, loading, error } = useCurrentProjectMetadataQuery({
    variables: {
      slug: slug || "",
    },
  });
  return (
    <div>
      <Switch>
        <Route exact path={path}>
          <Header projectMode />
          <nav className="max-w-lg mt-4 mx-auto text-center bg-white rounded shadow">
            {data && data.projectBySlug?.sessionIsAdmin && (
              <Link
                className="inline-block m-4 p-2 px-4 bg-primary-600 text-white shadow rounded"
                to={`/${slug}/admin`}
              >
                Admin
              </Link>
            )}
            <Link
              className="inline-block m-4 p-2 px-4 bg-primary-600 text-white shadow rounded"
              to={`/${slug}/map`}
            >
              Map
            </Link>
          </nav>
        </Route>
        <Route path={`${path}/admin`}>
          <AdminApp />
        </Route>
      </Switch>
    </div>
  );
}
