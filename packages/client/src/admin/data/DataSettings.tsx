import React from "react";
import {
  Link,
  Route,
  Switch,
  useParams,
  useRouteMatch,
} from "react-router-dom";
import Button from "../../components/Button";
import DataBucketSettings from "./DataBucketSettings";
const LazyArcGISBrowser = React.lazy(() => import("./arcgis/ArcGISBrowser"));

export default function DataSettings() {
  const { path } = useRouteMatch();
  return (
    <>
      <Switch>
        <Route exact path={`${path}`}>
          <Link to={`./data/add-data`} component={Button}>
            Add Data
          </Link>
          <DataBucketSettings className="m-5 max-w-xl" />
        </Route>
        <Route exact path={`${path}/add-data`}>
          <div className="pt-2 pb-6 md:py-6">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
              <div className="mt-5 md:mt-0 md:col-span-2">
                <div className="shadow sm:rounded-md sm:overflow-hidden">
                  <div className="px-4 py-5 bg-white sm:p-6">
                    <Link
                      to={`./add-data/arcgis`}
                      className="mx-2"
                      component={Button}
                    >
                      ArcGIS Server
                    </Link>
                    <Link
                      to={`./add-data/esri`}
                      className="mx-2"
                      component={Button}
                    >
                      WCS (WMS or WMTS)
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Route>
        <Route exact path={`${path}/add-data/arcgis`}>
          <LazyArcGISBrowser />
        </Route>
      </Switch>
    </>
  );
}
