import {
  CogIcon,
  PencilIcon,
  TableIcon,
  TranslateIcon,
} from "@heroicons/react/outline";
import { useContext, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import InputBlock from "../components/InputBlock";
import Modal from "../components/Modal";
import Switch from "../components/Switch";
import LanguageSelector from "../surveys/LanguageSelector";
import LocalizableTextInput from "../surveys/LocalizableTextInput";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
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
  const style = useContext(SurveyLayoutContext).style;
  const context = useContext(SurveyContext);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  if (!context) {
    throw new Error("SurveyContext not set");
  }
  const beginButtonText = useLocalizedComponentSetting(
    "beginButtonText",
    props
  );

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={false}
        body={props.body}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div className="w-full flex align-middle mt-6 mb-10">
        <Button
          name="Begin Survey"
          buttonClassName="md:px-8 px-6"
          onClick={() => props.onChange({ dropdownSelection: "BEGIN" }, false)}
          label={beginButtonText || ""}
          primary
          backgroundColor={style.secondaryColor}
          shadowSize="shadow-lg"
        />
        <LanguageSelector
          button={(onClick) => (
            <button
              onClick={onClick}
              className="border rounded border-white p-1 px-2 ml-2 border-opacity-0"
            >
              <TranslateIcon className="w-6 h-6 inline mr-1 " />
              <Trans ns="surveys">Language</Trans>
            </button>
          )}
          options={context.supportedLanguages}
        />
        <div className="sm:flex-1 sm:items-end sm:relative">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="border rounded border-white p-1 px-2 mr-2 border-opacity-0 sm:right-0 sm:absolute"
          >
            <CogIcon className={`w-6 h-6 inline mr-1 ${style.textClass}`} />
            <Trans ns="surveys">Settings</Trans>
          </button>
        </div>
        <Modal
          className="text-black"
          // title={t("Survey Settings", { ns: "surveys" })}
          open={settingsModalOpen}
          onRequestClose={() => setSettingsModalOpen(false)}
        >
          <div className="text-black sm:max-w-lg space-y-4">
            <h3 className="text-lg mb-2">
              {t("Survey Settings", { ns: "surveys" })}
            </h3>
            {context.surveySupportsFacilitation && (
              <InputBlock
                input={
                  <Switch
                    isToggled={context.isFacilitatedResponse}
                    onClick={(enable) => context.toggleFacilitation(enable)}
                  />
                }
                title={t("Facilitated Response", { ns: "surveys" })}
                description={
                  <Trans ns="surveys">
                    If enabled, the survey will prompt for both a respondent
                    name and the name of the facilitator.
                  </Trans>
                }
              />
            )}
            <InputBlock
              input={
                <Switch
                  isToggled={context.practiceMode}
                  onClick={(enable) => context.togglePracticeMode(enable)}
                />
              }
              title={t("Practice Mode", { ns: "surveys" })}
              description={
                <Trans ns="surveys">
                  Practice responses are stored seperately in the database and
                  not counted in analyses.
                </Trans>
              }
            />

            {context.isAdmin && (
              <>
                <h4 className="text-lg pt-1">
                  <Trans ns="admin:surveys">Administrator Tools</Trans>
                </h4>
                <Link
                  className="flex"
                  to={`/${context.slug}/admin/surveys/${context.surveyId}`}
                >
                  <span className="flex-1">
                    <Trans ns="admin:surveys">View responses</Trans>
                  </span>
                  <TableIcon className="w-5 h-5" />
                </Link>
                <Link
                  className="flex"
                  to={`/${context.slug}/survey-editor/${context.surveyId}`}
                >
                  <span className="flex-1">
                    <Trans ns="admin:surveys">Edit this survey</Trans>
                  </span>
                  <PencilIcon className="w-5 h-5" />
                </Link>
              </>
            )}
            <span></span>
          </div>
        </Modal>
      </div>

      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <LocalizableTextInput
                name="beginButtonText"
                required
                value={beginButtonText}
                onChange={updateComponentSetting(
                  "beginButtonText",
                  props.componentSettings,
                  context.lang.code,
                  props.alternateLanguageSettings
                )}
                label={t("Begin Button Text", { ns: "admin:surveys" })}
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

// eslint-disable-next-line i18next/no-literal-string
// WelcomeMessage.label = <span>Welcome</span>;
// (
//   <Trans key="WelcomeMessageLabel" ns="admin:surveys">
//     Welcome Message
//   </Trans>
// );
// eslint-disable-next-line i18next/no-literal-string
// WelcomeMessage.description = <span>description</span>;
// (
//   <Trans key="WelcomeMessageDescription" ns="admin:surveys">
//     Rich text block.
//   </Trans>
// );

WelcomeMessage.label = <Trans ns="admin:surveys">Welcome Message</Trans>;
WelcomeMessage.description = <Trans ns="admin:surveys">Rich text block.</Trans>;

WelcomeMessage.templatesOnly = true;
// eslint-disable-next-line i18next/no-literal-string
WelcomeMessage.defaultBody = fromMarkdown(`
# Welcome to the Survey!

Thank you for participating.
`);

WelcomeMessage.icon = () => (
  <div className="bg-gray-100 w-full h-full text-gray-50 font-bold text-center flex justify-center items-center">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <span className="text-xl">👋</span>
  </div>
);

WelcomeMessage.hideNav = true;
WelcomeMessage.disableDeletion = true;

export default WelcomeMessage;
