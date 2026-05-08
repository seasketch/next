/* eslint-disable react/jsx-no-target-blank */
import { useApolloClient } from "@apollo/client";
import {
  useUpdateSketchClassMutation,
  useDeleteSketchClassMutation,
  useSketchClassGeographyEditorDetailsQuery,
  useUpdateSketchClassGeographiesMutation,
  useSetPrimaryReportForSketchClassMutation,
  SketchClassesQuery,
  SketchClassesDocument,
  SketchClassReportAssignmentDocument,
  SketchClassGeographyEditorDetailsDocument,
  SketchFragmentStatusDocument,
  SketchGeometryType,
  AdminSketchingDetailsFragment,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import useDialog from "../../components/useDialog";
import getSlug from "../../getSlug";
import { SketchClassTemplateIcon } from "./TemplateChooser";
import Tabs, { NonLinkTabItem } from "../../components/Tabs";
import SketchClassAttributesAdmin from "./SketchClassAttributesAdmin";
import TranslatedPropControl from "../../components/TranslatedPropControl";
import SketchClassStyleAdmin from "./SketchClassStyleAdmin";
import EvaluateFilterServiceModal from "./EvaluateFilterServiceModal";
import GeoprocessingTab from "./GeoprocessingTab";
import GeographyClippingTab from "./GeographyClippingTab";
import { Link, useHistory, useParams } from "react-router-dom";
import SketchClassReportAssignment from "./SketchClassReportAssignment";
import SketchClassGeographiesInput from "./SketchClassGeographiesInput";

export default function SketchClassForm({
  sketchClass,
  selectedTab: initialTab = "settings",
  onDelete,
}: {
  sketchClass: AdminSketchingDetailsFragment;
  selectedTab?: string;
  onDelete?: (id: number) => void;
}) {
  const onError = useGlobalErrorHandler();
  const { t } = useTranslation("admin:sketching");
  const history = useHistory();
  const { tab } = useParams<{ tab?: string }>();

  // Use tab from URL params, fallback to prop, then default to "settings"
  const selectedTab = tab || initialTab;

  // Update URL when tab changes
  const updateTabInUrl = useCallback(
    (tabId: string) => {
      const currentPath = history.location.pathname;
      const pathParts = currentPath.split("/");

      // Remove the last part if it looks like a tab (not a number)
      if (
        pathParts.length > 0 &&
        isNaN(parseInt(pathParts[pathParts.length - 1]))
      ) {
        pathParts.pop();
      }

      // Add the new tab
      const newPath = [...pathParts, tabId].join("/");
      history.replace(newPath);
    },
    [history]
  );

  const slug = getSlug();
  const isCollectionSketchClass =
    sketchClass.geometryType === SketchGeometryType.Collection;
  const isPolygonSketchClass =
    sketchClass.geometryType === SketchGeometryType.Polygon;

  const { data: geographyEditorData, loading: geographyEditorLoading } =
    useSketchClassGeographyEditorDetailsQuery({
      variables: { slug },
      skip: !slug || isCollectionSketchClass,
    });

  const client = useApolloClient();

  const [mutate, mutationState] = useUpdateSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    onError,
  });

  const [updateSketchClassGeographies] =
    useUpdateSketchClassGeographiesMutation({
      onError,
    });

  const [setPrimaryReportForSketchClass] =
    useSetPrimaryReportForSketchClassMutation({
      onError,
    });
  const [filterLocationModal, setFilterLocationModal] = useState<
    string | undefined
  >();
  const reportingMode: "new" | "legacy" | "transition" =
    sketchClass.isGeographyClippingEnabled
      ? "new"
      : sketchClass.previewNewReports
      ? "transition"
      : "legacy";
  const geoprocessingReportsEnabled = reportingMode !== "new";
  const canConfigureReporting =
    sketchClass.geometryType === SketchGeometryType.Polygon ||
    sketchClass.geometryType === SketchGeometryType.Collection;
  const showModernGeographySettings =
    isPolygonSketchClass && sketchClass.isGeographyClippingEnabled;
  const showModernReportAssignment =
    canConfigureReporting &&
    sketchClass.isGeographyClippingEnabled &&
    !sketchClass.previewNewReports;

  const hasProjectGeographies = useMemo(() => {
    const n = geographyEditorData?.projectBySlug?.geographies?.length ?? 0;
    return n > 0;
  }, [geographyEditorData?.projectBySlug?.geographies?.length]);

  const clippingGeographyCount = useMemo(
    () => (sketchClass.clippingGeographies ?? []).filter(Boolean).length,
    [sketchClass.clippingGeographies]
  );

  /** Polygon sketch classes require clipping geography before report assignment; collections do not. */
  const geographyGateForReports = isPolygonSketchClass;

  const analyticalReportsReady =
    !geographyGateForReports ||
    (!geographyEditorLoading &&
      hasProjectGeographies &&
      clippingGeographyCount > 0);

  const transitionGeoReady =
    isCollectionSketchClass ||
    (!geographyEditorLoading &&
      hasProjectGeographies &&
      clippingGeographyCount > 0);

  /** After switching off geoprocessing, pick first geography / report so admins are not blocked on empty selects. */
  const applyDefaultsAfterSwitchingToModern = useCallback(async () => {
    const geographies = geographyEditorData?.projectBySlug?.geographies ?? [];
    const firstGeographyId = geographies[0]?.id;

    if (
      isPolygonSketchClass &&
      clippingGeographyCount === 0 &&
      firstGeographyId != null
    ) {
      await updateSketchClassGeographies({
        variables: {
          id: sketchClass.id,
          geographyIds: [firstGeographyId],
        },
        refetchQueries: [
          {
            query: SketchClassGeographyEditorDetailsDocument,
            variables: { slug },
          },
          {
            query: SketchFragmentStatusDocument,
            variables: { slug },
          },
          {
            query: SketchClassesDocument,
            variables: { slug },
          },
        ],
        awaitRefetchQueries: true,
      });
    }

    const { data } = await client.query({
      query: SketchClassReportAssignmentDocument,
      variables: { slug, sketchClassId: sketchClass.id },
      fetchPolicy: "network-only",
    });

    const projectId = data?.projectBySlug?.id;
    const existingDraftReportId = data?.sketchClass?.draftReport?.id;
    const reportCandidates = (data?.reportsConnection?.nodes ?? []).filter(
      (r: { projectId?: number; draftId?: number | null }) =>
        r.projectId === projectId && r.draftId == null
    );
    const firstDraftReportId = reportCandidates[0]?.id;

    if (!existingDraftReportId && firstDraftReportId != null) {
      await setPrimaryReportForSketchClass({
        variables: {
          sketchClassId: sketchClass.id,
          draftReportId: firstDraftReportId,
        },
        refetchQueries: [
          {
            query: SketchClassesDocument,
            variables: { slug },
          },
        ],
        awaitRefetchQueries: true,
      });
    }
  }, [
    client,
    clippingGeographyCount,
    geographyEditorData?.projectBySlug?.geographies,
    isPolygonSketchClass,
    setPrimaryReportForSketchClass,
    sketchClass.id,
    slug,
    updateSketchClassGeographies,
  ]);

  const switchToModernReporting = useCallback(async () => {
    try {
      await mutate({
        variables: {
          id: sketchClass.id,
          isGeographyClippingEnabled: true,
          previewNewReports: false,
        },
        optimisticResponse: {
          __typename: "Mutation",
          updateSketchClass: {
            __typename: "UpdateSketchClassPayload",
            sketchClass: {
              __typename: "SketchClass",
              ...sketchClass,
              isGeographyClippingEnabled: true,
              previewNewReports: false,
            },
          },
        },
      });
      await applyDefaultsAfterSwitchingToModern();
    } catch (e) {
      onError(e);
    }
  }, [applyDefaultsAfterSwitchingToModern, mutate, onError, sketchClass]);

  const handleReportingModeChange = useCallback(
    (mode: "legacy" | "new" | "transition") => {
      const isGeographyClippingEnabled = mode === "new";
      const previewNewReports = mode === "transition";
      mutate({
        variables: {
          id: sketchClass.id,
          isGeographyClippingEnabled,
          previewNewReports,
        },
        optimisticResponse: {
          __typename: "Mutation",
          updateSketchClass: {
            __typename: "UpdateSketchClassPayload",
            sketchClass: {
              __typename: "SketchClass",
              ...sketchClass,
              isGeographyClippingEnabled,
              previewNewReports,
            },
          },
        },
      });
    },
    [mutate, sketchClass]
  );
  const handleGeoprocessingSwitchChange = useCallback(() => {
    if (geoprocessingReportsEnabled) {
      void switchToModernReporting();
    } else {
      handleReportingModeChange("legacy");
    }
  }, [
    geoprocessingReportsEnabled,
    handleReportingModeChange,
    switchToModernReporting,
  ]);
  const handleTransitionSwitchChange = useCallback(() => {
    handleReportingModeChange(
      reportingMode === "transition" ? "legacy" : "transition"
    );
  }, [reportingMode, handleReportingModeChange]);

  const tabs: NonLinkTabItem[] = useMemo(() => {
    return [
      {
        name: "Settings",
        id: "settings",
        current: selectedTab === "settings",
      },
      {
        name: "Attribute Form",
        id: "attributes",
        current: selectedTab === "attributes",
      },
      ...(geoprocessingReportsEnabled
        ? [
            {
              name: "Geoprocessing Services",
              id: "geoprocessing",
              current: selectedTab === "geoprocessing",
            },
          ]
        : []),
      ...(sketchClass.geometryType !== SketchGeometryType.Collection &&
      sketchClass.geometryType !== SketchGeometryType.ChooseFeature &&
      sketchClass.geometryType !== SketchGeometryType.FilteredPlanningUnits
        ? [
            {
              name: "Style",
              id: "style",
              current: selectedTab === "style",
            },
          ]
        : []),
    ];
  }, [selectedTab, sketchClass.geometryType, geoprocessingReportsEnabled]);

  useEffect(() => {
    if (selectedTab === "geography-clipping" || selectedTab === "reports") {
      updateTabInUrl("settings");
    }
  }, [selectedTab, updateTabInUrl]);

  const { confirmDelete } = useDialog();

  const [del] = useDeleteSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    update: (cache, { data }) => {
      const deletedId = data?.deleteSketchClass?.sketchClass?.id;
      if (deletedId) {
        const existingSketchClasses = cache.readQuery<SketchClassesQuery>({
          query: SketchClassesDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (existingSketchClasses?.projectBySlug?.sketchClasses) {
          const filtered = [
            ...existingSketchClasses.projectBySlug.sketchClasses.filter(
              (sc) => sc.id !== deletedId
            ),
          ];
          cache.writeQuery({
            query: SketchClassesDocument,
            data: {
              ...existingSketchClasses,
              projectBySlug: {
                ...existingSketchClasses.projectBySlug,
                sketchClasses: filtered,
              },
            },
          });
          if (onDelete) {
            onDelete(deletedId);
          }
        }
      }
    },
  });

  const toggleArchived = useCallback(() => {
    const isArchived = !sketchClass.isArchived;
    mutate({
      variables: {
        id: sketchClass.id,
        isArchived,
      },
      optimisticResponse: (d) => {
        return {
          __typename: "Mutation",
          updateSketchClass: {
            __typename: "UpdateSketchClassPayload",
            sketchClass: {
              __typename: "SketchClass",
              ...sketchClass,
              isArchived,
            },
          },
        };
      },
    });
  }, [sketchClass, mutate]);

  // Handle tab click - update URL
  const handleTabClick = useCallback(
    (tabId: string) => {
      updateTabInUrl(tabId);
    },
    [updateTabInUrl]
  );

  return (
    <div className="min-h-screen max-h-screen overflow-hidden flex-col flex w-full">
      <div className="p-2 bg-gray-700 pl-4">
        <h1 className="text-lg font-semibold flex items-center text-gray-50 mb-2">
          <span className="flex-1">
            {/* <Trans>Sketch class settings</Trans> */}
            {sketchClass.name}
          </span>
          <SketchClassTemplateIcon
            geometryType={sketchClass.geometryType}
            name=""
            color="text-indigo-100"
          />
        </h1>
        <div className="flex-0 mb-2 -mt-2 bg-gray-700 text-primary-300 flex items-center">
          <Tabs dark small tabs={tabs} onClick={handleTabClick} />
        </div>
      </div>
      <div
        className="bg-white flex-1 shadow z-0 overflow-x-hidden w-full"
        style={{
          background: `
            linear-gradient(150deg, 
              rgba(238, 240, 241, 0) 0%, 
              rgba(238, 240, 241, 0.6) 60%, 
              rgba(238, 240, 241, 0.8) 100%
            ),
            url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACFJREFUKFNjXL58oxQDEYARpDAy0v8ZIbWjCvGGENHBAwCZWCYkLmgNZgAAAABJRU5ErkJggg==") repeat rgba(238, 240, 241)
          `,
        }}
      >
        {selectedTab === "settings" && (
          <div className="px-6 p-4 space-y-4 w-full max-w-xl min-h-full bg-white shadow border-r">
            <div className="flex w-full items-center">
              <div className="flex-1">
                <MutableAutosaveInput
                  value={sketchClass.name}
                  label={t("Name")}
                  mutation={mutate}
                  mutationStatus={mutationState}
                  propName="name"
                />
              </div>
              <TranslatedPropControl
                id={sketchClass.id}
                label={t("Sketch Class Name")}
                propName="name"
                typeName="SketchClass"
                defaultValue={sketchClass.name}
                className="p-0.5 border rounded hover:shadow-sm -mb-5 ml-2"
              />
            </div>
            {sketchClass.geometryType ===
              SketchGeometryType.FilteredPlanningUnits && (
              <div className="">
                <MutableAutosaveInput
                  value={sketchClass.filterApiServerLocation || ""}
                  description={
                    <span>
                      <Trans ns="admin:sketching">
                        Should match the signature of the{" "}
                        <a
                          className="text-primary-500"
                          href="https://github.com/underbluewaters/crdss-api-server"
                        >
                          CRDSS service
                        </a>
                        . Provide the root URL of the API server.
                      </Trans>
                    </span>
                  }
                  label={t("Filter API Server Location")}
                  mutation={mutate}
                  mutationStatus={mutationState}
                  propName="filterApiServerLocation"
                />
                {sketchClass.filterApiServerLocation && (
                  <Button
                    small
                    className="mt-1"
                    label={t("Test Service")}
                    onClick={() => {
                      setFilterLocationModal(
                        sketchClass.filterApiServerLocation!
                      );
                    }}
                  />
                )}
              </div>
            )}

            {sketchClass.acl?.nodeId && (
              <AccessControlListEditor nodeId={sketchClass.acl?.nodeId} />
            )}
            {showModernGeographySettings && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium leading-5 text-gray-800">
                  {t("Geography Clipping")}
                </h3>
                <GeographyClippingTab sketchClass={sketchClass} />
              </div>
            )}
            {showModernReportAssignment && (
              <div
                className={`space-y-2 pb-2 ${
                  !analyticalReportsReady && !geographyEditorLoading
                    ? "pointer-events-none opacity-60"
                    : ""
                }`}
              >
                <h3 className="text-sm font-medium leading-5 text-gray-800">
                  {t("Analytical Reports")}
                </h3>
                <p className="text-sm text-gray-500">
                  <Trans ns="admin:sketching">
                    Choose a report from the{" "}
                    <Link
                      to={`/${slug}/admin/reports`}
                      className="text-primary-500 hover:underline"
                    >
                      report authoring section
                    </Link>{" "}
                    to evaluate user designs.
                  </Trans>
                </p>
                <div
                  className={
                    !analyticalReportsReady && !geographyEditorLoading
                      ? "pointer-events-none opacity-60"
                      : ""
                  }
                >
                  <SketchClassReportAssignment
                    sketchClassId={sketchClass.id}
                    embedded
                    showIntro={false}
                    disabled={!analyticalReportsReady}
                    disabledText={
                      !analyticalReportsReady && !geographyEditorLoading
                        ? t("Select a geography first")
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
            <div className="">
              <InputBlock
                input={
                  <Switch
                    isToggled={sketchClass.isArchived}
                    onClick={toggleArchived}
                  />
                }
                title={t("Archived")}
                description={t(
                  "Enable if you would like to disable and hide this sketch class. Existing sketches will not be deleted but new ones cannot be drawn."
                )}
              />
            </div>
            <InputBlock
              input={
                <Button
                  disabled={sketchClass.sketchCount >= 10}
                  label={t("Delete")}
                  onClick={async () => {
                    if (sketchClass.sketchCount < 10) {
                      confirmDelete({
                        message:
                          "Are you sure you want to delete this Sketch Class and all associated sketches?",
                        onDelete: async () => {
                          await del();
                        },
                      });
                    }
                  }}
                />
              }
              title={t("Delete Sketch Class")}
              description={
                sketchClass.sketchCount < 10
                  ? t(
                      "This Sketch Class can still be deleted since it has fewer than 10 sketches. All related sketches will be deleted."
                    )
                  : t(
                      "You can only delete sketch classes if they have not been used to create more than 10 sketches."
                    )
              }
            />
            {canConfigureReporting && (
              <>
                <h3 className="text-sm font-medium leading-5 text-gray-500 pt-4">
                  {t("Advanced Settings")}
                </h3>
                <div className="">
                  <InputBlock
                    input={
                      <Switch
                        isToggled={geoprocessingReportsEnabled}
                        onClick={handleGeoprocessingSwitchChange}
                      />
                    }
                    title={t("Enable Geoprocessing Services")}
                    description={
                      <Trans ns="admin:sketching">
                        Use{" "}
                        <a
                          className="text-primary-500 hover:underline"
                          href="https://github.com/seasketch/geoprocessing"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Geoprocessing framework services
                        </a>{" "}
                        for reporting instead of the graphical report builder.
                        Configure further in the <i>Geoprocessing Services</i>{" "}
                        tab if enabled.
                      </Trans>
                    }
                  />
                </div>
                {geoprocessingReportsEnabled && (
                  <>
                    <InputBlock
                      input={
                        <Switch
                          isToggled={reportingMode === "transition"}
                          onClick={handleTransitionSwitchChange}
                        />
                      }
                      title={t("Transition from Geoprocessing Services")}
                      description={t(
                        "If enabled, geoprocessing services reports will be used by default, but administrators will have access to a preview of reports using the new authoring system. Useful for testing the new authoring system before rolling out to all users."
                      )}
                    />
                    {reportingMode === "transition" && (
                      <div className="rounded border p-3 space-y-3">
                        {!isCollectionSketchClass && (
                          <>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-600">
                                {t("Clipping geography")}
                              </div>
                              {geographyEditorLoading ? (
                                <p className="text-xs text-gray-500">
                                  {t("Loading…")}
                                </p>
                              ) : !hasProjectGeographies ? (
                                <p className="text-xs text-gray-500">
                                  {t("No geographies in this project.")}
                                </p>
                              ) : (
                                <SketchClassGeographiesInput
                                  sketchClassId={sketchClass.id}
                                  projectGeographies={
                                    geographyEditorData?.projectBySlug
                                      ?.geographies ?? []
                                  }
                                />
                              )}
                            </div>
                            {!transitionGeoReady &&
                            !geographyEditorLoading &&
                            hasProjectGeographies ? (
                              <p className="text-xs text-gray-500">
                                {t(
                                  "Select a geography before assigning a report."
                                )}
                              </p>
                            ) : null}
                          </>
                        )}
                        <SketchClassReportAssignment
                          sketchClassId={sketchClass.id}
                          embedded
                          showIntro={false}
                          disabled={!transitionGeoReady}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
        {selectedTab === "geoprocessing" && (
          <GeoprocessingTab sketchClass={sketchClass} />
        )}
        {selectedTab === "attributes" && sketchClass.form && (
          <SketchClassAttributesAdmin
            sketchClassName={sketchClass.name}
            formId={sketchClass.form.id}
            filterServiceLocation={
              sketchClass.filterApiServerLocation || undefined
            }
          />
        )}
        {selectedTab === "style" && (
          <SketchClassStyleAdmin sketchClass={sketchClass} />
        )}
        {filterLocationModal && (
          <EvaluateFilterServiceModal
            location={filterLocationModal}
            onRequestClose={() => setFilterLocationModal(undefined)}
          />
        )}
      </div>
    </div>
  );
}
