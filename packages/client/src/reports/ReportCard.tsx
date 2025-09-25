import { Trans, useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import {
  getCardComponent,
  ReportCardConfigUpdateCallback,
} from "./registerCard";
import { LocalMetric, useReportContext } from "./ReportContext";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import { TrashIcon } from "@heroicons/react/outline";
import { FormLanguageContext } from "../formElements/FormElement";
import {
  useContext,
  useCallback,
  useEffect,
  Component,
  useState,
  useMemo,
} from "react";
import { prosemirrorToHtml } from "./utils/prosemirrorToHtml";
import ReportCardBodyEditor from "./components/ReportCardBodyEditor";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import Badge from "../components/Badge";
import Button from "../components/Button";
import {
  SpatialMetricState,
  useRetryFailedSpatialMetricsMutation,
} from "../generated/graphql";
import Skeleton from "../components/Skeleton";
import ReportMetricsProgressDetails from "./ReportMetricsProgressDetails";

export type ReportCardIcon = "info" | "warning" | "error";

export type ReportCardComponentProps = {
  tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  icon?: ReportCardIcon;
  children?: React.ReactNode;
  dragHandleProps?: any; // Props from react-beautiful-dnd Draggable
  cardId?: number; // ID of the card for edit functionality
  onUpdate?: ReportCardConfigUpdateCallback; // Single update callback
  className?: string;
  metrics: Pick<LocalMetric, "id" | "state" | "errorMessage">[];
  skeleton?: React.ReactNode;
};

// Icon mapping for named icons (no color classes, will inherit from parent)
const iconMap = {
  info: <InfoCircledIcon className="w-5 h-5" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5" />,
  error: <CrossCircledIcon className="w-5 h-5" />,
};

export default function ReportCard({
  tint = "text-black",
  backgroundTint,
  icon,
  children,
  dragHandleProps,
  cardId,
  onUpdate,
  config,
  className,
  metrics,
  skeleton,
}: ReportCardComponentProps & {
  config: ReportCardConfiguration<any>;
}) {
  const { t } = useTranslation("admin:sketching");
  const { adminMode, selectedForEditing, setSelectedForEditing, deleteCard } =
    useReportContext();
  const langContext = useContext(FormLanguageContext);
  const { alternateLanguageSettings } = config;

  const { errors, failedMetrics, loading } = useMemo(() => {
    console.log("metrics", metrics);
    const errors = {} as { [key: string]: number };
    let loading = false;
    const failedMetrics = [] as number[];
    for (const metric of metrics) {
      if (metric.state === SpatialMetricState.Error) {
        let errorMessage = metric.errorMessage || "Unknown error";
        if (errorMessage in errors) {
          errors[errorMessage]++;
        } else {
          errors[errorMessage] = 1;
        }
        failedMetrics.push(metric.id);
      } else if (metric.state !== SpatialMetricState.Complete) {
        loading = true;
      }
    }
    return { errors, failedMetrics, loading };
  }, [metrics]);

  const [retry, retryState] = useRetryFailedSpatialMetricsMutation({
    variables: {
      metricIds: failedMetrics,
    },
  });

  if (Object.keys(errors).length > 0) {
    tint = "text-red-500";
  }

  const handleBodyUpdate = useCallback(
    (newBody: any) => {
      if (onUpdate) {
        if (langContext?.lang?.code !== "EN") {
          // Save to alternateLanguageSettings for non-English languages
          onUpdate((prevState) => ({
            ...prevState,
            alternateLanguageSettings: {
              ...prevState.alternateLanguageSettings,
              [langContext.lang.code]: {
                ...prevState.alternateLanguageSettings[langContext.lang.code],
                body: newBody,
              },
            },
          }));
        } else {
          onUpdate((prevState) => ({
            ...prevState,
            body: newBody,
          }));
        }
      }
    },
    [onUpdate, config, langContext?.lang?.code]
  );

  const getBackgroundClasses = () => {
    if (Object.keys(errors).length > 0) {
      return "bg-red-50 border border-red-500/10";
    }
    switch (backgroundTint) {
      case "blue":
        return "bg-blue-50 border border-blue-500/10";
      case "yellow":
        return "bg-yellow-50 border border-yellow-400/15";
      case "red":
        return "bg-red-50 border border-red-500/10";
      default:
        return "bg-white border border-black/0";
    }
  };

  const isSelectedForEditing = selectedForEditing === cardId;
  const isDisabled = selectedForEditing && !isSelectedForEditing;

  // Get localized body
  let localizedBody = config.body;
  if (
    langContext?.lang?.code !== "EN" &&
    alternateLanguageSettings[langContext?.lang?.code]?.body
  ) {
    localizedBody = alternateLanguageSettings[langContext.lang.code].body;
  }

  const isReady = !loading && !Object.keys(errors).length;

  const loadingSkeleton = useMemo(() => {
    if (skeleton) {
      return skeleton;
    }
    return (
      <div className="w-full space-y-1">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>
    );
  }, [skeleton]);

  return (
    <div
      className={`transition-opacity opacity-100 relative rounded w-full shadow-sm ${getBackgroundClasses()} group ${
        isSelectedForEditing ? "ring-2 ring-opacity-80 ring-blue-500" : ""
      } ${
        isDisabled ? "opacity-60 pointer-events-none select-none" : ""
      } ${className}`}
    >
      <div className={`absolute top-0.5 w-full p-4 pb-1 ${tint}`}>
        <div className="flex items-center space-x-2" {...dragHandleProps}>
          {icon && iconMap[icon] ? (
            <div className="flex-shrink-0">{iconMap[icon]}</div>
          ) : (
            <div className="flex-shrink-0 w-4 h-4" />
          )}
        </div>
      </div>
      <div className="absolute right-2 top-2">
        <div>
          {adminMode && !selectedForEditing && cardId && (
            <div className="flex-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 justify-end">
              {deleteCard && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCard(cardId);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  title={t("Delete card")}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedForEditing(cardId);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                title={t("Edit card")}
              >
                <Pencil1Icon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-0 text-sm">
        {adminMode && selectedForEditing === cardId ? (
          <ReportCardBodyEditor
            body={localizedBody}
            onUpdate={handleBodyUpdate}
            className={`${tint} ${icon ? "hasIcon" : ""}`}
          />
        ) : (
          <div
            className={`ReportCard ReportCardBody ProseMirrorBody ${
              icon ? "hasIcon" : ""
            } ${tint ? tint : ""}`}
            dangerouslySetInnerHTML={{
              __html: prosemirrorToHtml(localizedBody),
            }}
          />
        )}
      </div>

      <div className="p-4 text-sm pt-0 pb-1">
        {Object.keys(errors).length > 0 && (
          <>
            <p>
              <Trans ns="sketching">
                There was a problem calculating metrics for this card.
              </Trans>
            </p>
            <ul className="list-disc pl-4 pt-2">
              {Object.entries(errors).map(([msg, count]) => (
                <li key={msg}>
                  {msg}{" "}
                  {count > 1 && (
                    <Badge variant="error">
                      {count}
                      {t("x")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {failedMetrics.length && (
              <div className="mt-2">
                <Button
                  onClick={() => {
                    retry();
                  }}
                  label={t("Retry calculations")}
                  small
                  disabled={retryState.loading}
                  loading={retryState.loading}
                />
              </div>
            )}
          </>
        )}
        {isReady && children}
        {adminMode && !isReady && (
          <ReportMetricsProgressDetails
            metricIds={metrics.map((m) => m.id)}
            skeleton={loadingSkeleton}
          />
        )}
        {!adminMode && loading && loadingSkeleton}
      </div>
    </div>
  );
}

export function ReportCardFactory({
  config,
  dragHandleProps,
  onUpdate,
}: {
  config: ReportCardConfiguration<any>;
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  const cardType = config.type;
  const CardComponent = getCardComponent(cardType);

  if (!CardComponent) {
    return (
      <ReportCard
        dragHandleProps={dragHandleProps}
        cardId={config.id}
        onUpdate={onUpdate}
        config={config}
        metrics={[]}
        backgroundTint="red"
        tint="text-red-500"
        icon="error"
      >
        <div>
          <p>{t("Unknown Card Type: {{cardType}}", { cardType })}</p>
        </div>
      </ReportCard>
    );
  }
  return (
    <CardComponent
      config={config}
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
    />
  );
}
