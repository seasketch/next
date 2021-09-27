import { ReactElement, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { FormElementProps } from "../formElements/FormElement";
import ShortText, { ShortTextProps } from "../formElements/ShortText";
import WelcomeMessage from "../formElements/WelcomeMessage";
import { FormElementType, useSurveyQuery } from "../generated/graphql";
import ProgressBar from "./ProgressBar";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import UpArrowIcon from "../components/UpArrowIcon";
import DownArrowIcon from "../components/DownArrowIcon";
import useLocalStorage from "../useLocalStorage";

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
  const { t } = useTranslation("surveys");
  const history = useHistory();
  const [backwards, setBackwards] = useState(false);
  const onError = useGlobalErrorHandler();
  const { data, loading } = useSurveyQuery({
    variables: { id: parseInt(surveyId) },
    onError,
  });
  const [responseState, setResponseState] = useLocalStorage<{
    [id: number]: FormElementState;
    // eslint-disable-next-line i18next/no-literal-string
  }>(`survey-${surveyId}`, {});
  if (loading) {
    return <div></div>;
  }
  if (!data?.survey) {
    return <div>{t("Survey not found")}</div>;
  } else {
    const form = data.survey.form!;
    let index = 0;
    if (position) {
      index = parseInt(position);
    }
    const elements = form.formElements || [];
    const formElement = elements[index];
    const state = responseState[formElement.id];
    const firstPage = index === 0;
    const lastPage = index === elements.length - 1;

    /**
     * Update response state for just the given FormElement. Partial state can be supplied to be
     * applied to previous state.
     * @param formElement
     * @param state
     */
    function updateState(
      formElement: Pick<FormElementProps<any>, "id">,
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
      const state = responseState[formElement.id];
      if (!formElement.isRequired || (state?.value && !state?.errors)) {
        return true;
      } else {
        return false;
      }
    }

    return (
      <div
        className="w-full h-auto relative"
        style={{
          backgroundColor: "rgb(5, 94, 157)",
          backgroundImage:
            "linear-gradient(128deg, rgb(5, 94, 157), rgb(41, 69, 209))",
          minHeight: "100vh",
        }}
      >
        <ProgressBar progress={index / elements.length} />
        <div
          className="w-full h-32 md:h-52 lg:h-64 overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(to top, transparent 0%, black 100%)",
            backgroundImage:
              "url(https://images.unsplash.com/photo-1527401850656-0f34108fdb30?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2200&q=80)",
            backgroundPosition: "left bottom",
            backgroundSize: "cover",
          }}
        ></div>
        <div className="px-5 -mt-2 max-w-xl mx-auto text-white survey-content">
          <AnimatePresence
            initial={false}
            exitBeforeEnter={true}
            custom={backwards}
            onExitComplete={() => {
              setBackwards(false);
            }}
          >
            <motion.div
              custom={backwards}
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
                duration: 0.36,
              }}
              key={formElement.id}
              initial="enter"
              animate="show"
              exit="exit"
            >
              <FormElementFactory
                {...formElement}
                typeName={formElement.type!.componentName}
                submissionAttempted={!!state?.submissionAttempted}
                onChange={(value, errors) =>
                  updateState(formElement, {
                    value,
                    errors,
                  })
                }
                editable={false}
                value={state?.value}
              />
              {(!!state?.value || !formElement.isRequired) &&
                formElement.type?.componentName !== "WelcomeMessage" && (
                  <motion.div
                    transition={{
                      delay: 0.15,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Button
                      className="mt-5"
                      buttonClassName="bg-yellow-400"
                      label={lastPage ? t("Complete Submission") : t("Next")}
                      onClick={() => {
                        if (!lastPage) {
                          updateState(formElement, {
                            submissionAttempted: true,
                          });
                          if (canAdvance()) {
                            history.push(`./${index + 1}`);
                          }
                        } else {
                          setResponseState({});
                          history.push(`./0`);
                        }
                      }}
                    />
                  </motion.div>
                )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div
          style={{ width: "fit-content", height: "fit-content" }}
          className={`fixed bottom-5 right-5 lg:left-5 lg:top-5 ${
            firstPage && "hidden"
          }`}
        >
          <Link onClick={() => setBackwards(true)} to={`./${index - 1}`}>
            <UpArrowIcon className="text-yellow-400  inline-block" />
          </Link>
          {!lastPage && (
            <Link
              onClick={(e) => {
                updateState(formElement, {
                  submissionAttempted: true,
                });
                if (!canAdvance()) {
                  e.preventDefault();
                }
                setBackwards(false);
              }}
              className={index + 1 === elements.length ? "hidden" : ""}
              to={`./${index + 1}`}
            >
              <DownArrowIcon className="text-yellow-400  inline-block" />
            </Link>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Returns the appropriate component for a given FormElement config based on type.componentName
 * @param param0
 * @returns FormElement component
 */
function FormElementFactory({
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
  | "editable"
> & {
  typeName: string;
}) {
  switch (typeName) {
    case "WelcomeMessage":
      return (
        <WelcomeMessage
          componentSettings={componentSettings}
          {...formElementData}
        />
      );
    case "ShortText":
      return (
        <ShortText
          value={value as string}
          {...formElementData}
          componentSettings={componentSettings as ShortTextProps}
        />
      );
    default:
      return <Trans ns="errors">missing form element type {typeName}</Trans>;
      break;
  }
}

export default SurveyApp;
