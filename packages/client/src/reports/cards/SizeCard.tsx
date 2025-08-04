import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard, { ReportCardComponentProps } from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { lazy, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TotalAreaMetric, subjectIsFragment } from "overlay-engine";
import { useMetrics } from "../hooks/useMetrics";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useReportContext } from "../ReportContext";

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
  const { t } = useTranslation("reports");
  const metrics = useMetrics({
    type: "total_area",
  });
  const totalArea = useMemo(() => {
    return metrics.data
      .filter((d) => subjectIsFragment(d.subject))
      .reduce((acc, metric) => {
        return acc + metric.value;
      }, 0);
  }, [metrics.data]);

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
        <p>
          {NumberFormatter.format(totalArea)} {t("sq km")}
        </p>
      </div>
    </ReportCard>
  );
}

const defaultComponentSettings: SizeCardConfiguration["componentSettings"] = {};

registerReportCardType({
  type: "Size",
  component: SizeCard,
  defaultSettings: defaultComponentSettings,
  pickerSettings: {
    componentSettings: defaultComponentSettings,
    body: {
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
    },
  },
  // requiredMetrics: (componentSettings) => {

  // }
  // adminComponent: lazy(() => import("./SizeCardAdmin")),
});
