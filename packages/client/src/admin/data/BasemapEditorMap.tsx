import { CameraOptions } from "mapbox-gl";
import MapboxMap from "../../components/MapboxMap";
import { BasemapDetailsFragment } from "../../generated/graphql";

export default function BasemapEditorPanelMap({
  basemap,
  cameraOptions,
}: {
  basemap: BasemapDetailsFragment;
  cameraOptions?: CameraOptions;
}) {
  return (
    <div className="w-full h-full">
      <MapboxMap className="w-full h-full" />
    </div>
  );
}
