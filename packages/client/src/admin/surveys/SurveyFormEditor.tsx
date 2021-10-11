import { AdjustmentsIcon, ChevronLeftIcon } from "@heroicons/react/outline";
import { EyeIcon } from "@heroicons/react/solid";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import SettingsIcon from "../../components/SettingsIcon";
import Switch from "../../components/Switch";
import {
  useSurveyFormEditorDetailsQuery,
  useUpdateSurveyBaseSettingsMutation,
  FormElement,
  FormElementType,
  useUpdateFormElementOrderMutation,
  useAddFormElementMutation,
  useDeleteFormElementMutation,
} from "../../generated/graphql";
import { FormElementFactory, SurveyAppLayout } from "../../surveys/SurveyApp";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  FormEditorPortalContext,
  useUpdateFormElement,
} from "../../formElements/FormElement";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from "react-beautiful-dnd";
import { components } from "../../formElements";
import { AnimatePresence, motion } from "framer-motion";
import gql from "graphql-tag";
import Spinner from "../../components/Spinner";
import TextInput from "../../components/TextInput";

require("../../formElements/BodyEditor");

export default function SurveyFormEditor({
  surveyId,
  slug,
}: {
  surveyId: number;
  slug: string;
}) {
  const { t } = useTranslation();
  const formElementEditorContainerRef = useRef<HTMLDivElement>(null);
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useSurveyFormEditorDetailsQuery({
    variables: {
      slug,
      id: surveyId,
    },
  });
  const [updateOrder, updateOrderState] = useUpdateFormElementOrderMutation();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [focusState, setFocusState] = useState<{
    basicSettings: boolean;
    formElement: number | undefined;
  }>({
    basicSettings: true,
    formElement: undefined,
  });
  const [
    updateBaseSettingsMutation,
    updateBaseSettingsState,
  ] = useUpdateSurveyBaseSettingsMutation({
    onError,
  });
  function updateBaseSetting(settings: { showProgress?: boolean }) {
    updateBaseSettingsMutation({
      variables: { ...settings, id: data!.survey!.id },
      optimisticResponse: {
        updateSurvey: {
          survey: {
            __typename: "Survey",
            id: data!.survey!.id,
            showProgress:
              "showProgress" in settings
                ? settings.showProgress!
                : data!.survey!.showProgress,
          },
          __typename: "UpdateSurveyPayload",
        },
      },
    });
  }

  const [addFormElement, addFormElementState] = useAddFormElementMutation({
    onError,
  });
  const [
    deleteFormElement,
    deleteFormElementState,
  ] = useDeleteFormElementMutation({
    onError,
  });

  const formElements = [...(data?.survey?.form?.formElements || [])];
  formElements.sort((a, b) => a.position - b.position);

  const selectedFormElement = formElements.find(
    (e) => e.id === focusState.formElement
  );

  const [updateElementSetting, updateComponentSetting] = useUpdateFormElement(
    selectedFormElement!
  );

  const WelcomeMessage = formElements.find(
    (e) => e.typeId === "WelcomeMessage"
  );
  const sortableFormElements = formElements.filter(
    (e) => e.typeId !== "WelcomeMessage"
  );
  const formId = data?.survey?.form?.id;

  return (
    <div className="w-screen h-screen flex flex-col">
      <nav className="bg-white p-2 w-full border text-gray-800 flex items-center">
        <div className="flex-1">
          <Link
            to={`/${slug}/admin/surveys/`}
            className="inline-flex items-center space-x-3 text-sm font-medium"
          >
            <ChevronLeftIcon
              className="relative top-1 h-5 w-5 text-gray-500 mr-1"
              aria-hidden="true"
            />
          </Link>
          <Link to={`/${slug}/admin/surveys/`}>
            {data?.projectBySlug?.name}
          </Link>{" "}
          /{" "}
          <Link to={`/${slug}/admin/surveys/${surveyId}`}>
            {data?.survey?.name}
          </Link>
        </div>
        <Button
          href={`/${slug}/surveys/${surveyId}/0?preview=true`}
          label={
            <>
              <EyeIcon className="h-4 mr-2" />
              <span>{t("Preview Survey")}</span>
            </>
          }
          // primary
        />
      </nav>
      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <div className="bg-white w-56 shadow">
          <div className="flex-1 overflow-y-auto flex flex-col min-h-full">
            <nav className="px-2 mt-2">
              <div className="space-y-1">
                <button
                  className={`${
                    focusState.basicSettings
                      ? "bg-cool-gray-100 text-black"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                      group flex items-center px-2 py-2 text-base leading-5 rounded-md w-full`}
                  aria-current={focusState.basicSettings ? "page" : undefined}
                  onClick={() =>
                    setFocusState({
                      basicSettings: true,
                      formElement: undefined,
                    })
                  }
                >
                  <AdjustmentsIcon
                    className={`${
                      focusState.basicSettings
                        ? "text-gray-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    }
                        mr-3 flex-shrink-0 h-6 w-6`}
                    aria-hidden="true"
                  />
                  {t("Base Settings")}
                </button>
              </div>
            </nav>
            <nav className="mt-2 bg-cool-gray-100 flex-1">
              <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-blue-gray-200 border items-center">
                <span className="flex-1">{t("Form Elements")}</span>
                <Button
                  className=""
                  small
                  label={t("Add")}
                  onClick={() => setAddMenuOpen(true)}
                />
                <AnimatePresence>
                  {addMenuOpen && (
                    <motion.div
                      transition={{ duration: 0.1 }}
                      initial={{ background: "rgba(0,0,0,0)" }}
                      animate={{ background: "rgba(0,0,0,0.1)" }}
                      exit={{ background: "rgba(0,0,0,0)" }}
                      className={`absolute top-0 left-0 z-50 w-screen h-screen bg-opacity-5 bg-black`}
                      onClick={() => setAddMenuOpen(false)}
                    >
                      <motion.div
                        transition={{ duration: 0.1 }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute left-56 ml-2 p-0 top-28 mt-2 max-h-128 overflow-y-auto bg-white rounded shadow "
                      >
                        {Object.entries(components)
                          .filter(([id, C]) => !C.templatesOnly)
                          .map(([id, C]) => (
                            <div
                              key={id}
                              className="py-4 px-4 cursor-pointer my-2 hover:bg-cool-gray-100"
                              onClick={async () => {
                                const result = await addFormElement({
                                  variables: {
                                    body: C.defaultBody,
                                    componentSettings:
                                      C.defaultComponentSettings || {},
                                    formId: data!.survey!.form!.id,
                                    componentType: id,
                                  },
                                  optimisticResponse: {
                                    __typename: "Mutation",
                                    createFormElement: {
                                      __typename: "CreateFormElementPayload",
                                      formElement: {
                                        __typename: "FormElement",
                                        body: C.defaultBody,
                                        componentSettings:
                                          C.defaultComponentSettings || {},
                                        formId: data!.survey!.form!.id,
                                        typeId: id,
                                        isRequired: false,
                                        position: formElements.length + 1,
                                        conditionalRenderingRules: [],
                                        type: {
                                          ...data!.formElementTypes!.find(
                                            (e) => e.componentName === id
                                          )!,
                                        },
                                        id: 9999999999,
                                        exportId:
                                          "loading-" + formElements.length + 1,
                                      },
                                    },
                                  },
                                  update: (cache, { data }) => {
                                    if (data?.createFormElement?.formElement) {
                                      const newElementData =
                                        data.createFormElement.formElement;
                                      cache.modify({
                                        id: cache.identify({
                                          __typename: "Form",
                                          id: formId,
                                        }),
                                        fields: {
                                          formElements(
                                            existingRefs = [],
                                            { readField }
                                          ) {
                                            const newRef = cache.writeFragment({
                                              data: newElementData,
                                              fragment: gql`
                                                fragment NewElement on FormElement {
                                                  body
                                                  componentSettings
                                                  conditionalRenderingRules {
                                                    id
                                                    field {
                                                      id
                                                      exportId
                                                    }
                                                    operator
                                                    predicateFieldId
                                                    value
                                                  }
                                                  exportId
                                                  formId
                                                  id
                                                  isRequired
                                                  position
                                                  type {
                                                    componentName
                                                    isHidden
                                                    isInput
                                                    isSingleUseOnly
                                                    isSurveysOnly
                                                    label
                                                  }
                                                  typeId
                                                }
                                              `,
                                            });

                                            return [...existingRefs, newRef];
                                          },
                                        },
                                      });
                                    }
                                  },
                                });
                                if (
                                  result.data?.createFormElement?.formElement
                                ) {
                                  setFocusState({
                                    basicSettings: false,
                                    formElement:
                                      result.data.createFormElement.formElement
                                        .id,
                                  });
                                }
                              }}
                            >
                              <div className="text-base font-medium text-gray-800">
                                {C.label}
                              </div>
                              <div className="text-sm text-gray-800">
                                {C.description}
                              </div>
                            </div>
                          ))}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </h3>
              <div className="pb-4 pt-1">
                {WelcomeMessage && (
                  <div className="mb-2">
                    <FormElementListItem
                      selected={
                        !!(
                          focusState.formElement &&
                          focusState.formElement === WelcomeMessage.id
                        )
                      }
                      element={WelcomeMessage}
                      type={WelcomeMessage.type!}
                      onClick={() =>
                        setFocusState({
                          basicSettings: false,
                          formElement: WelcomeMessage.id,
                        })
                      }
                      draggable={false}
                    />
                  </div>
                )}
                <DragDropContext
                  onDragEnd={(result) => {
                    if (!result.destination) {
                      return;
                    } else {
                      let sorted = reorder(
                        sortableFormElements,
                        result.source.index,
                        result.destination.index
                      );
                      if (WelcomeMessage) {
                        sorted = [WelcomeMessage, ...sorted];
                      }
                      updateOrder({
                        variables: {
                          elementIds: sorted.map((e) => e.id),
                        },
                        optimisticResponse: {
                          __typename: "Mutation",
                          setFormElementOrder: {
                            __typename: "SetFormElementOrderPayload",
                            formElements: sorted.map((e, i) => ({
                              __typename: "FormElement",
                              id: e.id,
                              position: i + 1,
                            })),
                          },
                        },
                      });
                    }
                  }}
                >
                  <Droppable droppableId="droppable">
                    {(provided, snapshot) => (
                      <div
                        className="space-y-2"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {sortableFormElements.map((element, i) => (
                          <Draggable
                            index={i}
                            draggableId={element.id.toString()}
                            key={element.id}
                            isDragDisabled={element.typeId === "WelcomeMessage"}
                          >
                            {(provided, snapshot) => (
                              <FormElementListItem
                                draggable={true}
                                provided={provided}
                                snapshot={snapshot}
                                // key={element.id}
                                selected={
                                  !!(
                                    focusState.formElement &&
                                    focusState.formElement === element.id
                                  )
                                }
                                element={element}
                                type={element.type!}
                                creating={element.id === 9999999999}
                                onClick={() =>
                                  setFocusState({
                                    basicSettings: false,
                                    formElement: element.id,
                                  })
                                }
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </nav>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1">
          {/* <div className={`w-96 h-160 ml-auto mr-auto`}> */}
          <SurveyAppLayout
            skipScreenHeight={true}
            progress={
              selectedFormElement
                ? formElements.indexOf(selectedFormElement) /
                  formElements.length
                : 1 / 3
            }
            showProgress={data?.survey?.showProgress}
          >
            <FormEditorPortalContext.Provider
              value={{
                container: formElementEditorContainerRef.current,
                formElementSettings: selectedFormElement!,
              }}
            >
              {!focusState.basicSettings && (
                <FormElementFactory
                  {...selectedFormElement!}
                  onChange={() => null}
                  onSubmit={() => null}
                  typeName={selectedFormElement!.typeId}
                  editable={true}
                />
              )}
            </FormEditorPortalContext.Provider>
          </SurveyAppLayout>
          {/* </div> */}
        </div>
        {/* Right Sidebar */}
        <div className="bg-white w-64 shadow">
          <>
            <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-b border-blue-gray-200  items-center">
              {focusState.basicSettings
                ? t("Base Settings")
                : selectedFormElement?.type?.componentName}
            </h3>
            {!focusState.basicSettings &&
              selectedFormElement &&
              selectedFormElement.typeId !== "WelcomeMessage" && (
                <div className="px-3 text-sm pt-3">
                  <InputBlock
                    title={t("Required", { ns: "admin:surveys" })}
                    input={
                      <Switch
                        isToggled={selectedFormElement?.isRequired}
                        onClick={updateElementSetting("isRequired")}
                      />
                    }
                  />
                </div>
              )}
            <div className="p-3" ref={formElementEditorContainerRef}>
              {focusState.basicSettings && (
                <InputBlock
                  title={t("Show Progress")}
                  input={
                    <Switch
                      isToggled={data?.survey?.showProgress}
                      onClick={(val) =>
                        updateBaseSetting({ showProgress: val })
                      }
                    />
                  }
                />
              )}
            </div>
            {!focusState.basicSettings &&
              selectedFormElement &&
              selectedFormElement.typeId !== "WelcomeMessage" && (
                <div className="px-3 text-base">
                  <TextInput
                    label={t("Export ID")}
                    name="exportid"
                    description={t(
                      "Setting an export id will give a stable column name when exporting your results"
                    )}
                    value={selectedFormElement.exportId || ""}
                    onChange={updateElementSetting("exportId")}
                  />
                  <Button
                    className="mt-4"
                    label={t("Delete Element")}
                    small
                    onClick={() => {
                      if (window.confirm(t("Are you sure?"))) {
                        const formElement = selectedFormElement!;
                        setFocusState({
                          formElement: undefined,
                          basicSettings: true,
                        });
                        deleteFormElement({
                          variables: { id: formElement.id },
                          optimisticResponse: {
                            __typename: "Mutation",
                            deleteFormElement: {
                              __typename: "DeleteFormElementPayload",
                              formElement: {
                                __typename: "FormElement",
                                id: formElement.id,
                              },
                            },
                          },
                          update: (cache) => {
                            const id = cache.identify(formElement!);

                            cache.evict({
                              id,
                            });
                            const formId = cache.identify(data!.survey!.form!);

                            cache.modify({
                              id: formId,
                              fields: {
                                formElements(existingRefs, { readField }) {
                                  return existingRefs.filter(
                                    // @ts-ignore
                                    (elementRef) => {
                                      return (
                                        formElement.id !==
                                        readField("id", elementRef)
                                      );
                                    }
                                  );
                                },
                              },
                            });
                          },
                        });
                      }
                    }}
                  />
                </div>
              )}
          </>
        </div>
      </div>
    </div>
  );
}

function FormElementListItem({
  element,
  type,
  onClick,
  selected,
  provided,
  draggable,
  snapshot,
  creating,
}: {
  element: Pick<FormElement, "body" | "componentSettings" | "exportId">;
  type: Pick<FormElementType, "label">;
  onClick?: () => void;
  selected: boolean;
  provided?: DraggableProvided;
  draggable?: boolean;
  snapshot?: DraggableStateSnapshot;
  creating?: boolean;
}) {
  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      // style={provided?.draggableProps.style}
      style={{ ...provided?.draggableProps.style, cursor: "pointer" }}
      onClick={onClick}
      className={`relative select-none cursor-pointer ${
        snapshot?.isDragging && "shadow-lg"
      } mx-2 px-4 py-2 ${
        draggable && "shadow-md"
      } bg-white w-50 border border-black border-opacity-20 rounded ${
        selected && "ring-2 ring-blue-300"
      } ${creating ? "opacity-50" : ""}`}
    >
      {creating && <Spinner className="absolute right-1 top-1" />}
      <div className="">{type.label}</div>
      <div className="text-xs italic overflow-x-hidden truncate">
        {collectText(element.body)}
      </div>
    </div>
  );
}

/**
 * Extracts text from the given ProseMirror document up to the character limit
 * @param body ProseMirror document json
 * @param charLimit Character limit
 * @returns string
 */
function collectText(body: any, charLimit = 32) {
  let text = "";
  if (body.text) {
    text += body.text + " ";
  }
  if (body.content && body.content.length) {
    for (const node of body.content) {
      if (text.length > charLimit) {
        return text;
      }
      text += collectText(node);
    }
  }
  return text;
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
