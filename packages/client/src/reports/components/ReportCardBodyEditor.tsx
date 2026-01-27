import { EditorState, TextSelection } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal as createReactPortal } from "react-dom";
import { useDebouncedFn } from "beautiful-react-hooks";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../../editor/TooltipMenu";
import {
  BLUR_SELECTION_STYLES,
  createBlurSelectionPlugin,
} from "../../editor/blurSelectionPlugin";
import ActiveParagraphPlaceholderPlugin from "../../editor/ActiveParagraphPlaceholderPlugin";
import { FormLanguageContext } from "../../formElements/FormElement";
import { exampleSetup } from "prosemirror-example-setup";
import ReportTitlePlaceholderPlugin from "../../editor/ReportTitlePlaceholderPlugin";
import {
  reportBodySchema,
  setCollapsibleBlocksClosed,
} from "../widgets/prosemirror/reportBodySchema";
import ReactNodeViewPortalsProvider, {
  useReactNodeViewPortals,
} from "../ReactNodeView/PortalProvider";
import { createReactNodeView } from "../ReactNodeView";
import {
  ReportWidgetNodeViewRouter,
  buildReportCommandGroups,
} from "../widgets/widgets";
import { CommandPaletteItem } from "../commandPalette/types";
import { DetailsView } from "../widgets/prosemirror/details";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  ProjectReportingLayersDocument,
  SpatialMetricState,
  useProjectReportingLayersQuery,
  usePublishedTableOfContentsQuery,
  useDataDownloadInfoLazyQuery,
  usePreprocessSourceMutation,
  useAvailableReportLayersQuery,
  useUpdateReportCardMutation,
  DraftReportDocument,
  useUpdateReportCardBodyMutation,
  useDraftReportDependenciesQuery,
  ReportContextDocument,
  SourceProcessingJobDetailsFragment,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useSlashCommandPalette } from "../hooks/useSlashCommandPalette";
import {
  extractMetricDependenciesFromReportBody,
  ReportContext,
} from "../ReportContext";
import getSlug from "../../getSlug";
import Spinner from "../../components/Spinner";
import { LayerPickerList } from "../widgets/LayerPickerDropdown";
import { useHistory } from "react-router-dom";
import { ProsemirrorBodyJSON } from "../cards/cards";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Button from "../../components/Button";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
import { DraftReportContext } from "../DraftReportContext";
import ReportCardLoadingIndicator from "./ReportCardLoadingIndicator";

interface ReportCardBodyEditorProps {
  /**
   * The Prosemirror document to edit
   */
  body: any;
  /**
   * Whether this is an input field (affects editor configuration)
   */
  isInput?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   *
   */
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  cardId: number;
  preselectTitle?: boolean;
  footerContainerRef: React.RefObject<HTMLDivElement>;
}

type OverlayPickerOption = {
  id: number;
  title: string;
  stableId?: string | null;
  dataSourceType?: string | null;
};

function ReportCardBodyEditorInner({
  body,
  isInput = false,
  className = "",
  metrics,
  sources,
  cardId,
  preselectTitle = false,
  footerContainerRef,
}: ReportCardBodyEditorProps) {
  const reportContext = useContext(ReportContext);

  const [reportBodyHasChanges, setReportBodyHasChanges] = useState(false);
  const [draftBody, setDraftBody] = useState<ProsemirrorBodyJSON>(
    JSON.parse(JSON.stringify(body))
  );
  const onError = useGlobalErrorHandler();

  const [updateReportCard, updateReportCardState] =
    useUpdateReportCardBodyMutation({
      onError,
      awaitRefetchQueries: true,
      refetchQueries: [DraftReportDocument],
    });

  const handleCardSave = useCallback(async () => {
    await updateReportCard({
      variables: {
        id: cardId,
        body: setCollapsibleBlocksClosed(draftBody),
      },
      refetchQueries: [DraftReportDocument, ReportContextDocument],
      awaitRefetchQueries: true,
    });
    reportContext?.setSelectedForEditing(null);
  }, [reportBodyHasChanges, updateReportCard, cardId, draftBody]);

  const history = useHistory();
  const { t } = useTranslation("sketching");

  const [additionalDependencies, setAdditionalDependencies] = useState<
    MetricDependency[]
  >([]);

  const draftDependenciesQuery = useDraftReportDependenciesQuery({
    variables: {
      input: {
        nodeDependencies: additionalDependencies.map((d) => ({
          ...d,
          hash: hashMetricDependency(d),
        })),
        sketchId: reportContext?.selectedSketchId!,
      },
    },
    skip:
      !additionalDependencies ||
      additionalDependencies.length === 0 ||
      !reportContext?.selectedSketchId,
    onError,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (
      !draftDependenciesQuery.loading &&
      !draftDependenciesQuery.data?.draftReportDependencies?.ready
    ) {
      const ref = setInterval(() => {
        draftDependenciesQuery.refetch();
      }, 1000);
      return () => clearInterval(ref);
    }
  }, [
    draftDependenciesQuery.loading,
    draftDependenciesQuery.data?.draftReportDependencies?.ready,
    draftDependenciesQuery,
  ]);

  const allDependencies = useMemo(() => {
    const allMetrics = [...metrics] as CompatibleSpatialMetricDetailsFragment[];
    const allSourceProcessingJobs = [...sources.map((s) => s.sourceProcessingJob)] as SourceProcessingJobDetailsFragment[];
    for (const source of draftDependenciesQuery.data?.draftReportDependencies?.overlaySources || []) {
      if (source.sourceProcessingJob && !allSourceProcessingJobs.find((j) => j.jobKey === source.sourceProcessingJob?.jobKey)) {
        allSourceProcessingJobs.push(source.sourceProcessingJob);
      }
    }
    for (const metric of draftDependenciesQuery.data?.draftReportDependencies?.metrics || []) {
      if (metric.id && !allMetrics.find((m) => m.id === metric.id)) {
        allMetrics.push(metric);
      }
    }
    return {
      metrics: allMetrics,
      sourceProcessingJobs: allSourceProcessingJobs,
    };
  }, [draftDependenciesQuery.data?.draftReportDependencies, metrics, sources])

  // Handle navigation blocking when editing
  useEffect(() => {
    if (!reportBodyHasChanges) return;
    const message = t(
      "You have unsaved changes to a report card. Are you sure you want to leave?"
    );

    // Handle browser refresh/close (beforeunload)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    // Handle React Router navigation
    const unblock = history.block(() => message);

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unblock();
    };
  }, [history, t, reportBodyHasChanges]);

  const { schema, plugins } = useMemo(() => {
    const schema = reportBodySchema;
    const plugins = [
      ...exampleSetup({ schema, menuBar: false }),
      ReportTitlePlaceholderPlugin(),
      createBlurSelectionPlugin(),
      ActiveParagraphPlaceholderPlugin(),
    ];
    return { schema, plugins };
  }, []);

  const langContext = useContext(FormLanguageContext);
  const currentLangCode = langContext?.lang?.code || "EN";

  const reportingLayersQuery = useProjectReportingLayersQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const [fetchOverlayDetails] = useDataDownloadInfoLazyQuery();
  const [preprocessSourceMutation, preprocessSourceState] =
    usePreprocessSourceMutation();
  const [pendingOverlayKey, setPendingOverlayKey] = useState<string | null>(
    null
  );
  const [addingOverlayId, setAddingOverlayId] = useState<number | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const overlayAugmenter = useCallback(
    ({
      source,
      item,
    }: {
      source: OverlaySourceDetailsFragment;
      item: CommandPaletteItem;
    }): CommandPaletteItem => {
      const state =
        source.sourceProcessingJob?.state ||
        (source.output ? null : SpatialMetricState.Queued);
      const status =
        state || source.sourceProcessingJob?.progressPercentage != null
          ? {
            state: state || null,
            progressPercent:
              source.sourceProcessingJob?.progressPercentage ?? null,
            label:
              source.sourceProcessingJob?.state ===
                SpatialMetricState.Processing &&
                source.sourceProcessingJob?.progressPercentage != null
                ? t("Processing {{percent}}%", {
                  percent:
                    source.sourceProcessingJob?.progressPercentage ?? 0,
                })
                : state || undefined,
          }
          : undefined;
      return {
        ...item,
        status,
      };
    },
    []
  );

  const handleOverlaySelection = useCallback(
    async (tocId: number) => {
      setOverlayError(null);
      setAddingOverlayId(tocId);
      try {
        const overlayDetails = await fetchOverlayDetails({
          variables: { tocId },
        });
        const sourceId =
          overlayDetails.data?.tableOfContentsItem?.dataLayer?.dataSource?.id;
        if (!sourceId) {
          throw new Error(t("Layer is missing a data source id"));
        }
        await preprocessSourceMutation({
          variables: {
            slug: getSlug(),
            sourceId,
          },
          refetchQueries: [
            {
              query: ProjectReportingLayersDocument,
              variables: { slug: getSlug() },
            },
          ],
          awaitRefetchQueries: true,
        });
        // eslint-disable-next-line i18next/no-literal-string
        setPendingOverlayKey(`layer-overlay-analysis:overlay-layer-${tocId}`);
        return true;
      } catch (err) {
        setOverlayError(
          err instanceof Error
            ? err.message
            : t("Unable to start preprocessing")
        );
        return false;
      } finally {
        setAddingOverlayId(null);
      }
    },
    [fetchOverlayDetails, preprocessSourceMutation]
  );

  const overlayFooterItem = useMemo<CommandPaletteItem>(() => {
    return {
      id: "choose-overlay",
      label: t("Choose from overlays…"),
      description: t("Add a reporting layer by preprocessing an overlay."),
      customPopoverContent: ({ closePopover, focusPalette }) => (
        <OverlayPickerContent
          isLoading={
            preprocessSourceState.loading || typeof addingOverlayId === "number"
          }
          loadingId={addingOverlayId}
          errorMessage={overlayError}
          onSelect={async (overlayId) => {
            const success = await handleOverlaySelection(overlayId);
            if (success) {
              closePopover();
              focusPalette();
            }
            return success;
          }}
        />
      ),
      disabled:
        preprocessSourceState.loading || typeof addingOverlayId === "number",
    };
  }, [
    preprocessSourceState.loading,
    addingOverlayId,
    overlayError,
    handleOverlaySelection,
  ]);

  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const lastLangCodeRef = useRef<string>(currentLangCode);
  const lastBodyRef = useRef<any>(body);
  const initialBodyRef = useRef<any>(body);
  const saveRef = useRef<((doc: any) => void) | null>(null);
  initialBodyRef.current = body;
  const { createPortal, removePortal, setSelection, setDraftDependencies } =
    useReactNodeViewPortals();

  useEffect(() => {
    setDraftDependencies({
      metrics:
        draftDependenciesQuery.data?.draftReportDependencies?.metrics || [],
      overlaySources:
        draftDependenciesQuery.data?.draftReportDependencies?.overlaySources ||
        [],
      dependencies: additionalDependencies,
    });
  }, [
    draftDependenciesQuery.data?.draftReportDependencies?.metrics,
    draftDependenciesQuery.data?.draftReportDependencies?.overlaySources,
    additionalDependencies,
    setDraftDependencies,
  ]);

  const save = useDebouncedFn(
    (doc: any) => {
      setReportBodyHasChanges(true);
      const body = doc.toJSON();
      setDraftBody(body);
      const deps = extractMetricDependenciesFromReportBody(body);
      let missing: MetricDependency[] = [];
      for (const dep of deps) {
        const hash = hashMetricDependency(dep);
        if (metrics.find((m) => m.dependencyHash === hash)) {
          continue;
        }
        missing.push(dep);
      }
      setAdditionalDependencies(missing);
    },
    100,
    { leading: true, trailing: true },
    [setReportBodyHasChanges, setDraftBody, setAdditionalDependencies]
  );
  saveRef.current = save;

  const contextualGroups = useMemo(
    () =>
      buildReportCommandGroups({
        sources:
          reportingLayersQuery.data?.projectBySlug?.reportingLayers || [],
        geographies: reportContext?.geographies,
        clippingGeography:
          reportContext?.sketchClass?.clippingGeographies?.[0]?.id,
        sketchClassGeometryType: reportContext?.sketchClass?.geometryType,
        overlayFooterItem,
        overlayAugmenter,
      }),
    [
      sources,
      reportContext?.geographies,
      reportContext?.sketchClass?.clippingGeographies,
      reportContext?.sketchClass?.geometryType,
      reportingLayersQuery.data?.projectBySlug?.reportingLayers,
      overlayFooterItem,
      overlayAugmenter,
    ]
  );

  const { palette: commandPalette } = useSlashCommandPalette({
    viewRef,
    state,
    schema,
    groups: contextualGroups,
    requestedPreviewKey: pendingOverlayKey,
    onPreviewKeyApplied: () => setPendingOverlayKey(null),
  });

  useEffect(() => {
    const initialBody = initialBodyRef.current;
    const doc = initialBody ? Node.fromJSON(schema, initialBody) : undefined;
    const view = new EditorView(root.current!, {
      state: EditorState.create({
        schema,
        plugins,
        doc,
      }),
      nodeViews: {
        // @ts-ignore
        metric(node, view, getPos, decorations) {
          return createReactNodeView({
            node,
            view,
            // @ts-ignore
            getPos,
            // @ts-ignore
            decorations,
            component: ReportWidgetNodeViewRouter,
            onCreatePortal: createPortal,
            onDestroy: removePortal,
            cardId,
          });
        },
        details(node, view, getPos) {
          return new DetailsView(node, view, getPos as () => number);
        },
        blockMetric(node, view, getPos, decorations) {
          return createReactNodeView({
            node,
            view,
            // @ts-ignore
            getPos,
            // @ts-ignore
            decorations,
            component: ReportWidgetNodeViewRouter,
            onCreatePortal: createPortal,
            onDestroy: removePortal,
            cardId,
          });
        },
      },
      dispatchTransaction: (transaction) => {
        const view = viewRef.current!;
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setState(newState);

        if (transaction.docChanged) {
          saveRef.current?.(newState.doc);
        }

        if (newState.selection) {
          setSelection({
            anchorPos: newState.selection.$anchor.pos,
            headPos: newState.selection.$head.pos,
          });
        } else {
          setSelection(null);
        }
      },
    });
    viewRef.current = view;
    if (preselectTitle) {
      const currentSelection = view.state.selection;
      const hasUserSelection = currentSelection && !currentSelection.empty;
      if (!hasUserSelection) {
        // update the view state to select the report title text
        let titlePos: number | null = null;
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === "reportTitle") {
            titlePos = pos;
            return false; // stop descending once found
          }
          return undefined;
        });
        if (titlePos !== null) {
          const titleNode = view.state.doc.nodeAt(titlePos);
          if (titleNode) {
            const from = titlePos + 1; // position inside the node content
            const to = titlePos + titleNode.nodeSize - 1;
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, from, to)
            );
            view.dispatch(tr);
          }
        }
      }
    }
    setState(view.state);
    return () => {
      view.destroy();
    };
  }, [
    isInput,
    plugins,
    schema,
    createPortal,
    removePortal,
    setSelection,
    preselectTitle,
  ]);

  // Update editor state when language changes (body will be different for different languages)
  useEffect(() => {
    if (viewRef.current && body) {
      const langChanged = lastLangCodeRef.current !== currentLangCode;

      // Always update when language changes to show the correct language's content
      if (langChanged) {
        const doc = Node.fromJSON(schema, body);
        const newState = EditorState.create({
          schema,
          plugins,
          doc,
        });
        viewRef.current.updateState(newState);
        setState(newState);

        lastLangCodeRef.current = currentLangCode;
        lastBodyRef.current = body;
      }
    }
  }, [body, schema, plugins, currentLangCode]);

  // Keep refs up to date with latest props
  useEffect(() => {
    lastLangCodeRef.current = currentLangCode;
    lastBodyRef.current = body;
  }, [body, currentLangCode]);

  return (
    <div className={`relative ${className}`}>
      <style>
        {
          // eslint-disable-next-line i18next/no-literal-string
          BLUR_SELECTION_STYLES
        }
      </style>
      <TooltipMenu view={viewRef.current} state={state} schema={schema} />
      {commandPalette}
      <div
        className={`ProseMirrorBody ReportCardBodyEditor ReportCardBody`}
        ref={root}
      ></div>
      {footerContainerRef.current &&
        createReactPortal(
          <>
            <div
              className="p-2 text-sm bg-gray-50 border-t border-gray-200 shadow-inner rounded-b-lg"
              data-report-card-body-editor-footer="true"
            >

              <div className="flex items-center space-x-2 justify-end">
                <div className="pr-5">
                  <button onClick={() => {
                    reportContext?.setShowCalcDetails(cardId);
                  }}>
                    <ReportCardLoadingIndicator display={true} metrics={allDependencies.metrics} sourceProcessingJobs={allDependencies.sourceProcessingJobs} />
                  </button>
                </div>
                <Button
                  small
                  label={t("Cancel")}
                  onClick={() => {
                    reportContext?.setSelectedForEditing(null);
                  }}
                />
                <Button
                  small
                  label={t("Save")}
                  onClick={handleCardSave}
                  disabled={updateReportCardState.loading}
                  loading={updateReportCardState.loading}
                  primary
                />
              </div>
            </div>
          </>,
          footerContainerRef.current
        )}
    </div>
  );
}

function OverlayPickerContent({
  onSelect,
  isLoading,
  loadingId,
  errorMessage,
}: {
  onSelect: (overlayId: number) => Promise<boolean>;
  isLoading: boolean;
  loadingId: number | null;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation("sketching");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <LayerPickerList
      className="w-72"
      hideSearch={false}
      required
      onlyReportingLayers={false}
      // optionsOverride={overlays.map((option) => ({
      //   stableId: option.stableId || String(option.id),
      //   title: option.title,
      //   tableOfContentsItemId: option.id,
      //   reporting: true,
      // }))}
      onSelect={async (val) => {
        if (!val?.tableOfContentsItemId) return;
        if (isLoading) return;
        const success = await onSelect(val.tableOfContentsItemId);
        if (!success && inputRef.current) {
          inputRef.current.focus();
        }
      }}
    />
  );
}

export default function ReportCardBodyEditor(props: ReportCardBodyEditorProps) {
  return (
    <ReactNodeViewPortalsProvider>
      <ReportCardBodyEditorInner {...props} />
    </ReactNodeViewPortalsProvider>
  );
}
