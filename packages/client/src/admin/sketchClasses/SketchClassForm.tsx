/* eslint-disable react/jsx-no-target-blank */
import {
  useUpdateSketchClassMutation,
  useDeleteSketchClassMutation,
  SketchClassesQuery,
  SketchClassesDocument,
  SketchGeometryType,
  AdminSketchingDetailsFragment,
  useToggleSketchClassGeographyClippingMutation,
  useSketchClassGeographyEditorDetailsQuery,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { useCallback, useMemo, useState } from "react";
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
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";
import SketchClassReportsAdmin from "./SketchClassReportsAdmin";
import { useHistory, useParams } from "react-router-dom";

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
  const projectMetadata = useCurrentProjectMetadata();
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

  const [mutate, mutationState] = useUpdateSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    onError,
  });
  const [filterLocationModal, setFilterLocationModal] = useState<
    string | undefined
  >();
  const [toggleClipping] = useToggleSketchClassGeographyClippingMutation({
    onError,
  });

  const { data: geographyData } = useSketchClassGeographyEditorDetailsQuery({
    variables: { slug: getSlug() },
  });

  const handleLegacyReportingToggle = useCallback(
    (enabled: boolean) => {
      toggleClipping({
        variables: {
          id: sketchClass.id,
          isGeographyClippingEnabled: !enabled,
        },
      });
    },
    [sketchClass.id, toggleClipping]
  );

  const isReportBuilderEnabled =
    projectMetadata.data?.project?.enableReportBuilder;
  const showLegacySystem = !sketchClass.isGeographyClippingEnabled;

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
      ...(isReportBuilderEnabled && !showLegacySystem
        ? [
            {
              name: "Geography Clipping",
              id: "geography-clipping",
              current: selectedTab === "geography-clipping",
            },
            {
              name: "Reports",
              id: "reports",
              current: selectedTab === "reports",
            },
          ]
        : [
            {
              name: "Geoprocessing",
              id: "geoprocessing",
              current: selectedTab === "geoprocessing",
            },
          ]),
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
  }, [
    selectedTab,
    sketchClass.geometryType,
    isReportBuilderEnabled,
    showLegacySystem,
  ]);

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
          background:
            'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACFJREFUKFNjXL58oxQDEYARpDAy0v8ZIbWjCvGGENHBAwCZWCYkLmgNZgAAAABJRU5ErkJggg==") repeat rgba(238, 240, 241)',
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
            {isReportBuilderEnabled && (
              <InputBlock
                input={
                  <Switch
                    isToggled={showLegacySystem}
                    onClick={(enabled) => handleLegacyReportingToggle(enabled)}
                  />
                }
                title={t("Enable Legacy Reporting System")}
                description={
                  <>
                    <Trans ns="admin:sketching">
                      When enabled, uses preprocessing and{" "}
                      <a
                        target="_blank"
                        href="https://github.com/seasketch/geoprocessing"
                        className="text-primary-500 hover:underline"
                      >
                        geoprocessing services
                      </a>{" "}
                      for reporting instead of the new geography-based system.
                    </Trans>
                  </>
                }
              />
            )}
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
        {selectedTab === "geography-clipping" && (
          <GeographyClippingTab sketchClass={sketchClass} />
        )}
        {selectedTab === "reports" && (
          <SketchClassReportsAdmin sketchClass={sketchClass} />
        )}
      </div>
    </div>
  );
}
