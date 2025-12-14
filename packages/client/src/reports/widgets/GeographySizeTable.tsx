import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { ReportWidget } from "./widgets";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";

export const GeographySizeTable: ReportWidget<{
  /**
   * Unit of measurement to display the area in.
   * @default "kilometer"
   */
  unit?: "hectare" | "acre" | "mile" | "kilometer";
  /**
   * Number of decimal places to round values to. If not specified, assumed to
   * be "auto", in which case it will use the default rounding behavior of the
   * useNumberFormatters hook.
   *
   * @default undefined
   */
  roundToDecimalPlaces?: number;
}> = ({ metrics, componentSettings, geographies, loading }) => {
  const { t } = useTranslation("reports");

  const widgetUnit = componentSettings?.unit ?? "kilometer";

  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings?.roundToDecimalPlaces,
    unit: widgetUnit,
  });

  const rows: GeographySizeTableRow[] = useMemo(() => {
    const totalArea = metrics.reduce((acc, m) => {
      if (subjectIsFragment(m.subject)) {
        return acc + m.value;
      }
      return acc;
    }, 0);

    return geographies.map((geography) => {
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
              {t("Geography")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              {t("Area")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              {t("Percent")}
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
