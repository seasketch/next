import {
  DeleteFormElementDocument,
  SketchFormElementFragment,
  useSketchClassFormQuery,
  useUpdateFormElementOrderMutation,
  useUpdateSketchFormElementMutation,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import SketchForm from "../../projects/Sketches/SketchForm";
import AddFormElementButton from "../surveys/AddFormElementButton";
import { MenuIcon, PencilIcon, TrashIcon } from "@heroicons/react/outline";
import useDialog from "../../components/useDialog";
import { useDelete } from "../../graphqlHookWrappers";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { FormEditorPortalContext } from "../../formElements/FormElement";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import { usePopper } from "react-popper";
import TextInput from "../../components/TextInput";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

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
  const [formElementEditorContainerRef, setFormElementEditorContainerRef] =
    useState<HTMLDivElement | null>(null);
  const { t } = useTranslation("admin:sketching");
  const [scrollableRef, setScrollableRef] = useState<HTMLDivElement | null>(
    null
  );

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
  const [updatePositions, mutationState] = useUpdateFormElementOrderMutation({
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

  const [updateElement, updateElementState] =
    useUpdateSketchFormElementMutation({
      onError,
    });

  const { confirmDelete } = useDialog();

  if (!data) {
    return null;
  }
  // const [submissionAttempted, setSubmissionAttempted] = useState(false);
  return (
    <div className="flex flex-col h-full flex-1">
      <p className="text-sm  bg-gray-50 p-4 border-b border-black border-opacity-5">
        <Trans>
          This form can be customized to collect important information about
          sketches from your users. The name field is the only form element
          required by SeaSketch which cannot be modified.
        </Trans>
        <span className="block mt-2 -mb-1">
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
        </span>
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
              <SketchForm
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
                  <Trans ns="admin:sketching">Edit</Trans>{" "}
                  {editableElement?.typeId}
                </h1>
                <div className="pt-3 px-3 text-sm pb-1 font-medium">
                  <div className="w-72 h-0"></div>
                  {editableElement.isInput && (
                    <InputBlock
                      title={t("Required")}
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
    </div>
  );
}
