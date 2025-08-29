import { useTranslation } from "react-i18next";
import { SizeCardConfiguration } from "./SizeCard";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import Switch from "../../components/Switch";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useCardLocalizedStringAdmin } from "./cards";
import LocalizedTextInput from "./LocalizedTextInput";

export default function SizeCardAdmin({
  config,
  onUpdate,
}: {
  config: SizeCardConfiguration;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  useContext(FormLanguageContext);
  const unit = config.componentSettings?.unit ?? "km";
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const updateSettings = (
    newSettings: Partial<
      NonNullable<SizeCardConfiguration["componentSettings"]>
    >
  ) => {
    updateComponentSettings(newSettings);
  };

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
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            value={unit}
            onChange={(e) => updateSettings({ unit: e.target.value as any })}
          >
            <option value="km">{t("km²")}</option>
            <option value="mi">{t("mi²")}</option>
            <option value="acres">{t("acres")}</option>
          </select>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-900">
          {t("Geographies")}
        </h4>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm text-gray-700">
              {t("Show all geographies in table")}
            </label>
            <p className="text-xs text-gray-500">
              {t("Include geographies in the table even if overlap is 0%.")}
            </p>
          </div>
          <Switch
            isToggled={Boolean(
              config.componentSettings?.showZeroOverlapGeographies
            )}
            onClick={(enabled: boolean) =>
              updateSettings({ showZeroOverlapGeographies: enabled })
            }
          />
        </div>
        {/* <div className="mt-4 space-y-3">
          <LocalizedTextInput
            config={config}
            onUpdate={onUpdate}
            settingKey="tableHeadingGeographies"
            label={t("Geographies column header")}
            placeholderDefault={t("Additional Geographies")}
          />
          <LocalizedTextInput
            config={config}
            onUpdate={onUpdate}
            settingKey="tableHeadingArea"
            label={t("Area column header")}
            placeholderDefault={t("area")}
          />
          <LocalizedTextInput
            config={config}
            onUpdate={onUpdate}
            settingKey="tableHeadingPercent"
            label={t("Percent column header")}
            placeholderDefault={t("% of total")}
          />
          <p className="text-xs text-gray-500">
            {t(
              "Use the language selector to enter localized labels. Non-English values are stored in alternateLanguageSettings."
            )}
          </p>
        </div> */}
      </div>
    </div>
  );
}
