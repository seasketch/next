import { useMemo } from "react";
import { MetricDependency } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { createMetricResolver } from "../utils/resolveMetric";
import { useReactNodeView } from "../ReactNodeView";

type InlineMetricSettings = {
  style?: keyof Intl.NumberFormatOptionsStyleRegistry;
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

function formatMetricValue(
  dependency: MetricDependency | undefined,
  settings: InlineMetricSettings,
  resolver: ReturnType<typeof createMetricResolver> | null
) {
  if (!dependency || !resolver) {
    return "N/A";
  }

  const geographyId =
    dependency.subjectType === "geographies" && dependency.geographies?.length
      ? String(dependency.geographies[0])
      : null;

  const {
    style = "decimal",
    unit,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = settings;

  const value = resolver.resolve(
    dependency.type,
    geographyId,
    style,
    unit,
    minimumFractionDigits,
    maximumFractionDigits
  );

  return value ?? "N/A";
}

export default function InlineMetric() {
  const { node } = useReactNodeView();
  const reportContext = useReportContext();

  const resolver = useMemo(() => {
    if (!reportContext?.metrics) {
      return null;
    }
    return createMetricResolver(reportContext.metrics);
  }, [reportContext?.metrics]);

  const { dependency, componentSettings } = useMemo(() => {
    const dep: MetricDependency | undefined = node?.attrs?.metrics?.[0];
    const settings: InlineMetricSettings = node?.attrs?.componentSettings || {};
    return { dependency: dep, componentSettings: settings };
  }, [node]);

  const value = useMemo(() => {
    return formatMetricValue(dependency, componentSettings, resolver);
  }, [dependency, componentSettings, resolver]);

  if (!dependency) {
    return (
      // eslint-disable-next-line i18next/no-literal-string
      <span className="metric font-semibold text-red-600">Metric missing</span>
    );
  }

  return (
    <span className="metric font-semibold hover:bg-blue-300/20 rounded-sm cursor-pointer inline-block">
      {value}
    </span>
  );
}
