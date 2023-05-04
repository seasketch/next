import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import InputBlock from "../components/InputBlock";
import NumberInput from "../components/NumberInput";
import TextInput from "../components/TextInput";
import {
  FormEditorPortalContext,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

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

  useEffect(() => {
    const e = validate(props.value, props.isRequired, props.componentSettings);
    if (e) {
      props.onChange(props.value, true);
    }
  }, []);

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
          hideErrorMessage={props.isSketchWorkflow}
          autocomplete={props.componentSettings.autocomplete}
          required={props.isRequired}
          autoFocus={props.autoFocus}
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
                label={t("Placeholder", { ns: "admin:surveys" })}
                name="placeholder"
                value={props.componentSettings.placeholder || ""}
                onChange={updateComponentSetting(
                  "placeholder",
                  props.componentSettings
                )}
              />
              <TextInput
                label={t("Autocomplete ID", { ns: "admin:surveys" })}
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

ShortText.label = <Trans ns="admin:surveys">Short Text</Trans>;
ShortText.description = (
  <Trans ns="admin:surveys">Single line of text for short answers</Trans>
);
ShortText.defaultBody = questionBodyFromMarkdown(`
# 
`);

function validate(
  text: string | undefined,
  required: boolean,
  { minLength, maxLength }: ShortTextProps
) {
  if (required && (!text || text.length < 1)) {
    return <Trans ns="admin:surveys">Required field</Trans>;
  }
  if (text && minLength && text.length < minLength) {
    return (
      <Trans ns="admin:surveys">
        Input must be {minLength.toString()} characters or greater
      </Trans>
    );
  }
  if (text && maxLength && text.length > maxLength) {
    return (
      <Trans ns="admin:surveys">
        Input must be {maxLength.toString()} characters or less
      </Trans>
    );
  }
}

ShortText.icon = () => (
  <div className="bg-blue-900 w-full h-full font-bold text-center flex justify-center items-center text-white">
    {/*eslint-disable-next-line i18next/no-literal-string*/}
    <span className="text-2xl">T</span>
  </div>
);

ShortText.ResponseGridCell = ({
  value,
  componentSettings,
  editable,
  updateValue,
  elementId,
}) => {
  return (
    <EditableResponseCell
      updateValue={updateValue}
      value={value}
      editor={TextCellEditor}
      elementId={elementId}
      componentSettings={componentSettings}
    >
      {value ? value : <SkippedQuestion />}
    </EditableResponseCell>
  );
};

export const TextCellEditor: CellEditorComponent<string | null | undefined> = ({
  value,
  disabled,
  onChange,
  onRequestSave,
  onRequestCancel,
}) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <input
      disabled={disabled}
      autoFocus
      type="text"
      value={val || ""}
      onChange={(e) => setVal(e.target.value)}
      className={`p-1 block w-full h-full rounded m-0 text-sm ${
        disabled && "opacity-50 pointer-events-none"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onRequestSave();
          e.preventDefault();
          e.stopPropagation();
        } else if (e.key === "Escape") {
          onRequestCancel();
        }
      }}
    />
  );
};

export default ShortText;
