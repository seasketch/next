import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { ReportWidget, TableHeadingsEditor } from "./widgets";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import { NumberRoundingControl } from "./NumberRoundingControl";
import { useBaseReportContext } from "../context/BaseReportContext";

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
  /** Geography IDs to exclude from the table. */
  excludeGeographies?: number[];
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

  const excludeSet = useMemo(
    () => new Set(componentSettings?.excludeGeographies ?? []),
    [componentSettings?.excludeGeographies]
  );

  const rows: GeographySizeTableRow[] = useMemo(() => {
    return geographies
      .filter((geography) => !excludeSet.has(geography.id))
      .map((geography) => {
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
          geographyId: geography.id,
          geographyName: geography.name,
          areaSqKm,
          fractionOfTotal,
        };
      });
  }, [metrics, geographies, excludeSet]);

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
              key={row.geographyId}
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
  geographyId: number;
  geographyName: string;
  areaSqKm: number;
  fractionOfTotal: number;
};

function GeographiesPopover({
  geographies,
  excludeGeographies,
  onUpdate,
  componentSettings,
  t,
}: {
  geographies: Pick<{ id: number; name: string }, "id" | "name">[];
  excludeGeographies: number[];
  onUpdate: (attrs: Record<string, any>) => void;
  componentSettings: Record<string, any>;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const excludedSet = new Set(excludeGeographies);
  const includedCount = geographies.length - excludeGeographies.length;

  const displayLabel =
    excludeGeographies.length === 0
      ? t("all")
      : // eslint-disable-next-line i18next/no-literal-string
        `some (${includedCount}/${geographies.length})`;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-800">
      <span className="font-light text-gray-400 whitespace-nowrap">
        {t("Geographies")}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex-1 h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none justify-end min-w-0"
          >
            <span className="truncate">{displayLabel}</span>
            <CaretDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        </Popover.Trigger>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-50 w-56 p-1"
        >
          <div className="max-h-64 overflow-auto space-y-1 pb-1">
            {geographies.map((geography) => {
              const checked = !excludedSet.has(geography.id);
              return (
                <label
                  key={geography.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={checked}
                    onChange={(e) => {
                      const nextExcluded = new Set(excludeGeographies);
                      if (e.target.checked) {
                        nextExcluded.delete(geography.id);
                      } else {
                        nextExcluded.add(geography.id);
                      }
                      onUpdate({
                        componentSettings: {
                          ...componentSettings,
                          excludeGeographies: Array.from(nextExcluded),
                        },
                      });
                    }}
                  />
                  <span className="flex-1 min-w-0 truncate">
                    {geography.name}
                  </span>
                </label>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

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

  const { geographies } = useBaseReportContext();
  const { t } = useTranslation("admin:reports");

  if (presentation === "total_area") {
    const unit = componentSettings?.unit || "kilometer";
    const unitDisplay = componentSettings?.unitDisplay || "short";
    return (
      <>
        <GeographiesPopover
          geographies={geographies}
          excludeGeographies={componentSettings?.excludeGeographies ?? []}
          onUpdate={onUpdate}
          componentSettings={componentSettings}
          t={t}
        />
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
