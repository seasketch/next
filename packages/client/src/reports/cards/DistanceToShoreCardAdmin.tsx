import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { LengthDisplayUnit } from "../hooks/useUnits";

type AdminConfig = ReportCardConfiguration<{
  unit?: LengthDisplayUnit;
}>;

export default function DistanceToShoreCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");

  const unit = config.componentSettings?.unit ?? "km";

  const updateUnit = (newUnit: LengthDisplayUnit) => {
    onUpdate((prev) => ({
      ...prev,
      componentSettings: {
        ...(prev.componentSettings || {}),
        unit: newUnit,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-900">
          {t("Distance unit")}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {t(
            "Choose how to display distance to shore. Kilometers will automatically switch to meters for distances under 1 km."
          )}
        </p>
        <select
          className="mt-2 block w-full rounded-md border-gray-300 shadow-sm text-sm"
          value={unit}
          onChange={(e) => updateUnit(e.target.value as LengthDisplayUnit)}
        >
          <option value="km">
            {t("Kilometers / meters (auto below 1 km)")}
          </option>
          <option value="mi">{t("Miles")}</option>
          <option value="nm">{t("Nautical miles")}</option>
        </select>
      </div>

    </div>
  );
}
