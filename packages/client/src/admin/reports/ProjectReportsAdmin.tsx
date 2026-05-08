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
import GeographyRequiredForReportsPrompt from "../../components/GeographyRequiredForReportsPrompt";
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

  const hasProjectGeographies = useMemo(() => {
    const geographies = contextQuery.data?.projectBySlug?.geographies;
    return Array.isArray(geographies) && geographies.length > 0;
  }, [contextQuery.data?.projectBySlug?.geographies]);

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

  const handleReportDeleted = useCallback(async () => {
    const { data } = await contextQuery.refetch();
    const projectId = data?.projectBySlug?.id;
    const remaining = (data?.reportsConnection?.nodes || [])
      .filter(Boolean)
      .filter((r: any) => r.projectId === projectId && r.draftId == null);
    if (remaining.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string -- admin route
      history.replace(`/${slug}/admin/reports/${remaining[0].id}`);
    } else {
      // eslint-disable-next-line i18next/no-literal-string -- admin route
      history.replace(`/${slug}/admin/reports`);
    }
  }, [contextQuery, history, slug]);

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

  const fallbackContextSketchClass = useMemo(() => {
    return (
      sketchClasses.find(
        (sc: any) =>
          sc.geometryType === "POLYGON" || sc.geometryType === "COLLECTION"
      ) ??
      sketchClasses[0] ??
      null
    );
  }, [sketchClasses]);

  const contextSketchClass = useMemo(() => {
    return (
      selectedReport?.assignedSketchClasses?.[0] ??
      fallbackContextSketchClass ??
      null
    );
  }, [selectedReport, fallbackContextSketchClass]);

  const selectedReportHasPrimaryAssignment = useMemo(
    () => (selectedReport?.assignedSketchClasses?.length ?? 0) > 0,
    [selectedReport]
  );

  /**
   * Keep URL in sync: optional ?sketchClassId=… deep link, otherwise default to the
   * first report whenever there is no valid :id (missing, non-numeric, or unknown).
   */
  useEffect(() => {
    if (contextQuery.loading || contextQuery.error) {
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
      confirm(t("Reassign Sketch Classes?"), {
        description: t(
          "One or more selected Sketch Classes already have primary reports. Creating this report will replace those assignments."
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
          {!hasProjectGeographies ? (
            <div className="flex flex-1 min-h-0 items-start justify-center overflow-y-auto p-6">
              <div className="max-w-xl w-full">
                <GeographyRequiredForReportsPrompt
                  // eslint-disable-next-line i18next/no-literal-string -- admin route
                  to={`/${slug}/admin/geography`}
                />
              </div>
            </div>
          ) : (
            <>
              {!contextQuery.loading && reportsWithAssignments.length === 0 && (
                <div className="flex flex-1 min-h-0 items-start justify-center overflow-y-auto px-2 pt-10">
                  <div className="max-w-xl rounded mx-auto p-4 border-4 border-dashed bg-white/80">
                    <h2 className="text-base mb-2">
                      {t(
                        "Your project has no reports yet. Create a report to author dashboards and printable summaries for sketches."
                      )}
                    </h2>
                    <Button
                      label={t("Create your first report")}
                      onClick={openCreateModal}
                    />
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
                  assignedSketchClassesForReport={selectedReport.assignedSketchClasses.map(
                    (sc: any) => ({
                      id: sc.id,
                      name: sc.name,
                    })
                  )}
                  onReportDeleted={handleReportDeleted}
                  publishAvailable={selectedReportHasPrimaryAssignment}
                  draftReportIdOverride={selectedReport.id}
                />
              )}
              {selectedReport && !contextSketchClass && (
                <div className="flex flex-1 min-h-0 items-start justify-center overflow-y-auto px-2 pt-10">
                  <div className="max-w-xl rounded mx-auto p-6 border-4 border-dashed bg-white/80 space-y-4">
                    <h2 className="text-base font-medium text-gray-900">
                      {t("Create a Sketch Class first")}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {t(
                        "You need at least one polygon Sketch Class before you can author reports."
                      )}
                    </p>
                    <Button
                      primary
                      label={t("Create a Sketch Class")}
                      onClick={() => {
                        // eslint-disable-next-line i18next/no-literal-string -- admin route
                        history.push(`/${slug}/admin/sketching/new`);
                      }}
                    />
                  </div>
                </div>
              )}
              {!selectedReport && reportsWithAssignments.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                  <Warning level="info">
                    {t("Select a report to begin editing.")}
                  </Warning>
                </div>
              )}
            </>
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
            label: createReportState.loading
              ? t("Creating...")
              : t("Create Report"),
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
              {t("Assign to Sketch Classes (optional)")}
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
              {t("Some selected Sketch Classes already have assigned reports")}
            </Warning>
          )}
        </div>
      </Modal>
    </>
  );
}
