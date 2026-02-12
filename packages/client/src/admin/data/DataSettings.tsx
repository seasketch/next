import { Route, Switch, useParams, useRouteMatch } from "react-router-dom";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import {
  LegendsContext,
  MapManagerContext,
  MapOverlayContext,
  useMapContext,
} from "../../dataLayers/MapContextManager";
import { BasemapContext } from "../../dataLayers/BasemapContext";
import MapUIProvider from "../../dataLayers/MapUIContext";
import useMapData from "../../dataLayers/useMapData";
import DataUploadDropzone from "../uploads/ProjectBackgroundJobContext";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Legend, { LegendProps } from "../../dataLayers/Legend";
import useCommonLegendProps from "../../dataLayers/useCommonLegendProps";
import { TableOfContentsMetadataModalProvider } from "../../dataLayers/TableOfContentsMetadataModal";
import { LayerEditingContextProvider } from "./LayerEditingContext";
import { DataDownloadModalProvider } from "../../dataLayers/DataDownloadModal";
import { useMemo } from "react";
import mapboxgl from "mapbox-gl";

export default function DataSettings() {
  const { path } = useRouteMatch();
  const { slug } = useParams<{ slug: string }>();
  const { managerState, mapOverlayState, basemapState, legendsState } =
    useMapContext({
      preferencesKey: "data-settings",
    });
  const { manager } = managerState;
  const { basemaps, tableOfContentsItems, dataLayers, dataSources } =
    useMapData(manager, { draft: true });
  const { data } = useProjectRegionQuery({
    variables: {
      slug,
    },
  });

  const legendProps = useCommonLegendProps(
    {
      layerStatesByTocStaticId: mapOverlayState.layerStatesByTocStaticId,
      legends: legendsState.legends,
    },
    manager,
    {}
  );

  const BasemapContextValue = useMemo(
    () => ({ ...basemapState, basemaps }),
    [basemapState, basemaps]
  );
  const MapOverlayContextValue = useMemo(
    () => ({
      ...mapOverlayState,
      dataLayers,
      dataSources,
      tableOfContentsItems,
    }),
    [mapOverlayState, dataLayers, dataSources, tableOfContentsItems]
  );

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <MapManagerContext.Provider value={managerState}>
          <BasemapContext.Provider value={BasemapContextValue}>
            <MapOverlayContext.Provider value={MapOverlayContextValue}>
              <LegendsContext.Provider value={legendsState}>
                <MapUIProvider preferencesKey="data-settings">
                  <TableOfContentsMetadataModalProvider>
                    <LayerEditingContextProvider>
                      <DataDownloadModalProvider>
                        <Switch>
                          <Route path={`${path}`}>
                            <DataUploadDropzone
                              slug={slug}
                              className="flex flex-row h-screen"
                            >
                              <DataSettingsInner
                                map={manager?.map}
                                legendProps={legendProps}
                                bounds={
                                  data?.projectBySlug
                                    ? (bbox(
                                        data.projectBySlug.region.geojson
                                      ) as [number, number, number, number])
                                    : undefined
                                }
                                showMap={data?.projectBySlug !== undefined}
                              />
                            </DataUploadDropzone>
                          </Route>
                        </Switch>
                      </DataDownloadModalProvider>
                    </LayerEditingContextProvider>
                  </TableOfContentsMetadataModalProvider>
                </MapUIProvider>
              </LegendsContext.Provider>
            </MapOverlayContext.Provider>
          </BasemapContext.Provider>
        </MapManagerContext.Provider>
      </DndProvider>
    </>
  );
}

const DataSettingsInner = function DataSettingsInner({
  map,
  legendProps,
  bounds,
  showMap,
}: {
  map?: mapboxgl.Map;
  legendProps: Omit<LegendProps, "zOrder" | "opacity">;
  bounds?: [number, number, number, number];
  showMap?: boolean;
}) {
  return (
    <>
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
            map={map}
            {...legendProps}
          />
        )}
        {showMap && <MapboxMap bounds={bounds} className="h-full" />}
      </div>
    </>
  );
};
