import { Trans, useTranslation } from "react-i18next";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import fromMarkdown from "./fromMarkdown";
import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { LinkIcon, StatusOfflineIcon } from "@heroicons/react/outline";
import Button from "../components/Button";
import { useContext } from "react";
import { Link } from "react-router-dom";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import useClipboard from "react-use-clipboard";
import LocalizableTextInput from "../surveys/LocalizableTextInput";
import { OfflineStateContext } from "../offline/OfflineStateContext";

export interface ThankYouProps {
  promptToRespondAgain?: boolean;
  respondAgainMessage?: string;
  shareButtons?: boolean;
  linkToProject?: boolean;
}

/**
 * Displays a rich text section at the end of a survey
 */
const ThankYou: FormElementComponent<ThankYouProps> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const style = useContext(FormElementLayoutContext).style;
  const context = useContext(SurveyContext);
  const shareUrl = new URL(context!.surveyUrl).toString();
  const shareClassName = "w-8 h-8 rounded shadow cursor-pointer";
  const [isCopied, setCopied] = useClipboard(shareUrl, {
    // `isCopied` will go back to `false` after 2000ms.
    successDuration: 1000,
  });
  const { online } = useContext(OfflineStateContext);

  const respondAgainMessage = useLocalizedComponentSetting(
    "respondAgainMessage",
    props
  );
  return (
    <>
      <div className="mb-5">
        <FormElementBody
          formElementId={props.id}
          isInput={false}
          body={props.body}
          editable={props.editable}
          alternateLanguageSettings={props.alternateLanguageSettings}
        />
        {context &&
          "offlineResponseCount" in context &&
          context.offlineResponseCount > 0 && (
            <div className="border my-4 p-4 rounded border-opacity-30 flex">
              <StatusOfflineIcon className="w-8 h-8 block mr-4" />
              <div className="flex-1">
                <h2 className="text-lg mb-1 font-semibold">
                  <Trans
                    ns="offline"
                    i18nKey="offlineResponseCount"
                    count={context.offlineResponseCount}
                  >
                    {{ count: context.offlineResponseCount }} offline responses
                    collected
                  </Trans>
                </h2>
                {!online && (
                  <>
                    <p>
                      <Trans ns="offline">
                        These responses have been saved to your device but will
                        need to be resubmitted to the SeaSketch server once you
                        are back online. You can continue to collect additional
                        responses until then.
                      </Trans>
                    </p>
                    <p className="mt-1">
                      <Trans ns="offline">
                        Once online, you can resubmit from the this page, the
                        begining of the survey, or from the SeaSketch homepage.
                      </Trans>
                    </p>
                  </>
                )}
              </div>
              {online && (
                <Link to={`/submit-offline-surveys`} className="underline">
                  <Trans ns="offline">Submit them now</Trans>
                </Link>
              )}
            </div>
          )}

        {props.componentSettings.shareButtons && (
          <div className="my-5 space-x-2 rtl:space-x-reverse flex items-center">
            <>
              <FacebookShareButton
                url={shareUrl}
                children={<FacebookIcon className={shareClassName} />}
              />
              <TwitterShareButton
                url={shareUrl}
                children={<TwitterIcon className={shareClassName} />}
              ></TwitterShareButton>
              <WhatsappShareButton url={shareUrl}>
                <WhatsappIcon className={shareClassName} />
              </WhatsappShareButton>
              <LinkedinShareButton url={shareUrl}>
                <LinkedinIcon className={shareClassName} />
              </LinkedinShareButton>
              <button
                onClick={setCopied}
                className={`${shareClassName} bg-gray-400 inline-block text-center relative`}
              >
                <LinkIcon className="w-6 h-6 mx-auto" />

                <div
                  className={`absolute ${
                    isCopied ? "opacity-100" : "opacity-0"
                  } transition-opacity duration-500 left-10 top-0 rounded px-2 py-1 bg-black shadow-lg text-white whitespace-nowrap`}
                >
                  <Trans ns="surveys">Copied URL</Trans>
                </div>
              </button>
            </>
          </div>
        )}
        <div className="mt-10 space-x-5 rtl:space-x-reverse">
          {(props.componentSettings.promptToRespondAgain ||
            context?.isAdmin) && (
            <Button
              href={new URL(context!.surveyUrl).pathname}
              label={respondAgainMessage || "Submit Another Response"}
              backgroundColor={style.secondaryColor}
            >
              {respondAgainMessage || "Submit Another Response"}{" "}
              {/* <RefreshIcon className="ml-2 w-4 h-4" /> */}
            </Button>
          )}
          {props.componentSettings.linkToProject && (
            <Link
              className="underline"
              to={new URL(context!.projectUrl).pathname}
            >
              <Trans ns="surveys">Return to {context!.projectName}</Trans>
            </Link>
          )}
        </div>
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Link to project", {
                  ns: "admin:surveys",
                })}
                input={
                  <Switch
                    isToggled={!!props.componentSettings.linkToProject}
                    onClick={updateComponentSetting(
                      "linkToProject",
                      props.componentSettings
                    )}
                  />
                }
              />
              <InputBlock
                labelType="small"
                title={t("Share buttons", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={!!props.componentSettings.shareButtons}
                    onClick={updateComponentSetting(
                      "shareButtons",
                      props.componentSettings
                    )}
                  />
                }
              />
              <InputBlock
                labelType="small"
                title={t("Prompt for multiple responses", {
                  ns: "admin:surveys",
                })}
                input={
                  <Switch
                    isToggled={!!props.componentSettings.promptToRespondAgain}
                    onClick={updateComponentSetting(
                      "promptToRespondAgain",
                      props.componentSettings
                    )}
                  />
                }
              />
              <p className="text-sm text-gray-500">
                <Trans ns="admin:surveys">
                  Note that admins will always be given the option to submit
                  another response.
                </Trans>
              </p>
              <LocalizableTextInput
                disabled={!props.componentSettings.promptToRespondAgain}
                label={t("Respond Again Button Text")}
                name="respondAgainMessage"
                value={respondAgainMessage || "Submit Another Response"}
                onChange={updateComponentSetting(
                  "respondAgainMessage",
                  props.componentSettings,
                  context?.lang.code,
                  props.alternateLanguageSettings
                )}
              />
            </>
          );
        }}
      />
    </>
  );
};

ThankYou.label = <Trans ns="admin:surveys">Thank You</Trans>;
ThankYou.description = (
  <Trans ns="admin:surveys">Message shown at end of survey.</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
ThankYou.defaultBody = fromMarkdown(`
# Thank You for Responding

Use this page to show a *customized* message when user's finish the survey. 

`);

ThankYou.defaultProps = {
  componentSettings: {
    shareButtons: true,
    linkToProject: true,
  },
};

ThankYou.icon = () => (
  <div className="bg-gray-100 w-full h-full font-bold text-center flex justify-center items-center   text-white">
    {/*eslint-disable-next-line i18next/no-literal-string*/}
    <span className="text-2xl font-serif">🙏</span>
    {/* <HeartIcon className="w-1/2 h-1/2" /> */}
  </div>
);

ThankYou.hideNav = true;
ThankYou.disableDeletion = true;
export default ThankYou;
