import { useAuth0 } from "@auth0/auth0-react";
import { useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Auth0User } from "../auth/Auth0User";
import Button from "../components/Button";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import { SurveyStyleContext } from "../surveys/appearance";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
} from "./FormElement";
import fromMarkdown from "./fromMarkdown";

/**
 * Displays rich text at the begining of a survey. Only one WelcomeMessage should be
 * added to form
 */
const WelcomeMessage: FormElementComponent<
  { beginButtonText: string; disablePracticeMode: boolean },
  { dropdownSelection?: string }
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const style = useContext(SurveyStyleContext);
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error("SurveyContext not set");
  }
  const auth0 = useAuth0<Auth0User>();
  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={false}
        body={props.body}
        editable={props.editable}
      />
      <Button
        autofocus
        className="mt-6 mb-10"
        onClick={props.onSubmit}
        label={
          props.componentSettings.beginButtonText?.length
            ? props.componentSettings.beginButtonText
            : ""
        }
        primary
        backgroundColor={style.secondaryColor}
        shadowSize="shadow-lg"
        segmentItems={
          !props.editable &&
          (context.isAdmin || !props.componentSettings.disablePracticeMode)
            ? [
                t("Take Survey", { ns: "surveys" }),
                t("Practice", { ns: "surveys" }),
                ...(context.surveySupportsFacilitation
                  ? [t("Facilitated Response", { ns: "surveys" })]
                  : []),
                ...(context.isAdmin
                  ? [t("Edit Survey"), t("View Responses")]
                  : []),
              ]
            : undefined
        }
        onSegmentClick={(n) => {
          switch (n) {
            case 0:
              props.onChange({ dropdownSelection: "BEGIN" }, false);
              break;
            case 1:
              props.onChange({ dropdownSelection: "PRACTICE" }, false);
              break;
            case 2:
              if (context.surveySupportsFacilitation) {
                props.onChange({ dropdownSelection: "FACILITATED" }, false);
              } else {
                props.onChange({ dropdownSelection: "EDIT" }, false);
              }
              break;
            case 3:
              if (context.surveySupportsFacilitation) {
                props.onChange({ dropdownSelection: "EDIT" }, false);
              } else {
                props.onChange({ dropdownSelection: "RESPONSES" }, false);
              }
              break;
            case 4:
              props.onChange({ dropdownSelection: "RESPONSES" }, false);
              break;
          }
        }}
      />
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <TextInput
                name="beginButtonText"
                required
                value={props.componentSettings.beginButtonText}
                onChange={updateComponentSetting(
                  "beginButtonText",
                  props.componentSettings
                )}
                label={t("Begin Button Text")}
              />
              <InputBlock
                labelType="small"
                title={t("Hide Practice Mode", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={!!props.componentSettings.disablePracticeMode}
                    onClick={updateComponentSetting(
                      "disablePracticeMode",
                      props.componentSettings
                    )}
                  />
                }
              />
              <p className="text-sm text-gray-500">
                <Trans ns="admin:surveys">
                  Practice mode is always available for project admins
                  regardless of this setting.
                </Trans>
              </p>
            </>
          );
        }}
      />
    </>
  );
};

WelcomeMessage.label = <Trans ns="admin:surveys">Welcome Message</Trans>;
WelcomeMessage.description = <Trans ns="admin:surveys">Rich text block.</Trans>;
WelcomeMessage.templatesOnly = true;
// eslint-disable-next-line i18next/no-literal-string
WelcomeMessage.defaultBody = fromMarkdown(`
# Welcome to the Survey!

Thank you for participating.
`);

WelcomeMessage.icon = (
  <div className="bg-gray-100 w-full h-full text-gray-50 font-bold text-center flex justify-center items-center">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <span className="text-xl">👋</span>
  </div>
);

export default WelcomeMessage;
