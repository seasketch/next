import { useState, useEffect, useMemo, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  BaseDraftReportContextDocument,
  DraftReportDocument,
  DraftReportDebuggingMaterialsDocument,
  DraftReportDebuggingMaterialsQuery,
  SketchingDetailsFragment,
  useDraftReportQuery,
  useProjectMetadataQuery,
  usePublishReportMutation,
  usePublishTableOfContentsMutation,
  PublishedTableOfContentsDocument,
  LayersAndSourcesForItemsDocument,
} from "../../generated/graphql";
import { useApolloClient } from "@apollo/client";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";
import Button from "../../components/Button";
import useDialog from "../../components/useDialog";
import useProjectId from "../../useProjectId";
import { FormLanguageContext } from "../../formElements/FormElement";
import languages from "../../lang/supported";
import getSlug from "../../getSlug";
import { SketchingIcon } from "../../projects/ToolbarButtons";
import { BaseReportContextProvider } from "../../reports/context/BaseReportContext";
import { SubjectReportContextProvider } from "../../reports/context/SubjectReportContext";
import ReportEditor from "../../reports/ReportEditor";
import { reportDemonstrationSketchStorageKey } from "../../reports/components/DemonstrationSketchDropdown";
import ReportDependenciesContextProvider, {
  ReportDependenciesContext,
} from "../../reports/context/ReportDependenciesContext";
import ReportPublishedMetricDependenciesRegistrar from "../../reports/context/ReportPublishedMetricDependenciesRegistrar";
import useIsSuperuser from "../../useIsSuperuser";

export default function SketchClassReportsAdmin({
  sketchClass,
  associatedSketchClassIds,
  assignedSketchClassesForReport,
  onReportDeleted,
  draftReportIdOverride,
  publishAvailable = true,
}: {
  sketchClass: SketchingDetailsFragment;
  /** Sketch classes that have this report as primary; drives sketch picker ordering. */
  associatedSketchClassIds?: number[];
  /** Sketch classes whose primary draft is this report (for delete confirmation). */
  assignedSketchClassesForReport?: { id: number; name: string }[];
  /** Called after the draft report is deleted from the server (e.g. refetch + navigate). */
  onReportDeleted?: () => void | Promise<void>;
  /** Force editor to open this draft report id (used for unassigned project reports). */
  draftReportIdOverride?: number;
  /** Whether publish actions should be available in this embedding context. */
  publishAvailable?: boolean;
}) {
  const { t, i18n } = useTranslation("admin:sketching");
  const { confirm, loadingMessage } = useDialog();
  const slug = getSlug();
  const projectId = useProjectId();

  const onError = useGlobalErrorHandler();
  const client = useApolloClient();
  const { data, loading } = useDraftReportQuery({
    variables: {
      sketchClassId: sketchClass.id,
    },
    onError,
  });

  const draftReportFromSketchClass = data?.sketchClass?.draftReport;
  const draftReportId = draftReportIdOverride ?? draftReportFromSketchClass?.id;

  /**
   * Demonstration sketch list (`mySketches`) is stable during report authoring.
   * A watched `useQuery` here re-ran on every draft-report/card cache write because
   * it shares normalized `SketchClass` — use a one-shot read instead (no broadcast subscription).
   */
  const [debuggingMaterialsData, setDebuggingMaterialsData] =
    useState<DraftReportDebuggingMaterialsQuery | null>(null);
  const [debuggingMaterialsLoading, setDebuggingMaterialsLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;
    setDebuggingMaterialsLoading(true);
    void client
      .query<DraftReportDebuggingMaterialsQuery>({
        query: DraftReportDebuggingMaterialsDocument,
        variables: { sketchClassId: sketchClass.id },
        fetchPolicy: "cache-first",
      })
      .then((result) => {
        if (!cancelled) {
          setDebuggingMaterialsData(result.data);
          setDebuggingMaterialsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDebuggingMaterialsLoading(false);
          onError(err as Error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sketchClass.id, client, onError]);

  const sketchesForDemonstration = useMemo(() => {
    const sketches =
      debuggingMaterialsData?.sketchClass?.project?.mySketches?.filter(
        Boolean
      ) || [];

    return [...sketches].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [debuggingMaterialsData]);

  const sketchClassLabelsById = useMemo(() => {
    const rows =
      debuggingMaterialsData?.sketchClass?.project?.sketchClasses?.filter(
        Boolean
      ) || [];
    const m: Record<number, string> = {};
    for (const sc of rows) {
      m[sc.id] = sc.name;
    }
    return m;
  }, [debuggingMaterialsData]);

  const demonstrationSketchStorageKey = useMemo(() => {
    if (projectId == null || draftReportId == null) {
      return undefined;
    }
    return reportDemonstrationSketchStorageKey(projectId, draftReportId);
  }, [projectId, draftReportId]);

  const [selectedSketchId, setSelectedSketchId] = useState<number | null>(null);

  // Auto-select a sketch when available — prefer a recently used one from localStorage
  useEffect(() => {
    if (sketchesForDemonstration.length === 0 || selectedSketchId != null) {
      return;
    }
    if (!demonstrationSketchStorageKey) {
      setSelectedSketchId(sketchesForDemonstration[0].id);
      return;
    }
    try {
      const raw = localStorage.getItem(demonstrationSketchStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const recentIds: number[] = Array.isArray(parsed)
        ? parsed.filter((x: unknown) => typeof x === "number")
        : [];
      const preferred = recentIds
        .map((id) => sketchesForDemonstration.find((s) => s.id === id))
        .find(Boolean);
      setSelectedSketchId(preferred?.id ?? sketchesForDemonstration[0].id);
    } catch {
      setSelectedSketchId(sketchesForDemonstration[0].id);
    }
  }, [
    sketchesForDemonstration,
    selectedSketchId,
    demonstrationSketchStorageKey,
  ]);

  const { data: projectData } = useProjectMetadataQuery({
    variables: { slug },
  });

  // Set up language state
  let lang = languages.find((l) => l.code === (i18n.language || "EN"))!;
  if (!lang) {
    lang = languages.find((l) => l.code === "EN")!;
  }
  const [language, setLanguage] = useState(lang);

  // Memoize FormLanguageContext value to prevent unnecessary re-renders of consumers
  const setFormLanguage = useCallback(
    (code: string) => {
      const selectedLang = languages.find((l) => l.code === code);
      if (!selectedLang) {
        throw new Error(`Unrecognized language ${code}`);
      }
      setLanguage(selectedLang);
      i18n.changeLanguage(selectedLang.code);
    },
    [i18n]
  );

  const formLanguageContextValue = useMemo(
    () => ({
      lang: language,
      setLanguage: setFormLanguage,
      supportedLanguages:
        (projectData?.project?.supportedLanguages as string[]) || [],
    }),
    [language, setFormLanguage, projectData?.project?.supportedLanguages]
  );

  const [publishTableOfContents] = usePublishTableOfContentsMutation({
    refetchQueries: [
      PublishedTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
    ],
  });

  const [publishReport, publishReportState] = usePublishReportMutation({
    onError: (err) => {
      const message = err?.message || "";
      if (
        message
          .toLowerCase()
          .includes(
            "references data layers that have not yet been published"
          ) ||
        message
          .toLowerCase()
          .includes(
            "references updated versions of data sources which have not yet been published"
          )
      ) {
        confirm(t("Report contains unpublished layers"), {
          description: message
            .toLowerCase()
            .includes(
              "references updated versions of data sources which have not yet been published"
            )
            ? t(
                "This report references data layers which updates to their sources that have not yet been published. Would you like to publish the overlays now?"
              )
            : t(
                "This report references data layers from the draft layer list that have not yet been published. Would you like to publish the overlays now?"
              ),
          primaryButtonText: t("Publish draft layers and report"),
          secondaryButtonText: t("Cancel"),
          onSubmit: async () => {
            const { hideLoadingMessage } = loadingMessage(
              t("Publishing overlays...")
            );
            const reportIdToPublish = draftReportId;
            if (!reportIdToPublish) {
              hideLoadingMessage();
              onError(new Error("No draft report is available to publish"));
              return;
            }
            try {
              await publishTableOfContents({
                variables: { projectId: projectId! },
              });
              hideLoadingMessage();
              await publishReport({
                variables: { reportId: reportIdToPublish },
              });
            } catch (e) {
              hideLoadingMessage();
              onError(e as any);
            }
          },
        });
        return;
      }
      onError(err);
    },
    refetchQueries: [DraftReportDocument, BaseDraftReportContextDocument],
    awaitRefetchQueries: true,
  });

  // Use the custom hook to manage report state

  if (!loading && !draftReportId) {
    return (
      <div className="flex flex-col w-full h-full items-center p-8">
        <Warning level="info">
          {t("No report is currently assigned to this sketch class.")}
        </Warning>
      </div>
    );
  }

  // Compare this sketch class's primary draft to its published snapshot. When opened
  // from Project Reports we pass draftReportIdOverride, but that id still matches
  // this sketch class's draft_report_id for assigned reports — do not gate on override
  // or Publish is always disabled there.
  const hasUnpublishedChanges =
    (data?.sketchClass && !data?.sketchClass?.report) ||
    new Date(data?.sketchClass?.draftReport?.updatedAt ?? 0) >=
      new Date(data?.sketchClass?.report?.createdAt ?? 0);

  if (
    sketchesForDemonstration.length === 0 &&
    !loading &&
    !debuggingMaterialsLoading
  ) {
    return (
      <div className="flex-1 p-8 pt-16">
        <div className="max-w-md text-center mx-auto">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <div className="w-6 h-6 text-blue-600">{SketchingIcon}</div>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("No sketches available for demonstration")}
          </h3>
          <p className="text-gray-600 mb-6">
            {t(
              "To author reports based on real data, you need to create sketches in your account first. Consider creating multiple sketches that represent different scenarios to test your reports thoroughly."
            )}
          </p>
          <Button
            label={t("Go to Sketching")}
            onClick={() => {
              window.location.href = `/${slug}/app/sketches`;
            }}
            primary
          />
        </div>
      </div>
    );
  }
  // While draft report query is still resolving, avoid mounting report-id-rooted
  // context with an undefined report id.
  if (!draftReportId) {
    return null;
  }
  if (!selectedSketchId) {
    // console.error("No selected sketch id");
    return null;
  }

  return (
    <BaseReportContextProvider reportId={draftReportId}>
      <div className="flex flex-col w-full flex-1 min-h-0 overflow-hidden">
        <ReportDependenciesContextProvider
          sketchId={selectedSketchId}
          reportId={draftReportId}
        >
          <ReportPublishedMetricDependenciesRegistrar />
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* <div className="flex-none flex justify-end px-4 py-1 bg-gray-50 border-b text-xs">
              <FragmentCalculationsRuntimeIndicator />
            </div> */}
            <SubjectReportContextProvider sketchId={selectedSketchId}>
              <FormLanguageContext.Provider value={formLanguageContextValue}>
                <div className="flex-1 flex relative min-h-0 overflow-hidden">
                  <ReportEditor
                    demonstrationSketches={sketchesForDemonstration}
                    selectedSketchId={selectedSketchId}
                    setSelectedSketchId={setSelectedSketchId}
                    sketchClassLabelsById={sketchClassLabelsById}
                    recentSketchIdsStorageKey={demonstrationSketchStorageKey}
                    reportAssociatedSketchClassIds={associatedSketchClassIds}
                    publishMenu={
                      publishAvailable
                        ? {
                            variant: "available" as const,
                            hasUnpublishedChanges,
                            publishing: publishReportState.loading,
                            lastPublishedSummary:
                              data?.sketchClass?.report != null
                                ? t("Last Published ") +
                                  new Date(
                                    data.sketchClass.report.createdAt
                                  ).toLocaleDateString()
                                : null,
                            onPublish: () => {
                              publishReport({
                                variables: {
                                  reportId: draftReportId,
                                },
                              });
                            },
                          }
                        : {
                            variant: "unavailable" as const,
                            message: t(
                              "Publishing is only available when this report is associated with at least one sketch class."
                            ),
                          }
                    }
                    reportDeletion={
                      onReportDeleted
                        ? {
                            assignedSketchClasses:
                              assignedSketchClassesForReport ?? [],
                            onDeleted: onReportDeleted,
                          }
                        : undefined
                    }
                  />
                </div>
              </FormLanguageContext.Provider>
            </SubjectReportContextProvider>
          </div>
        </ReportDependenciesContextProvider>
      </div>
    </BaseReportContextProvider>
  );
}

export function collectReportCardTitle(body: any) {
  if (!body || typeof body !== "object") {
    return null;
  }
  if (
    body.type === "doc" &&
    "content" in body &&
    Array.isArray(body.content) &&
    body.content.length > 0
  ) {
    for (const node of body.content) {
      if (
        node.type === "reportTitle" &&
        "content" in node &&
        Array.isArray(node.content) &&
        node.content.length > 0
      ) {
        // Some users have reportTitle nodes with an empty content array, and other
        // forms of document corruption are possible. Prefer the first text child
        // if present, otherwise treat title as missing.
        const firstTextChild = node.content.find(
          (child: any) => child && typeof child.text === "string"
        );
        return firstTextChild?.text ?? null;
      }
    }
  }
  return null;
}

function FragmentCalculationsRuntimeIndicator() {
  const { fragmentCalculationsRuntime } = useContext(ReportDependenciesContext);
  const { t } = useTranslation("admin:sketching");
  const isSuperuser = useIsSuperuser();
  if (!fragmentCalculationsRuntime) {
    return null;
  }
  if (!isSuperuser) {
    return null;
  }
  return (
    <span className="flex-1 text-right text-gray-500 text-xs italic">
      {Math.round((fragmentCalculationsRuntime / 1000) * 10) / 10}{" "}
      {t("seconds total lambda runtime")}
    </span>
  );
}
