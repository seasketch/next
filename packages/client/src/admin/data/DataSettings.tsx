import React, { useCallback, useEffect, useState } from "react";
import {
  Link,
  Route,
  Switch,
  useParams,
  useRouteMatch,
} from "react-router-dom";
import Button from "../../components/Button";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import { MapContext, useMapContext } from "../../dataLayers/MapContextManager";
import { useTranslation } from "react-i18next";
import DataUploadDropzone from "../uploads/DataUploadDropzone";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Legend, { LegendItem } from "../../dataLayers/Legend";

const LazyArcGISBrowser = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminArcGISBrowser" */ "./arcgis/ArcGISBrowser"
    )
);

export default function DataSettings() {
  const { path } = useRouteMatch();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation("admin");
  const mapContext = useMapContext({ preferencesKey: "data-settings" });
  const { data, loading, error } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });

  const [legendState, setLegendState] = useState<{ items: LegendItem[] }>({
    items: [],
  });

  useEffect(() => {
    if (mapContext.legends) {
      // TODO: this does't really handle WMS or dynamic map services
      const visibleLegends: LegendItem[] = [];
      for (const id in mapContext.layerStatesByTocStaticId) {
        if (mapContext.layerStatesByTocStaticId[id].visible) {
          const legend = mapContext.legends[id];
          if (legend) {
            visibleLegends.push(legend);
          }
        }
      }
      setLegendState({
        items: visibleLegends,
      });
    }
  }, [mapContext.legends, mapContext.layerStatesByTocStaticId]);

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <MapContext.Provider value={mapContext}>
          <Switch>
            <Route exact path={`${path}`}>
              <DataUploadDropzone
                slug={slug}
                className="flex flex-row h-screen"
              >
                <div className="h-full w-128">
                  <LayerAdminSidebar />
                </div>
                <div className="flex-1 h-full">
                  <Legend
                    maxHeight={800}
                    className="absolute ml-5 top-5 z-10"
                    items={legendState.items}
                    hiddenItems={[]}
                    opacity={{}}
                    zOrder={{}}
                    map={mapContext.manager?.map}
                  />
                  {data?.projectBySlug && (
                    <MapboxMap
                      bounds={
                        data?.projectBySlug
                          ? (bbox(data.projectBySlug.region.geojson) as [
                              number,
                              number,
                              number,
                              number
                            ])
                          : undefined
                      }
                      className="h-full"
                    />
                  )}
                </div>
              </DataUploadDropzone>
            </Route>
            <Route exact path={`${path}/add-data`}>
              <div className="pt-2 pb-6 md:py-6">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8">
                  <div className="mt-5 md:mt-0 md:col-span-2">
                    <div className="shadow sm:rounded-md sm:overflow-hidden">
                      <div className="px-4 py-5 bg-white sm:p-6">
                        {t(
                          "Area temporarily disabled. Drag and drop spatial data to the overlays list to upload."
                        )}
                        <div className="opacity-20 pointer-events-none mt-5">
                          <Link
                            to={`./add-data/arcgis`}
                            className="mx-2"
                            aria-disabled
                            component={Button}
                          >
                            {t("ArcGIS Server")}
                          </Link>
                          <Link
                            aria-disabled
                            to={`./add-data/esri`}
                            className="mx-2"
                            component={Button}
                          >
                            {t("WCS (WMS or WMTS)")}
                          </Link>
                        </div>
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
        </MapContext.Provider>
      </DndProvider>
    </>
  );
}
