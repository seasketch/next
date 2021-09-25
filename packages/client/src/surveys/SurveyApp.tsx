import { ReactElement, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router";
import Button from "../components/Button";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { FormElementProps } from "../formElements/FormElement";
import ShortText, { ShortTextProps } from "../formElements/ShortText";
import WelcomeMessage from "../formElements/WelcomeMessage";
import {
  FormElement,
  FormElementType,
  Maybe,
  useSurveyQuery,
} from "../generated/graphql";
import ProgressBar from "./ProgressBar";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

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
  const [values, setValues] = useState<{
    [id: number]: {
      touched?: boolean;
      value: any;
      errors: boolean;
      submissionAttempted?: boolean;
    };
  }>({});
  function setValue(value: any, id: number, errors: boolean) {
    setValues({
      ...values,
      [id]: {
        ...values[id],
        touched: true,
        value,
        errors,
      },
    });
  }
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
    const formElement = form.formElements[index];
    const state = values[formElement.id];
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
        <ProgressBar progress={index / form.formElements.length} />
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
              <ElementFactory
                typeName={formElement.type!.componentName}
                {...formElement}
                submissionAttempted={!!state?.submissionAttempted}
                onChange={(value, errors) =>
                  setValue(value, formElement.id, errors)
                }
                editable={false}
                value={state?.value}
              />
              {/* <AnimatePresence> */}
              {!!state?.value && (
                <motion.div
                  transition={{
                    delay: 0.5,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    className="mt-5"
                    buttonClassName="bg-yellow-400"
                    label={t("Next")}
                    onClick={() => {
                      if (!state) {
                        setValues({
                          ...values,
                          [formElement.id]: {
                            ...values[formElement.id],
                            submissionAttempted: true,
                          },
                        });
                      } else if (state.errors) {
                        setValues({
                          ...values,
                          [formElement.id]: {
                            ...values[formElement.id],
                            submissionAttempted: true,
                          },
                        });
                      } else if (!state.errors) {
                        history.push(`./${index + 1}`);
                      }
                    }}
                  />
                </motion.div>
              )}
              {/* </AnimatePresence> */}
            </motion.div>
          </AnimatePresence>
        </div>
        <div
          style={{ width: "fit-content", height: "fit-content" }}
          className={`fixed bottom-5 right-5 lg:left-5 lg:top-5 ${
            index === 0 && "hidden"
          }`}
        >
          <Link onClick={() => setBackwards(true)} to={`./${index - 1}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-yellow-400  inline-block"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <Link
            onClick={() => setBackwards(false)}
            className={index + 1 === form.formElements.length ? "hidden" : ""}
            to={`./${index + 1}`}
          >
            <svg
              className="h-10 w-10 text-yellow-400  inline-block"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              // href={`./${index - 1}`}
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    );
  }
}

function ElementFactory({
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
