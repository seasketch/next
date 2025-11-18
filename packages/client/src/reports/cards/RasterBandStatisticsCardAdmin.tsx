import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useCardLocalizedStringAdmin } from "./cards";
import Switch from "../../components/Switch";
import CollapsibleFooterAdmin from "../components/CollapsibleFooterAdmin";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";

type AdminConfig = ReportCardConfiguration<{
  displayStats?: {
    min?: boolean;
    max?: boolean;
    mean?: boolean;
    stdev?: boolean;
    histogram?: boolean;
  };
}>;

export default function RasterBandStatisticsCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  useContext(FormLanguageContext);
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const displayStats = config.componentSettings?.displayStats || {
    min: true,
    max: true,
    mean: true,
    stdev: true,
    histogram: true,
  };

  const updateSettings = (
    newSettings: Partial<NonNullable<AdminConfig["componentSettings"]>>
  ) => {
    updateComponentSettings(newSettings);
  };

  const updateDisplayStats = (
    statName: keyof NonNullable<AdminConfig["componentSettings"]>["displayStats"],
    enabled: boolean
  ) => {
    updateSettings({
      displayStats: {
        ...displayStats,
        [statName]: enabled,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-900">
          {t("Display Statistics")}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {t("Select which statistics to display in the table.")}
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                {t("Minimum")}
              </label>
            </div>
            <Switch
              isToggled={Boolean(displayStats.min)}
              onClick={(enabled: boolean) => updateDisplayStats("min", enabled)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                {t("Maximum")}
              </label>
            </div>
            <Switch
              isToggled={Boolean(displayStats.max)}
              onClick={(enabled: boolean) => updateDisplayStats("max", enabled)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                {t("Mean")}
              </label>
            </div>
            <Switch
              isToggled={Boolean(displayStats.mean)}
              onClick={(enabled: boolean) => updateDisplayStats("mean", enabled)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                {t("Standard Deviation")}
              </label>
            </div>
            <Switch
              isToggled={Boolean(displayStats.stdev)}
              onClick={(enabled: boolean) =>
                updateDisplayStats("stdev", enabled)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                {t("Histogram")}
              </label>
            </div>
            <Switch
              isToggled={Boolean(displayStats.histogram)}
              onClick={(enabled: boolean) =>
                updateDisplayStats("histogram", enabled)
              }
            />
          </div>
        </div>
      </div>

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />

      <CollapsibleFooterAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}

