import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import CollapsibleFooterAdmin from "../components/CollapsibleFooterAdmin";

type AdminConfig = ReportCardConfiguration<{}>;

export default function PresenceCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  return (
    <div className="space-y-6">
      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />

      <CollapsibleFooterAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
