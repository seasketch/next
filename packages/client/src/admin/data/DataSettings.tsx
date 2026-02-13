import { Route, Switch, useRouteMatch } from "react-router-dom";
import getSlug from "../../getSlug";
import MapboxMap from "../../components/MapboxMap";
import LayerAdminSidebar from "./LayerAdminSidebar";
import { useProjectRegionQuery } from "../../generated/graphql";
import bbox from "@turf/bbox";
import {
  LegendsContext,
  MapManagerContext,
  MapOverlayContext,
} from "../../dataLayers/MapContextManager";
import BasemapContextProvider from "../../dataLayers/BasemapContext";
import MapManagerContextProvider from "../../dataLayers/MapManagerContextProvider";
import MapUIProvider from "../../dataLayers/MapUIContext";
import useMapData from "../../dataLayers/useMapData";
import DataUploadDropzone from "../uploads/ProjectBackgroundJobContext";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Legend from "../../dataLayers/Legend";
import useCommonLegendProps from "../../dataLayers/useCommonLegendProps";
import { TableOfContentsMetadataModalProvider } from "../../dataLayers/TableOfContentsMetadataModal";
import { LayerEditingContextProvider } from "./LayerEditingContext";
import { DataDownloadModalProvider } from "../../dataLayers/DataDownloadModal";
import { useContext } from "react";

/**
 * Reads legend state from context so it stays in sync with the manager.
 */
function DataSettingsLegend() {
  const { manager } = useContext(MapManagerContext);
  const overlayState = useContext(MapOverlayContext);
  const legendsState = useContext(LegendsContext);
  const legendProps = useCommonLegendProps(
    {
      layerStatesByTocStaticId: overlayState.layerStatesByTocStaticId,
      legends: legendsState.legends,
    },
    manager,
    {}
  );

  if (legendProps.items.length === 0) return null;
  return (
    <Legend
      editable
      backdropBlur
      maxHeight={800}
      className="absolute ml-5 top-5 z-10"
      opacity={{}}
      zOrder={{}}
      map={manager?.map}
      {...legendProps}
    />
  );
}

export default function DataSettings() {
  const { path } = useRouteMatch();
  const slug = getSlug();
  const { basemaps, dataLayers, dataSources, tableOfContentsItems } =
    useMapData({ draft: true });
  const { data } = useProjectRegionQuery({
    variables: { slug },
  });

  const bounds = data?.projectBySlug
    ? (bbox(data.projectBySlug.region.geojson) as [
        number,
        number,
        number,
        number
      ])
    : undefined;

  return (
    <DndProvider backend={HTML5Backend}>
      <BasemapContextProvider
        basemaps={basemaps}
        preferencesKey={`${slug}-data-settings-basemap`}
      >
        <MapOverlayContext.Provider
          value={{
            layerStatesByTocStaticId: {},
            styleHash: "",
            dataLayers,
            dataSources,
            tableOfContentsItems,
          }}
        >
          <MapManagerContextProvider preferencesKey={`${slug}-data-settings`}>
            <MapUIProvider preferencesKey={`${slug}-data-settings-ui`}>
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
                            <DataSettingsLegend />
                            {data?.projectBySlug && (
                              <MapboxMap bounds={bounds} className="h-full" />
                            )}
                          </div>
                        </DataUploadDropzone>
                      </Route>
                    </Switch>
                  </DataDownloadModalProvider>
                </LayerEditingContextProvider>
              </TableOfContentsMetadataModalProvider>
            </MapUIProvider>
          </MapManagerContextProvider>
        </MapOverlayContext.Provider>
      </BasemapContextProvider>
    </DndProvider>
  );
}
