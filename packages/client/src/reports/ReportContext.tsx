/* eslint-disable i18next/no-literal-string */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  ReportContextSketchClassDetailsFragment,
  ReportContextSketchDetailsFragment,
  Sketch,
  useGeographyMetricSubscriptionSubscription,
  useRecalculateSpatialMetricsMutation,
  useSketchMetricSubscriptionSubscription,
  OverlaySourceDetailsFragment,
  useReportContextQuery,
  ReportContextDocument,
  SketchGeometryType,
  useReportOverlaySourcesSubscriptionSubscription,
  SpatialMetricState,
} from "../generated/graphql";
import { ReportConfiguration } from "./cards/cards";
import { MetricSubjectFragment } from "overlay-engine";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { ApolloError } from "@apollo/client";
import type { AnyLayer, AnySourceData } from "mapbox-gl";
import { MapContext } from "../dataLayers/MapContextManager";

export type ReportMapStyle = {
  sources: { [id: string]: AnySourceData };
  layers: AnyLayer[];
};

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
  adminMode?: boolean;

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

  selectedSketchId: number | null;
  sketch: ReportContextSketchDetailsFragment;
  sketchClass: ReportContextSketchClassDetailsFragment;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  overlaySources: OverlaySourceDetailsFragment[];
  getDependencies: (cardId: number) => {
    metrics: CompatibleSpatialMetricDetailsFragment[];
    overlaySources: OverlaySourceDetailsFragment[];
    loading: boolean;
    errors: string[];
  };
  userIsAdmin: boolean;
  recalculate: (metricIds: number[], preprocessSources?: boolean) => void;
  recalculateState: { loading: boolean; error: ApolloError | undefined };
  /**
   * Set or clear a map style associated with a given report card. Styles are
   * automatically namespaced so they don't collide with other report cards or
   * the main overlay list.
   */
  setCardMapStyle: (
    cardId: number,
    styleId: string,
    style: ReportMapStyle | null
  ) => void;
}

export const ReportContext = createContext<ReportContextState | null>(null);

/**
 * Custom hook to manage report state
 */
export function useReportState(
  reportId: number | undefined,
  sketchClassId: number,
  selectedSketchId: number | null,
  initialSelectedTabId?: number
): ReportContextState | undefined {
  const projectMetadata = useCurrentProjectMetadata();
  const mapContext = useContext(MapContext);
  const cardMapStylesRef = useRef<{
    [cardId: number]: {
      [styleId: string]: { sources: string[]; layers: string[] };
    };
  }>({});
  const [selectedForEditing, setSelectedForEditing] = useState<number | null>(
    null
  );

  useReportOverlaySourcesSubscriptionSubscription({
    variables: {
      projectId: projectMetadata.data?.project?.id!,
    },
    skip: !projectMetadata.data?.project?.id,
  });

  const onError = useGlobalErrorHandler();

  const { data, refetch } = useReportContextQuery({
    variables: {
      reportId: reportId!,
      sketchId: selectedSketchId!,
    },
    skip: !reportId || !selectedSketchId,
    onError,
    fetchPolicy: "cache-and-network",
  });

  const [selectedTabId, setSelectedTabId] = useState<number>(
    initialSelectedTabId || data?.report?.tabs?.[0]?.id || 0
  );

  // Get the selected tab based on selectedTabId, fallback to first tab
  const selectedTab = data?.report?.tabs?.find(
    (tab) => tab.id === selectedTabId
  ) ||
    data?.report?.tabs?.[0] || {
      id: 0,
      title: "Default Tab",
      position: 0,
      cards: [],
      alternateLanguageSettings: {},
    };

  const [recalculateMutation, recalculateState] =
    useRecalculateSpatialMetricsMutation({
      onError: onError,
      refetchQueries: [ReportContextDocument],
      awaitRefetchQueries: true,
    });

  const projectId = useProjectId();

  useGeographyMetricSubscriptionSubscription({
    variables: {
      projectId: projectId!,
    },
    skip: !projectId,
  });

  useSketchMetricSubscriptionSubscription({
    variables: {
      sketchId: selectedSketchId!,
    },
    skip: !selectedSketchId,
  });

  // Update selectedTabId if the current one is no longer valid
  useEffect(() => {
    if (!data?.report?.tabs) return;

    const currentTabExists = data.report.tabs.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && data.report.tabs[0]?.id) {
      setSelectedTabId(data.report.tabs[0].id);
    }
  }, [data?.report?.tabs, selectedTabId]);

  const recalculate = useCallback(
    (metricIds: number[], preprocessSources?: boolean) => {
      return recalculateMutation({
        variables: {
          metricIds,
          preprocessSources: preprocessSources || false,
        },
        refetchQueries: [ReportContextDocument],
        awaitRefetchQueries: true,
        onCompleted: () => {
          // When there are a lot of metrics to recalculate, some appear in the
          // client as "stuck" in the queued state. This is a hack to force a
          // refetch. I'm not really sure why this occurs, but this seems to
          // fix the issue.
          setTimeout(() => {
            refetch();
          }, 1500);
        },
      });
    },
    [recalculateMutation, refetch]
  );

  const metricsInProgress = useMemo(() => {
    return (
      (data?.report?.dependencies?.metrics || []).find(
        (m) =>
          m.state === SpatialMetricState.Queued ||
          m.state === SpatialMetricState.Processing
      ) !== undefined
    );
  }, [data?.report?.dependencies?.metrics]);

  useEffect(() => {
    if (metricsInProgress) {
      const interval = setInterval(() => {
        refetch();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [metricsInProgress, refetch]);

  const dependencies = useMemo(() => {
    let dependencies: {
      [cardId: number]: {
        metrics: CompatibleSpatialMetricDetailsFragment[];
        overlaySources: OverlaySourceDetailsFragment[];
        loading: boolean;
        errors: string[];
      };
    } = {};
    if (
      data?.report?.dependencies?.cardDependencyLists &&
      data?.report?.dependencies?.metrics &&
      data?.report?.dependencies?.overlaySources
    ) {
      for (const cardDependencyList of data.report.dependencies
        .cardDependencyLists) {
        const overlays = data.report.dependencies.overlaySources.filter(
          (overlay) =>
            cardDependencyList.overlaySources.includes(
              overlay.tableOfContentsItemId
            )
        );
        const metrics = data.report.dependencies.metrics.filter((metric) =>
          cardDependencyList.metrics.includes(metric.id)
        );
        let loading = false;
        let errors: string[] = [];
        for (const overlay of overlays) {
          if (!overlay.output) {
            loading = true;
          }
          if (overlay.sourceProcessingJob?.state === SpatialMetricState.Error) {
            errors.push(
              overlay.sourceProcessingJob?.errorMessage || "Unknown error"
            );
          }
        }
        for (const metric of metrics) {
          if (metric.state === SpatialMetricState.Error) {
            errors.push(metric.errorMessage || "Unknown error");
          }
          if (
            metric.state !== SpatialMetricState.Complete &&
            metric.state !== SpatialMetricState.Error
          ) {
            loading = true;
          }
        }
        dependencies[cardDependencyList.cardId] = {
          metrics,
          overlaySources: overlays,
          loading,
          errors,
        };
      }
    }
    return dependencies;
  }, [
    data?.report?.dependencies?.cardDependencyLists,
    data?.report?.dependencies?.metrics,
    data?.report?.dependencies?.overlaySources,
  ]);

  const getDependencies = useCallback(
    (cardId: number) => {
      if (cardId in dependencies) {
        return dependencies[cardId];
      } else {
        return {
          metrics: [],
          overlaySources: [],
          loading: false,
          errors: [],
        };
      }
    },
    [dependencies]
  );

  const setCardMapStyle = useCallback(
    (cardId: number, styleId: string, style: ReportMapStyle | null) => {
      const manager = mapContext.manager;
      if (!manager) {
        return;
      }

      // Namespace by report, sketch, and card so multiple open reports can't
      // clobber each other's dynamic layers or sources.
      const reportIdPart = data?.report?.id ?? "report";
      const sketchIdPart = selectedSketchId ?? "sketch";
      // eslint-disable-next-line i18next/no-literal-string
      const basePrefix = `report-style-${reportIdPart}-${sketchIdPart}-${cardId}-${styleId}`;

      const perCard = cardMapStylesRef.current[cardId];
      const existing = perCard?.[styleId];
      if (existing) {
        for (const sourceId of existing.sources) {
          manager.removeSource(sourceId);
        }
        for (const layerId of existing.layers) {
          manager.removeLayer(layerId);
        }
        if (perCard) {
          delete perCard[styleId];
          if (Object.keys(perCard).length === 0) {
            delete cardMapStylesRef.current[cardId];
          }
        }
      }

      if (!style) {
        return;
      }

      const sourceIds: string[] = [];
      const layerIds: string[] = [];

      for (const [sourceId, source] of Object.entries(style.sources || {})) {
        const namespacedId = `${basePrefix}-source-${sourceId}`;
        manager.addSource(namespacedId, source as AnySourceData);
        sourceIds.push(namespacedId);
      }

      for (const layer of style.layers || []) {
        const originalId = layer.id;
        const namespacedLayerId = `${basePrefix}-layer-${originalId}`;
        const anyLayer = layer as any;
        const originalSource: any = anyLayer.source;
        const namespacedSource =
          typeof originalSource === "string"
            ? `${basePrefix}-source-${originalSource}`
            : originalSource;

        const clonedLayer: AnyLayer = {
          ...anyLayer,
          id: namespacedLayerId,
          ...(namespacedSource !== undefined
            ? { source: namespacedSource }
            : {}),
        };

        manager.addLayer(clonedLayer);
        layerIds.push(namespacedLayerId);
      }

      if (!cardMapStylesRef.current[cardId]) {
        cardMapStylesRef.current[cardId] = {};
      }
      cardMapStylesRef.current[cardId][styleId] = {
        sources: sourceIds,
        layers: layerIds,
      };
    },
    [data?.report?.id, mapContext.manager, selectedSketchId]
  );

  if (!data?.sketch) {
    return undefined;
  } else {
    if (!data.report) {
      throw new Error("Report not found");
    } else if (!data.sketch.sketchClass) {
      throw new Error("Sketch class not found");
    } else if (!data.report.dependencies) {
      throw new Error("Report dependencies not found");
    }
    return {
      selectedTabId,
      setSelectedTabId,
      selectedTab: selectedTab as ReportConfiguration["tabs"][0],
      selectedForEditing,
      setSelectedForEditing,
      selectedSketchId,
      sketch: data.sketch!,
      sketchClass: data.sketch.sketchClass!,
      childSketches: (data.sketch.children || []) as Pick<
        Sketch,
        "id" | "name" | "sketchClassId"
      >[],
      siblingSketches: (data.sketch.siblings || []) as Pick<
        Sketch,
        "id" | "name" | "sketchClassId"
      >[],
      relatedFragments: (data.sketch.relatedFragments ||
        []) as MetricSubjectFragment[],
      metrics: (data.report.dependencies.metrics ||
        []) as CompatibleSpatialMetricDetailsFragment[],
      userIsAdmin: projectMetadata.data?.project?.sessionIsAdmin || false,
      recalculate,
      recalculateState: {
        loading: recalculateState.loading,
        error: recalculateState.error || undefined,
      },
      isCollection: Boolean(
        data.sketch.sketchClass?.geometryType === SketchGeometryType.Collection
      ),
      overlaySources: data.report.dependencies.overlaySources,
      geographies: data.report.geographies || [],
      report: data.report as ReportConfiguration,
      getDependencies,
      setCardMapStyle,
    };
  }
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

export function useReportStyleToggle(
  cardId: number,
  styleId: string,
  style: ReportMapStyle | null | undefined
) {
  const { setCardMapStyle } = useReportContext();
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => {
    setVisible((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!style && visible) {
      setVisible(false);
    }
  }, [style, visible]);

  useEffect(() => {
    if (!style || !visible) {
      setCardMapStyle(cardId, styleId, null);
    } else {
      setCardMapStyle(cardId, styleId, style);
    }
  }, [visible, style, cardId, styleId, setCardMapStyle]);

  useEffect(() => {
    return () => {
      setCardMapStyle(cardId, styleId, null);
    };
  }, [cardId, styleId, setCardMapStyle]);

  return {
    visible,
    toggle,
    setVisible,
  };
}
