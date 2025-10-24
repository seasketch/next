import { Trans, useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import {
  getCardComponent,
  ReportCardConfigUpdateCallback,
} from "./registerCard";
import { useReportContext } from "./ReportContext";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  Pencil1Icon,
  TrashIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import ReportCardActionMenu from "./components/ReportCardActionMenu";
import Modal from "../components/Modal";
import { FormLanguageContext } from "../formElements/FormElement";
import { useContext, useCallback, useState, useMemo } from "react";
import { prosemirrorToHtml } from "./utils/prosemirrorToHtml";
import ReportCardBodyEditor from "./components/ReportCardBodyEditor";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useRetryFailedSpatialMetricsMutation,
} from "../generated/graphql";
import Skeleton from "../components/Skeleton";
import ReportMetricsProgressDetails from "./ReportMetricsProgressDetails";
import { subjectIsFragment } from "overlay-engine";
import ReportCardLoadingIndicator from "./components/ReportCardLoadingIndicator";
import { CalculatorIcon } from "@heroicons/react/outline";
import { collectReportCardTitle } from "../admin/sketchClasses/SketchClassReportsAdmin";
import Badge from "../components/Badge";
import Button from "../components/Button";

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
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
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
  sources,
  skeleton,
}: ReportCardComponentProps & {
  config: ReportCardConfiguration<any>;
}) {
  const { t } = useTranslation("admin:sketching");
  const {
    adminMode,
    selectedForEditing,
    setSelectedForEditing,
    deleteCard,
    recalculate,
    recalculateState,
    overlaySources,
  } = useReportContext();
  const langContext = useContext(FormLanguageContext);
  const { alternateLanguageSettings } = config;

  const [retryFailedMetrics, retryState] =
    useRetryFailedSpatialMetricsMutation();

  let { errors, failedMetrics, loading } = useMemo(() => {
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
    [onUpdate, langContext?.lang?.code]
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
  // loading = true;

  const isReady = !loading && !Object.keys(errors).length;

  const loadingSkeleton = useMemo(() => {
    if (skeleton) {
      return skeleton;
    }
    return (
      <div className="w-full space-y-1">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-4/5 h-4" />
      </div>
    );
  }, [skeleton]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recomputePreprocessed, setRecomputePreprocessed] = useState(false);
  const [recomputeTotals, setRecomputeTotals] = useState(false);
  const [showCalcDetails, setShowCalcDetails] = useState(false);

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
      {loading && !Object.values(errors).length && (
        <button
          type="button"
          className="absolute top-[14px] right-[16px]"
          onClick={() => setShowCalcDetails(true)}
          title={t("Calculation Details")}
        >
          <ReportCardLoadingIndicator
            className=""
            display={true}
            metrics={metrics}
            sourceProcessingJobs={sources.map((s) => s.sourceProcessingJob)}
          />
        </button>
      )}
      <div className="absolute right-2 top-2">
        <div>
          {(!loading || Object.values(errors).length > 0) &&
            !selectedForEditing &&
            cardId && (
              <div
                className={`flex-1 ml-auto transition-opacity flex items-center justify-end ${
                  menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <ReportCardActionMenu
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  label={t("Card actions")}
                >
                  <ReportCardActionMenu.Item
                    onSelect={() => setShowCalcDetails(true)}
                    icon={<CalculatorIcon className="h-4 w-4" />}
                  >
                    {t("Calculation details")}
                  </ReportCardActionMenu.Item>
                  <ReportCardActionMenu.Item
                    icon={<ReloadIcon className="h-4 w-4" />}
                    onSelect={async () => {
                      if (adminMode) {
                        setRecalcOpen(true);
                      } else {
                        const metricsToRecalculate = [] as number[];
                        for (const metric of metrics) {
                          if (subjectIsFragment(metric.subject)) {
                            metricsToRecalculate.push(metric.id);
                          }
                        }
                        await recalculate(metricsToRecalculate, false);
                      }
                    }}
                  >
                    {t("Recalculate")}
                  </ReportCardActionMenu.Item>
                  {adminMode && (
                    <>
                      <ReportCardActionMenu.Item
                        icon={<Pencil1Icon className="h-4 w-4" />}
                        onSelect={() => {
                          setSelectedForEditing(cardId!);
                        }}
                      >
                        {t("Edit card")}
                      </ReportCardActionMenu.Item>
                      {deleteCard && (
                        <ReportCardActionMenu.Item
                          icon={<TrashIcon className="h-4 w-4" />}
                          variant="danger"
                          onSelect={() => {
                            deleteCard(cardId!);
                          }}
                        >
                          {t("Delete card")}
                        </ReportCardActionMenu.Item>
                      )}
                    </>
                  )}
                </ReportCardActionMenu>
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
                    setShowCalcDetails(true);
                  }}
                  label={t("View details")}
                  small
                />
              </div>
            )}
          </>
        )}
        {isReady && children}
        {loading && !Object.values(errors).length && (
          <div className="relative">
            <div>{loadingSkeleton}</div>
          </div>
        )}
      </div>

      {recalcOpen && (
        <Modal
          open
          onRequestClose={() => setRecalcOpen(false)}
          title={t("Recalculate results")}
          disableBackdropClick={false}
          footerClassName="bg-gray-100 border-t"
          footer={[
            {
              label: t("Cancel"),
              onClick: () => setRecalcOpen(false),
              variant: "secondary",
            },
            {
              label: t("Recalculate"),
              onClick: async () => {
                const metricsToRecalculate = [] as number[];
                for (const metric of metrics) {
                  if (subjectIsFragment(metric.subject) || recomputeTotals) {
                    metricsToRecalculate.push(metric.id);
                  }
                }

                await recalculate(metricsToRecalculate, recomputePreprocessed);
                setRecalcOpen(false);
              },
              variant: "danger",
              loading: recalculateState.loading,
            },
          ]}
        >
          <div className="space-y-4 mb-4">
            <p className="text-sm">
              {t(
                "This will recompute all metrics for this card. Depending on data size, this may take some time. If you choose to recreate optimized layers, this will delete the cache of any related metrics."
              )}
            </p>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded outline-none ring-0 active:ring-0 focus:ring-0 focus-visible:ring-2"
                checked={recomputePreprocessed}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRecomputePreprocessed(checked);
                  if (checked) {
                    setRecomputeTotals(true);
                  }
                }}
              />
              <span>{t("Recreate optimized layers")}</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded outline-none ring-0 active:ring-0 focus:ring-0 focus-visible:ring-2 disabled:opacity-50"
                checked={recomputeTotals}
                onChange={(e) => setRecomputeTotals(e.target.checked)}
                disabled={recomputePreprocessed}
              />
              <span>{t("Recalculate geography totals (slow)")}</span>
            </label>
          </div>
        </Modal>
      )}

      {showCalcDetails && (
        <Modal
          open
          onRequestClose={() => setShowCalcDetails(false)}
          title={
            <div>
              <span className="text-gray-500 block text-base">
                {collectReportCardTitle(config.body)}
              </span>
              <span>{t("Data Sources and Calculations")}</span>
            </div>
          }
          disableBackdropClick={recalcOpen}
          footer={[
            {
              label: t("Close"),
              onClick: () => setShowCalcDetails(false),
              variant: "secondary",
            },
            {
              label: t("Recalculate"),
              onClick: async () => {
                if (adminMode) {
                  setRecalcOpen(true);
                } else {
                  const metricsToRecalculate = [] as number[];
                  for (const metric of metrics) {
                    if (subjectIsFragment(metric.subject)) {
                      metricsToRecalculate.push(metric.id);
                    }
                  }
                  await recalculate(metricsToRecalculate, false);
                }
              },
              disabled: loading,
              variant: "secondary",
              loading: recalculateState.loading,
            },
            ...(failedMetrics.length > 0
              ? [
                  {
                    label: t("Retry failed calculations"),
                    onClick: async () => {
                      await retryFailedMetrics({
                        variables: {
                          metricIds: failedMetrics,
                        },
                      });
                    },
                    disabled: retryState.loading,
                    variant: "danger" as const,
                    loading: retryState.loading,
                  },
                ]
              : []),
          ]}
        >
          <ReportMetricsProgressDetails
            metricIds={metrics.map((m) => m.id)}
            skeleton={loadingSkeleton}
            config={config}
            isAdmin={adminMode}
          />
        </Modal>
      )}
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
        sources={[]}
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
