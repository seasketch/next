import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import useDebounce from "../../useDebounce";
import { ReportWidget } from "./widgets";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  ReportWidgetTooltipControls,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { UnitSelector } from "./UnitSelector";
import { AreaUnit } from "../utils/units";
import { NumberRoundingControl } from "./NumberRoundingControl";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon } from "@radix-ui/react-icons";

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
  const { t } = useTranslation("reports");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const presentation =
    node.attrs.componentSettings.presentation || "total_area";

  const componentSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );

  const initialLabels = useMemo(
    () => ({
      geographyNameLabel: componentSettings.geographyNameLabel || "",
      areaLabel: componentSettings.areaLabel || "",
      percentLabel: componentSettings.percentLabel || "",
    }),
    [
      componentSettings.geographyNameLabel,
      componentSettings.areaLabel,
      componentSettings.percentLabel,
    ]
  );

  const [localState, setLocalState] = useState(initialLabels);
  const debouncedLocalState = useDebounce(localState, 100);

  // Sync local state when componentSettings change externally
  useEffect(() => {
    setLocalState(initialLabels);
  }, [initialLabels]);

  // Debounced update of componentSettings
  useEffect(() => {
    // Only update if values have actually changed from the current componentSettings
    if (
      debouncedLocalState.geographyNameLabel !==
        initialLabels.geographyNameLabel ||
      debouncedLocalState.areaLabel !== initialLabels.areaLabel ||
      debouncedLocalState.percentLabel !== initialLabels.percentLabel
    ) {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          geographyNameLabel:
            debouncedLocalState.geographyNameLabel || undefined,
          areaLabel: debouncedLocalState.areaLabel || undefined,
          percentLabel: debouncedLocalState.percentLabel || undefined,
        },
      });
    }
  }, [debouncedLocalState, initialLabels, componentSettings, onUpdate]);

  // Explicit save when popover closes
  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (!open) {
      // Popover is closing - ensure all current values are saved
      onUpdate({
        componentSettings: {
          ...componentSettings,
          geographyNameLabel: localState.geographyNameLabel || undefined,
          areaLabel: localState.areaLabel || undefined,
          percentLabel: localState.percentLabel || undefined,
        },
      });
    }
  };

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
        <Popover.Root
          open={isPopoverOpen}
          onOpenChange={handlePopoverOpenChange}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none"
            >
              <Pencil2Icon className="w-3 h-3" />
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {"headings"}
            </button>
          </Popover.Trigger>
          <TooltipPopoverContent title={t("Headings")}>
            <div className="space-y-3 px-1">
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Geography
                </label>
                <input
                  type="text"
                  value={localState.geographyNameLabel}
                  onChange={(e) =>
                    setLocalState((prev) => ({
                      ...prev,
                      geographyNameLabel: e.target.value,
                    }))
                  }
                  placeholder={t("Geography")}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Area
                </label>
                <input
                  type="text"
                  value={localState.areaLabel}
                  onChange={(e) =>
                    setLocalState((prev) => ({
                      ...prev,
                      areaLabel: e.target.value,
                    }))
                  }
                  placeholder={t("Area")}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Percent
                </label>
                <input
                  type="text"
                  value={localState.percentLabel}
                  onChange={(e) =>
                    setLocalState((prev) => ({
                      ...prev,
                      percentLabel: e.target.value,
                    }))
                  }
                  placeholder={t("Percent")}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </TooltipPopoverContent>
        </Popover.Root>
      </>
    );
  }
  return null;
};
