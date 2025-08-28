import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { subjectIsFragment } from "overlay-engine";
import { useMetrics } from "../hooks/useMetrics";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useReportContext } from "../ReportContext";
import Skeleton from "../../components/Skeleton";
import { Trans } from "react-i18next";
import { RulerSquareIcon } from "@radix-ui/react-icons";
import { subjectIsGeography } from "overlay-engine/dist/metrics/metrics";

export type SizeCardConfiguration = ReportCardConfiguration<{}>;

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
}: SizeCardProps & {
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const langContext = useContext(FormLanguageContext);
  const reportContext = useReportContext();
  const allGeographyIds = useMemo(() => {
    return reportContext.geographies.map((g) => g.id);
  }, [reportContext.geographies]);

  const { t } = useTranslation("reports");

  const metrics = useMetrics({
    type: "total_area",
    // just fetch area stats for all geographies since it is easy to calculate
    geographyIds: allGeographyIds,
  });

  const sizeCardData: SizeCardData = useMemo(() => {
    if (metrics.loading) {
      return {
        area: 0,
        geographies: [],
      };
    }

    // Calculate total area from fragments
    const totalArea = metrics.data.reduce((acc, metric) => {
      if (subjectIsFragment(metric.subject)) {
        return acc + metric.value;
      }
      return acc;
    }, 0);

    // Filter and calculate geography statistics
    const geogs = reportContext.geographies.filter((g) => {
      const metric = metrics.data.find(
        (m) => subjectIsGeography(m.subject) && m.subject.id === g.id
      );
      return Boolean(metric && metric.value > 0);
    });

    const geographyStats = geogs.map((g) => {
      const geographyTotalArea =
        metrics.data.find(
          (m) =>
            subjectIsGeography(m.subject) &&
            m.subject.id === g.id &&
            m.type === "total_area"
        )?.value ?? 0;

      let overlapArea = 0;
      for (const m of metrics.data) {
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
  }, [metrics.data, metrics.loading, reportContext.geographies]);

  const AreaFormatter = useMemo(() => {
    return (value: number) => {
      if (value < 100) {
        return new Intl.NumberFormat(langContext?.lang?.code, {
          style: "decimal",
          unit: "kilometer",
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        }).format(value);
      } else {
        return new Intl.NumberFormat(langContext?.lang?.code, {
          style: "decimal",
          unit: "kilometer",
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        }).format(value);
      }
    };
  }, [langContext?.lang?.code]);

  const PercentageFormatter = useMemo(() => {
    return (value: number) => {
      if (value < 5) {
        return new Intl.NumberFormat(langContext?.lang?.code, {
          style: "percent",
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(value);
      } else {
        return new Intl.NumberFormat(langContext?.lang?.code, {
          style: "percent",
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        }).format(value);
      }
    };
  }, [langContext?.lang?.code]);

  return (
    <ReportCard
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
      config={config}
      className="pb-2"
      tint={config.tint}
      icon={config.icon}
    >
      <div>
        {metrics.loading ? (
          <Skeleton className="w-full h-4" />
        ) : (
          <div>
            <p>
              {t("This area is ")}
              <span className="tabular-nums text-base font-medium">
                {AreaFormatter(sizeCardData.area)} {t("km²")}
              </span>
              {sizeCardData.geographies.length > 0 && (
                <>
                  {t(", which is ")}
                  <span className="tabular-nums text-base font-medium">
                    {(() => {
                      const primaryGeography = sizeCardData.geographies.find(
                        (g) => g.primary
                      );
                      if (primaryGeography) {
                        return PercentageFormatter(
                          primaryGeography.overlap.fraction
                        );
                      }
                      return PercentageFormatter(1);
                    })()}
                  </span>
                  {t(" of the ")}
                  <span className="font-medium">
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
            {(() => {
              const secondaryGeographies = sizeCardData.geographies.filter(
                (g) => !g.primary && g.overlap.area > 0
              );
              if (secondaryGeographies.length > 0) {
                return (
                  <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                          >
                            {t("Additional Geographies")}
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
                          >
                            {t("area")}
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
                          >
                            {t("% of total")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {secondaryGeographies.map((g) => (
                          <tr
                            key={g.id}
                            className="odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                          >
                            <td className="px-3 py-2 text-sm text-gray-800">
                              {g.name}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                              {AreaFormatter(g.overlap.area)} {t("km²")}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-800 text-right tabular-nums">
                              {PercentageFormatter(g.overlap.fraction)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </ReportCard>
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
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Size</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display the total area of all geographies in square kilometers.
    </Trans>
  ),
  icon: SizeCardIcon,
});
