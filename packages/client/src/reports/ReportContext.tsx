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
  useGeographyMetricSubscriptionSubscription,
  useRecalculateSpatialMetricsMutation,
  useSketchMetricSubscriptionSubscription,
  useSourceProcessingJobsQuery,
  useSourceProcessingJobsSubscriptionSubscription,
  DraftReportDocument,
  OverlaySourceDetailsFragment,
  useReportContextQuery,
  ReportContextDocument,
  SketchGeometryType,
} from "../generated/graphql";
import { ReportConfiguration } from "./cards/cards";
import { MetricSubjectFragment } from "overlay-engine";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";

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
  userIsAdmin: boolean;
  recalculate: (metricIds: number[], preprocessSources?: boolean) => void;
}

export const ReportContext = createContext<ReportContextState | null>(null);

/**
 * Custom hook to manage report state
 */
export function useReportState(
  report: ReportConfiguration | undefined,
  sketchClassId: number,
  selectedSketchId: number | null,
  initialSelectedTabId?: number
): ReportContextState | undefined {
  const projectMetadata = useCurrentProjectMetadata();
  const [selectedTabId, setSelectedTabId] = useState<number>(
    initialSelectedTabId || report?.tabs?.[0]?.id || 0
  );
  const [selectedForEditing, setSelectedForEditing] = useState<number | null>(
    null
  );

  const sourceProcessingJobsQuery = useSourceProcessingJobsQuery({
    variables: {
      projectId: projectMetadata.data?.project?.id!,
    },
    skip: !projectMetadata.data?.project?.id,
  });

  useSourceProcessingJobsSubscriptionSubscription({
    variables: {
      projectId: projectMetadata.data?.project?.id!,
    },
    skip: !projectMetadata.data?.project?.id,
  });

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

  const { data, loading } = useReportContextQuery({
    variables: {
      reportId: report?.id!,
      sketchId: selectedSketchId!,
    },
    skip: !report?.id || !selectedSketchId,
    onError,
  });

  const [recalculateMutation, recalculateState] =
    useRecalculateSpatialMetricsMutation({
      onError: onError,
      refetchQueries: [DraftReportDocument],
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
    if (!report?.tabs) return;

    const currentTabExists = report.tabs.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && report.tabs[0]?.id) {
      setSelectedTabId(report.tabs[0].id);
    }
  }, [report?.tabs, selectedTabId]);

  const recalculate = useCallback(
    (metricIds: number[], preprocessSources?: boolean) => {
      return recalculateMutation({
        variables: {
          metricIds,
          preprocessSources: preprocessSources || false,
        },
        refetchQueries: [ReportContextDocument],
        awaitRefetchQueries: true,
      });
    },
    [recalculateMutation]
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
      selectedTab,
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
      isCollection: Boolean(
        data.sketch.sketchClass?.geometryType === SketchGeometryType.Collection
      ),
      overlaySources: data.report.dependencies.overlaySources,
      geographies: data.report.geographies || [],
      report: data.report as ReportConfiguration,
    } as ReportContextState;
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
