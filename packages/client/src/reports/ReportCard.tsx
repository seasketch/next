import { Trans, useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import { ReportCardConfigUpdateCallback } from "./registerCard";
import { useReportContext } from "./ReportContext";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  Pencil1Icon,
  TrashIcon,
  DragHandleDots2Icon,
} from "@radix-ui/react-icons";
import ReportCardActionMenu from "./components/ReportCardActionMenu";
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
import Skeleton from "../components/Skeleton";
import ReportMetricsProgressDetails from "./ReportMetricsProgressDetails";
import { subjectIsFragment } from "overlay-engine";
import ReportCardLoadingIndicator from "./components/ReportCardLoadingIndicator";
import { CalculatorIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import { collectReportCardTitle } from "../admin/sketchClasses/SketchClassReportsAdmin";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import { DraftReportContext } from "./DraftReportContext";

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
    setSelectedForEditing,
    deleteCard,
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
  const draftReportContext = useContext(DraftReportContext);
  const langContext = useContext(FormLanguageContext);
  const { alternateLanguageSettings } = config;

  // Use a ref to always get the current language code, even from debounced callbacks
  const langCodeRef = useRef<string>(langContext?.lang?.code || "EN");
  useEffect(() => {
    langCodeRef.current = langContext?.lang?.code || "EN";
  }, [langContext?.lang?.code]);

  const [retryFailedMetrics, retryState] =
    useRetryFailedSpatialMetricsMutation();

  const hasRelatedDraftMetrics = useMemo(() => {
    return draftReportContext.draftDependencyMetrics.length > 0 && selectedForEditing === cardId;
  }, [draftReportContext.draftDependencyMetrics, selectedForEditing, cardId]);

  let { errors, failedMetrics, loading } = useMemo(() => {
    const errors = {} as { [key: string]: number };
    let loading = false;
    const failedMetrics = [] as number[];
    const relatedMetrics = hasRelatedDraftMetrics
      ? [...metrics, ...draftReportContext.draftDependencyMetrics]
      : metrics;
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
    return { errors, failedMetrics, loading };
  }, [metrics, sources, hasRelatedDraftMetrics]);

  if (Object.keys(errors).length > 0) {
    tint = "text-red-500";
  }

  const handleBodyUpdate = useCallback(
    (newBody: any) => {
      if (onUpdate) {
        // Always read the current language code from ref, not from closure
        // This ensures debounced saves use the current language, not a stale one
        const currentLangCode = langCodeRef.current;
        if (currentLangCode !== "EN") {
          // Save to alternateLanguageSettings for non-English languages
          onUpdate((prevState) => ({
            ...prevState,
            alternateLanguageSettings: {
              ...prevState.alternateLanguageSettings,
              [currentLangCode]: {
                ...prevState.alternateLanguageSettings[currentLangCode],
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
    [onUpdate]
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

  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div
      className={`ReportCard ${config.type} ${presenceAbsenceClassName} ${adminMode && selectedForEditing === cardId ? "editing" : ""
        } transition-all opacity-100 relative rounded-lg w-full ${getBackgroundClasses()} ${isSelectedForEditing
          ? "shadow-xl ring-1 ring-opacity-5 ring-black"
          : "shadow-sm"
        } ${isDisabled ? "opacity-40 blur-sm pointer-events-none select-none" : ""
        } ${className} ${loading && !selectedForEditing ? "loadingSkeleton" : ""
        } ${Object.values(errors).length > 0 ? "hasErrors" : ""}`}
    >
      <div className="group">
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
            onClick={() => setShowCalcDetails(cardId!)}
            title={t("Calculation Details")}
          >
            <ReportCardLoadingIndicator
              className=""
              display={true}
              metrics={
                hasRelatedDraftMetrics
                  ? [...metrics, ...draftReportContext.draftDependencyMetrics]
                  : metrics
              }
              sourceProcessingJobs={sources
                .map((s) => s.sourceProcessingJob!)
                .filter((s) => Boolean(s))}
            />
          </button>
        )}
        <div className="absolute right-2 top-2 z-10">
          <div className="flex items-center space-x-1">
            {dragHandleProps &&
              !selectedForEditing &&
              (!loading || Object.values(errors).length > 0) && (
                <button
                  type="button"
                  aria-label={t("Drag to reorder")}
                  className={`p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 active:bg-gray-100 transition ${menuOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                    }`}
                  {...dragHandleProps}
                  title={t("Drag to reorder")}
                >
                  <DragHandleDots2Icon className="w-4 h-4" />
                </button>
              )}
            {(!loading || Object.values(errors).length > 0) &&
              !selectedForEditing &&
              cardId && (
                <div
                  className={`flex-1 ml-auto flex items-center justify-end ${menuOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                    } ${selectedForEditing ? "opacity-0" : "transition-opacity"}`}
                >
                  <ReportCardActionMenu
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    label={t("Card actions")}
                  >
                    {adminMode && (
                      <ReportCardActionMenu.Item
                        icon={<Pencil1Icon className="h-4 w-4" />}
                        onSelect={() => {
                          setSelectedForEditing(cardId!);
                        }}
                      >
                        {t("Edit card")}
                      </ReportCardActionMenu.Item>
                    )}
                    {metrics?.length > 0 && (
                      <ReportCardActionMenu.Item
                        onSelect={() => setShowCalcDetails(cardId!)}
                        icon={<CalculatorIcon className="h-4 w-4" />}
                      >
                        {t("Calculation details")}
                      </ReportCardActionMenu.Item>
                    )}
                    {adminMode &&
                      moveCardToTab &&
                      sortedTabs.length > 1 &&
                      cardId && (
                        <ReportCardActionMenu.Item
                          icon={<SwitchHorizontalIcon className="h-4 w-4" />}
                          onSelect={() => {
                            openMoveToTabModal();
                          }}
                        >
                          {t("Move to tab")}
                        </ReportCardActionMenu.Item>
                      )}
                    {adminMode && deleteCard && (
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
                  </ReportCardActionMenu>
                </div>
              )}
          </div>
        </div>
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
                for (const metric of [...metrics, ...draftReportContext.draftDependencyMetrics]) {
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
                  for (const metric of [
                    ...metrics,
                    ...draftReportContext.draftDependencyMetrics,
                  ]) {
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
            metricIds={Array.from(
              new Set([
                ...metrics.map((m) => m.id),
                ...draftReportContext.draftDependencyMetrics.map((m) => m.id),
              ])
            )}
            config={config}
            isAdmin={adminMode}
          />
        </Modal>
      )}
    </div>
  );
}
