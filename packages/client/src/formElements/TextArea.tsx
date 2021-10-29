import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type TextAreaProps = {
  // maxLength?: number;
  compact?: boolean;
  placeholder?: string;
};

const TextArea: FormElementComponent<TextAreaProps, string> = (props) => {
  const { t } = useTranslation("surveys");
  const errors = props.isRequired && !props.value?.length;
  const showError = errors && props.submissionAttempted;

  return (
    <>
      <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
        <FormElementBody
          formElementId={props.id}
          isInput={true}
          body={props.body}
          required={props.isRequired}
          editable={props.editable}
        />
        <textarea
          autoFocus={true}
          required={props.isRequired}
          className={`w-full rounded text-base text-black  my-4 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 ${
            showError ? "bg-red-50" : "bg-white"
          }`}
          placeholder={
            showError
              ? t("Required field")
              : props.componentSettings.placeholder
          }
          style={{
            maxHeight: props.componentSettings.compact ? 120 : 400,
            height: props.componentSettings.compact ? 120 : "100vh",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              props.onSubmit();
            }
          }}
          value={props.value}
          onChange={(e) =>
            props.onChange(e.target.value, e.target.value.length === 0)
          }
        />
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Compact", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={!!props.componentSettings.compact}
                    onClick={updateComponentSetting(
                      "compact",
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
            </>
          );
        }}
      />
    </>
  );
};

TextArea.label = <Trans ns="admin:surveys">Text Area</Trans>;
TextArea.description = <Trans>Longer text input</Trans>;
TextArea.defaultBody = questionBodyFromMarkdown(`
# 
`);
TextArea.defaultComponentSettings = {
  compact: true,
};

export default TextArea;
