import { MouseEventHandler, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { FormElementProps } from "../formElements/FormElement";
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
import { components } from "../formElements";
import { useMediaQuery } from "beautiful-react-hooks";
import SurveyAppLayout, {
  FormElementStyleProps,
  getCurrentStyle,
} from "./SurveyAppLayout";
import ImagePreloader from "./ImagePreloader";
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
  const { surveyId, position } = useParams<{
    surveyId: string;
    position: string;
  }>();
  const isSmall = useMediaQuery("(max-width: 767px)");
  const { t } = useTranslation("surveys");
  const history = useHistory();
  const [backwards, setBackwards] = useState(false);
  const onError = useGlobalErrorHandler();
  const { data, loading } = useSurveyQuery({
    variables: { id: parseInt(surveyId) },
    onError,
  });
  const [createResponse, createResponseState] = useCreateResponseMutation({
    onError,
  });
  const [formElement, setFormElement] = useState<{
    current?: Pick<
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
    exiting?: Pick<
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
  }>({});

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
  }>(`survey-${surveyId}`, {});
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
      setResponseState((prev) => ({
        ...prev,
        [formElement.id]: {
          ...prev[formElement.id],
          ...state,
        },
      }));
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

    async function handleAdvance() {
      updateState(formElement.current!, {
        submissionAttempted: true,
      });
      setFormElement((prev) => ({ ...prev, exiting: prev.current }));
      if (canAdvance()) {
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
            },
          });
          if (response && !response.errors) {
            setResponseState({});
            history.push(`./0`);
          }
        } else {
          history.push(`./${index + 1}`);
        }
      }
    }

    const style = getCurrentStyle(
      data.survey.form.formElements,
      formElement.exiting || formElement.current,
      isSmall
    );

    return (
      <>
        <SurveyAppLayout
          showProgress={data.survey.showProgress}
          progress={index / elements.length}
          style={style}
          unsplashUserName={formElement.current.unsplashAuthorName || undefined}
          unsplashUserUrl={formElement.current.unsplashAuthorUrl || undefined}
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
              className="relative pb-12"
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
                  // transitionDelay: "100ms",
                }),
                show: () => ({
                  opacity: 1,
                  translateY: 0,
                  position: "relative",
                }),
              }}
              transition={{
                duration: 0.3,
                // when: "afterChildren",
                // staggerChildren: 0.5,
              }}
              key={formElement.current.id}
              initial="enter"
              animate="show"
              exit="exit"
            >
              <FormElementFactory
                {...formElement.current}
                typeName={formElement.current.typeId}
                submissionAttempted={!!state?.submissionAttempted}
                onChange={(value, errors) =>
                  updateState(formElement.current!, {
                    value,
                    errors,
                  })
                }
                onSubmit={handleAdvance}
                editable={false}
                value={state?.value}
              />
              {!formElement.exiting &&
                (!!state?.value || !formElement.current.isRequired) &&
                formElement.current.typeId !== "WelcomeMessage" &&
                !state?.errors && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.3,
                      when: "beforeChildren",
                    }}
                  >
                    <Button
                      className="mt-10 mb-10 absolute -bottom-3"
                      label={
                        lastPage && !!!formElement.exiting
                          ? t("Complete Submission")
                          : t("Next")
                      }
                      onClick={handleAdvance}
                      disabled={
                        createResponseState.loading || !!formElement.exiting
                      }
                      loading={createResponseState.loading}
                      backgroundColor={style.secondaryColor}
                    />
                  </motion.div>
                )}
            </motion.div>
          </AnimatePresence>
          <SurveyNav
            canAdvance={canAdvance()}
            buttonColor={style.secondaryColor}
            lastPage={parseInt(position) + 1 === elements.length}
            index={parseInt(position)}
            onPrev={() => setBackwards(true)}
            onNext={(e) => {
              handleAdvance();
              if (!canAdvance()) {
                e.preventDefault();
              }
            }}
          />
        </SurveyAppLayout>
        <ImagePreloader formElements={elements} />
      </>
    );
  }
}

/**
 * Returns the appropriate component for a given FormElement config based on type.componentName
 * @param param0
 * @returns FormElement component
 */
export function FormElementFactory({
  typeName,
  componentSettings,
  value,
  ...formElementData
}: Pick<
  FormElementProps<any>,
  | "body"
  | "id"
  | "componentSettings"
  | "isRequired"
  | "submissionAttempted"
  | "value"
  | "onChange"
  | "onSubmit"
  | "editable"
> & {
  typeName: string;
}) {
  if (typeName in components) {
    const Component = components[typeName];
    return (
      <Component
        value={value}
        componentSettings={componentSettings}
        {...formElementData}
      />
    );
  } else {
    return <Trans ns="errors">missing form element type {typeName}</Trans>;
  }
}

function SurveyNav({
  canAdvance,
  lastPage,
  buttonColor,
  onNext,
  onPrev,
  index,
}: {
  canAdvance: boolean;
  lastPage: boolean;
  buttonColor: string;
  onNext: MouseEventHandler<HTMLAnchorElement>;
  onPrev: MouseEventHandler<HTMLAnchorElement>;
  index: number;
}) {
  return (
    <div
      style={{ width: "fit-content", height: "fit-content" }}
      className={`fixed bottom-5 right-5 lg:left-5 lg:top-5 ${
        index === 0 && "hidden"
      }`}
    >
      <Link
        onClick={onPrev}
        to={`./${index - 1}`}
        className="inline-block transition-colors duration-500"
      >
        <UpArrowIcon className="inline-block" style={{ color: buttonColor }} />
      </Link>
      {!lastPage && (
        <Link
          onClick={onNext}
          className={"inline-block transition-colors duration-500"}
          to={`./${index + 1}`}
        >
          <DownArrowIcon
            className="inline-block"
            style={{ color: buttonColor }}
          />
        </Link>
      )}
    </div>
  );
}

export default SurveyApp;
