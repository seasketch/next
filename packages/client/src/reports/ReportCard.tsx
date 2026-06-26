import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import {
  useContext,
  useMemo,
  useRef,
  memo,
  useCallback,
  useState,
} from "react";
// react-scripts@4 / webpack 4 — see ReportFullPrintBridge
import { useReactToPrint } from "react-to-print/dist/react-to-print.js";
import ReportCardBodyEditor from "./components/ReportCardBodyEditor";
import ReportCardBodyViewer from "./components/ReportCardBodyViewer";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import ReactNodeViewPortalsProvider from "./ReactNodeView/PortalProvider";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import { useCardDependencies } from "./context/useCardDependencies";
import { CardDependenciesContext } from "./context/CardDependenciesContext";
import { useBaseReportContext } from "./context/BaseReportContext";
import { CalculationDetailsModal } from "./components/CalculationDetailsModal";
import { useSubjectReportContext } from "./context/SubjectReportContext";
import { ReportCardTitleToolbarContext } from "./widgets/ReportCardTitleToolbar";
import { exportReportCard } from "./widgets/exports";
import { download } from "../download";
import { collectReportCardTitle } from "../admin/sketchClasses/SketchClassReportsAdmin";
import { REACT_PRINT_PAGE_STYLE } from "./reactPrintPageStyle";
require("../formElements/prosemirror-body.css");

export type ReportCardIcon = "info" | "warning" | "error";

export type ReportCardComponentProps = {
  // tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  children?: React.ReactNode;
  className?: string;
};

/**
 * Props for InnerReportCard - includes context values that would otherwise be
 * pulled from hooks, allowing the inner component to be pure and avoid re-renders
 * from context changes.
 */
export type InnerReportCardProps = ReportCardComponentProps & {
  config: ReportCardConfiguration<any>;
  // Context values passed from outer component
  editing: number | null;
  preselectTitle?: boolean;
  adminMode?: boolean;
  // Dependencies from useCardDependencies (including computed loading/errors)
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: { [errorMessage: string]: number };
};

/**
 * InnerReportCard is a pure component that doesn't subscribe to any contexts
 * (except useTranslation). All context values are passed as props from the
 * outer ReportCard component. This prevents unnecessary re-renders when
 * context values change that don't affect this card.
 */
export const InnerReportCard = memo(function InnerReportCard({
  backgroundTint,
  config,
  className,
  metrics,
  sources,
  loading,
  errors,
  // Context values as props
  editing,
  preselectTitle,
  adminMode,
}: InnerReportCardProps) {
  let tint = config.tint || "text-black";
  const icon = config.icon;
  const cardId = config.id;
  const { t } = useTranslation("admin:sketching");
  const hasErrors = Object.keys(errors).length > 0;

  if (hasErrors) {
    tint = "text-red-500";
  }

  const getBackgroundClasses = () => {
    if (hasErrors) {
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

  const isSelectedForEditing = editing === cardId;
  const isDisabled = editing && !isSelectedForEditing;

  const presenceAbsenceClassName = useMemo(() => {
    if (!loading && !hasErrors) {
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
  }, [metrics, loading, hasErrors]);

  const footerContainerRef = useRef<HTMLDivElement>(null);

  const errorBoundaryFallback = useCallback(
    (props: any) => {
      return (
        <ErrorBoundaryFallback
          title={t("Failed to render report card body")}
          error={props.error}
        />
      );
    },
    [t]
  );

  const content = (
    <div
      className={`ReportCard ${config.type} ${presenceAbsenceClassName} ${
        adminMode && isSelectedForEditing ? "editing" : ""
      } transition-all opacity-100 relative rounded-lg w-full ${getBackgroundClasses()} ${
        isSelectedForEditing
          ? "shadow-xl ring-1 ring-opacity-5 ring-black"
          : "shadow-sm"
      } ${
        isDisabled ? "opacity-40 blur-sm pointer-events-none select-none" : ""
      } ${className} ${
        loading && !isSelectedForEditing ? "loadingSkeleton" : ""
      } ${hasErrors ? "hasErrors" : ""}`}
    >
      <div className="">
        <div className={`px-4 pb-4 text-sm ${loading ? "loading" : ""}`}>
          <ErrorBoundary fallback={errorBoundaryFallback}>
            {adminMode && isSelectedForEditing ? (
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
                className={`ReportCard ReportCardBody ProseMirrorBody ${
                  icon ? "hasIcon" : ""
                } ${tint ? tint : ""}`}
                cardId={cardId!}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>
      <div ref={footerContainerRef}></div>
    </div>
  );

  if (adminMode && editing === cardId) {
    return (
      <ReactNodeViewPortalsProvider>{content}</ReactNodeViewPortalsProvider>
    );
  } else {
    return content;
  }
});

/**
 * ReportCard is the outer component that pulls context values and passes them
 * to InnerReportCard. The ReportCardTitleToolbarContext should be provided by
 * a parent component (e.g., SortableReportContent) to avoid re-renders when
 * dragHandleProps change.
 *
 * It also wraps the card content with CardDependenciesContext to provide
 * card-scoped metrics and sources to widgets, preventing unnecessary re-renders
 * when other cards' data changes.
 */
export default function ReportCard(
  props: ReportCardComponentProps & {
    config: ReportCardConfiguration<any>;
  }
) {
  const reportUiState = useContext(ReportUIStateContext);
  const {
    editing,
    preselectTitle,
    adminMode,
    showCalcDetails,
    setShowCalcDetails,
  } = reportUiState;

  const { t } = useTranslation("admin:sketching");
  const [cardPrintPrep, setCardPrintPrep] = useState(false);
  const cardPrintSurfaceRef = useRef<HTMLDivElement>(null);

  const reportUiForCardPrintSubtree = useMemo(
    () => ({
      ...reportUiState,
      printing: true,
    }),
    [reportUiState]
  );

  const baseReportContext = useBaseReportContext();
  const toolbarContext = useContext(ReportCardTitleToolbarContext);
  const subjectReportContext = useSubjectReportContext();
  const subjectSketchClass = subjectReportContext.data?.sketch?.sketchClass;
  const sessionIsAdmin =
    subjectSketchClass?.project?.sessionIsAdmin || false;
  const showAdminCalculationDetails = adminMode || sessionIsAdmin;
  const cardDependencies = useCardDependencies(props.config.id);
  /** Subject sketch/class query is separate from dependency metrics; gate loading until both settle. */
  const cardDependenciesLoading =
    cardDependencies.loading || subjectReportContext.loading;

  const cardDocumentTitle = useMemo(() => {
    const sketchName = subjectReportContext.data?.sketch?.name;
    const title = collectReportCardTitle(props.config.body);
    if (sketchName && title) {
      // documentTitle / save-as-PDF filename, not in-app UI copy
      // eslint-disable-next-line i18next/no-literal-string
      return `${sketchName} — ${title}`;
    }
    if (sketchName) {
      return sketchName;
    }
    if (title) {
      return title;
    }
    return t("Report card");
  }, [subjectReportContext.data?.sketch?.name, props.config.body, t]);

  const reactToPrintCard = useReactToPrint({
    contentRef: cardPrintSurfaceRef,
    documentTitle: cardDocumentTitle,
    pageStyle: REACT_PRINT_PAGE_STYLE,
    onBeforePrint: async () => {
      setCardPrintPrep(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    },
    onAfterPrint: () => {
      setCardPrintPrep(false);
    },
    onPrintError: () => {
      setCardPrintPrep(false);
    },
  });

  const onPrint = useCallback(() => {
    void reactToPrintCard();
  }, [reactToPrintCard]);

  const onDownloadResults = useCallback(
    async (format: "csv" | "json") => {
      if (cardDependenciesLoading) return;
      if (!subjectReportContext.data) return;

      const subject = subjectReportContext.data;
      const sketchClassForExport = subject.sketch.sketchClass;
      if (!sketchClassForExport) {
        return;
      }
      const input = {
        reportId: baseReportContext.report.id,
        cardId: props.config.id,
        cardTitle: undefined,
        body: props.config.body as any,
        metrics: cardDependencies.metrics,
        sources: cardDependencies.overlaySources,
        geographies: baseReportContext.geographies,
        sketchClass: sketchClassForExport,
        subject: {
          sketchId: subject.sketch.id,
          sketchName: subject.sketch.name,
          isCollection: subject.isCollection,
          childSketches: (subject.childSketches || []).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        },
        relatedFragments: (subject.relatedFragments || []).map((f) => ({
          hash: f.hash,
          geographies: f.geographies,
          sketches: f.sketches,
        })),
        primaryGeographyId: undefined,
        // Exporters sometimes pass interpolation args through t(); we don't need
        // translated strings for filenames/CSV headers, but we do need a stable
        // function with a compatible signature.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t: ((k: string) => k) as any,
      };

      try {
        const result = await exportReportCard(input, format);
        if (result.format === "json") {
          const blob = new Blob([JSON.stringify(result.body, null, 2)], {
            // eslint-disable-next-line i18next/no-literal-string
            type: result.mimeType,
          });
          const url = URL.createObjectURL(blob);
          download(url, result.filename);
          URL.revokeObjectURL(url);
        } else {
          const url = URL.createObjectURL(result.blob);
          download(url, result.filename);
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        // Export failures shouldn't break card rendering
        // eslint-disable-next-line no-console
        console.error(e);
      }
    },
    [
      baseReportContext.geographies,
      baseReportContext.report.id,
      cardDependenciesLoading,
      cardDependencies.metrics,
      cardDependencies.overlaySources,
      props.config.body,
      props.config.id,
      subjectReportContext.data,
    ],
  );

  const toolbarContextValue = useMemo(() => {
    return {
      ...toolbarContext,
      loading: toolbarContext.loading || cardDependenciesLoading,
      onDownloadResults,
      onPrint,
    };
  }, [toolbarContext, cardDependenciesLoading, onDownloadResults, onPrint]);

  return (
    <CardDependenciesContext.Provider
      value={{
        metrics: cardDependencies.metrics,
        sources: cardDependencies.overlaySources,
        loading: cardDependenciesLoading,
        geographies: baseReportContext.geographies,
        sketchClass: subjectSketchClass ?? null,
        errors: cardDependencies.errors,
        globalErrors: cardDependencies.globalErrors,
        dependenciesAwaitingRefresh:
          cardDependencies.dependenciesAwaitingRefresh,
        dependencyResolutionFailuresByHash:
          cardDependencies.dependencyResolutionFailuresByHash,
      }}
    >
      <ReportCardTitleToolbarContext.Provider value={toolbarContextValue}>
        <InnerReportCard
          {...props}
          editing={editing}
          preselectTitle={preselectTitle}
          adminMode={adminMode}
          metrics={cardDependencies.metrics}
          sources={cardDependencies.overlaySources}
          loading={cardDependenciesLoading}
          errors={cardDependencies.errors}
        />
        {cardPrintPrep && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-[-1] box-border w-full bg-white text-black"
          >
            <ReportUIStateContext.Provider value={reportUiForCardPrintSubtree}>
              <div ref={cardPrintSurfaceRef} className="w-full bg-white">
                <InnerReportCard
                  {...props}
                  editing={editing}
                  preselectTitle={preselectTitle}
                  adminMode={adminMode}
                  metrics={cardDependencies.metrics}
                  sources={cardDependencies.overlaySources}
                  loading={cardDependenciesLoading}
                  errors={cardDependencies.errors}
                />
              </div>
            </ReportUIStateContext.Provider>
          </div>
        )}
      </ReportCardTitleToolbarContext.Provider>
      {showCalcDetails && !editing && showCalcDetails === props.config.id && (
        <CalculationDetailsModal
          state={{ open: true, cardId: props.config.id }}
          onClose={() => setShowCalcDetails(undefined)}
          config={props.config}
          metrics={[]}
          adminMode={adminMode}
          showAdminDetails={showAdminCalculationDetails}
        />
      )}
    </CardDependenciesContext.Provider>
  );
}
