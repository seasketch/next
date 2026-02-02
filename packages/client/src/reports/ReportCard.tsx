import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import { useContext, useMemo, useRef, memo } from "react";
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
import { useCardDependencies } from "./context/ReportDependenciesContext";
import { CardDependenciesContext } from "./context/CardDependenciesContext";
import { useBaseReportContext } from "./context/BaseReportContext";
import { CalculationDetailsModal } from "./components/CalculationDetailsModal";

export type ReportCardIcon = "info" | "warning" | "error";

export type ReportCardComponentProps = {
  // tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  children?: React.ReactNode;
  className?: string;
  onShowCalculationDetails?: (cardId: number) => void;
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
  onShowCalculationDetails,
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

  const errorBoundaryFallback = useMemo(() => {
    return (
      <ErrorBoundaryFallback title={t("Failed to render report card body")} />
    );
  }, [t]);

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
                onShowCalculationDetails={onShowCalculationDetails}
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
  const {
    editing,
    preselectTitle,
    adminMode,
    showCalcDetails,
    setShowCalcDetails,
  } = useContext(ReportUIStateContext);

  const baseReportContext = useBaseReportContext();
  const cardDependencies = useCardDependencies(props.config.id);

  return (
    <CardDependenciesContext.Provider
      value={{
        metrics: cardDependencies.metrics,
        sources: cardDependencies.overlaySources,
        loading: cardDependencies.loading,
        geographies: baseReportContext.geographies,
        sketchClass: baseReportContext.sketchClass,
      }}
    >
      <InnerReportCard
        {...props}
        editing={editing}
        preselectTitle={preselectTitle}
        adminMode={adminMode}
        metrics={cardDependencies.metrics}
        sources={cardDependencies.overlaySources}
        loading={cardDependencies.loading}
        errors={cardDependencies.errors}
      />
      {showCalcDetails && !editing && showCalcDetails === props.config.id && (
        <CalculationDetailsModal
          state={{ open: true, cardId: props.config.id }}
          onClose={() => setShowCalcDetails(undefined)}
          config={props.config}
          metrics={[]}
          adminMode={true}
        />
      )}
    </CardDependenciesContext.Provider>
  );
}
