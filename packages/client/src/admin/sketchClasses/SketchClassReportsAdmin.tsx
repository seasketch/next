import { useState, useEffect, useMemo, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  DraftReportDocument,
  SketchingDetailsFragment,
  useCreateDraftReportMutation,
  useDraftReportQuery,
  useProjectMetadataQuery,
  usePublishReportMutation,
  useDraftReportDebuggingMaterialsQuery,
  usePublishTableOfContentsMutation,
} from "../../generated/graphql";
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
import ReportDependenciesContextProvider, {
  ReportDependenciesContext,
} from "../../reports/context/ReportDependenciesContext";
import useIsSuperuser from "../../useIsSuperuser";

export default function SketchClassReportsAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t, i18n } = useTranslation("admin:sketching");
  const { confirm, loadingMessage } = useDialog();
  const slug = getSlug();
  const projectId = useProjectId();

  const onError = useGlobalErrorHandler();
  const { data, loading } = useDraftReportQuery({
    variables: {
      sketchClassId: sketchClass.id,
    },
    onError,
  });

  const { data: debuggingMaterialsData } =
    useDraftReportDebuggingMaterialsQuery({
      variables: {
        sketchClassId: sketchClass.id,
      },
      onError,
    });

  const sketchesForDemonstration = useMemo(() => {
    const sketches =
      debuggingMaterialsData?.sketchClass?.mySketches?.filter(
        (sketch) => sketch.sketchClassId === sketchClass.id
      ) || [];

    // Sort by createdAt (most recent first)
    return sketches.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [debuggingMaterialsData, sketchClass.id]);

  const [selectedSketchId, setSelectedSketchId] = useState<number | null>(null);

  // Auto-select the first sketch when sketches become available
  useEffect(() => {
    if (sketchesForDemonstration.length > 0 && !selectedSketchId) {
      setSelectedSketchId(sketchesForDemonstration[0].id);
    }
  }, [sketchesForDemonstration, selectedSketchId]);

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

  const [createDraftReport, createDraftReportState] =
    useCreateDraftReportMutation({
      awaitRefetchQueries: true,
      refetchQueries: [DraftReportDocument],
    });

  const [publishTableOfContents] = usePublishTableOfContentsMutation();

  const [publishReport, publishReportState] = usePublishReportMutation({
    onError: (err) => {
      const message = err?.message || "";
      if (
        message
          .toLowerCase()
          .includes("references data layers that have not yet been published")
      ) {
        confirm(t("Report contains unpublished layers"), {
          description: t(
            "This report references data layers from the draft layer list that have not yet been published. Would you like to publish the overlays now?"
          ),
          primaryButtonText: t("Publish draft layers and report"),
          secondaryButtonText: t("Cancel"),
          onSubmit: async () => {
            const { hideLoadingMessage } = loadingMessage(
              t("Publishing overlays...")
            );
            try {
              await publishTableOfContents({
                variables: { projectId: projectId! },
              });
              hideLoadingMessage();
              await publishReport({
                variables: { sketchClassId: sketchClass.id },
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
    refetchQueries: [DraftReportDocument],
    awaitRefetchQueries: true,
  });

  const draftReport = data?.sketchClass?.draftReport;
  // Use the custom hook to manage report state

  if (!loading && !draftReport) {
    if (
      !createDraftReportState.called &&
      !createDraftReportState.loading &&
      !createDraftReportState.error
    ) {
      createDraftReport({
        variables: {
          sketchClassId: sketchClass.id,
        },
      }).catch(() => {
        // do nothing. component will show error
      });
    }
    return (
      <div className="flex flex-col w-full h-full items-center p-8">
        {createDraftReportState.called &&
          !createDraftReportState.loading &&
          !createDraftReportState.error && (
            <Warning level="warning">{t("No draft report found")}</Warning>
          )}
        {createDraftReportState.error && (
          <Warning level="error">
            {t("Error creating draft report. ")}
            {createDraftReportState.error.message}
          </Warning>
        )}
        {createDraftReportState.loading && (
          <div className="flex flex-col w-full h-full items-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-500">{t("Creating draft report...")}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const hasUnpublishedChanges =
    (data?.sketchClass && !data?.sketchClass?.report) ||
    new Date(data?.sketchClass?.draftReport?.updatedAt) >=
      new Date(data?.sketchClass?.report?.createdAt);

  if (sketchesForDemonstration.length === 0 && !loading) {
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
  if (!selectedSketchId) {
    console.error("No selected sketch id");
    return null;
  }

  return (
    <BaseReportContextProvider sketchClassId={sketchClass.id} draft={true}>
      <ReportDependenciesContextProvider
        sketchId={selectedSketchId}
        reportId={draftReport?.id}
      >
        <SubjectReportContextProvider sketchId={selectedSketchId}>
          <FormLanguageContext.Provider value={formLanguageContextValue}>
            <div className="flex flex-col w-full h-full overflow-y-hidden">
              {/* Header */}
              <div className="bg-gray-100 p-4 flex-none border-b shadow z-10 flex items-center justify-between">
                <div className="flex w-full space-x-2 items-center">
                  <Button
                    small
                    disabled={
                      publishReportState.loading || !hasUnpublishedChanges
                    }
                    title={
                      hasUnpublishedChanges
                        ? t(
                            "There are unpublished changes. Publish to save them."
                          )
                        : t("No unpublished changes")
                    }
                    loading={publishReportState.loading}
                    label={t("Publish Report")}
                    onClick={() => {
                      publishReport({
                        variables: {
                          sketchClassId: sketchClass.id,
                        },
                      });
                    }}
                    primary={hasUnpublishedChanges}
                  />
                  <span className="text-sm text-gray-500">
                    {data?.sketchClass?.report &&
                      t("Last Published ") +
                        new Date(
                          data.sketchClass.report.createdAt
                        ).toLocaleDateString()}
                  </span>
                  <FragmentCalculationsRuntimeIndicator />
                </div>
                {/* <EditorLanguageSelector /> */}
              </div>
              {/* Main */}
              <div className="flex-1 flex relative max-h-full overflow-hidden">
                {/* main content */}
                {/* {sketchesForDemonstration.length === 0 && !loading ? (
                <div className="flex-1 p-8 pt-16">
                  <div className="max-w-md text-center mx-auto">
                    <div className="mb-6">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                        <div className="w-6 h-6 text-blue-600">
                          {SketchingIcon}
                        </div>
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
              ) : ( */}
                <ReportEditor
                  demonstrationSketches={sketchesForDemonstration}
                  selectedSketchId={selectedSketchId}
                  setSelectedSketchId={setSelectedSketchId}
                />
                {/* )} */}

                {/* right sidebar */}
                {/* <div className="w-0 bg-white flex-none border-l shadow"></div> */}
                {/* bottom right geography metrics indicator */}
              </div>

              {/* Footer */}
              {/* <div className="bg-gray-100 p-4 flex-none border-t shadow"></div> */}
            </div>
          </FormLanguageContext.Provider>
        </SubjectReportContextProvider>
      </ReportDependenciesContextProvider>
    </BaseReportContextProvider>
  );
}

export function collectReportCardTitle(body: any) {
  if (
    body.type === "doc" &&
    "content" in body &&
    Array.isArray(body.content) &&
    body.content.length > 0
  ) {
    for (const node of body.content) {
      if (node.type === "reportTitle") {
        return node.content[0].text;
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
