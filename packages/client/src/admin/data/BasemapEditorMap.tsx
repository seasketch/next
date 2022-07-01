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
  return (
    <div className="w-full h-full">
      <MapboxMap className="w-full h-full" />
    </div>
  );
}
