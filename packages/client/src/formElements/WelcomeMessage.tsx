import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import fromMarkdown from "./fromMarkdown";

/**
 * Displays rich text at the begining of a survey. Only one WelcomeMessage should be
 * added to form
 */
const WelcomeMessage: FormElementComponent<{ beginButtonText: string }> = (
  props
) => {
  const { t } = useTranslation("admin:surveys");
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
      />
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
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

export default WelcomeMessage;
