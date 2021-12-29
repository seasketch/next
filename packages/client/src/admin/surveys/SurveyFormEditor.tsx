import {
  AdjustmentsIcon,
  ChevronDoubleDownIcon,
  ChevronLeftIcon,
} from "@heroicons/react/outline";
import { EyeIcon } from "@heroicons/react/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useHistory } from "react-router-dom";
import Button from "../../components/Button";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import {
  useSurveyFormEditorDetailsQuery,
  useUpdateSurveyBaseSettingsMutation,
  useUpdateFormElementOrderMutation,
  useDeleteFormElementMutation,
  useUpdateFormMutation,
  FormElementLayout,
  FormElementTextVariant,
  useUpdateFormElementBackgroundMutation,
  useSetFormElementBackgroundMutation,
  useClearFormElementStyleMutation,
  FormElement,
  FormElementFullDetailsFragment,
  LogicRuleDetailsFragment,
} from "../../generated/graphql";
import FormElementFactory from "../../surveys/FormElementFactory";
import { SurveyAppLayout } from "../../surveys/SurveyAppLayout";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  FormEditorPortalContext,
  sortFormElements,
  SurveyButtonFooterPortalContext,
  SurveyContext,
  useUpdateFormElement,
} from "../../formElements/FormElement";
import TextInput from "../../components/TextInput";
import { useAuth0 } from "@auth0/auth0-react";
import UnsplashImageChooser from "./UnsplashImageChooser";
import { colord, extend } from "colord";
import harmoniesPlugin from "colord/plugins/harmonies";
import a11yPlugin from "colord/plugins/a11y";
import ImagePreloader from "../../surveys/ImagePreloader";
import { Auth0User } from "../../auth/Auth0User";
import SortableFormElementList from "./SortableFormElementList";
import AddFormElementButton from "./AddFormElementButton";
import { useCurrentStyle } from "../../surveys/appearance";
import { advancesAutomatically } from "../../surveys/SurveyApp";
import SurveyFlowMap from "./SurveyFlowMap";
import LogicRuleEditor from "./LogicRuleEditor";
import { components } from "../../formElements";
import bbox from "@turf/bbox";
import { LngLatBoundsLike, LngLatLike } from "mapbox-gl";

extend([a11yPlugin]);
extend([harmoniesPlugin]);

require("../../formElements/BodyEditor");

export default function SurveyFormEditor({
  surveyId,
  slug,
  route,
  formElementId,
}: {
  surveyId: number;
  slug: string;
  route: "basic" | "logic" | "formElement";
  formElementId: number | null;
}) {
  const { t } = useTranslation();
  const formElementEditorContainerRef = useRef<HTMLDivElement>(null);
  const onError = useGlobalErrorHandler();
  const auth0 = useAuth0<Auth0User>();
  const { data, loading, error } = useSurveyFormEditorDetailsQuery({
    variables: {
      slug,
      id: surveyId,
    },
  });
  const [imageChooserOpen, setImageChooserOpen] = useState(false);
  const [updateOrder, updateOrderState] = useUpdateFormElementOrderMutation();
  const history = useHistory();
  const [values, setValues] = useState<{ [id: number]: any | undefined }>({});

  const { flattenedFormElements, flattenedRules } = useMemo(() => {
    const results: {
      flattenedFormElements: FormElementFullDetailsFragment[];
      flattenedRules: LogicRuleDetailsFragment[];
    } = { flattenedFormElements: [], flattenedRules: [] };
    if (data?.survey?.form?.formElements && data?.survey?.form?.logicRules) {
      results.flattenedRules.push(...data.survey.form.logicRules);
      for (const element of data.survey.form.formElements) {
        results.flattenedFormElements.push(element);
        if (element.sketchClass?.form?.formElements?.length) {
          results.flattenedFormElements.push(
            ...element.sketchClass.form.formElements
          );
          results.flattenedRules.push(
            ...(element.sketchClass.form.logicRules || [])
          );
        }
      }
    }
    results.flattenedFormElements = sortFormElements(
      results.flattenedFormElements
    );
    return results;
  }, [data?.survey?.form?.formElements, data?.survey?.form?.logicRules]);

  const [selectedLogicFormElements, setSelectedLogicFormElements] = useState<
    number[]
  >([]);
  const surveyButtonFooter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      route === "formElement" &&
      formElementId === null &&
      data?.survey?.form?.formElements?.length
    ) {
      history.replace(
        history.location.pathname + "/" + data.survey.form.formElements[0].id
      );
    }
  }, [data, route]);

  const [
    updateBackground,
    updateBackgroundState,
  ] = useUpdateFormElementBackgroundMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => ({
      updateFormElement: {
        formElement: {
          ...selectedFormElement,
          ...data,
        },
      },
    }),
  });

  const [
    setBackground,
    setBackgroundState,
  ] = useSetFormElementBackgroundMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        setFormElementBackground: {
          ...data,
          backgroundImage: data.backgroundUrl,
        },
      };
    },
  });

  const [clearStyle, clearStyleState] = useClearFormElementStyleMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        clearFormElementStyle: {
          __typename: "ClearFormElementStylePayload",
          formElement: {
            __typename: "FormElement",
            secondaryColor: null,
            textVariant: FormElementTextVariant.Dynamic,
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
  function updateBaseSetting(settings: {
    showProgress?: boolean;
    showFacilitationOption?: boolean;
  }) {
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
            showFacilitationOption:
              "showFacilitationOption" in settings
                ? settings.showFacilitationOption!
                : data!.survey!.showFacilitationOption,
          },
          __typename: "UpdateSurveyPayload",
        },
      },
    });
  }

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

  const formElements = sortFormElements([
    ...(data?.survey?.form?.formElements || []),
  ]);

  let selectedFormElement: FormElementFullDetailsFragment | undefined;
  let selectedParentFormElement: FormElementFullDetailsFragment | null = null;
  for (const element of formElements) {
    if (element.sketchClass?.form?.formElements?.length) {
      for (const subElement of element.sketchClass.form.formElements) {
        if (subElement.id === formElementId) {
          selectedFormElement = subElement;
          selectedParentFormElement = element;
          break;
        }
      }
    }
    if (element.id === formElementId) {
      selectedFormElement = element;
    }
    if (selectedFormElement) {
      break;
    }
  }

  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
  }, [selectedFormElement?.id]);

  const style = useCurrentStyle(
    data?.survey?.form?.formElements,
    selectedFormElement,
    stage
  );

  let isDark = colord(style.backgroundColor || "#efefef").isDark();
  let dynamicTextClass = "text-white";
  dynamicTextClass = isDark ? "text-white" : "text-grey-800";

  const [updateElementSetting, updateComponentSetting] = useUpdateFormElement(
    selectedFormElement!
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
          href={`/${slug}/surveys/${surveyId}/0/practice`}
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
        <div className="bg-white w-56 shadow z-10">
          <div className="flex-1 overflow-y-auto flex flex-col min-h-full max-h-full">
            <nav className="px-2 mt-2">
              <div className="space-y-1">
                <Link
                  className={`${
                    route === "basic"
                      ? "bg-blue-100 text-black"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                      group flex items-center px-2 py-2 text-base leading-5 rounded-md w-full`}
                  aria-current={route === "basic" ? "page" : undefined}
                  to={"./basic"}
                >
                  <AdjustmentsIcon
                    className={`${
                      route === "basic"
                        ? "text-gray-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    }
                        mr-3 flex-shrink-0 h-6 w-6`}
                    aria-hidden="true"
                  />
                  {t("Base Settings")}
                </Link>
                <Link
                  className={`${
                    route === "logic"
                      ? "bg-blue-100 text-black"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                      group flex items-center px-2 py-2 text-base leading-5 rounded-md w-full`}
                  aria-current={route === "logic" ? "page" : undefined}
                  to={"./logic"}
                >
                  <ChevronDoubleDownIcon
                    className={`${
                      route === "logic"
                        ? "text-gray-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    }
                        mr-3 flex-shrink-0 h-6 w-6`}
                    aria-hidden="true"
                  />
                  {t("Skip Logic")}
                </Link>
              </div>
            </nav>
            <nav className="mt-2 bg-cool-gray-100 flex-1">
              <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-blue-gray-200 border items-center">
                <span className="flex-1">{t("Form Elements")}</span>
                <AddFormElementButton
                  formIsSketchClass={
                    !!(
                      selectedParentFormElement?.sketchClass?.form ||
                      selectedFormElement?.sketchClass
                    )
                  }
                  nextPosition={formElements.length + 1}
                  types={data?.formElementTypes || []}
                  formId={
                    selectedParentFormElement?.sketchClass?.form
                      ? selectedParentFormElement.sketchClass?.form?.id!
                      : selectedFormElement?.sketchClass
                      ? selectedFormElement.sketchClass.form!.id
                      : formId!
                  }
                  heading={
                    selectedParentFormElement?.sketchClass?.form ||
                    selectedFormElement?.sketchClass
                      ? t("Add to spatial input...")
                      : t("Add to survey...")
                  }
                  onAdd={(formElement) => history.replace(`./${formElement}`)}
                  existingTypes={formElements.map((el) => el.typeId)}
                />
              </h3>
              <SortableFormElementList
                dim={route === "logic"}
                selection={
                  route === "formElement" ? selectedFormElement?.id : undefined
                }
                items={formElements}
                onClick={(formElement) => history.replace(`./${formElement}`)}
                onReorder={(elementIds) => {
                  updateOrder({
                    variables: {
                      elementIds,
                    },
                    optimisticResponse: {
                      __typename: "Mutation",
                      setFormElementOrder: {
                        __typename: "SetFormElementOrderPayload",
                        formElements: elementIds.map((id, i) => ({
                          __typename: "FormElement",
                          id,
                          position: i + 1,
                        })),
                      },
                    },
                  });
                }}
              />
            </nav>
          </div>
        </div>
        {/* Content */}
        <div
          className="flex-1 h-full overflow-y-auto"
          style={{
            background:
              route !== "logic"
                ? "transparent"
                : "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACFJREFUKFNjXL58oxQDEYARpDAy0v8ZIbWjCvGGENHBAwCZWCYkLmgNZgAAAABJRU5ErkJggg==) repeat rgb(238 240 241)",
          }}
        >
          {route === "logic" && (
            <SurveyFlowMap
              primaryFormId={formId!}
              formElements={flattenedFormElements}
              onSelection={(selection) => {
                setSelectedLogicFormElements(selection);
              }}
              rules={flattenedRules}
            />
          )}
          {route === "formElement" && data?.survey && selectedFormElement && (
            <SurveyContext.Provider
              value={{
                isAdmin: true,
                isFacilitatedResponse: true,
                surveySupportsFacilitation: data.survey.showFacilitationOption,
                projectName: data.currentProject!.name,
                projectUrl: data.currentProject!.url!,
                projectBounds: bbox(data.currentProject!.region.geojson),
                surveyUrl: `${data.currentProject!.url!}/surveys/${
                  data.survey.id
                }`,
              }}
            >
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
                <SurveyButtonFooterPortalContext.Provider
                  value={surveyButtonFooter.current}
                >
                  <FormEditorPortalContext.Provider
                    value={{
                      container: formElementEditorContainerRef.current,
                      formElementSettings: selectedFormElement!,
                      surveyId: data.survey.id,
                    }}
                  >
                    {selectedFormElement && (
                      <>
                        {components[selectedFormElement.typeId].stages && (
                          <StageSelect
                            value={stage}
                            onChange={(n) => setStage(n)}
                            stages={
                              components[selectedFormElement.typeId].stages!
                            }
                          />
                        )}
                        <FormElementFactory
                          stage={stage}
                          onRequestStageChange={(n) => setStage(n)}
                          featureNumber={1}
                          {...selectedFormElement!}
                          sketchClass={
                            selectedParentFormElement?.sketchClass ||
                            selectedFormElement.sketchClass
                          }
                          isSpatial={!!selectedFormElement.type?.isSpatial}
                          onChange={(value) =>
                            setValues((prev) => ({
                              ...prev,
                              [selectedFormElement!.id]: value,
                            }))
                          }
                          onSubmit={() => null}
                          typeName={selectedFormElement!.typeId}
                          editable={true}
                          value={values[selectedFormElement.id]}
                          onRequestNext={() => null}
                          onRequestPrevious={() => null}
                        />
                        <div className="flex items-center mb-10 space-x-4">
                          {selectedFormElement.typeId !== "WelcomeMessage" &&
                            selectedFormElement.typeId !== "ThankYou" &&
                            !advancesAutomatically(selectedFormElement) &&
                            !components[selectedFormElement.typeId].stages && (
                              <Button
                                label={t("Next")}
                                backgroundColor={style.secondaryColor}
                              />
                            )}
                          <div ref={surveyButtonFooter}></div>
                        </div>
                      </>
                    )}
                  </FormEditorPortalContext.Provider>
                </SurveyButtonFooterPortalContext.Provider>
              </SurveyAppLayout>
            </SurveyContext.Provider>
          )}
        </div>
        {/* Right Sidebar */}
        <div
          className={`bg-white ${
            route === "logic" ? "w-72" : "w-64"
          } shadow overflow-y-auto`}
        >
          <>
            <h3 className="flex text-sm text-black bg-cool-gray-50 p-3 py-2 border-b border-blue-gray-200  items-center">
              {(() => {
                if (route === "basic") {
                  return t("Base Settings");
                } else if (route === "logic") {
                  if (selectedFormElement) {
                    return t("Skip Logic");
                    // return selectedFormElement?.type?.componentName;
                  } else {
                    return t("Skip Logic");
                  }
                } else {
                  return (
                    components[selectedFormElement?.typeId || ""]?.label || ""
                  );
                }
              })()}
            </h3>
            {route === "logic" && !selectedLogicFormElements.length && (
              <p className="text-sm p-2 text-gray-500">
                <Trans ns="admin:surveys">
                  Select an input element to skip ahead based on answers.
                </Trans>
              </p>
            )}
            {route === "logic" && selectedLogicFormElements.length > 0 && (
              <>
                <LogicRuleEditor
                  form={data!.survey!.form!}
                  selectedIds={selectedLogicFormElements}
                  rules={flattenedRules}
                  formElements={flattenedFormElements}
                />
              </>
            )}
            {route === "formElement" &&
              selectedFormElement &&
              selectedFormElement.type?.isInput &&
              selectedFormElement.typeId !== "FeatureName" &&
              selectedFormElement.typeId !== "SAPRange" && (
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
            <div className="text-sm" ref={formElementEditorContainerRef}>
              {route === "basic" && (
                <div className="p-3">
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
                </div>
              )}
            </div>
            {route === "formElement" &&
              selectedFormElement &&
              selectedFormElement.typeId !== "WelcomeMessage" &&
              selectedFormElement.typeId !== "ThankYou" &&
              selectedFormElement.typeId !== "FeatureName" &&
              selectedFormElement.typeId !== "SAPRange" && (
                <>
                  <div className="px-3 text-base">
                    {selectedFormElement.type?.isInput &&
                      !selectedFormElement.type?.isSpatial && (
                        <div className="pt-2">
                          <TextInput
                            label={t("Export ID")}
                            name="exportid"
                            description={t(
                              "Setting an export id will give a stable column name when exporting your results"
                            )}
                            value={selectedFormElement.exportId || ""}
                            onChange={updateElementSetting("exportId")}
                          />
                        </div>
                      )}
                    <Button
                      className="mt-4"
                      label={t("Delete Element")}
                      small
                      onClick={() => {
                        if (window.confirm(t("Are you sure?"))) {
                          const formElement = selectedFormElement!;
                          history.replace(`../${surveyId}/basic`);
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
          {route === "formElement" &&
            selectedFormElement &&
            !selectedFormElement.type?.isSpatial &&
            !selectedParentFormElement && (
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
                        id: selectedFormElement!.id,
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
                        <div
                          className="flex-1 h-12"
                          style={{
                            background: `url(${selectedFormElement.backgroundImage}&w=200) no-repeat center`,
                            backgroundSize: "cover",
                          }}
                        ></div>
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
                                    id: selectedFormElement!.id,
                                    backgroundColor: c,
                                  },
                                });
                              }}
                              className={`w-4 h-4 rounded-full shadow ${
                                selectedFormElement!.backgroundColor === c
                                  ? "ring"
                                  : ""
                              }`}
                              style={{ backgroundColor: c! }}
                            />
                          )
                        )}
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
                          return (
                            <button
                              key={c!.toString()}
                              onClick={() => {
                                updateBackground({
                                  variables: {
                                    id: selectedFormElement!.id,
                                    secondaryColor: c,
                                  },
                                });
                              }}
                              className={`w-4 h-4 rounded-full shadow ${
                                selectedFormElement!.secondaryColor === c
                                  ? "ring"
                                  : ""
                              }`}
                              style={{ backgroundColor: c! }}
                            />
                          );
                        })}
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
                                id: selectedFormElement!.id,
                                layout: FormElementLayout.Cover,
                              },
                            });
                          }}
                          className={`w-12 h-8 border rounded bg-cool-gray-600 flex flex-col justify-center space-y-1 shadow cursor-pointer ${
                            selectedFormElement.layout ===
                              FormElementLayout.Cover && "ring"
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
                                id: selectedFormElement!.id,
                                layout: FormElementLayout.Top,
                              },
                            });
                          }}
                          className={`w-12 h-8 border overflow-hidden rounded flex flex-col justify-center space-y-1 shadow cursor-pointer ${
                            selectedFormElement.layout ===
                              FormElementLayout.Top && "ring"
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
                                id: selectedFormElement!.id,
                                layout: FormElementLayout.Left,
                              },
                            });
                          }}
                          className={`w-12 h-8 border overflow-hidden rounded flex flex-row justify-center shadow cursor-pointer ${
                            selectedFormElement.layout ===
                              FormElementLayout.Left && "ring"
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
                                id: selectedFormElement!.id,
                                layout: FormElementLayout.Right,
                              },
                            });
                          }}
                          className={`w-12 h-8 border overflow-hidden rounded flex flex-row justify-center shadow cursor-pointer ${
                            selectedFormElement.layout ===
                              FormElementLayout.Right && "ring"
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
                          Note that on mobile phones and other small devices,
                          the top-image layout will be used if left or right
                          image layout is selected.
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
                              variables: { id: selectedFormElement!.id },
                            });
                          }}
                        />
                        <p className="text-sm text-gray-800 mt-2.5">
                          <Trans>
                            Removing style settings will mean that this page
                            will share the same appearance as previous pages.
                          </Trans>
                        </p>
                      </div>
                    )}
                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                      {t("Text color")}
                    </h4>
                    <div className="flex space-x-2">
                      <div
                        className={`relative w-12 h-8 shadow rounded text-center flex justify-center cursor-pointer items-center ${
                          style.textVariant ===
                            FormElementTextVariant.Dynamic && "ring"
                        }`}
                        style={{ backgroundColor: style.backgroundColor }}
                        onClick={() =>
                          updateBackground({
                            variables: {
                              id: selectedFormElement!.id,
                              textVariant: FormElementTextVariant.Dynamic,
                            },
                          })
                        }
                      >
                        <span
                          className={`font-bold text-lg ${dynamicTextClass}`}
                        >
                          {t("T", { ns: "no-translate" })}
                        </span>
                        <span className="absolute -bottom-5 text-xs">
                          {t("auto")}
                        </span>
                      </div>
                      <div
                        className={`relative w-12 h-8 shadow rounded text-center flex justify-center cursor-pointer items-center ${
                          style.textVariant === FormElementTextVariant.Light &&
                          "ring"
                        }`}
                        style={{ backgroundColor: style.backgroundColor }}
                        onClick={() =>
                          updateBackground({
                            variables: {
                              id: selectedFormElement!.id,
                              textVariant: FormElementTextVariant.Light,
                            },
                          })
                        }
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <span className={`font-bold text-lg text-white`}>
                          T
                        </span>
                        <span className="absolute -bottom-5 text-xs">
                          {t("light")}
                        </span>
                      </div>
                      <div
                        className={`relative w-12 h-8 shadow rounded text-center flex justify-center cursor-pointer items-center ${
                          style.textVariant === FormElementTextVariant.Dark &&
                          "ring"
                        }`}
                        style={{ backgroundColor: style.backgroundColor }}
                        onClick={() =>
                          updateBackground({
                            variables: {
                              id: selectedFormElement!.id,
                              textVariant: FormElementTextVariant.Dark,
                            },
                          })
                        }
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <span className={`font-bold text-lg text-grey-800`}>
                          T
                        </span>
                        <span className="absolute -bottom-5 text-xs">
                          {t("dark")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          {route === "basic" &&
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

function StageSelect({
  stages,
  onChange,
  value,
}: {
  stages: { [stage: number]: string };
  onChange: (n: number) => void;
  value: number;
}) {
  return (
    <div
      className="p-1 p1-2 left-1/2 bg-yellow-400 bg-opacity-60 text-black rounded absolute top-4 z-10 text-sm items-center mx-auto text-center"
      style={{ width: 460, marginLeft: -230 }}
    >
      <span className="mr-3">
        <Trans ns="admin:surveys">This element has multiple stages</Trans>
      </span>
      <select
        className="text-sm py-1 p1-2 pr-10 rounded bg-yellow-100"
        value={value.toString()}
        onChange={(e) => onChange(parseInt(e.target.value))}
      >
        {Object.keys(stages)
          .filter((key) => parseInt(key).toString() !== key)
          .map((label, i) => (
            <option value={i} key={label}>
              {label.replace("_", " ").toLowerCase()}
            </option>
          ))}
      </select>
    </div>
  );
}
