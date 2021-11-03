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
import { useParams } from "react-router";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { LinkIcon } from "@heroicons/react/outline";
import TextInput from "../components/TextInput";
import Button from "../components/Button";
import { useContext } from "react";
import { SurveyStyleContext } from "../surveys/appearance";
import { Link } from "react-router-dom";
import { useCurrentProjectMetadataQuery } from "../generated/graphql";

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
  const style = useContext(SurveyStyleContext);
  const context = useContext(SurveyContext);
  // eslint-disable-next-line i18next/no-literal-string
  const shareUrl = new URL(context!.surveyUrl).pathname;
  const shareClassName = "w-8 h-8 rounded shadow cursor-pointer";
  return (
    <>
      <div className="mb-5">
        <FormElementBody
          formElementId={props.id}
          isInput={false}
          body={props.body}
          editable={props.editable}
        />

        <div className="my-5 space-x-2">
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
              <a
                href={shareUrl}
                className={`${shareClassName} bg-gray-400 inline-block text-center`}
              >
                <LinkIcon className="w-6 h-6 mx-auto mt-1" />
              </a>
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

export default ThankYou;
