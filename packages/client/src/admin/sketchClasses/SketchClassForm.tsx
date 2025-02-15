import {
  useUpdateSketchClassMutation,
  useDeleteSketchClassMutation,
  SketchClassesQuery,
  SketchClassesDocument,
  SketchGeometryType,
  AdminSketchingDetailsFragment,
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
import PreprocessorInput from "./PreprocessorInput";
import SketchClassAttributesAdmin from "./SketchClassAttributesAdmin";
import GeoprocessingClientInput from "./GeoprocessingClientInput";
import TranslatedPropControl from "../../components/TranslatedPropControl";
import SketchClassStyleAdmin from "./SketchClassStyleAdmin";
import EvaluateFilterServiceModal from "./EvaluateFilterServiceModal";

export default function SketchClassForm({
  sketchClass,
  onDelete,
}: {
  sketchClass: AdminSketchingDetailsFragment;
  onDelete?: (id: number) => void;
}) {
  const onError = useGlobalErrorHandler();
  const { t } = useTranslation("admin:sketching");
  const [mutate, mutationState] = useUpdateSketchClassMutation({
    variables: {
      id: sketchClass.id,
    },
    onError,
  });
  const [selectedTab, setSelectedTab] = useState("settings");
  const [filterLocationModal, setFilterLocationModal] = useState<
    string | undefined
  >();

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
      {
        name: "Geoprocessing",
        id: "geoprocessing",
        current: selectedTab === "geoprocessing",
      },
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
  }, [selectedTab, sketchClass.geometryType]);

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
  return (
    <div className="min-h-screen max-h-screen overflow-hidden flex-col flex">
      <div className="p-2 bg-gray-700">
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
          <Tabs dark small tabs={tabs} onClick={(id) => setSelectedTab(id)} />
        </div>
      </div>
      <div className="bg-white flex-1 max-w-xl shadow z-0 w-128 overflow-x-hidden overflow-y-auto">
        {selectedTab === "settings" && (
          <div className="p-4 space-y-4">
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
          <>
            <div className="p-4 space-y-4">
              {sketchClass.geometryType !== SketchGeometryType.Collection &&
                sketchClass.geometryType !==
                  SketchGeometryType.ChooseFeature && (
                  <PreprocessorInput sketchClass={sketchClass} />
                )}
              <GeoprocessingClientInput sketchClass={sketchClass} />
            </div>
          </>
        )}
        {selectedTab === "attributes" && sketchClass.form && (
          <SketchClassAttributesAdmin
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
