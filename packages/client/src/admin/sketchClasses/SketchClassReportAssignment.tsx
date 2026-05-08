import { useTranslation } from "react-i18next";
import Warning from "../../components/Warning";
import getSlug from "../../getSlug";
import {
  useSetPrimaryReportForSketchClassMutation,
  useSketchClassReportAssignmentQuery,
} from "../../generated/graphql";

export default function SketchClassReportAssignment({
  sketchClassId,
  embedded = false,
  disabled = false,
  showIntro = true,
  disabledText,
}: {
  sketchClassId: number;
  embedded?: boolean;
  disabled?: boolean;
  showIntro?: boolean;
  disabledText?: string;
}) {
  const { t } = useTranslation("admin:sketching");
  const slug = getSlug();
  const { data, loading, error, refetch } = useSketchClassReportAssignmentQuery(
    {
      variables: { slug, sketchClassId },
    }
  );
  const [setPrimaryReport, setPrimaryReportState] =
    useSetPrimaryReportForSketchClassMutation();

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">{t("Loading...")}</div>;
  }
  if (error) {
    return (
      <div className="p-4">
        <Warning level="error">
          {t("Could not load report assignments.")}
        </Warning>
      </div>
    );
  }

  const currentDraftReportId = data?.sketchClass?.draftReport?.id;
  const reports = (data?.reportsConnection?.nodes || []).filter(
    (report: any) =>
      report.projectId === data?.projectBySlug?.id && report.draftId == null
  );

  const hasReportAssignment = currentDraftReportId != null;

  const content = (
    <div className={`space-y-4 ${disabled ? "opacity-60" : ""}`}>
      {showIntro && (
        <>
          <h3 className="text-base font-semibold text-gray-900">
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
        </>
      )}
      {reports.length === 0 ? (
        <p className="text-sm text-gray-500">
          {disabled && disabledText
            ? disabledText
            : t("No draft reports available.")}
        </p>
      ) : (
        <select
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:opacity-50"
          value={hasReportAssignment ? currentDraftReportId : ""}
          disabled={disabled}
          onChange={async (e) => {
            if (disabled) {
              return;
            }
            const raw = e.target.value;
            if (raw === "") {
              return;
            }
            const draftReportId = Number(raw);
            await setPrimaryReport({
              variables: {
                sketchClassId,
                draftReportId,
              },
            });
            await refetch();
          }}
        >
          {!hasReportAssignment ? (
            <option value="">{disabledText ?? t("Select report")}</option>
          ) : null}
          {reports.map((report: any) => (
            <option key={report.id} value={report.id}>
              {report.title || `${t("Report")} #${report.id}`}
            </option>
          ))}
        </select>
      )}
      {setPrimaryReportState.error && (
        <Warning level="error">{setPrimaryReportState.error.message}</Warning>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="max-w-xl bg-white border-r shadow min-h-full p-6 space-y-4">
      {content}
    </div>
  );
}
