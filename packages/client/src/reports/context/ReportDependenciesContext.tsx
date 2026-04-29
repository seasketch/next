import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CardDependencyLists,
  CompatibleSpatialMetricDetailsFragment,
  CompatibleSpatialMetricSlimFragment,
  FragmentSubjectDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
  ReportDependenciesDocument,
  useReportDependenciesQuery,
  useReportOverlaySourcesQuery,
} from "../../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ApolloError, NetworkStatus, useApolloClient } from "@apollo/client";
import type { MetricDependency } from "overlay-engine";
import { ReportMetricDependencyRegistrarContext } from "./ReportMetricDependencyRegistrarContext";
import {
  buildOverlayStableIdToSourceUrlMap,
  EMPTY_FRAGMENT_SUBJECT_CATALOG,
  EMPTY_OVERLAY_SOURCES,
  EMPTY_SLIM_METRICS,
  hydrateSpatialMetrics,
} from "../utils/hydrateSpatialMetrics";
import {
  invalidationKeysForReportAndSketch,
  invalidationTickForKeys,
  subscribeReportDependenciesInvalidation,
} from "../utils/reportDependenciesInvalidation";

export const ReportDependenciesContext = createContext<{
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  cardDependencyLists: CardDependencyLists[];
  /**
   * Metric ids actually available on cards after hydration (subset of the slim
   * payload). Used to detect brief Apollo id churn vs permanently dropped rows.
   */
  slimMetricIdsFromServer: Set<string>;
  fragmentCalculationsRuntime?: number;
  loading: boolean;
  /**
   * True after cache eviction bumps invalidation until a fresh `network-only`
   * refetch of Report.dependencies finishes. Per-card loading intentionally
   * ignores most of `loading`; this flag forces skeletons for that path.
   */
  dependenciesAwaitingRefresh: boolean;
  error?: ApolloError;
}>({
  metrics: [],
  overlaySources: [],
  cardDependencyLists: [],
  slimMetricIdsFromServer: new Set(),
  loading: true,
  dependenciesAwaitingRefresh: false,
});

export type CardDependenciesResult = {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: { [errorMessage: string]: number };
};

const EMPTY_CARD_DEPENDENCY_LISTS: CardDependencyLists[] = [];

export default function ReportDependenciesContextProvider({
  children,
  sketchId,
  reportId,
}: {
  children: React.ReactNode;
  sketchId?: number;
  reportId?: number;
}) {
  const invalidationKeys = useMemo(
    () =>
      reportId != null && sketchId != null
        ? invalidationKeysForReportAndSketch(reportId, sketchId)
        : [],
    [reportId, sketchId]
  );

  const [invalidationTick, setInvalidationTick] = useState(() =>
    invalidationTickForKeys(
      reportId != null && sketchId != null
        ? invalidationKeysForReportAndSketch(reportId, sketchId)
        : []
    )
  );

  const [resolvedInvalidationTick, setResolvedInvalidationTick] = useState(0);

  const refetchCompletedForInvalidationTickRef = useRef(0);

  useLayoutEffect(() => {
    const t = invalidationTickForKeys(invalidationKeys);
    setInvalidationTick(t);
    setResolvedInvalidationTick(0);
    refetchCompletedForInvalidationTickRef.current = 0;
  }, [invalidationKeys]);

  useEffect(() => {
    if (invalidationKeys.length === 0) {
      return;
    }
    return subscribeReportDependenciesInvalidation(invalidationKeys, () => {
      setInvalidationTick(invalidationTickForKeys(invalidationKeys));
    });
  }, [invalidationKeys]);

  const invalidationTickRef = useRef(invalidationTick);
  invalidationTickRef.current = invalidationTick;

  const awaitingDependencyInvalidation =
    invalidationTick > resolvedInvalidationTick;

  const client = useApolloClient();

  const {
    data: depsData,
    loading: depsLoading,
    refetch: refetchDeps,
    error: depsError,
    networkStatus: depsNetworkStatus,
  } = useReportDependenciesQuery({
    variables: {
      reportId: reportId!,
      sketchId: sketchId!,
    },
    skip: !reportId || !sketchId,
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (!reportId || !sketchId) {
      return;
    }
    if (invalidationTick <= refetchCompletedForInvalidationTickRef.current) {
      return;
    }
    let cancelled = false;
    void client
      .query({
        query: ReportDependenciesDocument,
        variables: { reportId, sketchId },
        fetchPolicy: "network-only",
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        const latest = invalidationTickRef.current;
        refetchCompletedForInvalidationTickRef.current = latest;
        setResolvedInvalidationTick(latest);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidationTick, reportId, sketchId, client]);

  const dependenciesQueryLoading =
    depsLoading ||
    depsNetworkStatus === NetworkStatus.refetch ||
    depsNetworkStatus === NetworkStatus.setVariables;

  const {
    data: overlayData,
    loading: overlayLoading,
    refetch: refetchOverlaySources,
    error: overlayError,
    networkStatus: overlayNetworkStatus,
  } = useReportOverlaySourcesQuery({
    variables: {
      reportId: reportId!,
    },
    skip: !reportId,
    notifyOnNetworkStatusChange: true,
  });

  const overlaySourcesQueryLoading =
    overlayLoading ||
    overlayNetworkStatus === NetworkStatus.refetch ||
    overlayNetworkStatus === NetworkStatus.setVariables;

  const rawSlimMetrics: CompatibleSpatialMetricSlimFragment[] =
    (depsData?.report?.dependencies?.metrics ??
      EMPTY_SLIM_METRICS) as CompatibleSpatialMetricSlimFragment[];

  const fragmentSubjectCatalog: Pick<
    FragmentSubjectDetailsFragment,
    "__typename" | "hash" | "sketches" | "geographies"
  >[] =
    depsData?.report?.dependencies?.fragmentSubjectCatalog ??
    EMPTY_FRAGMENT_SUBJECT_CATALOG;

  const registrationRef = useRef<{
    deps: MetricDependency[];
    fingerprint: string;
  } | null>(null);
  const [registrationEpoch, setRegistrationEpoch] = useState(0);

  const registerReportMetricDependencies = useCallback(
    (dependencies: MetricDependency[], fingerprint: string) => {
      const prev = registrationRef.current;
      if (prev?.fingerprint === fingerprint) {
        return;
      }
      registrationRef.current = { deps: dependencies, fingerprint };
      setRegistrationEpoch((e) => e + 1);
    },
    [],
  );

  const overlaySources =
    overlayData?.report?.overlaySources ?? EMPTY_OVERLAY_SOURCES;

  const hydratedMetrics = useMemo(() => {
    const waitingForDocRegistration =
      rawSlimMetrics.length > 0 && registrationRef.current === null;
    if (waitingForDocRegistration) {
      return [];
    }
    const deps = registrationRef.current?.deps ?? [];
    const urlMap = buildOverlayStableIdToSourceUrlMap(overlaySources);
    return hydrateSpatialMetrics({
      slimMetrics: rawSlimMetrics,
      dependencies: deps,
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog,
    });
  }, [rawSlimMetrics, overlaySources, registrationEpoch, fragmentSubjectCatalog]);

  const slimMetricIdsFromServer = useMemo(
    () => new Set(hydratedMetrics.map((m) => String(m.id))),
    [hydratedMetrics],
  );

  const waitingForDocRegistration =
    rawSlimMetrics.length > 0 && registrationRef.current === null;

  const contextValue = useMemo(() => {
    let fragmentCalculationsRuntime: number | undefined = undefined;
    if (!dependenciesQueryLoading && !waitingForDocRegistration) {
      fragmentCalculationsRuntime = 0;
      for (const metric of hydratedMetrics) {
        if (
          metric.state === SpatialMetricState.Complete &&
          metric.subject != null &&
          subjectIsFragment(metric.subject) &&
          metric.durationSeconds
        ) {
          fragmentCalculationsRuntime += metric.durationSeconds * 1000;
        }
      }
    }
    return {
      metrics: hydratedMetrics,
      overlaySources,
      cardDependencyLists:
        depsData?.report?.dependencies?.cardDependencyLists ??
        EMPTY_CARD_DEPENDENCY_LISTS,
      slimMetricIdsFromServer,
      loading:
        awaitingDependencyInvalidation ||
        dependenciesQueryLoading ||
        overlaySourcesQueryLoading ||
        waitingForDocRegistration,
      dependenciesAwaitingRefresh: awaitingDependencyInvalidation,
      fragmentCalculationsRuntime,
      error: depsError || overlayError,
    };
  }, [
    hydratedMetrics,
    overlaySources,
    depsData?.report?.dependencies?.cardDependencyLists,
    slimMetricIdsFromServer,
    awaitingDependencyInvalidation,
    dependenciesQueryLoading,
    overlaySourcesQueryLoading,
    waitingForDocRegistration,
    depsError,
    overlayError,
  ]);

  useEffect(() => {
    const anyMetricsLoading = contextValue.metrics.some(
      (metric) =>
        metric.state !== SpatialMetricState.Complete &&
        metric.state !== SpatialMetricState.Error,
    );
    const anyOverlaySourcesLoading = contextValue.overlaySources.some(
      (source) =>
        source.sourceProcessingJob &&
        source.sourceProcessingJob.state !== SpatialMetricState.Complete &&
        source.sourceProcessingJob.state !== SpatialMetricState.Error,
    );

    let metricInterval: ReturnType<typeof setInterval> | null = null;
    let overlayInterval: ReturnType<typeof setInterval> | null = null;

    if (anyMetricsLoading) {
      metricInterval = setInterval(() => {
        refetchDeps();
      }, 1000);
    }

    if (anyOverlaySourcesLoading) {
      overlayInterval = setInterval(() => {
        refetchOverlaySources();
      }, 1000);
    }

    return () => {
      if (metricInterval) clearInterval(metricInterval);
      if (overlayInterval) clearInterval(overlayInterval);
    };
  }, [
    depsData,
    overlayData,
    refetchDeps,
    refetchOverlaySources,
    contextValue.metrics,
    contextValue.overlaySources,
  ]);

  const hydrateRecoveryRef = useRef(false);
  useEffect(() => {
    if (hydratedMetrics.length > 0) {
      hydrateRecoveryRef.current = false;
      return;
    }
    if (
      hydrateRecoveryRef.current ||
      dependenciesQueryLoading ||
      waitingForDocRegistration ||
      rawSlimMetrics.length === 0
    ) {
      return;
    }
    // Slim payload had rows but hydration dropped all (e.g. fragment catalog
    // index drift after a collection move + cache eviction). One refetch
    // usually realigns slim metrics and catalog.
    hydrateRecoveryRef.current = true;
    void refetchDeps();
  }, [
    dependenciesQueryLoading,
    waitingForDocRegistration,
    rawSlimMetrics.length,
    hydratedMetrics.length,
    refetchDeps,
  ]);

  return (
    <ReportMetricDependencyRegistrarContext.Provider
      value={registerReportMetricDependencies}
    >
      <ReportDependenciesContext.Provider value={contextValue}>
        {children}
      </ReportDependenciesContext.Provider>
    </ReportMetricDependencyRegistrarContext.Provider>
  );
}
