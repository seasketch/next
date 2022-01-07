import { Trans, useTranslation } from "react-i18next";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
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
import { LinkIcon } from "@heroicons/react/outline";
import TextInput from "../components/TextInput";
import Button from "../components/Button";
import { useContext } from "react";
import { Link } from "react-router-dom";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import useClipboard from "react-use-clipboard";

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
  const style = useContext(SurveyLayoutContext).style;
  const context = useContext(SurveyContext);
  const shareUrl = new URL(context!.surveyUrl).toString();
  const shareClassName = "w-8 h-8 rounded shadow cursor-pointer";
  const [isCopied, setCopied] = useClipboard(shareUrl, {
    // `isCopied` will go back to `false` after 2000ms.
    successDuration: 1000,
  });
  return (
    <>
      <div className="mb-5">
        <FormElementBody
          formElementId={props.id}
          isInput={false}
          body={props.body}
          editable={props.editable}
        />

        <div className="my-5 space-x-2 flex items-center">
          {props.componentSettings.shareButtons && (
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
          )}
        </div>
        <div className="mt-10 space-x-5">
          {(props.componentSettings.promptToRespondAgain ||
            context?.isAdmin) && (
            <Button
              href={new URL(context!.surveyUrl).pathname}
              label={
                props.componentSettings.respondAgainMessage ||
                "Submit Another Response"
              }
              backgroundColor={style.secondaryColor}
            >
              {props.componentSettings.respondAgainMessage ||
                "Submit Another Response"}{" "}
              {/* <RefreshIcon className="ml-2 w-4 h-4" /> */}
            </Button>
          )}
          {props.componentSettings.linkToProject && (
            <Link
              className="underline"
              to={new URL(context!.projectUrl).pathname}
            >
              <Trans>Return to {context!.projectName}</Trans>
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
              <TextInput
                disabled={!props.componentSettings.promptToRespondAgain}
                label={t("Respond Again Button Text")}
                name="respondAgainMessage"
                value={
                  props.componentSettings.respondAgainMessage ||
                  "Submit Another Response"
                }
                onChange={updateComponentSetting(
                  "respondAgainMessage",
                  props.componentSettings
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
