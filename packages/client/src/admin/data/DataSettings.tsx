import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  Link,
  Route,
  Switch,
  useParams,
  useRouteMatch,
} from "react-router-dom";
import Button from "../../components/Button";
import DataBucketSettings from "./DataBucketSettings";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import { Map } from "mapbox-gl";
import {
  LayerManagerContext,
  useLayerManager,
} from "../../dataLayers/LayerManager";
const LazyArcGISBrowser = React.lazy(() => import("./arcgis/ArcGISBrowser"));

export default function DataSettings() {
  const { path } = useRouteMatch();
  const { slug } = useParams<{ slug: string }>();
  const [map, setMap] = useState<Map>();
  const layerManager = useLayerManager();
  const { data, loading, error } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });
  useEffect(() => {
    if (map && data?.projectBySlug?.region) {
      const bounds = bbox(JSON.parse(data.projectBySlug.region.geojson)) as [
        number,
        number,
        number,
        number
      ];
      map.fitBounds(bounds, { duration: 0 });
      if (map) {
        layerManager.manager?.setMap(map);
      }
    }
  }, [map, data?.projectBySlug?.region]);
  return (
    <>
      <LayerManagerContext.Provider value={layerManager}>
        <Switch>
          <Route exact path={`${path}`}>
            <div className="flex flex-row h-full">
              <div className="h-full w-128">
                <LayerAdminSidebar />
              </div>
              <div className="flex-1 h-full">
                <MapboxMap
                  onLoad={(map) => {
                    setMap(map);
                  }}
                  className="h-full"
                />
              </div>
            </div>
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
      </LayerManagerContext.Provider>
    </>
  );
}
