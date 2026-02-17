import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LabeledDropdown } from "./LabeledDropdown";
import { TooltipInfoIcon } from "../../editor/TooltipMenu";

type RoundingValue = number | undefined;

type NumberRoundingControlProps = {
  value?: RoundingValue;
  onChange: (value?: RoundingValue) => void;
};

const SAMPLE_VALUE = 1.0;

/**
 * Reusable dropdown to control minimumFractionDigits component settings.
 */
export function NumberRoundingControl({
  value,
  onChange,
}: NumberRoundingControlProps) {
  const { t, i18n } = useTranslation("admin:reports");
  const locale = i18n.language;

  const autoLabelWithTooltip = useMemo(
    () => (
      <div className="flex items-center justify-between w-full -ml-2 pl-2">
        <span className="flex-1">{t("auto")}</span>
        <TooltipInfoIcon
          side="right"
          content={
            <div className="space-y-1.5">
              <div className="font-semibold">{t("Area:")}</div>
              <div>
                {t(
                  "Larger numbers (>100) are presented with no fractional digits. Smaller numbers will be displayed to one decimal place."
                )}
              </div>
              <div className="font-semibold pt-1">{t("Percentages:")}</div>
              <div>
                {t(
                  'Percentages > 5% will be rounded. Percentages > 0.9999 will be displayed as 100%., and values less than 0.1% will be displayed as "< 0.1%".'
                )}
              </div>
            </div>
          }
          className="-mr-1"
        />
      </div>
    ),
    [t]
  );

  const options = useMemo(() => {
    const formatLabel = (minDigits?: number) => {
      const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: minDigits,
      });
      return formatter.format(SAMPLE_VALUE);
    };

    return [
      {
        value: "auto" as const,
        label: autoLabelWithTooltip,
      },
      { value: "0" as const, label: formatLabel(0) },
      { value: "1" as const, label: formatLabel(1) },
      { value: "2" as const, label: formatLabel(2) },
      { value: "3" as const, label: formatLabel(3) },
    ];
  }, [locale, autoLabelWithTooltip]);

  const dropdownValue = value === undefined ? "auto" : String(value);

  return (
    <LabeledDropdown
      label={t("Rounding")}
      value={dropdownValue}
      title={t("Number rounding")}
      options={options}
      getDisplayLabel={(selected) => {
        // When dropdown is closed, show just the text without the tooltip icon
        if (selected?.value === "auto") {
          return t("auto");
        }
        return selected?.label;
      }}
      onChange={(next) => {
        if (next === "auto") {
          onChange(undefined);
        } else {
          const parsed = Number(next);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }
      }}
      ariaLabel={t("Number rounding")}
    />
  );
}
