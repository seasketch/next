import { Route, Switch, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import { MapContext, useMapContext } from "../../dataLayers/MapContextManager";
import DataUploadDropzone from "../uploads/ProjectBackgroundJobContext";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Legend from "../../dataLayers/Legend";
import useCommonLegendProps from "../../dataLayers/useCommonLegendProps";
import { TableOfContentsMetadataModalProvider } from "../../dataLayers/TableOfContentsMetadataModal";
import { LayerEditingContextProvider } from "./LayerEditingContext";
import { DataDownloadModalProvider } from "../../dataLayers/DataDownloadModal";

export default function DataSettings() {
  const { path } = useRouteMatch();
  const { slug } = useParams<{ slug: string }>();
  const mapContext = useMapContext({ preferencesKey: "data-settings" });
  const { data } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });

  const legendProps = useCommonLegendProps(mapContext);

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <MapContext.Provider value={mapContext}>
          <TableOfContentsMetadataModalProvider>
            <LayerEditingContextProvider>
              <DataDownloadModalProvider>
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
                        {legendProps.items.length > 0 && (
                          <Legend
                            editable
                            backdropBlur
                            maxHeight={800}
                            className="absolute ml-5 top-5 z-10"
                            opacity={{}}
                            zOrder={{}}
                            map={mapContext.manager?.map}
                            {...legendProps}
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
              </DataDownloadModalProvider>
            </LayerEditingContextProvider>
          </TableOfContentsMetadataModalProvider>
        </MapContext.Provider>
      </DndProvider>
    </>
  );
}
