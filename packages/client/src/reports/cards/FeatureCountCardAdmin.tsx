import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useCardLocalizedStringAdmin } from "./cards";
import Switch from "../../components/Switch";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import SortSelect from "../components/SortSelect";

type AdminConfig = ReportCardConfiguration<{
  showZeroCountCategories?: boolean;
  sortBy?: "count" | "name";
}>;

export default function FeatureCountCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  useContext(FormLanguageContext);
  const sortBy = config.componentSettings?.sortBy ?? "count";
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const updateSettings = (
    newSettings: Partial<NonNullable<AdminConfig["componentSettings"]>>
  ) => {
    updateComponentSettings(newSettings);
  };

  const hasGroupBy = false;
  // config.reportingLayers.some(
  //   (l) => l.layerParameters?.groupBy
  // );

  return (
    <div className="space-y-6">
      <SortSelect
        value={sortBy}
        onChange={(value) => updateSettings({ sortBy: value })}
        options={[
          { value: "count", labelKey: "by count" },
          { value: "name", labelKey: "by name" },
        ]}
        descriptionKey="Choose how to order items in the list."
      />

      {hasGroupBy && (
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              {t("Show all categories")}
            </label>
            <p className="text-xs text-gray-500">
              {t("Include categories even if there are no features.")}
            </p>
          </div>
          <Switch
            isToggled={Boolean(
              config.componentSettings?.showZeroCountCategories
            )}
            onClick={(enabled: boolean) =>
              updateSettings({ showZeroCountCategories: enabled })
            }
          />
        </div>
      )}

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
