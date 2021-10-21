import { AdjustmentsIcon, ChevronLeftIcon } from "@heroicons/react/outline";
import { EyeIcon } from "@heroicons/react/solid";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
  useUpdateFormMutation,
  FormElementBackgroundImagePlacement,
  FormElementTextVariant,
  useUpdateFormElementBackgroundMutation,
  useSetFormElementBackgroundMutation,
  useClearFormElementStyleMutation,
} from "../../generated/graphql";
import { FormElementFactory } from "../../surveys/SurveyApp";
import {
  getCurrentStyle,
  SurveyAppLayout,
} from "../../surveys/SurveyAppLayout";
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
import { useAuth0 } from "@auth0/auth0-react";
import UnsplashImageChooser from "./UnsplashImageChooser";
import { colord, extend } from "colord";
import harmoniesPlugin from "colord/plugins/harmonies";
import a11yPlugin from "colord/plugins/a11y";
import { useMediaQuery } from "beautiful-react-hooks";
import ImagePreloader from "../../surveys/ImagePreloader";

extend([a11yPlugin]);
extend([harmoniesPlugin]);

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
  const auth0 = useAuth0();
  const { data, loading, error } = useSurveyFormEditorDetailsQuery({
    variables: {
      slug,
      id: surveyId,
    },
  });
  const [imageChooserOpen, setImageChooserOpen] = useState(false);
  const [updateOrder, updateOrderState] = useUpdateFormElementOrderMutation();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [focusState, setFocusState] = useState<{
    basicSettings: boolean;
    formElement: number | undefined;
  }>({
    basicSettings: false,
    formElement: undefined,
  });

  useEffect(() => {
    if (
      focusState.formElement === undefined &&
      focusState.basicSettings === false &&
      data?.survey?.form?.formElements?.length
    ) {
      setFocusState({
        formElement: data.survey.form.formElements[0].id,
        basicSettings: false,
      });
    }
  }, [data, focusState]);

  const [
    updateBackground,
    updateBackgroundState,
  ] = useUpdateFormElementBackgroundMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateFormElement: {
          __typename: "UpdateFormElementPayload",
          formElement: {
            __typename: "FormElement",
            id: data.id,
            backgroundColor:
              data.backgroundColor || selectedFormElement?.backgroundColor,
            secondaryColor:
              data.secondaryColor || selectedFormElement?.secondaryColor,
            backgroundImagePlacement:
              data.backgroundImagePlacement ||
              selectedFormElement?.backgroundImagePlacement ||
              FormElementBackgroundImagePlacement.Top,
            backgroundPalette:
              data.backgroundPalette ||
              selectedFormElement?.backgroundPalette ||
              [],
            textVariant:
              data.textVariant ||
              selectedFormElement?.textVariant ||
              FormElementTextVariant.Dynamic,
            unsplashAuthorName: selectedFormElement?.unsplashAuthorName,
            unsplashAuthorUrl: selectedFormElement?.unsplashAuthorUrl,
            backgroundImage: selectedFormElement?.backgroundImage,
          },
        },
      };
    },
  });

  const [
    setBackground,
    setBackgroundState,
  ] = useSetFormElementBackgroundMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        setFormElementBackground: {
          __typename: "FormElement",
          ...data,
          backgroundImage: data.backgroundUrl,
        },
      };
    },
  });

  const [clearStyle, clearStyleState] = useClearFormElementStyleMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        clearFormElementStyle: {
          formElement: {
            id: data.id,
            backgroundColor: null,
            backgroundImage: null,
            backgroundPalette: null,
            unsplashAuthorName: null,
            unsplashAuthorUrl: null,
          },
        },
      };
    },
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
  const [updateForm, updateFormMutationState] = useUpdateFormMutation({
    onError,
    optimisticResponse: (d) => ({
      __typename: "Mutation",
      updateForm: {
        __typename: "UpdateFormPayload",
        form: {
          __typename: "Form",
          id: data!.survey!.form!.id,
          isTemplate: d.isTemplate || data!.survey!.form!.isTemplate,
          templateName: d.templateName || data!.survey!.form!.templateName,
        },
      },
    }),
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
  const isSmall = useMediaQuery("(max-width: 767px)");

  const style = getCurrentStyle(
    data?.survey?.form?.formElements,
    selectedFormElement,
    isSmall
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
      <ImagePreloader formElements={formElements} />
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
      <div className="flex-1 flex" style={{ maxHeight: "calc(100vh - 56px)" }}>
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
                                        backgroundColor: null,
                                        backgroundImage: null,
                                        backgroundImagePlacement:
                                          FormElementBackgroundImagePlacement.Top,
                                        textVariant:
                                          FormElementTextVariant.Dynamic,
                                        backgroundPalette: null,
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
          {data?.survey && selectedFormElement && (
            <SurveyAppLayout
              embeddedInAdmin={true}
              style={style}
              progress={
                selectedFormElement
                  ? formElements.indexOf(selectedFormElement) /
                    formElements.length
                  : 1 / 3
              }
              showProgress={data?.survey?.showProgress}
              unsplashUserName={
                selectedFormElement?.unsplashAuthorName || undefined
              }
              unsplashUserUrl={
                selectedFormElement?.unsplashAuthorUrl || undefined
              }
            >
              <FormEditorPortalContext.Provider
                value={{
                  container: formElementEditorContainerRef.current,
                  formElementSettings: selectedFormElement!,
                }}
              >
                {selectedFormElement && (
                  <>
                    <FormElementFactory
                      {...selectedFormElement!}
                      onChange={() => null}
                      onSubmit={() => null}
                      typeName={selectedFormElement!.typeId}
                      editable={true}
                    />
                    {selectedFormElement.typeId !== "WelcomeMessage" && (
                      <Button
                        className="mt-5 mb-10"
                        label={t("Next")}
                        backgroundColor={style.secondaryColor}
                      />
                    )}
                  </>
                )}
              </FormEditorPortalContext.Provider>
            </SurveyAppLayout>
          )}
          {/* </div> */}
        </div>
        {/* Right Sidebar */}
        <div className="bg-white w-64 shadow overflow-y-auto">
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
                    labelType="small"
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
            <div className="p-3 text-sm" ref={formElementEditorContainerRef}>
              {focusState.basicSettings && (
                <InputBlock
                  labelType="small"
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
                <>
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
                              const formId = cache.identify(
                                data!.survey!.form!
                              );

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
                </>
              )}
          </>
          {selectedFormElement && (
            <>
              <h3 className="mt-4 flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-b border-t border-blue-gray-200  items-center">
                {t("Appearance")}
              </h3>
              <UnsplashImageChooser
                onRequestClose={() => setImageChooserOpen(false)}
                open={imageChooserOpen}
                onChange={(photo, colors) => {
                  setBackground({
                    variables: {
                      id: selectedFormElement.id,
                      downloadUrl: photo.links.download_location,
                      backgroundUrl: photo.urls.raw,
                      backgroundColor: colors[0],
                      secondaryColor: secondaryPalette(colors[0], colors)[0],
                      backgroundPalette: colors,
                      unsplashAuthorName: photo.user.name,
                      unsplashAuthorUrl: photo.user.links.html,
                      backgroundHeight: photo.height,
                      backgroundWidth: photo.width,
                    },
                  });
                  // setBackgroundColor(colors[0]);
                  // setImageUrl(photo.urls.regular);
                  setImageChooserOpen(false);
                }}
              />
              {!selectedFormElement.backgroundImage && (
                <div className="px-3 py-2 space-y-4 text-base">
                  <p className="text-sm">
                    <Trans ns="admin:surveys">
                      Choose a background image first to customize the
                      appearance of this page
                    </Trans>
                  </p>
                  <div>
                    <div className="flex-rows flex space-x-4 py-2 items-center justify-center">
                      <Button
                        small
                        label={t("Choose image...")}
                        onClick={() => setImageChooserOpen(true)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {selectedFormElement.backgroundImage && (
                <div className="px-3 py-2 space-y-4 text-base">
                  <p className="text-sm">
                    <Trans ns="admin:surveys">
                      Changing appearance settings will impact all following
                      pages until another customized page appears.
                    </Trans>
                  </p>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">
                      {t("Background image")}
                    </h4>
                    <div className="flex-rows flex space-x-4 py-2 items-center justify-center">
                      <img
                        role="button"
                        src={`${selectedFormElement.backgroundImage}&w=200`}
                        alt="survey background"
                        className="w-12 cursor-pointer"
                        onClick={() => setImageChooserOpen(true)}
                      />
                      <Button
                        small
                        label={t("Choose image...")}
                        onClick={() => setImageChooserOpen(true)}
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                      {t("Background color")}
                    </h4>
                    <div className="space-x-2 w-36 pl-2">
                      {(selectedFormElement.backgroundPalette || []).map(
                        (c) => (
                          <button
                            key={c!.toString()}
                            onClick={() => {
                              updateBackground({
                                variables: {
                                  id: selectedFormElement.id,
                                  backgroundColor: c,
                                },
                              });
                            }}
                            className={`w-4 h-4 rounded-full shadow ${
                              selectedFormElement.backgroundColor === c
                                ? "ring"
                                : ""
                            }`}
                            style={{ backgroundColor: c! }}
                          />
                        )
                      )}
                      {/* <input
                        className="w-4 h-4 rounded-full shadow"
                        type="color"
                        value={Color(
                          selectedFormElement.backgroundColor || ""
                        ).hex()}
                      /> */}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                      {t("Secondary color")}
                    </h4>
                    <div className="space-x-2 w-36 pl-2">
                      {secondaryPalette(
                        selectedFormElement.backgroundColor || "black",
                        (selectedFormElement.backgroundPalette ||
                          []) as string[]
                      ).map((c, i) => {
                        // c = Color(c!).rotate(180).rgb();
                        return (
                          <button
                            key={c!.toString()}
                            onClick={() => {
                              updateBackground({
                                variables: {
                                  id: selectedFormElement.id,
                                  secondaryColor: c,
                                },
                              });
                            }}
                            className={`w-4 h-4 rounded-full shadow ${
                              selectedFormElement.secondaryColor === c
                                ? "ring"
                                : ""
                            }`}
                            style={{ backgroundColor: c! }}
                          />
                        );
                      })}
                      {/* <input
                        className="w-4 h-4 rounded-full shadow"
                        type="color"
                        value={Color(
                          selectedFormElement.backgroundColor || ""
                        ).hex()}
                      /> */}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                      {t("Background layout")}
                    </h4>
                    <div className="flex space-x-2">
                      <div
                        title="Full Screen Image"
                        onClick={() => {
                          updateBackground({
                            variables: {
                              id: selectedFormElement.id,
                              backgroundImagePlacement:
                                FormElementBackgroundImagePlacement.Cover,
                            },
                          });
                        }}
                        className={`w-12 h-8 border rounded bg-cool-gray-600 flex flex-col justify-center space-y-1 shadow cursor-pointer ${
                          selectedFormElement.backgroundImagePlacement ===
                            FormElementBackgroundImagePlacement.Cover && "ring"
                        }`}
                      >
                        <div className="w-8 mx-auto bg-white rounded h-0.5"></div>
                        <div className="w-6 mx-auto bg-white rounded h-0.5"></div>
                        <div className="w-8 mx-auto bg-white rounded h-0.5"></div>
                      </div>
                      <div
                        title="Top Header Image"
                        onClick={() => {
                          updateBackground({
                            variables: {
                              id: selectedFormElement.id,
                              backgroundImagePlacement:
                                FormElementBackgroundImagePlacement.Top,
                            },
                          });
                        }}
                        className={`w-12 h-8 border overflow-hidden rounded flex flex-col justify-center space-y-1 shadow cursor-pointer ${
                          selectedFormElement.backgroundImagePlacement ===
                            FormElementBackgroundImagePlacement.Top && "ring"
                        }`}
                      >
                        <div className="w-full -mt-1 bg-gray-400 h-2"></div>
                        <div className="w-8 ml-1 bg-gray-500 rounded h-0.5"></div>
                        <div className="w-6 ml-1 bg-gray-500 rounded h-0.5"></div>
                        <div className="w-8 ml-1 bg-gray-500 rounded h-0.5"></div>
                      </div>
                      <div
                        title="Left Side Image"
                        onClick={() => {
                          updateBackground({
                            variables: {
                              id: selectedFormElement.id,
                              backgroundImagePlacement:
                                FormElementBackgroundImagePlacement.Left,
                            },
                          });
                        }}
                        className={`w-12 h-8 border overflow-hidden rounded flex flex-row justify-center shadow cursor-pointer ${
                          selectedFormElement.backgroundImagePlacement ===
                            FormElementBackgroundImagePlacement.Left && "ring"
                        }`}
                      >
                        <div className="w-1/3 h-full bg-gray-400"></div>
                        <div className="w-2/3 space-y-1">
                          <div className="w-3/4 mt-1 ml-1 bg-gray-500 rounded h-0.5"></div>
                          <div className="w-1/2 ml-1 bg-gray-500 rounded h-0.5"></div>
                          <div className="w-3/4 ml-1 bg-gray-500 rounded h-0.5"></div>
                        </div>
                      </div>
                      <div
                        title="Right Side Image"
                        onClick={() => {
                          updateBackground({
                            variables: {
                              id: selectedFormElement.id,
                              backgroundImagePlacement:
                                FormElementBackgroundImagePlacement.Right,
                            },
                          });
                        }}
                        className={`w-12 h-8 border overflow-hidden rounded flex flex-row justify-center shadow cursor-pointer ${
                          selectedFormElement.backgroundImagePlacement ===
                            FormElementBackgroundImagePlacement.Right && "ring"
                        }`}
                      >
                        <div className="w-2/3 space-y-1">
                          <div className="w-3/4 mt-1 ml-1 bg-gray-500 rounded h-0.5"></div>
                          <div className="w-1/2 ml-1 bg-gray-500 rounded h-0.5"></div>
                          <div className="w-3/4 ml-1 bg-gray-500 rounded h-0.5"></div>
                        </div>
                        <div className="w-1/3 h-full bg-gray-400"></div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 mt-2.5">
                      <Trans ns="admin:surveys">
                        Note that on mobile phones and other small devices, the
                        top-image layout will be used if left or right image
                        layout is selected.
                      </Trans>
                    </p>
                  </div>
                  {selectedFormElement.typeId !== "WelcomeMessage" && (
                    <div className="mt-2">
                      <Button
                        small
                        label={t("Clear style")}
                        onClick={() => {
                          clearStyle({
                            variables: { id: selectedFormElement.id },
                          });
                        }}
                      />
                      <p className="text-sm text-gray-800 mt-2.5">
                        <Trans>
                          Removing style settings will mean that this page will
                          share the same appearance as previous pages.
                        </Trans>
                      </p>
                    </div>
                  )}
                  {/* <InputBlock
                  labelType="small"
                  title={t("Text Color")}
                  input={
                    <select
                      className="w-32"
                      value={selectedFormElement.textVariant || ""}
                      onChange={(e) => {
                        updateBackground({
                          variables: {
                            id: selectedFormElement.id,
                            textVariant: e.target
                              .value as FormElementTextVariant,
                          },
                        });
                      }}
                    >
                      <option value={FormElementTextVariant.Dynamic}>
                        {t("Dynamic")}
                      </option>
                      <option value={FormElementTextVariant.Dark}>
                        {t("Dark")}
                      </option>
                      <option value={FormElementTextVariant.Light}>
                        {t("Light")}
                      </option>
                    </select>
                  }
                /> */}
                </div>
              )}
            </>
          )}
          {focusState.basicSettings &&
            auth0.user &&
            auth0.user["https://seasketch.org/superuser"] && (
              <div>
                <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-b border-t border-blue-gray-200  items-center">
                  <Trans ns="superuser">Superuser Settings</Trans>
                </h3>
                <div className="p-3 space-y-4">
                  <InputBlock
                    labelType="small"
                    className="text-sm"
                    title={<Trans ns="superuser">Publish as template</Trans>}
                    input={
                      <Switch
                        isToggled={data?.survey?.form?.isTemplate}
                        onClick={(val) => {
                          const templateName =
                            data!.survey!.form!.templateName ||
                            `Template ${data!.survey!.form!.id}`;
                          updateForm({
                            variables: {
                              id: data!.survey!.form!.id,
                              isTemplate: val,
                              templateName,
                            },
                          });
                        }}
                      />
                    }
                  />
                  <TextInput
                    disabled={!data?.survey?.form?.isTemplate}
                    label={<Trans ns="superuser">Template name</Trans>}
                    name="templateName"
                    description={
                      <Trans ns="superuser">
                        This is the label SeaSketch admins will see when
                        choosing among templates. For ease of maintenance, it's
                        best to publish templates from a single project like
                        <a
                          href={`${process.env.REACT_APP_PUBLIC_URL}/superuser`}
                          className="underline"
                        >
                          {` ${(
                            process.env.REACT_APP_PUBLIC_URL || "seasketch.org"
                          ).replace(/http[s]*:\/\//, "")}/superuser`}
                        </a>
                        . Sharing a template won't disable it in the project
                        so... don't let things get weird!
                      </Trans>
                    }
                    value={data?.survey?.form?.templateName || ""}
                    onChange={(val) => {
                      const templateName =
                        val || `Template ${data!.survey!.form!.id}`;
                      updateForm({
                        variables: {
                          id: data!.survey!.form!.id,
                          templateName,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            )}
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

function secondaryPalette(
  background: string,
  backgroundPalette: string[]
): string[] {
  let palette = [];
  const bg = colord(background);
  const luminance = bg.luminance();
  for (const color of backgroundPalette) {
    if (colord(color).contrast(bg) > 2) {
      palette.push(color);
    }
  }
  palette.push(bg.invert().toRgbString());
  if (bg.isDark()) {
    palette.push(
      ...bg
        .lighten(0.13 - luminance)
        .harmonies("tetradic")
        .filter((c) => c.contrast(bg) > 2)
        .map((c) => c.toRgbString())
    );
  } else {
    palette.push(
      ...bg
        .harmonies("tetradic")
        .filter((c) => c.contrast(bg) > 2)
        .map((c) => c.toRgbString())
    );
  }
  return palette;
}
