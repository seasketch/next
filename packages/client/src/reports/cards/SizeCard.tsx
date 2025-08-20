import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard, { ReportCardComponentProps } from "../ReportCard";
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

export type SizeCardConfiguration = ReportCardConfiguration<{}>;

export type SizeCardProps = ReportCardProps<SizeCardConfiguration>;

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

  const totalArea = useMemo(() => {
    return metrics.data.reduce((acc, metric) => {
      if (subjectIsFragment(metric.subject)) {
        return acc + metric.value;
      }
      return acc;
    }, 0);
  }, [metrics.data, metrics.loading]);

  const NumberFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
    style: "decimal",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

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
          <p>
            {NumberFormatter.format(totalArea)} {t("sq km")}
          </p>
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
