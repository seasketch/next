import { CameraOptions } from "mapbox-gl";
import { useMemo } from "react";
import MapboxMap from "../../components/MapboxMap";
import { MapContext } from "../../dataLayers/MapContextManager";
import { BasemapDetailsFragment } from "../../generated/graphql";
import useMapEssentials from "../surveys/useMapEssentials";

export default function BasemapEditorPanelMap({
  basemap,
  cameraOptions,
}: {
  basemap: BasemapDetailsFragment;
  cameraOptions?: CameraOptions;
}) {
  const basemapIds = useMemo(() => {
    return [basemap.id];
  }, [basemap]);
  const essentials = useMapEssentials({
    filterBasemapIds: basemapIds,
    cameraOptions,
  });
  return (
    <div className="w-full h-full">
      <MapContext.Provider value={essentials.mapContext}>
        <MapboxMap className="w-full h-full" />
      </MapContext.Provider>
    </div>
  );
}
