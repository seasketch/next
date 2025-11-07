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
    config.reportingLayers.some((l) => l.groupBy) ||
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

      <div>
        <label className="text-sm font-medium text-gray-900">
          {t("Sort items")}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {t("Choose how to order categories in the list.")}
        </p>
        <div className="mt-2">
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={sortBy}
            onChange={(e) => updateSettings({ sortBy: e.target.value as any })}
          >
            <option value="overlap">{t("by amount")}</option>
            <option value="name">{t("by name")}</option>
          </select>
        </div>
      </div>

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
