/* eslint-disable i18next/no-literal-string */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Dispatch,
  SetStateAction,
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
  useDraftReportDependenciesQuery,
  useProjectReportingLayersQuery,
} from "../generated/graphql";
import { ProsemirrorBodyJSON, ReportConfiguration } from "./cards/cards";
import {
  hashMetricDependency,
  MetricDependency,
  MetricSubjectFragment,
} from "overlay-engine";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import { ApolloError } from "@apollo/client";
import type { AnyLayer, AnySourceData } from "mapbox-gl";
import { MapContext } from "../dataLayers/MapContextManager";
import { Node } from "prosemirror-model";
import getSlug from "../getSlug";
import useDebounce from "../useDebounce";

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
  preselectTitle: boolean;

  /**
   * Function to set the card selected for editing
   */
  setSelectedForEditing: (
    cardId: number | null,
    preselectTitle?: boolean
  ) => void;

  /**
   * Function to delete a card
   */
  deleteCard?: (cardId: number) => void;
  /**
   * Function to move a card to another tab (admin only)
   */
  moveCardToTab?: (cardId: number, tabId: number) => Promise<void> | void;
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
  setDraftReportCardBody: (cardId: number, body: any) => void;
  clearDraftReportCardBody: () => void;
  additionalDependencies: MetricDependency[];
  setAdditionalDependencies: (dependencies: MetricDependency[]) => void;
  draftDependencyMetrics: CompatibleSpatialMetricDetailsFragment[];
  showCalcDetails: number | undefined;
  setShowCalcDetails: Dispatch<SetStateAction<number | undefined>>;
  adminSources: OverlaySourceDetailsFragment[];
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
  const [selectedForEditing, _setSelectedForEditing] = useState<number | null>(
    null
  );
  const [preselectTitle, setPreselectTitle] = useState<boolean>(false);
  const setSelectedForEditing = useCallback(
    (cardId: number | null, preselectTitle?: boolean) => {
      setPreselectTitle(preselectTitle || false);
      _setSelectedForEditing(cardId);
    },
    [_setSelectedForEditing, setPreselectTitle]
  );
  const [showCalcDetails, setShowCalcDetails] = useState<number | undefined>();

  const [additionalDependencies, setAdditionalDependencies] = useState<
    MetricDependency[]
  >([]);

  useReportOverlaySourcesSubscriptionSubscription({
    variables: {
      projectId: projectMetadata.data?.project?.id!,
    },
    skip: !projectMetadata.data?.project?.id,
  });

  const onError = useGlobalErrorHandler();

  const { data, refetch, variables } = useReportContextQuery({
    variables: {
      reportId: reportId!,
      sketchId: selectedSketchId!,
    },
    skip: !reportId || !selectedSketchId,
    onError,
    fetchPolicy: "cache-and-network",
  });

  const debouncedData = useDebounce(data, 100);

  const draftDependenciesQuery = useDraftReportDependenciesQuery({
    variables: {
      input: {
        nodeDependencies: additionalDependencies.map((d) => ({
          ...d,
          hash: hashMetricDependency(d),
        })),
        sketchId: selectedSketchId!,
      },
    },
    skip:
      !additionalDependencies ||
      additionalDependencies.length === 0 ||
      !selectedSketchId,
    onError,
    fetchPolicy: "cache-and-network",
  });

  const debouncedDraftDependenciesData = useDebounce(
    draftDependenciesQuery.data,
    100
  );

  const allOverlays = useMemo(() => {
    const tableOfContentsItemIds = new Set<number>();
    const overlays = [] as OverlaySourceDetailsFragment[];
    for (const overlay of data?.report?.dependencies?.overlaySources || []) {
      tableOfContentsItemIds.add(overlay.tableOfContentsItemId);
      overlays.push(overlay);
    }
    for (const overlay of draftDependenciesQuery.data?.draftReportDependencies
      ?.overlaySources || []) {
      if (!tableOfContentsItemIds.has(overlay.tableOfContentsItemId)) {
        tableOfContentsItemIds.add(overlay.tableOfContentsItemId);
        overlays.push(overlay);
      }
    }
    return overlays;
  }, [
    debouncedData?.report?.dependencies?.overlaySources,
    debouncedDraftDependenciesData?.draftReportDependencies?.overlaySources,
  ]);

  const draftReportingLayersQuery = useProjectReportingLayersQuery({
    variables: {
      slug: getSlug(),
    },
    skip: !window.location.pathname.includes("/admin/sketching/"),
  });

  const metrics = useMemo(() => {
    let metrics: CompatibleSpatialMetricDetailsFragment[] = [];
    if (data?.report?.dependencies?.metrics) {
      metrics.push(...data.report.dependencies.metrics);
    }
    if (debouncedDraftDependenciesData?.draftReportDependencies?.metrics) {
      metrics.push(
        ...debouncedDraftDependenciesData.draftReportDependencies.metrics
      );
    }
    if (
      !debouncedDraftDependenciesData?.draftReportDependencies?.metrics &&
      draftDependenciesQuery.previousData?.draftReportDependencies?.metrics &&
      draftDependenciesQuery.previousData.draftReportDependencies.sketchId ===
        variables?.sketchId
    ) {
      metrics.push(
        ...draftDependenciesQuery.previousData.draftReportDependencies.metrics
      );
    }
    return [
      ...(debouncedData?.report?.dependencies?.metrics || []),
      ...(debouncedDraftDependenciesData?.draftReportDependencies?.metrics ||
        []),
    ] as CompatibleSpatialMetricDetailsFragment[];
  }, [
    debouncedData?.report?.dependencies?.metrics,
    debouncedDraftDependenciesData?.draftReportDependencies,
    variables?.sketchId,
    draftDependenciesQuery.previousData?.draftReportDependencies?.sketchId,
    draftDependenciesQuery.previousData?.draftReportDependencies?.metrics,
  ]);

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

    const currentTabExists = debouncedData?.report?.tabs?.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && debouncedData?.report?.tabs?.[0]?.id) {
      setSelectedTabId(debouncedData.report.tabs[0].id);
    }
  }, [debouncedData?.report?.tabs, selectedTabId]);

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
      (metrics || []).find(
        (m) =>
          m.state === SpatialMetricState.Queued ||
          m.state === SpatialMetricState.Processing
      ) !== undefined
    );
  }, [metrics]);

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
      debouncedData?.report?.dependencies?.cardDependencyLists &&
      metrics.length > 0 &&
      allOverlays.length > 0
    ) {
      for (const cardDependencyList of debouncedData.report.dependencies
        .cardDependencyLists) {
        const overlays = allOverlays.filter((overlay) =>
          cardDependencyList.overlaySources.includes(
            overlay.tableOfContentsItemId
          )
        );
        const cardMetrics = metrics.filter((metric) =>
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
        for (const metric of cardMetrics) {
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
          metrics: cardMetrics,
          overlaySources: overlays,
          loading,
          errors,
        };
      }
    }
    return dependencies;
  }, [
    debouncedData?.report?.dependencies?.cardDependencyLists,
    metrics,
    allOverlays,
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

  const [draftReportCardBody, _setDraftReportCardBody] =
    useState<ProsemirrorBodyJSON | null>(null);

  const setDraftReportCardBody = useCallback(
    (cardId: number, body: ProsemirrorBodyJSON) => {
      if (selectedForEditing !== cardId) {
        throw new Error("Card not selected for editing");
      }
      _setDraftReportCardBody(body);
    },
    [selectedForEditing]
  );

  const clearDraftReportCardBody = useCallback(() => {
    _setDraftReportCardBody(null);
  }, [_setDraftReportCardBody]);

  useEffect(() => {
    if (draftReportCardBody) {
      const deps = extractMetricDependenciesFromReportBody(draftReportCardBody);
      const metrics = debouncedData?.report?.dependencies?.metrics || [];
      const hashesInMainReportRequest = new Set(
        metrics.map(
          (metric: CompatibleSpatialMetricDetailsFragment) =>
            metric.dependencyHash
        )
      );
      const hashesInDraft = new Set(deps.map((d) => hashMetricDependency(d)));

      const missingDependencies: (MetricDependency & { hash: string })[] = [];
      const missingHashes: string[] = [];
      for (const hash of hashesInDraft) {
        if (!hashesInMainReportRequest.has(hash)) {
          const dep = deps.find((d) => hashMetricDependency(d) === hash);
          if (!dep) {
            throw new Error(`Dependency not found in draft: ${hash}`);
          }
          missingHashes.push(hash);
          missingDependencies.push({
            ...dep,
            hash,
          });
        }
      }

      if (missingDependencies.length > 0) {
        setAdditionalDependencies((prev) => {
          // first, check if the dependencies are identical. If so, don't update
          const currentHashes = prev
            .map((d) => hashMetricDependency(d))
            .join(",");
          const newHashes = missingDependencies
            .map((d) => hashMetricDependency(d))
            .join(",");
          if (currentHashes === newHashes) {
            return prev;
          } else {
            return missingDependencies;
          }
        });
      } else {
        setAdditionalDependencies([]);
      }
    } else {
      setAdditionalDependencies([]);
    }
  }, [
    draftReportCardBody,
    setAdditionalDependencies,
    debouncedData?.report?.dependencies,
    getDependencies,
    selectedForEditing,
    variables,
  ]);

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
      additionalDependencies,
      setAdditionalDependencies,
      setDraftReportCardBody,
      clearDraftReportCardBody,
      selectedTabId,
      setSelectedTabId,
      selectedTab: selectedTab as ReportConfiguration["tabs"][0],
      selectedForEditing,
      setSelectedForEditing,
      preselectTitle,
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
      metrics: metrics,
      userIsAdmin: projectMetadata.data?.project?.sessionIsAdmin || false,
      recalculate,
      recalculateState: {
        loading: recalculateState.loading,
        error: recalculateState.error || undefined,
      },
      isCollection: Boolean(
        data.sketch.sketchClass?.geometryType === SketchGeometryType.Collection
      ),
      overlaySources: allOverlays,
      geographies: data.report.geographies || [],
      report: data.report as unknown as ReportConfiguration,
      getDependencies,
      setCardMapStyle,
      draftDependencyMetrics:
        draftDependenciesQuery.data?.draftReportDependencies?.metrics || [],
      showCalcDetails,
      setShowCalcDetails,
      adminSources:
        draftReportingLayersQuery.data?.projectBySlug?.reportingLayers || [],
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

export function extractMetricDependenciesFromReportBody(
  node: ProsemirrorNode,
  dependencies: MetricDependency[] = []
) {
  if (typeof node !== "object" || node === null || !node.type) {
    throw new Error("Invalid node");
  }
  if (
    (node.type === "metric" || node.type === "blockMetric") &&
    node.attrs?.metrics
  ) {
    const metrics = node.attrs.metrics;
    if (!Array.isArray(metrics)) {
      throw new Error("Invalid metrics");
    }
    if (metrics.length > 0) {
      if (typeof metrics[0] !== "object") {
        throw new Error("Invalid metric");
      }
      dependencies.push(...metrics);
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      extractMetricDependenciesFromReportBody(child, dependencies);
    }
  }
  return dependencies;
}

type ProsemirrorNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: ProsemirrorNode[];
};
type ProsemirrorDocument = ProsemirrorNode & {
  type: "doc";
};
