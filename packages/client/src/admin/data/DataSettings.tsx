import { useMemo } from "react";
import { Route, Switch, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import { MapContext, useMapContext } from "../../dataLayers/MapContextManager";
import DataUploadDropzone from "../uploads/DataUploadDropzone";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Legend, { LegendItem } from "../../dataLayers/Legend";

export default function DataSettings() {
  const { path } = useRouteMatch();
  const { slug } = useParams<{ slug: string }>();
  const mapContext = useMapContext({ preferencesKey: "data-settings" });
  const { data } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });

  const legendState = useMemo<{ items: LegendItem[] }>(() => {
    if (mapContext.legends) {
      const visibleLegends: LegendItem[] = [];
      for (const id in mapContext.layerStatesByTocStaticId) {
        if (mapContext.layerStatesByTocStaticId[id].visible) {
          const legend = mapContext.legends[id];
          if (legend) {
            visibleLegends.push(legend);
          }
        }
      }
      visibleLegends.sort((a, b) => {
        return (a.zOrder || 0) - (b.zOrder || 0);
      });
      return { items: visibleLegends };
    } else {
      return { items: [] };
    }
  }, [mapContext.legends, mapContext.layerStatesByTocStaticId]);

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <MapContext.Provider value={mapContext}>
          <Switch>
            <Route path={`${path}`}>
              <DataUploadDropzone
                slug={slug}
                className="flex flex-row h-screen"
              >
                <div className="h-full w-128">
                  <LayerAdminSidebar />
                </div>
                <div className="flex-1 h-full">
                  {legendState.items.length > 0 && (
                    <Legend
                      backdropBlur
                      maxHeight={800}
                      className="absolute ml-5 top-5 z-10"
                      items={legendState.items}
                      hiddenItems={[]}
                      opacity={{}}
                      zOrder={{}}
                      map={mapContext.manager?.map}
                    />
                  )}
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
          </Switch>
        </MapContext.Provider>
      </DndProvider>
    </>
  );
}
