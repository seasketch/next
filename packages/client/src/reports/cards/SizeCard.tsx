import { ReportCardConfiguration, ReportCardProps } from "./cards";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { lazy, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import Skeleton from "../../components/Skeleton";
import { Trans } from "react-i18next";
import { RulerSquareIcon } from "@radix-ui/react-icons";
import LocalizedText from "../components/LocalizedText";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { useUnits } from "../hooks/useUnits";

// Admin component for configuring the card
const SizeCardAdmin = lazy(() => import("./SizeCardAdmin"));

export type SizeCardConfiguration = ReportCardConfiguration<{
  /**
   * The unit of measurement to display the area in.
   * @default "km"
   */
  unit?: "km" | "mi" | "acres" | "ha";
  /**
   * When true, the table of additional geographies will include
   * geographies that have 0% overlap with the sketch.
   * When false, geographies with zero overlap are hidden.
   * @default false
   */
  showZeroOverlapGeographies?: boolean;
  /**
   * Column header text for the geographies column in the overlap table.
   * Provide the default/English text here. Translations should be stored
   * under config.alternateLanguageSettings[langCode].tableHeadingGeographies.
   * If not provided, defaults to i18n string for "Additional Geographies".
   */
  tableHeadingGeographies?: string;
  /**
   * Column header text for the area column in the overlap table.
   * Provide the default/English text here. Translations should be stored
   * under config.alternateLanguageSettings[langCode].tableHeadingArea.
   * If not provided, defaults to i18n string for "area".
   */
  tableHeadingArea?: string;
  /**
   * Column header text for the percent column in the overlap table.
   * Provide the default/English text here. Translations should be stored
   * under config.alternateLanguageSettings[langCode].tableHeadingPercent.
   * If not provided, defaults to i18n string for "% of total".
   */
  tableHeadingPercent?: string;
}>;

export type SizeCardProps = ReportCardProps<SizeCardConfiguration>;

type SizeCardData = {
  area: number;
  geographies: {
    id: number;
    name: string;
    primary: boolean;
    overlap: {
      area: number;
      fraction: number;
    };
  }[];
};

export function SizeCard({
  config,
  dragHandleProps,
  onUpdate,
  metrics,
  sources,
  loading,
  errors,
}: SizeCardProps & {
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const reportContext = useReportContext();

  const { t } = useTranslation("reports");

  const unit = config.componentSettings?.unit ?? "km";

  const sizeCardData: SizeCardData = useMemo(() => {
    if (loading) {
      return {
        area: 0,
        geographies: [],
      };
    }

    // Calculate total area from fragments
    const totalArea = metrics.reduce((acc, metric) => {
      if (subjectIsFragment(metric.subject)) {
        return acc + metric.value;
      }
      return acc;
    }, 0);

    // Filter and calculate geography statistics
    const geogs = reportContext.geographies.filter((g) => {
      const metric = metrics.find(
        (m) => subjectIsGeography(m.subject) && m.subject.id === g.id
      );
      return Boolean(metric && metric.value > 0);
    });

    const geographyStats = geogs.map((g) => {
      const geographyTotalArea =
        metrics.find(
          (m) =>
            subjectIsGeography(m.subject) &&
            m.subject.id === g.id &&
            m.type === "total_area"
        )?.value ?? 0;

      let overlapArea = 0;
      for (const m of metrics) {
        if (
          subjectIsFragment(m.subject) &&
          m.subject.geographies.includes(g.id)
        ) {
          overlapArea += m.value;
        }
      }

      return {
        id: g.id,
        name: g.name,
        primary: false, // Will be updated after determining the primary geography
        overlap: {
          area: overlapArea,
          fraction: overlapArea / geographyTotalArea,
        },
      };
    });

    // Determine primary geography based on largest overlap area
    const primaryGeographyId = geographyStats.reduce((primary, current) => {
      return current.overlap.area > primary.overlap.area ? current : primary;
    }, geographyStats[0]);

    // Mark the primary geography
    geographyStats.forEach((g) => {
      g.primary = g.id === primaryGeographyId.id;
    });

    return {
      area: totalArea,
      geographies: geographyStats,
    };
  }, [metrics, loading, reportContext.geographies]);

  const { unitLabel, convertFromBase } = useUnits({ category: "area", unit });

  const formatters = useNumberFormatters();

  // unitLabel provided by useAreaUnit

  const showZeros = Boolean(
    config.componentSettings?.showZeroOverlapGeographies
  );

  const secondaryGeographies = useMemo(() => {
    const list = sizeCardData.geographies
      .filter((g) => !g.primary && (showZeros ? true : g.overlap.area > 0))
      .sort((a, b) => {
        if (b.overlap.area !== a.overlap.area) {
          return b.overlap.area - a.overlap.area;
        }
        return a.name.localeCompare(b.name);
      });
    return list;
  }, [sizeCardData.geographies, showZeros]);

  return (
    <div>
      {loading ? (
        <Skeleton className="w-full h-4" />
      ) : (
        <div>
          <p className="text-[15px] line-height-[24px] py-2">
            {t("This area is ")}
            <span className="tabular-nums font-semibold">
              {formatters.area(convertFromBase(sizeCardData.area))} {unitLabel}
            </span>
            {sizeCardData.geographies.length > 0 && (
              <>
                {t(", which is ")}
                <span className="tabular-nums font-semibold">
                  {(() => {
                    const primaryGeography = sizeCardData.geographies.find(
                      (g) => g.primary
                    );
                    if (primaryGeography) {
                      return formatters.percent(
                        primaryGeography.overlap.fraction
                      );
                    }
                    return formatters.percent(1);
                  })()}
                </span>
                {t(" of the ")}
                <span className="font-semibold">
                  {(() => {
                    const primaryGeography = sizeCardData.geographies.find(
                      (g) => g.primary
                    );
                    return primaryGeography?.name || t("total area");
                  })()}
                </span>
                {t(".")}
              </>
            )}
          </p>
          {secondaryGeographies.length > 0 ? (
            <GeographiesTable
              config={config}
              onUpdate={onUpdate}
              secondaryGeographies={secondaryGeographies}
              unitLabel={unitLabel}
              AreaFormatter={(n) => formatters.area(convertFromBase(n))}
              PercentageFormatter={(n) => formatters.percent(n)}
              editable
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

const defaultComponentSettings: SizeCardConfiguration["componentSettings"] = {};

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Size",
        },
      ],
    },
  ],
};

function SizeCardIcon() {
  return (
    <div className="bg-blue-100 w-full h-full text-blue-600 flex justify-center items-center rounded">
      <RulerSquareIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "Size",
  component: SizeCard,
  adminComponent: SizeCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Size</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display the total area of all geographies in square kilometers.
    </Trans>
  ),
  icon: SizeCardIcon,
  order: 1,
});

function GeographiesTable({
  config,
  onUpdate,
  secondaryGeographies,
  unitLabel,
  AreaFormatter,
  PercentageFormatter,
  editable,
}: {
  config: SizeCardConfiguration;
  onUpdate?: ReportCardConfigUpdateCallback;
  secondaryGeographies: {
    id: number;
    name: string;
    overlap: { area: number; fraction: number };
  }[];
  unitLabel: string;
  AreaFormatter: (n: number) => string;
  PercentageFormatter: (n: number) => string;
  editable: boolean;
}) {
  const { t } = useTranslation("reports");
  return (
    <div className="mt-3.5 overflow-hidden rounded-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              <LocalizedText
                config={config}
                onUpdate={onUpdate}
                cardId={config.id}
                settingKey="tableHeadingGeographies"
                fallback={t("Additional Geographies")}
                editable={editable}
                className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600 truncate"
              />
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              <LocalizedText
                config={config}
                onUpdate={onUpdate}
                cardId={config.id}
                settingKey="tableHeadingArea"
                fallback={t("area")}
                editable={editable}
                className="text-right text-xs font-semibold uppercase tracking-wide text-gray-600 truncate"
              />
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              <LocalizedText
                config={config}
                onUpdate={onUpdate}
                cardId={config.id}
                settingKey="tableHeadingPercent"
                fallback={t("% of total")}
                editable={editable}
                className="text-right text-xs font-semibold uppercase tracking-wide text-gray-600 truncate"
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {secondaryGeographies.map((g) => (
            <tr
              key={g.id}
              className={`odd:bg-white even:bg-gray-50 hover:bg-gray-100`}
            >
              <td className="px-3 py-2 text-sm text-gray-800">
                <span className={g.overlap.area === 0 ? "opacity-50" : ""}>
                  {g.name}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                <span className={g.overlap.area === 0 ? "opacity-50" : ""}>
                  {AreaFormatter(g.overlap.area)} {unitLabel}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                <span className={g.overlap.area === 0 ? "opacity-50" : ""}>
                  {PercentageFormatter(g.overlap.fraction)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
