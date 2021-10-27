import { MouseEventHandler, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  FormElement,
  useCreateResponseMutation,
  useSurveyQuery,
} from "../generated/graphql";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import UpArrowIcon from "../components/UpArrowIcon";
import DownArrowIcon from "../components/DownArrowIcon";
import useLocalStorage from "../useLocalStorage";
import { FormElementStyleProps, useCurrentStyle } from "./appearance";
import ImagePreloader from "./ImagePreloader";
import SurveyAppLayout from "./SurveyAppLayout";
import FormElementFactory from "./FormElementFactory";
import Modal from "../components/Modal";
import { useAuth0 } from "@auth0/auth0-react";
import { Auth0User } from "../auth/Auth0User";
require("./surveys.css");

interface FormElementState {
  touched?: boolean;
  value: any;
  errors: boolean;
  submissionAttempted?: boolean;
}

type FE = Pick<
  FormElement,
  | "typeId"
  | "id"
  | "isRequired"
  | "position"
  | "unsplashAuthorName"
  | "unsplashAuthorUrl"
  | "body"
  | "componentSettings"
> &
  FormElementStyleProps;

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

  const [createResponse, createResponseState] = useCreateResponseMutation({
    onError,
  });
  const [formElement, setFormElement] = useState<{
    current?: FE;
    exiting?: FE;
  }>({});

  const style = useCurrentStyle(
    data?.survey?.form?.formElements,
    formElement.exiting || formElement.current
  );

  useEffect(() => {
    if (surveyId && data?.survey?.form?.formElements) {
      const el = data.survey.form.formElements[parseInt(position)];
      if (!formElement.current) {
        setFormElement({ current: el });
      } else if (el.id === formElement.current.id) {
        setFormElement({ current: el });
      } else {
        setFormElement({ exiting: formElement.current, current: el });
      }
    }
  }, [data?.survey?.form?.formElements, position, surveyId]);

  const [responseState, setResponseState] = useLocalStorage<{
    [id: number]: FormElementState;
    // eslint-disable-next-line i18next/no-literal-string
  }>(
    // eslint-disable-next-line i18next/no-literal-string
    `survey-${surveyId}`,
    {}
  );

  if (!data?.survey?.form?.formElements || loading) {
    return <div></div>;
  } else if (!data?.survey) {
    return <div>{t("Survey not found")}</div>;
  } else if (!formElement.current) {
    return null;
  } else {
    const form = data.survey.form;
    let index = 0;
    if (position) {
      index = parseInt(position);
    }
    const elements = form.formElements || [];
    const state = responseState[formElement.current.id];
    const lastPage = index === elements.length - 1;

    /**
     * Update response state for just the given FormElement. Partial state can be supplied to be
     * applied to previous state.
     * @param formElement
     * @param state
     */
    function updateState(
      formElement: { id: number },
      state: Partial<FormElementState>
    ) {
      setResponseState((prev) => {
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
      if (!formElement.current.isRequired || (state?.value && !state?.errors)) {
        return true;
      } else {
        return false;
      }
    }

    async function handleAdvance(e?: any) {
      updateState(formElement.current!, {
        submissionAttempted: true,
      });
      if (canAdvance() || e?.advanceAutomatically) {
        setFormElement((prev) => ({ ...prev, exiting: prev.current }));
        if (lastPage) {
          const responseData: { [elementId: number]: any } = {};
          for (const element of elements.filter((e) => e.type!.isInput)) {
            responseData[element.id] = responseState[element.id]?.value;
          }
          const response = await createResponse({
            variables: {
              surveyId: data!.survey!.id,
              isDraft: false,
              bypassedDuplicateSubmissionControl: false,
              facilitated: false,
              responseData,
              practice: !!practice,
            },
          });
          if (response && !response.errors) {
            setResponseState({});
            history.push(
              // eslint-disable-next-line i18next/no-literal-string
              `/${slug}/surveys/${surveyId}/0/${practice ? "practice" : ""}`
            );
          }
        } else {
          history.push(
            // eslint-disable-next-line i18next/no-literal-string
            `/${slug}/surveys/${surveyId}/${index + 1}/${
              practice ? "practice" : ""
            }`
          );
        }
      }
    }

    const currentValue = responseState[formElement.current.id]?.value;

    return (
      <>
        <SurveyAppLayout
          showProgress={data.survey.showProgress}
          progress={index / elements.length}
          style={style}
          unsplashUserName={formElement.current.unsplashAuthorName || undefined}
          unsplashUserUrl={formElement.current.unsplashAuthorUrl || undefined}
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
              <FormElementFactory
                isAdmin={
                  !!(
                    data.me?.isAdmin ||
                    auth0.user?.["https://seasketch.org/superuser"]
                  )
                }
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
                        history.push(`/${slug}/surveys/${surveyId}/1`);
                        break;
                      case "PRACTICE":
                        history.push(`/${slug}/surveys/${surveyId}/1/practice`);
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
                    });
                    // TODO: add something into the form_element_types schema and integrate w/client
                    // if (advanceAutomatically) {
                    //   setTimeout(() => {
                    //     handleAdvance({ advanceAutomatically: true });
                    //   }, 500);
                    // }
                  }
                }}
                onSubmit={handleAdvance}
                editable={false}
                value={state?.value}
              />

              <div
                className={`${
                  !formElement.exiting &&
                  (!!state?.value || !formElement.current.isRequired) &&
                  formElement.current.typeId !== "WelcomeMessage" &&
                  !state?.errors
                    ? "opacity-100 transition-opacity duration-300"
                    : "opacity-0"
                }`}
              >
                <Button
                  className="mb-10"
                  label={
                    lastPage && !!!formElement.exiting
                      ? t("Complete Submission")
                      : currentValue === undefined
                      ? t("Skip Question")
                      : t("Next")
                  }
                  onClick={handleAdvance}
                  disabled={
                    createResponseState.loading || !!formElement.exiting
                  }
                  loading={createResponseState.loading}
                  backgroundColor={style.secondaryColor}
                />
              </div>
            </motion.div>
          </AnimatePresence>
          <SurveyNav
            canAdvance={canAdvance()}
            buttonColor={style.secondaryColor}
            lastPage={parseInt(position) + 1 === elements.length}
            index={parseInt(position)}
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
      </>
    );
  }
}

function SurveyNav({
  lastPage,
  buttonColor,
  onNext,
  onPrev,
  index,
  slug,
  surveyId,
  canAdvance,
  practice,
}: {
  canAdvance: boolean;
  lastPage: boolean;
  buttonColor: string;
  onNext: MouseEventHandler<HTMLAnchorElement>;
  onPrev: MouseEventHandler<HTMLAnchorElement>;
  index: number;
  slug: string;
  surveyId: string;
  practice?: string;
}) {
  return (
    <div
      style={{ width: "fit-content", height: "fit-content" }}
      className={`z-20 fixed bottom-3 right-3 lg:left-2 ${
        practice ? "lg:top-8" : "lg:top-5"
      } ${index === 0 && "hidden"}`}
    >
      <Link
        onClick={onPrev}
        to={`/${slug}/surveys/${surveyId}/${index - 1}/${
          practice ? "practice" : ""
        }`}
        className="inline-block "
      >
        <UpArrowIcon
          className="inline-block transition-colors duration-300"
          style={{ color: buttonColor, width: 48, height: 48 }}
        />
      </Link>
      {!lastPage && (
        <Link
          onClick={onNext}
          className={`inline-block ${
            !canAdvance && "opacity-50 cursor-default"
          }`}
          to={`/${slug}/surveys/${surveyId}/${index + 1}/${
            practice ? "practice" : ""
          }`}
        >
          <DownArrowIcon
            className="inline-block transition-colors duration-300"
            style={{ color: buttonColor, width: 48, height: 48 }}
          />
        </Link>
      )}
    </div>
  );
}

export default SurveyApp;
