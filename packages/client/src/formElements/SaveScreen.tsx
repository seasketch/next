import {
  RefreshIcon,
  SaveAsIcon,
  StatusOfflineIcon,
} from "@heroicons/react/outline";
import { GraphQLError } from "graphql";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import IndeterminantLoadingBar from "../admin/surveys/IndeterminantLoadingBar";
import Button from "../components/Button";
import ModalDeprecated from "../components/ModalDeprecated";
import { OfflineStateContext } from "../offline/OfflineStateContext";
import SurveyButton from "../surveys/SurveyButton";
import { FormElementComponent, SurveyContext } from "./FormElement";
import fromMarkdown from "./fromMarkdown";

const SaveScreen: FormElementComponent<{}> = (props) => {
  const { t } = useTranslation("surveys");
  const { online } = useContext(OfflineStateContext);
  const surveyContext = useContext(SurveyContext);
  const [errors, setErrors] = useState<null | GraphQLError>(null);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  function advance(startedSubmissionAt: number) {
    const duration = new Date().getTime() - startedSubmissionAt;
    if (duration > 2000) {
      props.onSubmit();
    } else {
      setTimeout(() => {
        props.onSubmit();
      }, 2000 - duration);
    }
  }

  function save() {
    setSaving(true);
    setErrors(null);
    const startedSubmissionAt = new Date().getTime();

    if (surveyContext?.saveResponse) {
      surveyContext.saveResponse().then(async (response) => {
        if (response.errors) {
          if (!online && surveyContext.clientIsPreppedForOfflineUse) {
            await surveyContext.saveResponseToOfflineStore();
            advance(startedSubmissionAt);
          } else {
            setSaving(false);
            if (Array.isArray(response.errors)) {
              setErrors(response.errors[0]);
            } else {
              // @ts-ignore
              setErrors(response.errors);
            }
          }
        } else {
          advance(startedSubmissionAt);
        }
      });
    }
  }

  useEffect(save, []);

  return (
    <>
      {/* TODO: Really shouldn't be handling these text wrapping issues here. Should be handled in SurveyAppLayout */}
      <div className="mb-5 md:w-96 xl:w-160 max-w-full">
        <h4 className="text-xl ">
          {!online && <Trans ns="surveys">You Are Offline</Trans>}
          {online && saving && (
            <Trans ns="surveys">Submitting Your Response</Trans>
          )}
          {online && errors && (
            <Trans ns="surveys">Error saving response</Trans>
          )}
        </h4>
        {saving && <IndeterminantLoadingBar className="mt-5" />}

        {!saving && !online && (
          <p>
            <Trans ns="surveys" i18nKey="OfflineInstructions">
              We cannot submit your response until you are connected to the
              internet. Please check your connection. You may safely refresh
              this page.
            </Trans>
            <StatusOfflineIcon className="mx-auto max-w-1/3 opacity-40 mt-5" />
          </p>
        )}

        {online && errors && (
          <>
            <h4 className="font-mono text-base my-3">{errors.message}</h4>

            <p>
              <Trans ns="surveys" i18nKey="UnsubmittedResponse">
                Your response is safe on this device, but will need to be
                submitted to the server before being counted.
              </Trans>
            </p>
            <p>
              <Trans ns="surveys" i18nKey="ContactForAssistance">
                Contact
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                  href="mailto:support@seasketch.org"
                >
                  support@seasketch.org
                </a>
                for assistance.
              </Trans>
            </p>

            <div className="my-4 space-x-4 rtl:space-x-reverse flex items-center">
              <SurveyButton
                label={
                  <>
                    <RefreshIcon className="w-4 h-4 mr-2" />
                    <Trans i18nKey="RepeatSubmission" ns="surveys">
                      Submit Again
                    </Trans>
                  </>
                }
                onClick={save}
              />
              <button
                className="border rounded p-2 px-4 text-sm"
                onClick={() => setShowResetModal(true)}
              >
                <Trans ns="surveys">Reset Survey</Trans>
              </button>
            </div>
          </>
        )}
        {showResetModal && (
          <ModalDeprecated
            open={true}
            onRequestClose={() => setShowResetModal(false)}
            title={t("Reset Survey")}
            className="text-black"
            footer={
              <div className="space-x-2 rtl:space-x-reverse text-right">
                <Button
                  label={t("Cancel")}
                  onClick={() => setShowResetModal(false)}
                />
                <Button
                  primary
                  label={t("Reset Survey")}
                  onClick={surveyContext?.resetResponse}
                />
              </div>
            }
          >
            <div className="w-full sm:w-128">
              <p>
                <Trans ns="surveys" i18nKey="ResetSurvey">
                  Resetting will delete all of your previously entered data so
                  that you may start the survey again in a blank state. This
                  action cannot be undone.
                </Trans>
              </p>
            </div>
          </ModalDeprecated>
        )}
      </div>
    </>
  );
};

SaveScreen.label = <Trans ns="admin:surveys">SaveScreen</Trans>;

SaveScreen.description = (
  <Trans ns="admin:surveys">Feedback while saving</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
SaveScreen.defaultBody = fromMarkdown(`
# Save Screen
`);

SaveScreen.icon = () => (
  <div className="bg-gray-800 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <SaveAsIcon className="w-5 h-5" />
  </div>
);

SaveScreen.hideNav = true;
SaveScreen.templatesOnly = true;
SaveScreen.disableDeletion = true;
export default SaveScreen;
