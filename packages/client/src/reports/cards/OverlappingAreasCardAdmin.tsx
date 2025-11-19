import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useCardLocalizedStringAdmin } from "./cards";
import Switch from "../../components/Switch";
import AreaUnitSelect from "../components/AreaUnitSelect";
import CollapsibleFooterAdmin from "../components/CollapsibleFooterAdmin";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import SortSelect from "../components/SortSelect";

type AdminConfig = ReportCardConfiguration<{
  unit?: "km" | "mi" | "acres" | "ha";
  showZeroOverlapCategories?: boolean;
  sortBy?: "overlap" | "name";
}>;

export default function OverlappingAreasCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  useContext(FormLanguageContext);
  const unit = config.componentSettings?.unit ?? "km";
  const sortBy = config.componentSettings?.sortBy ?? "overlap";
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const updateSettings = (
    newSettings: Partial<NonNullable<AdminConfig["componentSettings"]>>
  ) => {
    updateComponentSettings(newSettings);
  };

  let multipeCategories =
    config.reportingLayers.some((l) => l.layerParameters?.groupBy) ||
    config.reportingLayers.length > 1;
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-900">
          {t("Display Units")}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {t("Choose the unit used to display area values.")}
        </p>
        <div className="mt-2">
          <AreaUnitSelect
            value={unit as any}
            onChange={(unit) => updateSettings({ unit })}
          />
        </div>
      </div>

      <SortSelect
        value={sortBy}
        onChange={(value) => updateSettings({ sortBy: value })}
        options={[
          { value: "overlap", labelKey: "by amount" },
          { value: "name", labelKey: "by name" },
        ]}
        descriptionKey="Choose how to order categories in the list."
      />

      {multipeCategories && (
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              {t("Show all categories")}
            </label>
            <p className="text-xs text-gray-500">
              {t("Include categories even if there is no overlap.")}
            </p>
          </div>
          <Switch
            isToggled={Boolean(
              config.componentSettings?.showZeroOverlapCategories
            )}
            onClick={(enabled: boolean) =>
              updateSettings({ showZeroOverlapCategories: enabled })
            }
          />
        </div>
      )}

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />

      <CollapsibleFooterAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
