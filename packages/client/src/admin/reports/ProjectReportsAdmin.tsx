import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import getSlug from "../../getSlug";
import {
  useCreateProjectDraftReportMutation,
  useProjectReportsContextQuery,
  useSetPrimaryReportForSketchClassMutation,
} from "../../generated/graphql";
import SketchClassReportsAdmin from "../sketchClasses/SketchClassReportsAdmin";

export default function ProjectReportsAdmin() {
  const slug = getSlug();
  const { t } = useTranslation("admin:sketching");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedSketchClassId, setSelectedSketchClassId] = useState<
    number | null
  >(null);

  const contextQuery = useProjectReportsContextQuery({
    variables: { slug },
  });
  const [createDraftReport, createDraftReportState] =
    useCreateProjectDraftReportMutation();
  const [setPrimaryReport, setPrimaryReportState] =
    useSetPrimaryReportForSketchClassMutation();

  const sketchClasses = useMemo(
    () =>
      (contextQuery.data?.projectBySlug?.sketchClasses || []).filter(
        (sc): sc is NonNullable<typeof sc> => Boolean(sc)
      ),
    [contextQuery.data?.projectBySlug?.sketchClasses]
  );
  const draftReports = useMemo(
    () =>
      (contextQuery.data?.reportsConnection?.nodes || [])
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .filter(
        (r: any) =>
          r.projectId === contextQuery.data?.projectBySlug?.id && r.draftId == null
      ),
    [contextQuery.data?.reportsConnection?.nodes, contextQuery.data?.projectBySlug?.id]
  );
  const reportsWithAssignments = useMemo(() => {
    return draftReports.map((report: any) => {
      const assignedSketchClasses = sketchClasses.filter(
        (sc: any) => sc.draftReport?.id === report.id
      );
      return {
        ...report,
        assignedSketchClasses,
      };
    });
  }, [draftReports, sketchClasses]);

  const selectedReport = useMemo(() => {
    if (!selectedReportId && reportsWithAssignments.length > 0) {
      return reportsWithAssignments[0];
    }
    return (
      reportsWithAssignments.find((r: any) => r.id === selectedReportId) || null
    );
  }, [reportsWithAssignments, selectedReportId]);

  const effectiveSketchClassId = useMemo(() => {
    if (selectedSketchClassId) {
      return selectedSketchClassId;
    }
    return selectedReport?.assignedSketchClasses?.[0]?.id || null;
  }, [selectedSketchClassId, selectedReport]);

  const selectedSketchClass = useMemo(() => {
    if (!effectiveSketchClassId) {
      return null;
    }
    return sketchClasses.find((sc: any) => sc.id === effectiveSketchClassId);
  }, [effectiveSketchClassId, sketchClasses]);

  if (contextQuery.loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (contextQuery.error) {
    return (
      <div className="p-6">
        <Warning level="error">
          {t("Unable to load report administration data")}
        </Warning>
      </div>
    );
  }

  if (!contextQuery.data?.projectBySlug?.enableReportBuilder) {
    return (
      <div className="p-6">
        <Warning level="warning">
          {t("Enable Report Builder in project settings first.")}
        </Warning>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      <div className="w-96 border-r bg-white p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t("Reports")}</h2>
          <button
            className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded"
            disabled={createDraftReportState.loading || !contextQuery.data?.projectBySlug?.id}
            onClick={async () => {
              const projectId = contextQuery.data?.projectBySlug?.id;
              if (!projectId) {
                return;
              }
              const result = await createDraftReport({
                variables: {
                  projectId,
                  // eslint-disable-next-line i18next/no-literal-string
                  title: "Untitled Report",
                },
              });
              await contextQuery.refetch();
              const newId = result.data?.createProjectDraftReport?.report?.id;
              if (newId) {
                setSelectedReportId(newId);
              }
            }}
          >
            {t("Create Draft For Selected Class")}
          </button>
        </div>
        <div className="space-y-2">
          {reportsWithAssignments.map((report: any) => {
            const isSelected = selectedReport?.id === report.id;
            return (
              <button
                key={report.id}
                className={`w-full text-left border rounded p-3 ${
                  isSelected
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => {
                  setSelectedReportId(report.id);
                  setSelectedSketchClassId(
                    report.assignedSketchClasses?.[0]?.id ?? null
                  );
                }}
              >
                <div className="text-sm font-medium text-gray-900">
                  {`${t("Report")} #${report.id}`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {report.assignedSketchClasses.length > 0
                    ? report.assignedSketchClasses
                        .map((sc: any) => sc?.name)
                        .filter(Boolean)
                        .join(", ")
                    : t("No assignment")}
                </div>
              </button>
            );
          })}
          {reportsWithAssignments.length === 0 && (
            <Warning level="info">{t("No reports found yet.")}</Warning>
          )}
        </div>
        {selectedReport && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium text-gray-700 block">
              {t("Editing context sketch class")}
            </label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={effectiveSketchClassId ?? ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSelectedSketchClassId(Number.isFinite(value) ? value : null);
              }}
            >
              <option value="">{t("Select sketch class")}</option>
              {sketchClasses.map((sc: any) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
            {effectiveSketchClassId &&
              selectedReport &&
              selectedReport.assignedSketchClasses.every(
                (sc: any) => sc.id !== effectiveSketchClassId
              ) && (
                <button
                  className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded"
                  disabled={setPrimaryReportState.loading}
                  onClick={async () => {
                    await setPrimaryReport({
                      variables: {
                        sketchClassId: effectiveSketchClassId,
                        draftReportId: selectedReport.id,
                      },
                    });
                    await contextQuery.refetch();
                  }}
                >
                  {t("Assign as primary report")}
                </button>
              )}
            {setPrimaryReportState.error && (
              <Warning level="error">{setPrimaryReportState.error.message}</Warning>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {selectedSketchClass ? (
          <SketchClassReportsAdmin sketchClass={selectedSketchClass} />
        ) : selectedReport ? (
          <div className="p-6">
            <Warning level="info">
              {t(
                "Choose a sketch class context to edit this report draft."
              )}
            </Warning>
          </div>
        ) : (
          <div className="p-6">
            <Warning level="info">{t("Select a report to begin editing.")}</Warning>
          </div>
        )}
      </div>
    </div>
  );
}

