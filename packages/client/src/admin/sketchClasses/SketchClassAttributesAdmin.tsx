import {
  DeleteFormElementDocument,
  SketchingDetailsFragment,
  useUpdateFormElementOrderMutation,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useCallback, useMemo, useRef, useState } from "react";
import SketchForm from "../../projects/Sketches/SketchForm";
import AddFormElementButton from "../surveys/AddFormElementButton";
import { MenuIcon, PencilIcon, TrashIcon } from "@heroicons/react/outline";
import useDialog from "../../components/useDialog";
import { useDelete } from "../../graphqlHookWrappers";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default function SketchClassAttributesAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");
  const [scrollableRef, setScrollableRef] = useState<HTMLDivElement | null>(
    null
  );
  const del = useDelete(DeleteFormElementDocument);
  const formElements = useMemo(() => {
    const elements = sketchClass.form?.formElements || [];
    let sorted = [...elements].sort((a, b) => a.position - b.position);
    return [
      sorted.find((el) => el.typeId === "FeatureName")!,
      ...sorted.filter((el) => el.typeId !== "FeatureName"),
    ];
  }, [sketchClass.form?.formElements]);

  const onError = useGlobalErrorHandler();
  const [updatePositions, mutationState] = useUpdateFormElementOrderMutation({
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

  const setRef = useCallback(
    (innerRef: any, el: any) => {
      innerRef(el);
      setScrollableRef(el);
    },
    [setScrollableRef]
  );

  const { confirmDelete } = useDialog();
  // const [submissionAttempted, setSubmissionAttempted] = useState(false);
  return (
    <div className="flex flex-col h-full">
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
            formId={sketchClass.form!.id}
            formIsSketchClass={true}
            nextPosition={(sketchClass.form?.formElements || []).length}
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
              className="p-4 space-y-4 overflow-y-auto"
              {...provided.droppableProps}
              ref={provided.innerRef}
              // ref={(el) => setRef(provided.innerRef, el)}
            >
              <SketchForm
                startingProperties={{}}
                submissionAttempted={false}
                formElements={formElements}
                editable={true}
                buttons={(element, dragHandleProps) =>
                  element.typeId !== "FeatureName" ? (
                    <>
                      <button
                        className="py-1 flex-1 cursor-move"
                        {...dragHandleProps}
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
                      <button className="py-1 flex-1">
                        <PencilIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                      </button>
                    </>
                  ) : (
                    <></>
                  )
                }
                renderElement={(children, element, i) => {
                  if (element.typeId === "FeatureName") {
                    return children;
                  }
                  return (
                    <Draggable
                      index={i}
                      draggableId={element.id.toString()}
                      key={element.id}
                      isDragDisabled={element.typeId === "FeatureName"}
                    >
                      {(provided, snapshot) => (
                        <div
                          className="flex items-center group"
                          ref={provided?.innerRef}
                          {...provided?.draggableProps}
                          key={element.id}
                          style={provided?.draggableProps.style}
                        >
                          <div className="flex-1">{children}</div>
                          <div className="h-full flex flex-col pl-3 border-l opacity-10 group-hover:opacity-100 z-0">
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
                            <button className="py-1 flex-1">
                              <PencilIcon className="w-5 h-5 text-gray-500 hover:text-black" />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                }}
              />
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
