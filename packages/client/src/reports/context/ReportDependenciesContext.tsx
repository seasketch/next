import {
  createContext,
  useCallback,
  useEffect,
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
  useReportDependenciesQuery,
  useReportOverlaySourcesQuery,
} from "../../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import { ApolloError, NetworkStatus } from "@apollo/client";
import type { MetricDependency } from "overlay-engine";
import { ReportMetricDependencyRegistrarContext } from "./ReportMetricDependencyRegistrarContext";
import {
  buildOverlayStableIdToSourceUrlMap,
  EMPTY_FRAGMENT_SUBJECT_CATALOG,
  EMPTY_OVERLAY_SOURCES,
  EMPTY_SLIM_METRICS,
  hydrateSpatialMetrics,
} from "../utils/hydrateSpatialMetrics";

export const ReportDependenciesContext = createContext<{
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  cardDependencyLists: CardDependencyLists[];
  /** Metric ids present in the last successful slim `Report.dependencies` payload (before doc-based filtering). */
  slimMetricIdsFromServer: Set<string>;
  fragmentCalculationsRuntime?: number;
  loading: boolean;
  error?: ApolloError;
}>({
  metrics: [],
  overlaySources: [],
  cardDependencyLists: [],
  slimMetricIdsFromServer: new Set(),
  loading: true,
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

  const slimMetricIdsFromServer = useMemo(
    () => new Set(rawSlimMetrics.map((m) => String(m.id))),
    [rawSlimMetrics],
  );

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

  const waitingForDocRegistration =
    rawSlimMetrics.length > 0 && registrationRef.current === null;

  const contextValue = useMemo(() => {
    let fragmentCalculationsRuntime: number | undefined = undefined;
    if (!dependenciesQueryLoading && !waitingForDocRegistration) {
      fragmentCalculationsRuntime = 0;
      for (const metric of hydratedMetrics) {
        if (
          metric.state === SpatialMetricState.Complete &&
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
        dependenciesQueryLoading ||
        overlaySourcesQueryLoading ||
        waitingForDocRegistration,
      fragmentCalculationsRuntime,
      error: depsError || overlayError,
    };
  }, [
    hydratedMetrics,
    overlaySources,
    depsData?.report?.dependencies?.cardDependencyLists,
    slimMetricIdsFromServer,
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
