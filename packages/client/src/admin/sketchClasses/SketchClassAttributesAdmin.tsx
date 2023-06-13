import {
  DeleteFormElementDocument,
  useProjectMetadataQuery,
  useSketchClassFormQuery,
  useUpdateFormElementOrderMutation,
  useUpdateSketchFormElementMutation,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import SketchForm from "../../projects/Sketches/SketchForm";
import AddFormElementButton from "../surveys/AddFormElementButton";
import {
  MenuIcon,
  PencilIcon,
  TrashIcon,
  EyeOffIcon,
} from "@heroicons/react/outline";
import useDialog from "../../components/useDialog";
import { useDelete } from "../../graphqlHookWrappers";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  FormEditorPortalContext,
  FormLanguageContext,
} from "../../formElements/FormElement";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import { usePopper } from "react-popper";
import TextInput from "../../components/TextInput";
import getSlug from "../../getSlug";
import languages from "../../lang/supported";
import EditorLanguageSelector from "../../surveys/EditorLanguageSelector";
import SketchAttributesFormLogicRulesModal from "./SketchAttributesFormLogicRulesModal";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import { defaultStyle } from "../../surveys/appearance";

export default function SketchClassAttributesAdmin({
  formId,
}: {
  formId: number;
}) {
  const { data } = useSketchClassFormQuery({
    variables: {
      id: formId,
    },
  });
  const projectMetadataQuery = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const [formElementEditorContainerRef, setFormElementEditorContainerRef] =
    useState<HTMLDivElement | null>(null);
  const { t } = useTranslation("admin:sketching");
  const [scrollableRef] = useState<HTMLDivElement | null>(null);
  const [showFormLogicRulesModal, setShowFormLogicRulesModal] = useState<
    number | null
  >(null);

  const del = useDelete(DeleteFormElementDocument);
  const formElements = useMemo(() => {
    const elements = data?.form?.formElements || [];
    let sorted = [...elements].sort((a, b) => a.position - b.position);
    return [
      sorted.find((el) => el.typeId === "FeatureName")!,
      ...sorted.filter((el) => el.typeId !== "FeatureName"),
    ];
  }, [data?.form?.formElements]);

  const [editableElementId, setEditableElementId] = useState<number | null>(
    null
  );

  const onError = useGlobalErrorHandler();
  const [updatePositions] = useUpdateFormElementOrderMutation({
    onError,
    optimisticResponse: (data) => ({
      __typename: "Mutation",
      setFormElementOrder: {
        __typename: "SetFormElementOrderPayload",
        formElements: (data.elementIds! as number[]).map((id, i) => ({
          __typename: "FormElement",
          id,
          position: i + 1,
        })),
      },
    }),
  });

  const [referenceElement, setReferenceElement] = useState<any | null>(null);
  const [popperElement, setPopperElement] = useState<any | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "right-start",
  });

  useEffect(() => {
    if (editableElementId) {
      const handler = (e: any) => {
        if (!document.body.contains(e.target)) {
          return;
        }
        if (e.target.closest(".PopperContextMenu")) {
          return;
        }
        setEditableElementId(null);
      };
      document.body.addEventListener("click", handler);
      return () => {
        document.body.removeEventListener("click", handler);
      };
    }
  }, [editableElementId, popperElement]);

  const [updateElement] = useUpdateSketchFormElementMutation({
    onError,
  });

  const { confirmDelete } = useDialog();

  const { i18n } = useTranslation();

  const supportedLanguages =
    (projectMetadataQuery?.data?.project?.supportedLanguages as string[]) || [];

  const [lang, setLang] = useState(
    languages.find((lang) => lang.code === i18n.language) || languages[0]
  );

  if (!data || !projectMetadataQuery.data?.project) {
    return null;
  }

  // const [submissionAttempted, setSubmissionAttempted] = useState(false);
  return (
    <div className="flex flex-col h-full flex-1">
      <FormLanguageContext.Provider
        value={{
          supportedLanguages,
          lang,
          setLanguage: (lang) => {
            setLang(
              languages.find((language) => language.code === lang) ||
                languages[0]
            );
          },
        }}
      >
        <p className="text-sm  bg-gray-50 p-4 border-b border-black border-opacity-5">
          {t(
            "This form can be customized to collect important information about sketches from your users. The name field is the only form element required by SeaSketch which cannot be modified."
          )}
          <div className="mt-2 -mb-1 flex gap-2 w-full items-center">
            {/* <div className="flex-1"> */}
            <AddFormElementButton
              label={t("Add a field")}
              existingTypes={[]}
              formId={formId}
              formIsSketchClass={true}
              nextPosition={(data?.form?.formElements || []).length}
              onAdd={(id) => {
                setTimeout(() => {
                  if (scrollableRef) {
                    scrollableRef.scrollTo({
                      top: 20000,
                      behavior: "auto",
                    });
                  }
                }, 16);
              }}
            />
            {/* </div> */}
            {/* <div> */}
            <EditorLanguageSelector large />
            {/* </div> */}
          </div>
        </p>
        <DragDropContext
          onDragEnd={(result) => {
            if (!result.destination) {
              return;
            } else {
              const element = formElements.find(
                (el) => el.id === parseInt(result.draggableId)
              );
              if (!element) {
                throw new Error("Element could not be found!");
              }
              let sorted = formElements.filter((el) => el !== element);
              sorted = [
                ...sorted.slice(0, result.destination.index),
                element,
                ...sorted.slice(result.destination.index),
              ];
              updatePositions({
                variables: {
                  elementIds: sorted.map((element) => element.id),
                },
              });
            }
          }}
        >
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div
                className="p-4 space-y-4 overflow-y-auto flex-1"
                {...provided.droppableProps}
                ref={provided.innerRef}
                // ref={(el) => setRef(provided.innerRef, el)}
              >
                <div className="SketchForm" dir="ltr">
                  <FormElementLayoutContext.Provider
                    value={{
                      mapPortal: null,
                      style: {
                        ...defaultStyle,
                        isDark: false,
                        textClass: "text-black",
                        backgroundColor: "#eee",
                        secondaryColor: "#999",
                        secondaryColor2: "#aaa",
                        isSmall: false,
                        compactAppearance: true,
                      },
                      navigatingBackwards: false,
                    }}
                  >
                    <SketchForm
                      isSketchWorkflow
                      logicRules={data?.form?.logicRules || []}
                      startingProperties={{}}
                      submissionAttempted={false}
                      formElements={formElements}
                      editable={true}
                      renderElement={(children, element, i) => {
                        if (element.typeId === "FeatureName") {
                          return children;
                        }
                        const draggable = (
                          <Draggable
                            index={i}
                            draggableId={element.id.toString()}
                            key={`draggable-${element.id}`}
                            isDragDisabled={element.typeId === "FeatureName"}
                          >
                            {(provided, snapshot) => (
                              <div
                                className={`flex items-center group`}
                                ref={provided?.innerRef}
                                {...provided?.draggableProps}
                                key={element.id}
                                style={provided?.draggableProps.style}
                              >
                                <div className="flex-1">{children}</div>
                                <div
                                  className={`h-full flex flex-col pl-3 border-l ${
                                    editableElementId
                                      ? editableElementId === element.id
                                        ? "opacity-100"
                                        : "opacity-5"
                                      : "opacity-10 group-hover:opacity-100"
                                  } z-0`}
                                >
                                  <button
                                    className="py-1 flex-1 cursor-move"
                                    {...provided.dragHandleProps}
                                  >
                                    <MenuIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                                  </button>
                                  <button
                                    className="py-1 flex-1"
                                    onClick={async () => {
                                      confirmDelete({
                                        message: t(
                                          "Are you sure you want to delete this item?"
                                        ),
                                        onDelete: async () => {
                                          await del(element);
                                        },
                                      });
                                    }}
                                  >
                                    <TrashIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                                  </button>
                                  {element.isInput && (
                                    <button
                                      ref={setReferenceElement}
                                      className={`py-1 flex-1 ${
                                        element.id === editableElementId
                                          ? "text-black"
                                          : ""
                                      }`}
                                      onClick={(e) => {
                                        setEditableElementId(element.id);
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                    >
                                      <PencilIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                                    </button>
                                  )}
                                  <button
                                    className="py-1 flex-1 relative"
                                    onClick={async () => {
                                      setShowFormLogicRulesModal(element.id);
                                    }}
                                  >
                                    <EyeOffIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                                    {(data.form?.logicRules || []).find(
                                      (rule) =>
                                        rule.formElementId === element.id
                                    ) && (
                                      <div className="bg-primary-500 w-2 h-2 rounded-full absolute top-1 -right-0.5 border-white border"></div>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                        if (
                          element.id === editableElementId &&
                          formElementEditorContainerRef
                        ) {
                          return (
                            <FormEditorPortalContext.Provider
                              key={`context-${element.id}`}
                              value={{
                                container: formElementEditorContainerRef,
                                formElementSettings: formElements.find(
                                  (el) => el.id === editableElementId
                                ),
                                surveyId: 0,
                                // surveyId: data.survey.id,
                              }}
                            >
                              {draggable}
                            </FormEditorPortalContext.Provider>
                          );
                        } else {
                          return draggable;
                        }
                      }}
                    />
                  </FormElementLayoutContext.Provider>
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div
          ref={setPopperElement}
          className="bg-white max-w-sm shadow-xl rounded z-50 border border-opacity-10 border-black PopperContextMenu"
          {...attributes.popper}
          style={styles.popper}
        >
          {editableElementId !== null &&
            (() => {
              const editableElement = formElements.find(
                (f) => f.id === editableElementId
              )!;
              return (
                <>
                  <h1 className="p-3 border-b font-semibold">
                    {t("Edit")}
                    {editableElement?.typeId}
                  </h1>
                  <div className="pt-3 px-3 text-sm pb-1 font-medium">
                    <div className="w-72 h-0"></div>
                    {editableElement.isInput && (
                      <InputBlock
                        title={t("Required", { ns: "admin:surveys" })}
                        input={
                          <Switch
                            isToggled={editableElement?.isRequired}
                            onClick={(isRequired) => {
                              updateElement({
                                variables: {
                                  id: editableElement.id,
                                  isRequired,
                                },
                                optimisticResponse: (data) => ({
                                  __typename: "Mutation",
                                  updateFormElement: {
                                    __typename: "UpdateFormElementPayload",
                                    formElement: {
                                      __typename: "FormElement",
                                      ...editableElement,
                                      isRequired,
                                    },
                                  },
                                }),
                              });
                            }}
                          />
                        }
                      />
                    )}
                    <div className="pt-2">
                      <TextInput
                        label={t("Export ID")}
                        name="exportid"
                        description={t(
                          "Setting an export id will give a stable column name when exporting data and is used in reporting."
                        )}
                        value={editableElement.exportId || ""}
                        onChange={(exportId) => {
                          updateElement({
                            variables: {
                              id: editableElement.id,
                              exportId,
                            },
                            optimisticResponse: (data) => ({
                              __typename: "Mutation",
                              updateFormElement: {
                                __typename: "UpdateFormElementPayload",
                                formElement: {
                                  __typename: "FormElement",
                                  ...editableElement,
                                  exportId,
                                },
                              },
                            }),
                          });
                        }}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          <div ref={setFormElementEditorContainerRef}></div>
        </div>
      </FormLanguageContext.Provider>
      {showFormLogicRulesModal && data.form?.sketchClassId && (
        <SketchAttributesFormLogicRulesModal
          id={showFormLogicRulesModal}
          onRequestClose={() => setShowFormLogicRulesModal(null)}
          sketchClassId={data.form.sketchClassId}
        />
      )}
    </div>
  );
}
