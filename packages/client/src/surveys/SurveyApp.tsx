import { useEffect, useRef, useState, useMemo } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  FormElementLayout,
  SurveyAppFormElementFragment,
  useCreateResponseMutation,
  useSurveyQuery,
} from "../generated/graphql";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import { useCurrentStyle } from "./appearance";
import ImagePreloader from "./ImagePreloader";
import SurveyAppLayout from "./SurveyAppLayout";
import FormElementFactory from "./FormElementFactory";
import Modal from "../components/Modal";
import { useAuth0 } from "@auth0/auth0-react";
import { Auth0User } from "../auth/Auth0User";
import {
  hideNav,
  SurveyButtonFooterPortalContext,
  SurveyContext,
} from "../formElements/FormElement";
import { sortFormElements } from "../formElements/sortFormElements";
import { components } from "../formElements";
import { getSurveyPagingState } from "./paging";
import { Title, Meta } from "react-head";
import { useLocalForage } from "../useLocalForage";
import useMobileDeviceDetector from "./useMobileDeviceDetector";
import bbox from "@turf/bbox";
import SurveyNavigationButton from "./SurveyNavigationButtons";
import languages from "../lang/supported";
import SurveyContextualMap from "./SurveyContextualMap";
import { ProjectAccessGate } from "../auth/ProjectAccessGate";

require("./surveys.css");

interface FormElementState {
  touched?: boolean;
  value: any;
  errors: boolean;
  submissionAttempted?: boolean;
}

/**
 * Coordinates the rendering of FormElements, collection of user data, maintenance of response state,
 * and navigation among states. Acts as a "controller" while delegating responsibility for data
 * validation and input rendering to FormElements.
 */
function SurveyApp() {
  const { surveyId, position, practice, slug } =
    useParams<{
      surveyId: string;
      position: string;
      practice?: string;
      slug: string;
    }>();
  const { t, i18n } = useTranslation("surveys");

  let language = languages.find((lang) => lang.code === "EN")!;
  language = languages.find((lang) => lang.code === i18n.language) || language;

  const history = useHistory();
  const auth0 = useAuth0<Auth0User>();

  const [backwards, setBackwards] = useState(false);
  const onError = useGlobalErrorHandler();
  const { data } = useSurveyQuery({
    variables: { id: parseInt(surveyId), slug },
    onError,
    // This could help improve resilience of the app when working offline with a stale cache
    // ref: https://github.com/apollographql/apollo-cache-persist/issues/323
    // returnPartialData: true,
  });
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);

  const isMobile = useMobileDeviceDetector();
  const [createResponse, createResponseState] = useCreateResponseMutation();
  const [formElement, setFormElement] = useState<{
    current?: SurveyAppFormElementFragment;
    exiting?: SurveyAppFormElementFragment;
  }>({});

  /**
   * Update response state for just the given FormElement. Partial state can be supplied to be
   * applied to previous state.
   * @param formElement
   * @param state
   */
  async function updateState(
    formElement: { id: number },
    state: Partial<FormElementState>
  ) {
    return setResponseState((prev) => {
      return {
        ...prev,
        [formElement.id]: {
          ...prev[formElement.id],
          ...state,
        },
      };
    });
  }

  /**
   * Whether user should be allowed to proceed to the next page based on input
   * and validation state
   * @returns boolean
   */
  function canAdvance() {
    if (!formElement.current) {
      return false;
    }
    const state = responseState[formElement.current.id];
    if (formElement.current.isRequired) {
      return state?.value !== undefined && !state?.errors;
    } else {
      return !state?.errors;
    }
  }

  let index = 0;
  if (position) {
    index = parseInt(position);
  }

  const elements = sortFormElements(data?.survey?.form?.formElements || []);

  const [responseState, setResponseState] = useLocalForage<{
    [id: number]: FormElementState;
    facilitated: boolean;
    submitted: boolean;
  }>(
    // eslint-disable-next-line i18next/no-literal-string
    `survey-${surveyId}`,
    { facilitated: false, submitted: false }
  );

  const [stage, setStage] = useState(0);
  // useEffect(() => {
  //   let stage = 0;
  //   if (
  //     formElement.current &&
  //     typeof components[formElement.current?.typeId].getInitialStage ===
  //       "function"
  //   ) {
  //     stage = components[formElement.current.typeId].getInitialStage!(
  //       responseState[formElement.current.id].value,
  //       formElement.current.componentSettings
  //     );
  //   }
  //   setStage(stage);
  // }, [formElement.current]);

  const pagingState = useMemo(() => {
    if (data?.survey?.form?.logicRules) {
      return getSurveyPagingState(
        index,
        elements,
        data.survey.form.logicRules || [],
        Object.keys(responseState).reduce((answers, id) => {
          if (id !== "facilitated" && id !== "submitted") {
            const n = parseInt(id);
            answers[n] = responseState[n].value;
          }
          return answers;
        }, {} as { [formElementId: number]: any })
      );
    } else {
      return null;
    }
  }, [index, data?.survey?.form?.logicRules, elements, responseState]);
  const [autoAdvance, setAutoAdvance] = useState(false);

  async function handleAdvance(e?: any) {
    updateState(formElement.current!, {
      submissionAttempted: true,
    });
    if (canAdvance() || e?.force) {
      if (pagingState?.isLastQuestion) {
        setFormElement((prev) => ({ ...prev, exiting: prev.current }));
        window.scrollTo(0, 0);
        history.push(
          // eslint-disable-next-line i18next/no-literal-string
          `/${slug}/surveys/${surveyId}/${elements.indexOf(
            pagingState.nextFormElement!
          )}/${practice ? "practice" : ""}`
        );
      } else if (pagingState) {
        setFormElement((prev) => ({ ...prev, exiting: prev.current }));
        window.scrollTo(0, 0);
        history.push(
          // eslint-disable-next-line i18next/no-literal-string
          `/${slug}/surveys/${surveyId}/${elements.indexOf(
            pagingState.nextFormElement!
          )}/${practice ? "practice" : ""}`
        );
      } else {
        throw new Error("Unknown paging state");
      }
    }
  }

  useEffect(() => {
    if (pagingState && autoAdvance) {
      handleAdvance(pagingState);
      setAutoAdvance(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance, pagingState]);

  const surveyButtonFooter = useRef<HTMLDivElement>(null);

  const style = useCurrentStyle(
    elements,
    formElement.exiting || formElement.current,
    stage
  );

  useEffect(() => {
    if (surveyId && elements.length) {
      const el = elements[parseInt(position)];
      let stage = 0;
      if (components[el.typeId].getInitialStage) {
        stage = components[el.typeId].getInitialStage!(
          responseState[el.id]?.value,
          el.componentSettings
        );
      }
      setStage(stage);
      if (!formElement.current || el.id === formElement.current.id) {
        setFormElement({ current: el });
      } else {
        setFormElement({ exiting: formElement.current, current: el });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.survey?.form?.formElements, position, surveyId]);

  if (!data?.survey?.form?.formElements || !pagingState) {
    return <div></div>;
  } else if (!data?.survey) {
    return <div>{t("Survey not found")}</div>;
  } else if (!formElement.current) {
    return null;
  } else {
    const pagingState = getSurveyPagingState(
      index,
      elements,
      data.survey.form.logicRules || [],
      Object.keys(responseState).reduce((answers, id) => {
        if (id !== "facilitated" && id !== "submitted") {
          const n = parseInt(id);
          answers[n] = responseState[n].value;
        }
        return answers;
      }, {} as { [formElementId: number]: any })
    );

    const state = responseState[formElement.current.id];
    /* Last (question) page. True last page is ThankYou */
    const lastPage = index === elements.length - 2;

    const currentValue = responseState[formElement.current.id]?.value;
    return (
      <>
        <ProjectAccessGate>
          <SurveyContext.Provider
            value={{
              slug: slug,
              surveyId: data.survey.id,
              lang: language,
              setLanguage: (code: string) => {
                const lang = languages.find((lang) => lang.code === code);
                if (!lang) {
                  throw new Error(`Unrecognized language ${code}`);
                }
                i18n.changeLanguage(lang.code);
              },
              practiceMode: !!practice,
              togglePracticeMode: (enable) => {
                if (enable) {
                  history.replace(
                    `/${slug}/surveys/${surveyId}/${index}/practice`
                  );
                } else {
                  history.replace(`/${slug}/surveys/${surveyId}/${index}/`);
                }
              },
              toggleFacilitation: (enable) =>
                setResponseState((prev) => ({
                  ...prev,
                  facilitated: enable,
                })),
              supportedLanguages:
                (data.survey?.supportedLanguages as string[]) || [],
              isAdmin: !!data.me?.isAdmin,
              isFacilitatedResponse: responseState.facilitated,
              surveySupportsFacilitation: !!data.survey.showFacilitationOption,
              projectName: data.currentProject!.name,
              projectBounds: bbox(data.currentProject!.region.geojson),
              projectUrl: data.currentProject!.url!,
              surveyUrl: `${data.currentProject!.url!}surveys/${surveyId}`,
              bestEmail: data.me?.profile?.email || auth0.user?.email,
              bestName: data.me?.profile?.fullname || auth0.user?.name,
              savingResponse: createResponseState.loading,
              resetResponse: async () => {
                await setResponseState((prev) => ({
                  // eslint-disable-next-line i18next/no-literal-string
                  facilitated: false,
                  submitted: false,
                }));
                history.push(
                  // eslint-disable-next-line i18next/no-literal-string
                  `/${slug}/surveys/${surveyId}/`
                );
                return;
              },
              saveResponse: async () => {
                const responseData: { [elementId: number]: any } = {};
                for (const element of elements.filter((e) => e.type!.isInput)) {
                  responseData[element.id] = responseState[element.id]?.value;
                }
                const response = await createResponse({
                  variables: {
                    surveyId: data!.survey!.id,
                    isDraft: false,
                    bypassedDuplicateSubmissionControl: false,
                    facilitated: !!responseState.facilitated,
                    responseData,
                    practice: !!practice,
                  },
                  onError: () => {
                    // avoid unhandled rejection errors
                  },
                });
                if (response && !response.errors) {
                  // setFormElement((prev) => ({ ...prev, exiting: prev.current }));
                  await setResponseState((prev) => ({
                    ...prev,
                    submitted: true,
                  }));
                  // window.scrollTo(0, 0);
                  // history.push(
                  //   // eslint-disable-next-line i18next/no-literal-string
                  //   `/${slug}/surveys/${surveyId}/${elements.indexOf(
                  //     pagingState.nextFormElement!
                  //   )}/${practice ? "practice" : ""}`
                  // );
                  // // setResponseState({ facilitated: false, submitted: false });
                }

                return response;
              },
            }}
          >
            <Title>{data.survey.name}</Title>
            <Meta name="theme-color" content={style.backgroundColor} />

            <SurveyAppLayout
              navigatingBackwards={backwards}
              showProgress={data.survey.showProgress}
              progress={index / elements.length}
              style={style}
              unsplashUserName={style.unsplashAuthorName}
              unsplashUserUrl={style.unsplashAuthorUrl}
              practice={!!practice}
              onPracticeClick={() => {
                setPracticeModalOpen(true);
              }}
              navigation={
                <SurveyNavigationButton
                  hidden={hideNav(
                    components[formElement.current!.typeId],
                    formElement.current.componentSettings,
                    isMobile,
                    stage,
                    style.layout
                  )}
                  slug={slug}
                  surveyId={surveyId}
                  practice={practice}
                  pagingState={pagingState}
                  canAdvance={canAdvance()}
                  onPrev={() => setBackwards(true)}
                  onNext={(e) => {
                    handleAdvance();
                    if (!canAdvance()) {
                      e.preventDefault();
                    }
                  }}
                />
              }
            >
              <AnimatePresence
                initial={false}
                exitBeforeEnter={true}
                custom={backwards}
                // @ts-ignore
                presenceAffectsLayout={false}
                onExitComplete={() => {
                  setBackwards(false);
                  setFormElement((prev) => ({
                    ...prev,
                    exiting: undefined,
                  }));
                }}
              >
                <motion.div
                  custom={backwards}
                  className="relative"
                  variants={{
                    exit: (direction: boolean) => ({
                      opacity: 0,
                      translateY: direction ? 100 : -100,
                      position: "relative",
                    }),
                    enter: (direction: boolean) => ({
                      opacity: 0,
                      translateY: direction ? -100 : 100,
                      position: "relative",
                    }),
                    show: () => ({
                      opacity: 1,
                      translateY: 0,
                      position: "relative",
                    }),
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                  key={`${formElement.current.id}`}
                  initial="enter"
                  animate="show"
                  exit="exit"
                >
                  <SurveyButtonFooterPortalContext.Provider
                    value={surveyButtonFooter.current}
                  >
                    <FormElementFactory
                      onRequestStageChange={(n) => setStage(n)}
                      stage={stage}
                      featureNumber={1}
                      isLastQuestion={lastPage}
                      isSpatial={formElement.current?.type?.isSpatial || false}
                      {...formElement.current}
                      typeName={formElement.current.typeId}
                      submissionAttempted={!!state?.submissionAttempted}
                      onChange={(value, errors, advanceAutomatically) => {
                        if (formElement.current?.typeId === "WelcomeMessage") {
                          setResponseState((prev) => ({
                            submitted: false,
                            facilitated: !!responseState.facilitated,
                          }));
                          if (practice) {
                            history.push(
                              `/${slug}/surveys/${surveyId}/1/practice`
                            );
                          } else {
                            history.push(`/${slug}/surveys/${surveyId}/1`);
                          }
                        } else {
                          updateState(formElement.current!, {
                            value,
                            errors,
                          }).then(() => {
                            if (advanceAutomatically) {
                              setTimeout(() => {
                                setAutoAdvance(true);
                              }, 500);
                            }
                          });
                        }
                      }}
                      onSubmit={handleAdvance}
                      editable={false}
                      value={state?.value}
                      onRequestNext={() => handleAdvance({ force: true })}
                      onRequestPrevious={() => {
                        setBackwards(true);
                        const url = `/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
                          pagingState.previousFormElement!
                        )}/${practice ? "practice" : ""}`;
                        history.push(url);
                      }}
                    />
                  </SurveyButtonFooterPortalContext.Provider>
                  {!formElement.current?.type?.isSpatial &&
                    !components[formElement.current?.typeId].hideNav &&
                    (!advancesAutomatically(formElement.current) ||
                      !formElement.current.isRequired) && (
                      <div
                        className={`${
                          createResponseState.loading ||
                          createResponseState.error ||
                          (!formElement.exiting &&
                            (state?.value !== undefined ||
                              !formElement.current.isRequired) &&
                            formElement.current.typeId !== "WelcomeMessage" &&
                            !state?.errors)
                            ? "opacity-100 transition-opacity duration-300"
                            : "opacity-0"
                        }`}
                      >
                        <Button
                          className="mb-10"
                          label={
                            pagingState.isLastQuestion
                              ? t("Complete Submission")
                              : currentValue === undefined ||
                                currentValue === null ||
                                currentValue === ""
                              ? formElement.current.isInput
                                ? t("Skip Question")
                                : t("Next")
                              : t("Next")
                          }
                          onClick={handleAdvance}
                          disabled={
                            createResponseState.loading || !!formElement.exiting
                          }
                          loading={createResponseState.loading}
                          backgroundColor={style.secondaryColor}
                        />
                        <span ref={surveyButtonFooter} className="ml-2"></span>
                      </div>
                    )}
                </motion.div>
              </AnimatePresence>
              {/* {!hideNav(
              components[formElement.current!.typeId],
              formElement.current.componentSettings,
              isMobile,
              0
            ) && (
              <SurveyNav
                style={style}
                pagingState={pagingState}
                canAdvance={canAdvance()}
                onPrev={() => setBackwards(true)}
                slug={slug}
                surveyId={surveyId}
                practice={practice}
                onNext={(e) => {
                  handleAdvance();
                  if (!canAdvance()) {
                    e.preventDefault();
                  }
                }}
              />
            )} */}
              {(style.layout === FormElementLayout.MapSidebarLeft ||
                style.layout === FormElementLayout.MapSidebarRight ||
                style.layout === FormElementLayout.MapTop ||
                style.layout === FormElementLayout.MapFullscreen) &&
                !formElement.current.type?.isSpatial && (
                  <SurveyContextualMap
                    isSmall={style.isSmall}
                    displayShowMapButton={
                      style.layout === FormElementLayout.MapTop
                    }
                    displayHideMapButton={stage === 1}
                    onRequestStageChange={setStage}
                    hideControls={style.layout === FormElementLayout.MapTop}
                    basemaps={(style.mapBasemaps as number[] | undefined) || []}
                    cameraOptions={style.mapCameraOptions}
                  />
                )}
            </SurveyAppLayout>
            <Modal
              open={practiceModalOpen}
              onRequestClose={() => setPracticeModalOpen(false)}
              title={t("Practice Mode")}
              footer={
                <div className="space-x-1 rtl:space-x-reverse text-center md:text-right space-y-2 md:space-y-0">
                  <Button
                    label={
                      practice
                        ? t("Continue Practice Mode")
                        : t("Enable Practice Mode")
                    }
                    onClick={() => {
                      setPracticeModalOpen(false);
                      history.replace(
                        `/${slug}/surveys/${surveyId}/${index}/practice`
                      );
                    }}
                  />
                  <Button
                    primary
                    label={t("Count My Response")}
                    onClick={() => {
                      setPracticeModalOpen(false);
                      history.replace(`/${slug}/surveys/${surveyId}/${index}/`);
                    }}
                  />
                </div>
              }
            >
              <Trans ns="surveys">
                Practice mode saves your responses seperately so that they are
                not counted in the survey results.
              </Trans>
            </Modal>
            <ImagePreloader formElements={elements} />
          </SurveyContext.Provider>
        </ProjectAccessGate>
      </>
    );
  }
}

export function advancesAutomatically(
  formElement: SurveyAppFormElementFragment
): boolean {
  let advanceAutomatically = false;
  if (
    formElement &&
    components[formElement.typeId].advanceAutomatically !== undefined
  ) {
    const aa = components[formElement.typeId].advanceAutomatically;
    if (typeof aa === "function") {
      advanceAutomatically = aa(formElement.componentSettings);
    } else {
      advanceAutomatically = aa || false;
    }
  }
  // return false;
  return advanceAutomatically;
}
export default SurveyApp;
