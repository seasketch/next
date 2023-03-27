import { MailIcon } from "@heroicons/react/solid";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import TextInput from "../components/TextInput";
import LocalizableTextInput from "../surveys/LocalizableTextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type EmailProps = {
  placeholder?: string;
};

/**
 * Email text input with validation. Automatically populates from registered
 * email if the user is logged in.
 */
const Email: FormElementComponent<EmailProps, string> = (props) => {
  const { t } = useTranslation("surveys");
  const [val, setVal] = useState(props.value);
  const [errors, setErrors] = useState(validate(val, props.isRequired));
  const context = useContext(SurveyContext);
  useEffect(() => {
    setErrors(validate(val, props.isRequired));
  }, [props.componentSettings, props.isRequired, val]);

  useEffect(() => {
    if ((val === null || val === undefined) && context?.bestEmail) {
      props.onChange(context.bestEmail, false);
    }
  }, [context?.bestEmail]);

  const placeholder = useLocalizedComponentSetting("placeholder", props);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div
        className="w-full md:w-96 max-w-full form-element-short-text pt-1"
        style={{ height: 68 }}
      >
        <TextInput
          type="email"
          error={props.submissionAttempted && errors ? errors : undefined}
          value={props.value || ""}
          label=""
          onChange={(v) => {
            const e = validate(v, props.isRequired);
            setVal(v);
            props.onChange(v, e ? true : false);
          }}
          name={`form-element-${props.id}-email-input`}
          autocomplete="email"
          required={props.isRequired}
          autoFocus={props.autoFocus}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              props.onSubmit();
            }
          }}
        />
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <p className="text-sm text-gray-500">
                <Trans ns="admin:surveys">
                  This input will be populated with the user's registered email
                  address if available
                </Trans>
              </p>
              <LocalizableTextInput
                label={t("Placeholder", { ns: "admin:surveys" })}
                name="placeholder"
                value={placeholder}
                onChange={updateComponentSetting(
                  "placeholder",
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

Email.label = <Trans ns="admin:surveys">Email</Trans>;
Email.description = <Trans ns="admin:surveys">Validated email input</Trans>;
// eslint-disable-next-line i18next/no-literal-string
Email.defaultBody = questionBodyFromMarkdown(`
# What is your email address?
`);
Email.defaultExportId = "email";

// via https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#basic_validation
const regexp =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function validate(text: string | undefined, required: boolean) {
  if (required && (!text || text.length < 1)) {
    return <Trans ns="surveys">Required field</Trans>;
  } else if (text?.length && !regexp.test(text)) {
    return <Trans ns="surveys">Does not appear to be a valid email</Trans>;
  }
}
Email.icon = () => (
  <div className="bg-blue-800 w-full h-full font-bold text-center flex justify-center items-center italic">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <MailIcon style={{ color: "rgb(244 236 255)" }} className="w-2/3 h-2/3" />
  </div>
);

export default Email;
