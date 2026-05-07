import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/outline";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import useDialog from "../../components/useDialog";
import getSlug from "../../getSlug";
import NavSidebar, { NavSidebarItem } from "../../components/NavSidebar";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import {
  useCreateCustomReportMutation,
  useProjectReportsContextQuery,
} from "../../generated/graphql";
import SketchClassReportsAdmin from "../sketchClasses/SketchClassReportsAdmin";

/** Same gradient + dot grid as {@link ../sketchClasses/SketchClassForm} tab content. */
const sketchClassAdminReportWorkspaceBackground: { background: string } = {
  // eslint-disable-next-line i18next/no-literal-string -- CSS only
  background: `
    linear-gradient(150deg,
      rgba(238, 240, 241, 0) 0%,
      rgba(238, 240, 241, 0.6) 60%,
      rgba(238, 240, 241, 0.8) 100%
    ),
    url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACFJREFUKFNjXL58oxQDEYARpDAy0v8ZIbWjCvGGENHBAwCZWCYkLmgNZgAAAABJRU5ErkJggg==") repeat rgba(238, 240, 241)
  `,
};

export default function ProjectReportsAdmin() {
  const slug = getSlug();
  const { t } = useTranslation("admin:sketching");
  const { confirm } = useDialog();
  const history = useHistory();
  const location = useLocation();
  const { id: routeReportIdParam } = useParams<{ id?: string }>();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState("");
  const [selectedCreateSketchClassIds, setSelectedCreateSketchClassIds] =
    useState<number[]>([]);

  const contextQuery = useProjectReportsContextQuery({
    variables: { slug },
  });
  const [createReport, createReportState] = useCreateCustomReportMutation();

  const sketchClasses = useMemo(
    () =>
      (contextQuery.data?.projectBySlug?.sketchClasses || []).filter(
        (sc: any): sc is NonNullable<typeof sc> => Boolean(sc)
      ),
    [contextQuery.data?.projectBySlug?.sketchClasses]
  );

  const draftReports = useMemo(
    () =>
      (contextQuery.data?.reportsConnection?.nodes || [])
        .filter((r: any): r is NonNullable<typeof r> => Boolean(r))
        .filter(
          (r: any) =>
            r.projectId === contextQuery.data?.projectBySlug?.id &&
            r.draftId == null
        ),
    [
      contextQuery.data?.reportsConnection?.nodes,
      contextQuery.data?.projectBySlug?.id,
    ]
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

  const routeReportId = useMemo(() => {
    if (!routeReportIdParam) {
      return null;
    }
    const n = parseInt(routeReportIdParam, 10);
    return Number.isFinite(n) ? n : null;
  }, [routeReportIdParam]);

  const selectedReport = useMemo(() => {
    if (routeReportId == null) {
      return null;
    }
    return (
      reportsWithAssignments.find((r: any) => r.id === routeReportId) || null
    );
  }, [reportsWithAssignments, routeReportId]);

  const contextSketchClass = useMemo(() => {
    return selectedReport?.assignedSketchClasses?.[0] ?? null;
  }, [selectedReport]);

  /**
   * Keep URL in sync: optional ?sketchClassId=… deep link, otherwise default to the
   * first report whenever there is no valid :id (missing, non-numeric, or unknown).
   */
  useEffect(() => {
    if (contextQuery.loading || contextQuery.error) {
      return;
    }
    if (!contextQuery.data?.projectBySlug?.enableReportBuilder) {
      return;
    }
    if (reportsWithAssignments.length === 0) {
      return;
    }

    const params = new URLSearchParams(location.search || "");
    const sketchClassIdRaw = params.get("sketchClassId");
    if (sketchClassIdRaw && sketchClasses.length > 0) {
      const sketchClassId = parseInt(sketchClassIdRaw, 10);
      if (Number.isFinite(sketchClassId)) {
        const sc = sketchClasses.find((s: any) => s.id === sketchClassId);
        const draftReportId = sc?.draftReport?.id;
        if (draftReportId) {
          // eslint-disable-next-line i18next/no-literal-string -- admin route
          history.replace(`/${slug}/admin/reports/${draftReportId}`);
          return;
        }
      }
    }

    if (routeReportId != null && selectedReport != null) {
      return;
    }

    const firstId = reportsWithAssignments[0].id;
    // eslint-disable-next-line i18next/no-literal-string -- admin route
    history.replace(`/${slug}/admin/reports/${firstId}`);
  }, [
    contextQuery.loading,
    contextQuery.error,
    contextQuery.data?.projectBySlug?.enableReportBuilder,
    reportsWithAssignments,
    routeReportIdParam,
    routeReportId,
    selectedReport,
    sketchClasses,
    location.search,
    history,
    slug,
  ]);

  const selectedCreateSketchClasses = useMemo(
    () =>
      sketchClasses.filter((sc: any) =>
        selectedCreateSketchClassIds.includes(sc.id)
      ),
    [sketchClasses, selectedCreateSketchClassIds]
  );

  const conflictingCreateAssignments = useMemo(
    () =>
      selectedCreateSketchClasses.filter(
        (sc: any) => sc.draftReport?.id != null
      ),
    [selectedCreateSketchClasses]
  );

  const resetCreateForm = useCallback(() => {
    setNewReportTitle("");
    setSelectedCreateSketchClassIds([]);
  }, []);

  const runCreateReport = useCallback(async () => {
    const projectId = contextQuery.data?.projectBySlug?.id;
    if (!projectId) {
      return;
    }
    const title = newReportTitle.trim();
    if (!title) {
      return;
    }

    const doCreate = async () => {
      const result = await createReport({
        variables: {
          projectId,
          title,
          sketchClassIds:
            selectedCreateSketchClassIds.length > 0
              ? selectedCreateSketchClassIds
              : undefined,
        },
      });
      await contextQuery.refetch();
      const newId = result.data?.createCustomReport?.report?.id;
      if (newId) {
        // eslint-disable-next-line i18next/no-literal-string -- admin route
        history.push(`/${slug}/admin/reports/${newId}`);
      }
      resetCreateForm();
      setCreateModalOpen(false);
    };

    if (conflictingCreateAssignments.length > 0) {
      confirm(t("Reassign sketch classes?"), {
        description: t(
          "One or more selected sketch classes already have primary reports. Creating this report will replace those assignments."
        ),
        primaryButtonText: t("Create and reassign"),
        secondaryButtonText: t("Cancel"),
        onSubmit: doCreate,
      });
      return;
    }

    await doCreate();
  }, [
    contextQuery.data?.projectBySlug?.id,
    newReportTitle,
    selectedCreateSketchClassIds,
    createReport,
    contextQuery,
    history,
    slug,
    resetCreateForm,
    conflictingCreateAssignments.length,
    confirm,
    t,
  ]);

  const navItems: NavSidebarItem[] = useMemo(() => {
    return reportsWithAssignments.map((report: any) => ({
      label: report.title?.trim() || t("Untitled report"),
      href: `/${slug}/admin/reports/${report.id}`,
      compact: true,
    }));
  }, [reportsWithAssignments, slug, t]);

  const openCreateModal = useCallback(() => {
    resetCreateForm();
    setCreateModalOpen(true);
  }, [resetCreateForm]);

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
    <>
    <div className="flex w-full min-h-0 flex-1 overflow-hidden h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] md:h-[100dvh] md:max-h-[100dvh]">
      <NavSidebar
        className="z-10 !w-[340px] shrink-0"
        loading={false}
        items={navItems}
        header={t("Reports")}
        headerButton={
          <Button
            title={t("Create a new report")}
            small
            label={
              <>
                {t("Add")}
                <PlusIcon className="w-4 h-4 ml-2" />
              </>
            }
            onClick={openCreateModal}
          />
        }
      />
      <div
        className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-white"
        style={sketchClassAdminReportWorkspaceBackground}
      >
        {!contextQuery.loading && reportsWithAssignments.length === 0 && (
          <div className="flex flex-1 min-h-0 items-start justify-center overflow-y-auto px-2 pt-10">
            <div className="max-w-xl rounded mx-auto p-4 border-4 border-dashed bg-white/80">
              <h2 className="text-base mb-2">
                {t(
                  "Your project has no reports yet. Create a report to author dashboards and printable summaries for sketches."
                )}
              </h2>
              <Button label={t("Create your first report")} onClick={openCreateModal} />
            </div>
          </div>
        )}
        {selectedReport && contextSketchClass && (
          <SketchClassReportsAdmin
            key={selectedReport.id}
            sketchClass={contextSketchClass}
            associatedSketchClassIds={selectedReport.assignedSketchClasses.map(
              (sc: any) => sc.id
            )}
          />
        )}
        {selectedReport && !contextSketchClass && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <Warning level="info">
              {t(
                "This report is not assigned as a primary report for any sketch class. Assign it from a sketch class’s Reports settings before editing."
              )}
            </Warning>
          </div>
        )}
        {!selectedReport && reportsWithAssignments.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <Warning level="info">{t("Select a report to begin editing.")}</Warning>
          </div>
        )}
      </div>
    </div>

      <Modal
        open={createModalOpen}
        onRequestClose={() => setCreateModalOpen(false)}
        title={t("Create Report")}
        scrollable
        footer={[
          {
            label: t("Cancel"),
            variant: "secondary",
            onClick: () => setCreateModalOpen(false),
          },
          {
            label: createReportState.loading ? t("Creating...") : t("Create Report"),
            variant: "primary",
            loading: createReportState.loading,
            disabled:
              createReportState.loading ||
              !contextQuery.data?.projectBySlug?.id ||
              !newReportTitle.trim(),
            onClick: () => {
              void runCreateReport();
            },
          },
        ]}
      >
        <div className="space-y-4 text-left">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("Report title")}
            </label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm border-gray-300"
              placeholder={t("Report title")}
              value={newReportTitle}
              onChange={(e) => setNewReportTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t("Assign as primary for sketch classes (optional)")}
            </label>
            <div className="max-h-48 overflow-y-auto border rounded border-gray-200 p-2 space-y-1">
              {sketchClasses.map((sc: any) => {
                const isChecked = selectedCreateSketchClassIds.includes(sc.id);
                return (
                  <label
                    key={sc.id}
                    className="flex items-center justify-between text-xs text-gray-700"
                  >
                    <span className="truncate pr-2">{sc.name}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedCreateSketchClassIds((ids) =>
                          isChecked
                            ? ids.filter((id) => id !== sc.id)
                            : [...ids, sc.id]
                        );
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
          {conflictingCreateAssignments.length > 0 && (
            <Warning level="warning">
              {t(
                "Some selected sketch classes already have assigned reports. Creating this report will replace those assignments."
              )}{" "}
              {conflictingCreateAssignments
                .map((sc: any) => `${sc.name} (#${sc.draftReport?.id})`)
                .join(", ")}
            </Warning>
          )}
        </div>
      </Modal>
    </>
  );
}
