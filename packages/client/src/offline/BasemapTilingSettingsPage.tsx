import { CameraOptions } from "mapbox-gl";
import AdminOfflineTileSettingsMap from "./AdminOfflineTileSettingsMap";

export default function EditBasemapPage({
  id,
  returnToUrl,
  cameraOptions,
}: {
  id: number;
  returnToUrl?: string | null;
  cameraOptions?: CameraOptions;
}) {
  return (
    <div className="w-screen h-screen">
      <AdminOfflineTileSettingsMap
        basemapId={id}
        showMap={true}
        returnToUrl={returnToUrl || undefined}
        cameraOptions={cameraOptions}
      />
    </div>
  );
}
