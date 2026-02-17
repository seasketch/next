import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { ReportWidget, TableHeadingsEditor } from "./widgets";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import { NumberRoundingControl } from "./NumberRoundingControl";

export const GeographySizeTable: ReportWidget<{
  /**
   * Unit of measurement to display the area in.
   * @default "kilometer"
   */
  unit?: "hectare" | "acre" | "mile" | "kilometer";
  /**
   * Minimum fraction digits to display when formatting numbers.
   */
  minimumFractionDigits?: number;
  geographyNameLabel?: string;
  areaLabel?: string;
  percentLabel?: string;
  unitDisplay?: "long" | "short";
}> = ({
  metrics,
  componentSettings,
  geographies,
  loading,
  alternateLanguageSettings,
}) => {
  const { t } = useTranslation("reports");

  const widgetUnit = componentSettings?.unit ?? "kilometer";
  const minimumFractionDigits = componentSettings?.minimumFractionDigits;

  const formatters = useNumberFormatters({
    minimumFractionDigits,
    unit: widgetUnit,
    unitDisplay: componentSettings?.unitDisplay,
  });

  const rows: GeographySizeTableRow[] = useMemo(() => {
    return geographies.map((geography) => {
      const totalArea = metrics.reduce((acc, m) => {
        if (
          subjectIsFragment(m.subject) &&
          m.subject.geographies.includes(geography.id)
        ) {
          return acc + m.value;
        }
        return acc;
      }, 0);

      const metric = metrics.find(
        (m) => subjectIsGeography(m.subject) && m.subject.id === geography.id
      );
      const areaSqKm = metric?.value ?? 0;
      const fractionOfTotal = totalArea > 0 ? totalArea / areaSqKm : 0;

      return {
        geographyName: geography.name,
        areaSqKm,
        fractionOfTotal,
      };
    });
  }, [metrics, geographies]);

  return (
    <div className="mt-3.5 overflow-hidden rounded-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              {componentSettings.geographyNameLabel || t("Geography")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              {componentSettings.areaLabel || t("Area")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              {componentSettings.percentLabel || t("Percent")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr
              key={row.geographyName}
              className="odd:bg-white even:bg-gray-50 hover:bg-gray-100"
            >
              <td className="px-3 py-2 text-sm text-gray-800">
                {row.geographyName}
              </td>
              <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                {loading ? (
                  <MetricLoadingDots className="mr-1" />
                ) : (
                  formatters.area(row.areaSqKm)
                )}
              </td>
              <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                {loading ? (
                  <MetricLoadingDots className="mr-1" />
                ) : (
                  formatters.percent(row.fractionOfTotal)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type GeographySizeTableRow = {
  geographyName: string;
  areaSqKm: number;
  fractionOfTotal: number;
};

export const GeographySizeTableTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";

  const componentSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );

  if (presentation === "total_area") {
    const unit = componentSettings?.unit || "kilometer";
    const unitDisplay = componentSettings?.unitDisplay || "short";
    return (
      <>
        <UnitSelector
          unitType="area"
          value={unit as AreaUnit}
          unitDisplay={unitDisplay}
          onChange={(value: AreaUnit) =>
            onUpdate({
              componentSettings: { ...componentSettings, unit: value },
            })
          }
          onUnitDisplayChange={(display) =>
            onUpdate({
              componentSettings: { ...componentSettings, unitDisplay: display },
            })
          }
        />
        <NumberRoundingControl
          value={componentSettings?.minimumFractionDigits}
          onChange={(minimumFractionDigits) =>
            onUpdate({
              componentSettings: {
                ...componentSettings,
                minimumFractionDigits,
                roundToDecimalPlaces: minimumFractionDigits,
              },
            })
          }
        />
        <TableHeadingsEditor
          labelKeys={["geographyNameLabel", "areaLabel", "percentLabel"]}
          labelDisplayNames={["Geography", "Area", "Percent"]}
          componentSettings={componentSettings}
          onUpdate={onUpdate}
        />
      </>
    );
  }
  return null;
};
