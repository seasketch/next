import { useTranslation } from "react-i18next";
import Warning from "../../components/Warning";
import getSlug from "../../getSlug";
import {
  useSetPrimaryReportForSketchClassMutation,
  useSketchClassReportAssignmentQuery,
} from "../../generated/graphql";

export default function SketchClassReportAssignment({
  sketchClassId,
}: {
  sketchClassId: number;
}) {
  const { t } = useTranslation("admin:sketching");
  const slug = getSlug();
  const { data, loading, error, refetch } = useSketchClassReportAssignmentQuery({
    variables: { slug, sketchClassId },
  });
  const [setPrimaryReport, setPrimaryReportState] =
    useSetPrimaryReportForSketchClassMutation();

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">{t("Loading...")}</div>;
  }
  if (error) {
    return (
      <div className="p-4">
        <Warning level="error">{t("Could not load report assignments.")}</Warning>
      </div>
    );
  }

  const currentDraftReportId = data?.sketchClass?.draftReport?.id || "";
  const reports = (data?.reportsConnection?.nodes || []).filter(
    (report: any) =>
      report.projectId === data?.projectBySlug?.id && report.draftId == null
  );

  return (
    <div className="max-w-xl bg-white border-r shadow min-h-full p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {t("Primary Report Assignment")}
      </h3>
      <p className="text-sm text-gray-600">
        {t(
          "Choose which project report should be used as the primary report for this sketch class."
        )}
      </p>
      <label className="block text-sm font-medium text-gray-700">
        {t("Assigned report")}
      </label>
      <select
        className="w-full border rounded px-2 py-2 text-sm"
        value={currentDraftReportId}
        onChange={async (e) => {
          const draftReportId = Number(e.target.value);
          if (!draftReportId) {
            return;
          }
          await setPrimaryReport({
            variables: {
              sketchClassId,
              draftReportId,
            },
          });
          await refetch();
        }}
      >
        <option value="">{t("Select report")}</option>
        {reports.map((report: any) => (
          <option key={report.id} value={report.id}>
            {report.title || `${t("Report")} #${report.id}`}
          </option>
        ))}
      </select>
      {setPrimaryReportState.error && (
        <Warning level="error">{setPrimaryReportState.error.message}</Warning>
      )}
      <a
        className="inline-flex text-sm px-3 py-1.5 rounded bg-primary-600 hover:bg-primary-500 text-white"
        href={`/${slug}/admin/reports?sketchClassId=${sketchClassId}`}
      >
        {t("Open Reports Admin")}
      </a>
    </div>
  );
}

