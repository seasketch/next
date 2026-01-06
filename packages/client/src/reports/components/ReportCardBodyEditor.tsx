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
import { reportBodySchema } from "../widgets/prosemirror/reportBodySchema";
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
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useSlashCommandPalette } from "../hooks/useSlashCommandPalette";
import { ReportContext } from "../ReportContext";
import getSlug from "../../getSlug";
import Spinner from "../../components/Spinner";

interface ReportCardBodyEditorProps {
  /**
   * The Prosemirror document to edit
   */
  body: any;
  /**
   * Callback when the document changes
   */
  onUpdate: (newBody: any) => void;
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
}

type OverlayPickerOption = {
  id: number;
  title: string;
  stableId?: string | null;
  dataSourceType?: string | null;
};

function ReportCardBodyEditorInner({
  body,
  onUpdate,
  isInput = false,
  className = "",
  metrics,
  sources,
  cardId,
  preselectTitle = false,
}: ReportCardBodyEditorProps) {
  const { t } = useTranslation("sketching");
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

  const availableReportLayersQuery = useAvailableReportLayersQuery({
    variables: {
      slug: getSlug(),
    },
    fetchPolicy: "cache-and-network",
  });

  const langContext = useContext(FormLanguageContext);
  const currentLangCode = langContext?.lang?.code || "EN";

  const reportContext = useContext(ReportContext);

  const reportingLayersQuery = useProjectReportingLayersQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const publishedTocQuery = usePublishedTableOfContentsQuery({
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

  const overlayOptions = useMemo<OverlayPickerOption[]>(() => {
    const existing = new Set(
      (reportingLayersQuery.data?.projectBySlug?.reportingLayers || []).map(
        (layer) => layer.tableOfContentsItemId
      )
    );
    return (
      availableReportLayersQuery.data?.projectBySlug?.availableReportLayers?.filter(
        (layer) => !existing.has(layer.id)
      ) || []
    );
  }, [
    availableReportLayersQuery.data?.projectBySlug?.availableReportLayers,
    reportingLayersQuery.data?.projectBySlug?.reportingLayers,
  ]);

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
          overlays={overlayOptions}
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
    overlayOptions,
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
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const save = useDebouncedFn(
    (doc: any) => {
      onUpdate(doc.toJSON());
    },
    100,
    { leading: true, trailing: true },
    [onUpdate]
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
    </div>
  );
}

function OverlayPickerContent({
  overlays,
  onSelect,
  isLoading,
  loadingId,
  errorMessage,
}: {
  overlays: OverlayPickerOption[];
  onSelect: (overlayId: number) => Promise<boolean>;
  isLoading: boolean;
  loadingId: number | null;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation("sketching");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return overlays.filter((option) =>
      option.title.toLowerCase().includes(term)
    );
  }, [overlays, search]);

  return (
    <div className="w-72 rounded-md border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-100 p-2">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search overlays…")}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
          disabled={isLoading}
        />
      </div>
      <div className="max-h-64 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">
            {t("No compatible overlays found.")}
          </div>
        ) : (
          filtered.map((option) => (
            <button
              key={option.id}
              disabled={isLoading}
              className={`w-full px-3 py-2 text-left transition-colors ${
                isLoading
                  ? "cursor-wait opacity-60"
                  : "hover:bg-gray-50 focus:bg-gray-50"
              }`}
              onClick={async (e) => {
                e.preventDefault();
                if (isLoading) return;
                const success = await onSelect(option.id);
                if (!success) {
                  inputRef.current?.focus();
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {option.title}
                  </span>
                  {option.stableId ? (
                    <span className="text-xs text-gray-500">
                      {option.stableId}
                    </span>
                  ) : null}
                </div>
                {loadingId === option.id && isLoading ? <Spinner mini /> : null}
              </div>
            </button>
          ))
        )}
      </div>
      {errorMessage ? (
        <div className="border-t border-gray-100 px-3 py-2 text-xs text-red-600">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

export default function ReportCardBodyEditor(props: ReportCardBodyEditorProps) {
  return (
    <ReactNodeViewPortalsProvider>
      <ReportCardBodyEditorInner {...props} />
    </ReactNodeViewPortalsProvider>
  );
}
