import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import { useContext, useMemo, useRef, memo } from "react";
import ReportCardBodyEditor from "./components/ReportCardBodyEditor";
import ReportCardBodyViewer from "./components/ReportCardBodyViewer";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
} from "../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import ReactNodeViewPortalsProvider from "./ReactNodeView/PortalProvider";
import { ReportUIStateContext } from "./context/ReportUIStateContext";

export type ReportCardIcon = "info" | "warning" | "error";

export type ReportCardComponentProps = {
  // tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  children?: React.ReactNode;
  className?: string;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  onDeleteCard?: (cardId: number, skipConfirmation?: boolean) => void;
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
  onDeleteCard,
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

  const { errors, loading } = useMemo(() => {
    const errors = {} as { [key: string]: number };
    let loading = false;
    for (const metric of metrics) {
      if (metric.state === SpatialMetricState.Error) {
        const errorMessage = metric.errorMessage || "Unknown error";
        if (errorMessage in errors) {
          errors[errorMessage]++;
        } else {
          errors[errorMessage] = 1;
        }
      } else if (metric.state !== SpatialMetricState.Complete) {
        loading = true;
      }
    }
    for (const source of sources) {
      if (source.sourceProcessingJob?.state === SpatialMetricState.Error) {
        const errorMessage =
          source.sourceProcessingJob?.errorMessage || "Unknown error";
        if (errorMessage in errors) {
          errors[errorMessage]++;
        } else {
          errors[errorMessage] = 1;
        }
      }
    }
    return { errors, loading };
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

  const isSelectedForEditing = editing === cardId;
  const isDisabled = editing && !isSelectedForEditing;

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

  const footerContainerRef = useRef<HTMLDivElement>(null);

  const errorBoundaryFallback = useMemo(() => {
    return (
      <ErrorBoundaryFallback title={t("Failed to render report card body")} />
    );
  }, [t]);

  const content = (
    <div
      className={`ReportCard ${config.type} ${presenceAbsenceClassName} ${
        adminMode && editing === cardId ? "editing" : ""
      } transition-all opacity-100 relative rounded-lg w-full ${getBackgroundClasses()} ${
        isSelectedForEditing
          ? "shadow-xl ring-1 ring-opacity-5 ring-black"
          : "shadow-sm"
      } ${
        isDisabled ? "opacity-40 blur-sm pointer-events-none select-none" : ""
      } ${className} ${loading && !editing ? "loadingSkeleton" : ""} ${
        Object.values(errors).length > 0 ? "hasErrors" : ""
      }`}
    >
      <div className="">
        <div className={`px-4 pb-4 text-sm ${loading ? "loading" : ""}`}>
          <ErrorBoundary fallback={errorBoundaryFallback}>
            {adminMode && editing === cardId ? (
              <ReportCardBodyEditor
                body={config.body}
                className={`${tint} ${icon ? "hasIcon" : ""}`}
                metrics={metrics}
                sources={sources}
                cardId={cardId!}
                preselectTitle={preselectTitle}
                footerContainerRef={footerContainerRef}
                onDeleteCard={onDeleteCard}
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
 */
export default function ReportCard(
  props: ReportCardComponentProps & {
    config: ReportCardConfiguration<any>;
  }
) {
  const { editing, preselectTitle, adminMode } =
    useContext(ReportUIStateContext);

  return (
    <InnerReportCard
      {...props}
      editing={editing}
      preselectTitle={preselectTitle}
      adminMode={adminMode}
    />
  );
}
