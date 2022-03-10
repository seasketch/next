import { CameraOptions } from "mapbox-gl";
import { useParams } from "react-router-dom";
import BasemapEditorPanel from "./BasemapEditorPanel";

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
      <BasemapEditorPanel
        basemapId={id}
        showMap={true}
        returnToUrl={returnToUrl || undefined}
        cameraOptions={cameraOptions}
      />
    </div>
  );
}
