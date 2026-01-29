import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  CompatibleSpatialMetricDetailsFragment,
  SpatialMetricState,
  useRecalculateSpatialMetricsMutation,
  useRetryFailedSpatialMetricsMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import ReportMetricsProgressDetails from "../ReportMetricsProgressDetails";
import { collectReportCardTitle } from "../../admin/sketchClasses/SketchClassReportsAdmin";
import { ReportCardConfiguration } from "../cards/cards";
import { subjectIsFragment } from "overlay-engine";

export interface CalculationDetailsModalState {
  open: boolean;
  cardId: number | null;
}

export interface UseCalculationDetailsModalStateReturn {
  state: CalculationDetailsModalState;
  openModal: (cardId: number) => void;
  closeModal: () => void;
}

/**
 * Hook to manage the state of the CalculationDetailsModal.
 * Use this in ReportEditor to control when the modal opens and which card's details to show.
 */
export function useCalculationDetailsModalState(): UseCalculationDetailsModalStateReturn {
  const [state, setState] = useState<CalculationDetailsModalState>({
    open: false,
    cardId: null,
  });

  const openModal = useCallback((cardId: number) => {
    setState({ open: true, cardId });
  }, []);

  const closeModal = useCallback(() => {
    setState({ open: false, cardId: null });
  }, []);

  return { state, openModal, closeModal };
}

interface CalculationDetailsModalProps {
  state: CalculationDetailsModalState;
  onClose: () => void;
  /** The card configuration - looked up by ReportEditor based on cardId */
  config?: ReportCardConfiguration<any>;
  /** Metrics for this card */
  metrics?: CompatibleSpatialMetricDetailsFragment[];
  /** Whether the user is in admin mode */
  adminMode?: boolean;
}

/**
 * Modal showing calculation/data source details for a report card.
 */
export function CalculationDetailsModal({
  state,
  onClose,
  config,
  metrics = [],
  adminMode = false,
}: CalculationDetailsModalProps) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();

  // Recalculate modal state (nested modal)
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recomputePreprocessed, setRecomputePreprocessed] = useState(false);
  const [recomputeTotals, setRecomputeTotals] = useState(false);

  const [recalculate, recalculateState] = useRecalculateSpatialMetricsMutation({
    onError,
  });

  const [retryFailedMetrics, retryState] =
    useRetryFailedSpatialMetricsMutation({
      onError,
    });

  // Compute loading and failed metrics
  const { loading, failedMetrics } = useMemo(() => {
    let loading = false;
    const failedMetrics: number[] = [];

    for (const metric of metrics) {
      if (metric.state === SpatialMetricState.Error) {
        failedMetrics.push(metric.id);
      } else if (metric.state !== SpatialMetricState.Complete) {
        loading = true;
      }
    }

    return { loading, failedMetrics };
  }, [metrics]);

  const handleRecalculate = useCallback(async () => {
    const metricsToRecalculate: number[] = [];
    for (const metric of metrics) {
      if (subjectIsFragment(metric.subject) || recomputeTotals) {
        metricsToRecalculate.push(metric.id);
      }
    }

    await recalculate({
      variables: {
        metricIds: metricsToRecalculate,
        recomputePreprocessed,
      },
    });
    setRecalcOpen(false);
  }, [metrics, recomputeTotals, recomputePreprocessed, recalculate]);

  const handleRecalculateClick = useCallback(async () => {
    if (adminMode) {
      setRecalcOpen(true);
    } else {
      const metricsToRecalculate: number[] = [];
      for (const metric of metrics) {
        if (subjectIsFragment(metric.subject)) {
          metricsToRecalculate.push(metric.id);
        }
      }
      await recalculate({
        variables: {
          metricIds: metricsToRecalculate,
          recomputePreprocessed: false,
        },
      });
    }
  }, [adminMode, metrics, recalculate]);

  const handleRetryFailed = useCallback(async () => {
    await retryFailedMetrics({
      variables: {
        metricIds: failedMetrics,
      },
    });
  }, [retryFailedMetrics, failedMetrics]);

  const handleClose = useCallback(() => {
    if (!recalcOpen) {
      onClose();
    }
  }, [onClose, recalcOpen]);

  if (!state.open || !config) {
    return null;
  }

  const cardTitle = collectReportCardTitle(config.body);

  return (
    <>
      <Modal
        open
        onRequestClose={handleClose}
        title={
          <div>
            <span className="text-gray-500 block text-base">{cardTitle}</span>
            <span>{t("Data Sources and Calculations")}</span>
          </div>
        }
        disableBackdropClick={recalcOpen}
        footer={[
          {
            label: t("Close"),
            onClick: handleClose,
            variant: "secondary",
          },
          {
            label: t("Recalculate"),
            onClick: handleRecalculateClick,
            disabled: loading,
            variant: "secondary",
            loading: recalculateState.loading,
          },
          ...(failedMetrics.length > 0
            ? [
                {
                  label: t("Retry failed calculations"),
                  onClick: handleRetryFailed,
                  disabled: retryState.loading,
                  variant: "danger" as const,
                  loading: retryState.loading,
                },
              ]
            : []),
        ]}
      >
        <ReportMetricsProgressDetails config={config} isAdmin={adminMode} />
      </Modal>

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
              onClick: handleRecalculate,
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
    </>
  );
}
