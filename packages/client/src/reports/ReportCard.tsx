import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import { ReportCardConfigUpdateCallback } from "./registerCard";
import { useReportContext } from "./ReportContext";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";
import Modal from "../components/Modal";
import { FormLanguageContext } from "../formElements/FormElement";
import {
  useContext,
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ReportCardBodyEditor from "./components/ReportCardBodyEditor";
import ReportCardBodyViewer from "./components/ReportCardBodyViewer";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  useRetryFailedSpatialMetricsMutation,
} from "../generated/graphql";
import ReportMetricsProgressDetails from "./ReportMetricsProgressDetails";
import { subjectIsFragment } from "overlay-engine";
import { collectReportCardTitle } from "../admin/sketchClasses/SketchClassReportsAdmin";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import { ReportCardTitleToolbarContext } from "./widgets/ReportCardTitleToolbar";
import ReactNodeViewPortalsProvider from "./ReactNodeView/PortalProvider";

export type ReportCardIcon = "info" | "warning" | "error";

export type ReportCardComponentProps = {
  // tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  // icon?: ReportCardIcon;
  children?: React.ReactNode;
  dragHandleProps?: any; // Props from react-beautiful-dnd Draggable
  // cardId?: number; // ID of the card for edit functionality
  onUpdate?: ReportCardConfigUpdateCallback; // Single update callback
  className?: string;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
};

// Icon mapping for named icons (no color classes, will inherit from parent)
const iconMap = {
  info: <InfoCircledIcon className="w-5 h-5" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5" />,
  error: <CrossCircledIcon className="w-5 h-5" />,
};

export default function ReportCard({
  backgroundTint,
  // icon,
  children,
  dragHandleProps,
  // cardId,
  onUpdate,
  config,
  className,
  metrics,
  sources,
}: ReportCardComponentProps & {
  config: ReportCardConfiguration<any>;
}) {
  let tint = config.tint || "text-black";
  const icon = config.icon;
  const cardId = config.id;
  const { t } = useTranslation("admin:sketching");
  const {
    adminMode,
    selectedForEditing,
    report,
    selectedTabId,
    setSelectedTabId,
    recalculate,
    recalculateState,
    showCalcDetails,
    setShowCalcDetails,
    moveCardToTab,
    preselectTitle,
  } = useReportContext();
  const langContext = useContext(FormLanguageContext);

  // Use a ref to always get the current language code, even from debounced callbacks
  const langCodeRef = useRef<string>(langContext?.lang?.code || "EN");
  useEffect(() => {
    langCodeRef.current = langContext?.lang?.code || "EN";
  }, [langContext?.lang?.code]);

  const [retryFailedMetrics, retryState] =
    useRetryFailedSpatialMetricsMutation();

  // const hasRelatedDraftMetrics = useMemo(() => {
  //   return draftReportContext.draftDependencyMetrics.length > 0 && selectedForEditing === cardId;
  // }, [draftReportContext.draftDependencyMetrics, selectedForEditing, cardId]);

  let { errors, failedMetrics, loading } = useMemo(() => {
    const errors = {} as { [key: string]: number };
    let loading = false;
    const failedMetrics = [] as number[];
    const relatedMetrics = metrics;
    for (const metric of relatedMetrics) {
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
    for (const source of sources) {
      if (source.sourceProcessingJob?.state === SpatialMetricState.Error) {
        let errorMessage =
          source.sourceProcessingJob?.errorMessage || "Unknown error";
        if (errorMessage in errors) {
          errors[errorMessage]++;
        } else {
          errors[errorMessage] = 1;
        }
      }
    }
    // loading = true;
    return { errors, failedMetrics, loading };
  }, [metrics, sources]);

  if (Object.keys(errors).length > 0) {
    tint = "text-red-500";
  }


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

  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recomputePreprocessed, setRecomputePreprocessed] = useState(false);
  const [recomputeTotals, setRecomputeTotals] = useState(false);
  const [moveTabOpen, setMoveTabOpen] = useState(false);
  const [moveTabTargetId, setMoveTabTargetId] = useState<number | null>(null);
  const [moveTabLoading, setMoveTabLoading] = useState(false);

  const presenceAbsenceClassName = useMemo(() => {
    if (!loading && !Object.values(errors).length) {
      const isPresent = metrics.some((m) => {
        if (subjectIsFragment(m.subject)) {
          switch (m.type) {
            case "presence":
              return m.value === true;
            case "count":
              return m.value["*"] > 0;
            case "overlay_area":
              return m.value["*"] > 0;
            default:
              return false;
          }
        } else {
          return false;
        }
      });
      if (isPresent) {
        return "isPresent";
      } else {
        return "isAbsent";
      }
    } else {
      return "";
    }
  }, [metrics, loading, errors]);

  const sortedTabs = useMemo(
    () => [...(report.tabs || [])].sort((a, b) => a.position - b.position),
    [report.tabs]
  );
  const footerContainerRef = useRef<HTMLDivElement>(null);

  const getLocalizedTabTitle = useCallback(
    (tab: (typeof report.tabs)[0]) => {
      if (langContext?.lang?.code !== "EN" && tab.alternateLanguageSettings) {
        const alternateSettings =
          tab.alternateLanguageSettings[langContext.lang.code];
        if (alternateSettings?.title) {
          return alternateSettings.title;
        }
      }
      return tab.title;
    },
    [langContext?.lang?.code, report.tabs]
  );

  const openMoveToTabModal = useCallback(() => {
    // Default selection is the current tab; submitting keeps card in place.
    setMoveTabTargetId(selectedTabId);
    setMoveTabOpen(true);
  }, [selectedTabId]);

  const handleMoveCardToTab = useCallback(async () => {
    if (!moveCardToTab || moveTabTargetId === null || !cardId) {
      setMoveTabOpen(false);
      return;
    }
    setMoveTabLoading(true);
    try {
      if (moveTabTargetId !== selectedTabId) {
        await moveCardToTab(cardId, moveTabTargetId);
        setSelectedTabId(moveTabTargetId);
      }
      setMoveTabOpen(false);
    } finally {
      setMoveTabLoading(false);
    }
  }, [moveCardToTab, moveTabTargetId, cardId, selectedTabId, setSelectedTabId]);


  const content = (

    <ReportCardTitleToolbarContext.Provider value={{ editing: Boolean(adminMode && selectedForEditing === cardId), dragHandleProps, adminMode: Boolean(adminMode), cardId, hasMetrics: metrics?.length > 0, openMoveCardToTabModal: sortedTabs.length > 1 ? openMoveToTabModal : undefined }}>
      <div
        className={`ReportCard ${config.type} ${presenceAbsenceClassName} ${adminMode && selectedForEditing === cardId ? "editing" : ""
          } transition-all opacity-100 relative rounded-lg w-full ${getBackgroundClasses()} ${isSelectedForEditing
            ? "shadow-xl ring-1 ring-opacity-5 ring-black"
            : "shadow-sm"
          } ${isDisabled ? "opacity-40 blur-sm pointer-events-none select-none" : ""
          } ${className} ${loading && !selectedForEditing ? "loadingSkeleton" : ""
          } ${Object.values(errors).length > 0 ? "hasErrors" : ""}`}
      >
        <div className="">
          <div className={`px-4 pb-4 text-sm ${loading ? "loading" : ""}`}>
            <ErrorBoundary
              fallback={
                <ErrorBoundaryFallback
                  title={t("Failed to render report card body")}
                />
              }
            >
              {adminMode && selectedForEditing === cardId ? (
                <ReportCardBodyEditor
                  body={config.body}
                  className={`${tint} ${icon ? "hasIcon" : ""}`}
                  metrics={metrics}
                  sources={sources}
                  cardId={cardId!}
                  preselectTitle={preselectTitle}
                  footerContainerRef={footerContainerRef}
                />
              ) : (
                <ReportCardBodyViewer
                  body={config.body}
                  className={`ReportCard ReportCardBody ProseMirrorBody ${icon ? "hasIcon" : ""
                    } ${tint ? tint : ""}`}
                  cardId={cardId!}
                />
              )}
            </ErrorBoundary>
          </div>
        </div>
        <div ref={footerContainerRef}></div>
        {moveTabOpen && (
          <Modal
            open
            onRequestClose={() => {
              if (!moveTabLoading) {
                setMoveTabOpen(false);
              }
            }}
            title={t("Move card to tab")}
            footer={[
              {
                label: t("Cancel"),
                onClick: () => setMoveTabOpen(false),
                variant: "secondary",
                disabled: moveTabLoading,
              },
              {
                label: t("Move"),
                onClick: handleMoveCardToTab,
                variant: "primary",
                loading: moveTabLoading,
                disabled: moveTabLoading || moveTabTargetId === null,
              },
            ]}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t("Select a tab to move this card to.")}
              </p>
              <div className="space-y-2">
                {sortedTabs.map((tab) => {
                  const localizedTitle = getLocalizedTabTitle(tab);
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center space-x-2 rounded border p-2 ${moveTabTargetId === tab.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-200"
                        }`}
                    >
                      <input
                        type="radio"
                        className="h-4 w-4"
                        checked={moveTabTargetId === tab.id}
                        onChange={() => setMoveTabTargetId(tab.id)}
                        disabled={moveTabLoading}
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-800">
                          {localizedTitle}
                        </span>
                        {tab.id === selectedTabId && (
                          <span className="ml-2 text-xs text-gray-500">
                            {t("Current tab")}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
                {sortedTabs.length === 0 && (
                  <p className="text-sm text-gray-500">
                    {t("No tabs available")}
                  </p>
                )}
              </div>
            </div>
          </Modal>
        )}
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

        {showCalcDetails === cardId && (
          <Modal
            open
            onRequestClose={() => setShowCalcDetails(undefined)}
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
                onClick: () => setShowCalcDetails(undefined),
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
              config={config}
              isAdmin={adminMode}
            />
          </Modal>
        )}
      </div>
    </ReportCardTitleToolbarContext.Provider>

  );
  if (adminMode && selectedForEditing === cardId) {
    return (
      <ReactNodeViewPortalsProvider>
        {content}
      </ReactNodeViewPortalsProvider>
    );
  } else {
    return content;
  }
}
