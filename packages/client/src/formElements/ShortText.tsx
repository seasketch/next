import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import NumberInput from "../components/NumberInput";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";

export type ShortTextProps = {
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /**
   * Enable admins to provide common values
   * https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values
   */
  autocomplete?: string;
};

/**
 * Simplest of input FormElements, takes a single line of text. Wraps TextInput component
 */
const ShortText: FormElementComponent<ShortTextProps, string> = (props) => {
  const { t } = useTranslation("surveys");
  const [val, setVal] = useState(props.value);
  const [errors, setErrors] = useState(
    validate(val, props.isRequired, props.componentSettings)
  );
  useEffect(() => {
    setErrors(validate(val, props.isRequired, props.componentSettings));
  }, [props.componentSettings, props.isRequired, val]);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div className="w-full md:w-96 max-w-full form-element-short-text pt-1 h-20">
        <TextInput
          error={props.submissionAttempted && errors ? errors : undefined}
          value={props.value || ""}
          label=""
          onChange={(v) => {
            const e = validate(v, props.isRequired, props.componentSettings);
            setVal(v);
            props.onChange(v, e ? true : false);
          }}
          name={
            props.componentSettings.autocomplete ||
            `form-element-${props.id}-text-input`
          }
          autocomplete={props.componentSettings.autocomplete}
          required={props.isRequired}
          autoFocus={true}
          placeholder={props.componentSettings.placeholder}
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
              <InputBlock
                labelType="small"
                title={t("Min Length", { ns: "admin:surveys" })}
                input={
                  <NumberInput
                    min={0}
                    placeholder={t("none")}
                    name="minLength"
                    value={props.componentSettings.minLength}
                    onChange={updateComponentSetting(
                      "minLength",
                      props.componentSettings
                    )}
                  />
                }
              />
              <InputBlock
                labelType="small"
                title={t("Max Length", { ns: "admin:surveys" })}
                input={
                  <NumberInput
                    min={0}
                    placeholder={t("none")}
                    name="maxLength"
                    value={props.componentSettings.maxLength}
                    onChange={updateComponentSetting(
                      "maxLength",
                      props.componentSettings
                    )}
                  />
                }
              />
              <TextInput
                label={t("Placeholder")}
                name="placeholder"
                value={props.componentSettings.placeholder || ""}
                onChange={updateComponentSetting(
                  "placeholder",
                  props.componentSettings
                )}
              />
              <TextInput
                label={t("Autocomplete ID")}
                name="autocomplete"
                placeholder={"name, fname, email, etc"}
                value={props.componentSettings.autocomplete || ""}
                onChange={updateComponentSetting(
                  "autocomplete",
                  props.componentSettings
                )}
                description={
                  <Trans ns="admin:surveys">
                    Giving this input a{" "}
                    <a
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                      href="https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values"
                    >
                      standard autocomplete attribute
                    </a>{" "}
                    can simplify tedious entries
                  </Trans>
                }
              />
            </>
          );
        }}
      />
    </>
  );
};

ShortText.label = <Trans>Short Text</Trans>;
ShortText.description = <Trans>Single line of text for short answers</Trans>;
ShortText.defaultBody = questionBodyFromMarkdown(`
# 
`);

function validate(
  text: string | undefined,
  required: boolean,
  { minLength, maxLength }: ShortTextProps
) {
  if (required && (!text || text.length < 1)) {
    return <Trans>Required field</Trans>;
  }
  if (text && minLength && text.length < minLength) {
    return (
      <Trans>Input must be {minLength.toString()} characters or greater</Trans>
    );
  }
  if (text && maxLength && text.length > maxLength) {
    return (
      <Trans>Input must be {maxLength.toString()} characters or less</Trans>
    );
  }
}

export default ShortText;
