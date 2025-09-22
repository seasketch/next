import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  ReportContextSketchClassDetailsFragment,
  ReportContextSketchDetailsFragment,
  Sketch,
  SpatialMetricDependency,
  SpatialMetricState,
  useGeographyMetricSubscriptionSubscription,
  useGetOrCreateSpatialMetricsMutation,
  useSketchMetricSubscriptionSubscription,
  useSketchReportingDetailsQuery,
} from "../generated/graphql";
import { ReportConfiguration } from "./cards/cards";
import { Metric, MetricSubjectFragment } from "overlay-engine";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";

export interface ReportContextState {
  /**
   * Whether the sketch is a collection
   */
  isCollection: boolean;

  childSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  siblingSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  relatedFragments: MetricSubjectFragment[];

  /**
   * The report configuration containing tabs and cards
   */
  report: ReportConfiguration;

  /**
   * The currently selected tab ID
   */
  selectedTabId: number;

  /**
   * The currently selected tab configuration
   */
  selectedTab: ReportConfiguration["tabs"][0];

  /**
   * Function to update the selected tab
   */
  setSelectedTabId: (tabId: number) => void;

  /**
   * Whether the report is in admin/editable mode
   */
  adminMode: boolean;

  /**
   * The ID of the card currently selected for editing
   */
  selectedForEditing: number | null;

  /**
   * Function to set the card selected for editing
   */
  setSelectedForEditing: (cardId: number | null) => void;

  /**
   * Function to delete a card
   */
  deleteCard?: (cardId: number) => void;
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[];

  /**
   * Function to add a metric dependency
   */
  addMetricDependency: (
    hookId: number,
    dependency: SpatialMetricDependency
  ) => void;

  /**
   * Function to remove a metric dependency
   */
  removeMetricDependency: (
    hookId: number,
    dependency: SpatialMetricDependency
  ) => void;

  /**
   * The current metric dependencies, debounced
   */
  metricDependencies: SpatialMetricDependency[];
  selectedSketchId: number | null;
  sketch?: ReportContextSketchDetailsFragment;
  sketchClass?: ReportContextSketchClassDetailsFragment;
  metrics: LocalMetrics;
}

export const ReportContext = createContext<ReportContextState | null>(null);

type LocalMetric = Metric & {
  id: number;
  state: SpatialMetricState;
  createdAt: Date;
  updatedAt: Date | null;
  errorMessage?: string;
  progress?: number;
  jobKey?: string;
  stableId?: string;
  groupBy?: string;
};

type LocalMetrics = LocalMetric[];

/**
 * Custom hook to manage report state
 */
export function useReportState(
  report: ReportConfiguration | undefined,
  sketchClassId: number,
  selectedSketchId: number | null,
  initialSelectedTabId?: number
) {
  const [selectedTabId, setSelectedTabId] = useState<number>(
    initialSelectedTabId || report?.tabs?.[0]?.id || 0
  );
  const [selectedForEditing, setSelectedForEditing] = useState<number | null>(
    null
  );

  const [metrics, setMetrics] = useState<LocalMetrics>([]);

  // Get the selected tab based on selectedTabId, fallback to first tab
  const selectedTab = report?.tabs?.find((tab) => tab.id === selectedTabId) ||
    report?.tabs?.[0] || {
      id: 0,
      title: "Default Tab",
      position: 0,
      cards: [],
      alternateLanguageSettings: {},
    };

  const onError = useGlobalErrorHandler();
  const sketchReportingDetails = useSketchReportingDetailsQuery({
    variables: {
      id: selectedSketchId!,
      sketchClassId,
    },
    skip: !selectedSketchId,
    onError,
  });

  useEffect(() => {
    if (selectedSketchId) {
      setMetrics([]);
    }
  }, [selectedSketchId]);

  const projectId = useProjectId();

  useGeographyMetricSubscriptionSubscription({
    variables: {
      projectId: projectId!,
    },
    skip: !projectId,
    onData: ({ data }) => {
      const metric = data.data?.geographyMetrics?.metric
        ? parseMetric(data.data.geographyMetrics.metric)
        : null;
      if (metric) {
        setMetrics((prev) => {
          const newVal = prev.map((existing) => {
            if (
              existing.id === metric.id &&
              (existing.state !== SpatialMetricState.Complete ||
                metric.state === SpatialMetricState.Complete)
            ) {
              return {
                ...existing,
                ...metric,
              };
            }
            return existing;
          });
          return newVal;
        });
      }
    },
  });

  useSketchMetricSubscriptionSubscription({
    variables: {
      sketchId: selectedSketchId!,
    },
    skip: !selectedSketchId,
    onData: ({ data }) => {
      const metric = data.data?.sketchMetrics?.metric
        ? parseMetric(data.data.sketchMetrics.metric)
        : null;
      if (metric) {
        setMetrics((prev) => {
          const newVal = prev.map((existing) => {
            if (
              existing.id === metric.id &&
              (existing.state !== SpatialMetricState.Complete ||
                metric.state === SpatialMetricState.Complete)
            ) {
              return {
                ...existing,
                ...metric,
              };
            }
            return existing;
          });

          return newVal;
        });
      }
    },
  });

  // Update selectedTabId if the current one is no longer valid
  useEffect(() => {
    if (!report?.tabs) return;

    const currentTabExists = report.tabs.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && report.tabs[0]?.id) {
      setSelectedTabId(report.tabs[0].id);
    }
  }, [report?.tabs, selectedTabId]);

  const [metricDependencies, setMetricDependencies] = useState<
    (SpatialMetricDependency & { hash: string; hooks: number[] })[]
  >([]);

  // Adds a metric dependency to metricDependencies, tracking the card it
  // belongs to. Multiple cards can share the same dependency, it should only be
  // added once, tracking all the cards that share the same dependency.
  const addMetricDependency = useCallback(
    (hookId: number, dependency: SpatialMetricDependency) => {
      const hash = hashMetricDependency(dependency);
      setMetricDependencies((currentDependencies) => {
        const existingDependency = currentDependencies.find(
          (d) => d.hash === hash
        );
        if (existingDependency) {
          return currentDependencies.map((d) =>
            d.hash === hash ? { ...d, hooks: [...d.hooks, hookId] } : d
          );
        } else {
          return [
            ...currentDependencies,
            { ...dependency, hash, hooks: [hookId] },
          ];
        }
      });
    },
    []
  );

  // Removes a metric dependency from metricDependencies, assuming no cards
  // reference it anymore.
  const removeMetricDependency = useCallback(
    (hookId: number, dependency: SpatialMetricDependency) => {
      const hash = hashMetricDependency(dependency);
      setMetricDependencies((currentDependencies) => {
        const existingDependency = currentDependencies.find(
          (d) => d.hash === hash
        );
        if (existingDependency) {
          const updatedHooks = existingDependency.hooks.filter(
            (id) => id !== hookId
          );
          if (updatedHooks.length === 0) {
            return currentDependencies.filter((d) => d.hash !== hash);
          } else {
            return currentDependencies.map((d) =>
              d.hash === hash ? { ...d, hooks: updatedHooks } : d
            );
          }
        }
        return currentDependencies;
      });
    },
    []
  );

  const [currentMetricDependencies, setCurrentMetricDependencies] = useState<
    SpatialMetricDependency[]
  >([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const deps = metricDependencies.map((d) => {
        const dep = {
          ...d,
        } as any;
        delete dep.hash;
        delete dep.hooks;
        return dep as SpatialMetricDependency;
      });
      setCurrentMetricDependencies(deps);
    }, 5);

    return () => clearTimeout(handler);
  }, [metricDependencies]);

  const [getOrCreateSpatialMetrics, mutationState] =
    useGetOrCreateSpatialMetricsMutation();

  const [
    previouslyFetchedMetricDependencies,
    setPreviouslyFetchedMetricDependencies,
  ] = useState<string>("");

  useEffect(() => {
    const stringifiedDependencies = JSON.stringify(currentMetricDependencies);
    if (
      currentMetricDependencies.length > 0 &&
      stringifiedDependencies !== previouslyFetchedMetricDependencies
    ) {
      setPreviouslyFetchedMetricDependencies(stringifiedDependencies);
      // check if there are any dependencies that have not already been fetched
      getOrCreateSpatialMetrics({
        variables: {
          dependencies: currentMetricDependencies,
        },
      }).then((results) => {
        setMetrics((prev) => {
          return updateMetricsList(
            prev,
            results.data?.getOrCreateSpatialMetrics?.metrics || []
          );
        });
      });
    }
  }, [currentMetricDependencies, setMetrics, getOrCreateSpatialMetrics]);

  return {
    selectedTabId,
    setSelectedTabId,
    selectedTab,
    selectedForEditing,
    setSelectedForEditing,
    addMetricDependency,
    removeMetricDependency,
    metricDependencies: currentMetricDependencies,
    selectedSketchId,
    sketch: sketchReportingDetails.data
      ?.sketch as ReportContextSketchDetailsFragment,
    sketchClass: sketchReportingDetails.data
      ?.sketchClass as ReportContextSketchClassDetailsFragment,
    childSketches: sketchReportingDetails.data?.sketch?.children || [],
    siblingSketches: sketchReportingDetails.data?.sketch?.siblings || [],
    relatedFragments:
      (sketchReportingDetails.data?.sketch
        ?.relatedFragments as MetricSubjectFragment[]) || [],
    loading: sketchReportingDetails.loading,
    metrics,
  };
}

export function useReportContext(): ReportContextState {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error(
      "useReportContext must be used within a ReportContextProvider"
    );
  }
  return context;
}

function hashMetricDependency(dependency: SpatialMetricDependency): string {
  const data = JSON.stringify(dependency);

  // Simple djb2 hash algorithm - works in both browser and Node.js
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) + hash + data.charCodeAt(i);
    // Convert to 32-bit integer
    hash = hash & hash;
  }

  // Convert to positive hex string
  return Math.abs(hash).toString(16);
}

function updateMetricsList(
  prev: LocalMetrics,
  newMetrics: CompatibleSpatialMetricDetailsFragment[]
): LocalMetrics {
  const newList = newMetrics.map((m) => {
    const existing = prev.find((p) => p.id === m.id);
    if (
      existing &&
      (existing.state !== SpatialMetricState.Complete ||
        m.state === SpatialMetricState.Complete)
    ) {
      return {
        ...existing,
        ...parseMetric(m),
      };
    } else {
      return parseMetric(m);
    }
  });
  return newList;
}

function parseMetric(m: CompatibleSpatialMetricDetailsFragment): LocalMetric {
  return {
    ...m,
    id: parseInt(m.id),
    state: m.state,
    createdAt: new Date(m.createdAt!),
    updatedAt: m.updatedAt ? new Date(m.updatedAt) : null,
    errorMessage: m.errorMessage || undefined,
  } as LocalMetric;
}
