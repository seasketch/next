import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "../cards/cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import Switch from "../../components/Switch";

interface MapLayerVisibilityControlsAdminProps {
  config: ReportCardConfiguration<any>;
  onUpdate: ReportCardConfigUpdateCallback;
}

export default function MapLayerVisibilityControlsAdmin({
  config,
  onUpdate,
}: MapLayerVisibilityControlsAdminProps) {
  const { t } = useTranslation("admin:sketching");

  const isEnabled = config.displayMapLayerVisibilityControls !== false; // Default to true

  return (
    <div className="space-y-6">
      <div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              {t("Map Layer Visibility Controls")}
            </label>
            <p className="text-xs text-gray-500">
              {t(
                "Show map layer visibility controls for linked data layers in the card."
              )}
            </p>
          </div>
          <Switch
            isToggled={isEnabled}
            onClick={(enabled: boolean) => {
              onUpdate((prev) => ({
                ...prev,
                displayMapLayerVisibilityControls: enabled,
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
