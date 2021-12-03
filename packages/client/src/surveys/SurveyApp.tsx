import { MouseEventHandler, useEffect, useRef, useState, useMemo } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  FormElementLayout,
  SurveyAppFormElementFragment,
  SurveyAppRuleFragment,
  useCreateResponseMutation,
  useSurveyQuery,
} from "../generated/graphql";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import UpArrowIcon from "../components/UpArrowIcon";
import DownArrowIcon from "../components/DownArrowIcon";
import useLocalStorage from "../useLocalStorage";
import {
  ComputedFormElementStyle,
  FormElementStyleProps,
  useCurrentStyle,
} from "./appearance";
import ImagePreloader from "./ImagePreloader";
import SurveyAppLayout from "./SurveyAppLayout";
import FormElementFactory from "./FormElementFactory";
import Modal from "../components/Modal";
import { useAuth0 } from "@auth0/auth0-react";
import { Auth0User } from "../auth/Auth0User";
import {
  hideNav,
  sortFormElements,
  SurveyButtonFooterPortalContext,
  SurveyContext,
} from "../formElements/FormElement";
import { components } from "../formElements";
import { getSurveyPagingState, SurveyPagingState } from "./paging";
import {
  collectHeaders,
  collectQuestion,
  collectText,
} from "../admin/surveys/collectText";
import { HeadProvider, Title, Meta } from "react-head";
import { colord } from "colord";
import { useLocalForage } from "../useLocalForage";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import useMobileDeviceDetector from "./useMobileDeviceDetector";
import bbox from "@turf/bbox";
import { LngLatBoundsLike } from "mapbox-gl";

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
  const { surveyId, position, practice, slug } = useParams<{
    surveyId: string;
    position: string;
    practice?: string;
    slug: string;
  }>();
  const { t } = useTranslation("surveys");
  const history = useHistory();
  const auth0 = useAuth0<Auth0User>();

  const [backwards, setBackwards] = useState(false);
  const onError = useGlobalErrorHandler();
  const { data, loading } = useSurveyQuery({
    variables: { id: parseInt(surveyId) },
    onError,
  });
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);

  const isMobile = useMobileDeviceDetector();
  const [createResponse, createResponseState] = useCreateResponseMutation({
    onError,
  });
  const [formElement, setFormElement] = useState<{
    current?: SurveyAppFormElementFragment;
    exiting?: SurveyAppFormElementFragment;
  }>({});

  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
  }, [formElement.current]);

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
    if (
      !formElement.current.isRequired ||
      (state?.value !== undefined && !state?.errors)
    ) {
      return true;
    } else {
      return false;
    }
  }

  let index = 0;
  if (position) {
    index = parseInt(position);
  }

  const elements = sortFormElements(data?.survey?.form?.formElements || []);

  // const [responseState, setResponseState] = useLocalStorage<{
  //   [id: number]: FormElementState;
  //   facilitated: boolean;
  //   submitted: boolean;
  // }>(
  //   // eslint-disable-next-line i18next/no-literal-string
  //   `survey-${surveyId}`,
  //   { facilitated: false, submitted: false }
  // );

  const [responseState, setResponseState] = useLocalForage<{
    [id: number]: FormElementState;
    facilitated: boolean;
    submitted: boolean;
  }>(
    // eslint-disable-next-line i18next/no-literal-string
    `survey-${surveyId}`,
    { facilitated: false, submitted: false }
  );

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
    if (canAdvance()) {
      if (pagingState?.isLastQuestion) {
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
        });
        if (response && !response.errors) {
          setFormElement((prev) => ({ ...prev, exiting: prev.current }));
          await setResponseState((prev) => ({ ...prev, submitted: true }));
          window.scrollTo(0, 0);
          history.push(
            // eslint-disable-next-line i18next/no-literal-string
            `/${slug}/surveys/${surveyId}/${elements.indexOf(
              pagingState.nextFormElement!
            )}/${practice ? "practice" : ""}`
          );
          setResponseState({ facilitated: false, submitted: false });
        } else {
        }
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
  }, [autoAdvance, pagingState]);

  const surveyButtonFooter = useRef<HTMLDivElement>(null);

  const style = useCurrentStyle(
    data?.survey?.form?.formElements,
    formElement.exiting || formElement.current
  );

  useEffect(() => {
    if (surveyId && elements.length) {
      const el = elements[parseInt(position)];
      if (!formElement.current) {
        setFormElement({ current: el });
      } else if (el.id === formElement.current.id) {
        setFormElement({ current: el });
      } else {
        setFormElement({ exiting: formElement.current, current: el });
      }
    }
  }, [data?.survey?.form?.formElements, position, surveyId]);

  if (!data?.survey?.form?.formElements || !pagingState || loading) {
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
        <SurveyContext.Provider
          value={{
            isAdmin: !!data.me?.isAdmin,
            isFacilitatedResponse: responseState.facilitated,
            surveySupportsFacilitation: !!data.survey.showFacilitationOption,
            projectName: data.currentProject!.name,
            projectBounds: bbox(data.currentProject!.region),
            projectUrl: data.currentProject!.url!,
            surveyUrl: `${data.currentProject!.url!}surveys/${surveyId}`,
            bestEmail: data.me?.profile?.email || auth0.user?.email,
            bestName: data.me?.profile?.fullname || auth0.user?.name,
          }}
        >
          <Title>{data.survey.name}</Title>
          <Meta name="theme-color" content={style.backgroundColor} />

          <SurveyAppLayout
            showProgress={data.survey.showProgress}
            progress={index / elements.length}
            style={style}
            unsplashUserName={style.unsplashAuthorName}
            unsplashUserUrl={style.unsplashAuthorUrl}
            practice={!!practice}
            onPracticeClick={() => {
              setPracticeModalOpen(true);
            }}
          >
            <AnimatePresence
              initial={false}
              exitBeforeEnter={true}
              custom={backwards}
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
                key={formElement.current.id}
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
                    isSpatial={formElement.current?.type?.isSpatial || false}
                    {...formElement.current}
                    typeName={formElement.current.typeId}
                    submissionAttempted={!!state?.submissionAttempted}
                    onChange={(value, errors) => {
                      if (formElement.current?.typeId === "WelcomeMessage") {
                        switch (
                          (value as { dropdownSelection?: string })
                            .dropdownSelection
                        ) {
                          case "BEGIN":
                            setResponseState((prev) => ({
                              ...prev,
                              facilitated: false,
                            }));
                            history.push(`/${slug}/surveys/${surveyId}/1`);
                            break;
                          case "FACILITATED":
                            setResponseState((prev) => ({
                              ...prev,
                              facilitated: true,
                            }));
                            history.push(`/${slug}/surveys/${surveyId}/1`);
                            break;
                          case "PRACTICE":
                            history.push(
                              `/${slug}/surveys/${surveyId}/1/practice`
                            );
                            setResponseState((prev) => ({
                              ...prev,
                              facilitated: false,
                            }));
                            break;
                          case "EDIT":
                            history.push(`/${slug}/survey-editor/${surveyId}`);
                            break;
                          case "RESPONSES":
                            history.push(`/${slug}/admin/surveys/${surveyId}`);
                        }
                      } else {
                        updateState(formElement.current!, {
                          value,
                          errors,
                        }).then(() => {
                          if (
                            advancesAutomatically(formElement.current!) &&
                            (value || !formElement.current?.isRequired)
                          ) {
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
                    onRequestNext={handleAdvance}
                    onRequestPrevious={() => {
                      setBackwards(true);
                      const url = `/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
                        pagingState.previousFormElement!
                      )}/${practice ? "practice" : ""}`;
                      history.push(url);
                    }}
                  />
                </SurveyButtonFooterPortalContext.Provider>
                {(createResponseState.loading ||
                  (!formElement.current?.type?.isSpatial &&
                    formElement.current?.typeId !== "ThankYou" &&
                    formElement.current?.typeId !== "WelcomeMessage" &&
                    (!advancesAutomatically(formElement.current) ||
                      !formElement.current.isRequired))) && (
                  <div
                    className={`${
                      createResponseState.loading ||
                      createResponseState.error ||
                      (!formElement.exiting &&
                        (!!state?.value || !formElement.current.isRequired) &&
                        formElement.current.typeId !== "WelcomeMessage" &&
                        !state?.errors)
                        ? "opacity-100 transition-opacity duration-300"
                        : "opacity-0"
                    }`}
                  >
                    <Button
                      className="mb-10"
                      label={
                        pagingState.isLastQuestion && !!!formElement.exiting
                          ? t("Complete Submission")
                          : currentValue === undefined || currentValue === null
                          ? t("Skip Question")
                          : createResponseState.loading
                          ? t("Submitting")
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
            {!hideNav(
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
            )}
          </SurveyAppLayout>
          <Modal
            open={practiceModalOpen}
            onRequestClose={() => setPracticeModalOpen(false)}
            title={t("Practice Mode")}
            footer={
              <div className="space-x-1 text-center md:text-right space-y-2 md:space-y-0">
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
              Practice mode saves your responses seperately so that they are not
              counted in the survey results.
            </Trans>
          </Modal>
          <ImagePreloader formElements={elements} />
        </SurveyContext.Provider>
      </>
    );
  }
}

function SurveyNav({
  pagingState,
  onNext,
  onPrev,
  slug,
  surveyId,
  canAdvance,
  practice,
  style,
}: {
  canAdvance: boolean;
  onNext: MouseEventHandler<HTMLAnchorElement>;
  onPrev: MouseEventHandler<HTMLAnchorElement>;
  slug: string;
  surveyId: string;
  practice?: string;
  pagingState: SurveyPagingState<SurveyAppFormElementFragment>;
  style: ComputedFormElementStyle;
}) {
  const { t } = useTranslation("surveys");
  let position =
    "bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-10";
  switch (style.layout) {
    case FormElementLayout.Right:
      position =
        "bottom-3 right-3 md:right-1/2 md:bottom-6 md:pr-4 lg:bottom-10 lg:pr-8";
      break;
    case FormElementLayout.MapStacked:
      position =
        "bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-5";
      break;
    default:
      break;
  }
  return (
    <div
      style={{
        width: "fit-content",
        height: "fit-content",
      }}
      className={`z-20 fixed flex ${position} ${style.secondaryTextClass} ${
        !pagingState.previousFormElement && "hidden"
      }`}
    >
      {pagingState.previousFormElement && (
        <Link
          title={t("Previous Question")}
          onClick={onPrev}
          to={`/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
            pagingState.previousFormElement
          )}/${practice ? "practice" : ""}`}
          className={`inline-block border-r shadow border-${style.secondaryTextClass.replace(
            "text-",
            ""
          )} border-opacity-10 opacity-95 hover:opacity-100 p-2 rounded-l`}
          style={{
            background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
          }}
        >
          <ChevronUpIcon className="w-6 h-6" />
        </Link>
      )}
      {!pagingState.isLastQuestion && (
        <Link
          title={t("Next Question")}
          onClick={onNext}
          className={`inline-flex items-center p-2 shadow rounded-r ${
            !canAdvance
              ? "opacity-50 cursor-default"
              : "opacity-95 hover:opacity-100"
          }`}
          to={`/${slug}/surveys/${surveyId}/${pagingState.sortedFormElements.indexOf(
            pagingState.nextFormElement!
          )}/${practice ? "practice" : ""}`}
          style={{
            background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
          }}
        >
          <ChevronDownIcon className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
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
