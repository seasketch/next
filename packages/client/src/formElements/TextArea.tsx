import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import SurveyLocalizableTextInput from "../surveys/SurveyLocalizableTextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
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
  const context = useContext(SurveyContext);
  const placeholder = useLocalizedComponentSetting("placeholder", props);
  return (
    <>
      <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
        <FormElementBody
          formElementId={props.id}
          isInput={true}
          body={props.body}
          required={props.isRequired}
          editable={props.editable}
          alternateLanguageSettings={props.alternateLanguageSettings}
        />
        <textarea
          autoFocus={props.autoFocus}
          required={props.isRequired}
          className={`border-gray-300 shadow-sm w-full rounded text-base text-black  my-4 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 ${
            showError ? "bg-red-50" : "bg-white"
          }`}
          placeholder={showError ? t("Required field") : placeholder}
          style={{
            maxHeight: props.componentSettings.compact ? 120 : 400,
            height: props.componentSettings.compact ? 120 : "100vh",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              props.onSubmit();
            }
          }}
          value={props.value || ""}
          onChange={(e) =>
            props.onChange(
              e.target.value,
              props.isRequired && !e.target.value.length
            )
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
              <SurveyLocalizableTextInput
                label={t("Placeholder", { ns: "admin:surveys" })}
                name="placeholder"
                value={placeholder || ""}
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

TextArea.label = <Trans ns="admin:surveys">Text Area</Trans>;
TextArea.description = <Trans ns="admin:surveys">Longer text input</Trans>;
TextArea.defaultBody = questionBodyFromMarkdown(`
# 
`);
TextArea.defaultComponentSettings = {
  compact: true,
};

TextArea.icon = () => (
  <div className="bg-blue-900 w-full h-full font-bold text-center flex justify-center items-center text-white">
    {/*eslint-disable-next-line i18next/no-literal-string*/}
    <span className="text-2xl">¶</span>
  </div>
);

TextArea.ResponseGridCell = ({
  value,
  componentSettings,
  elementId,
  updateValue,
}) => {
  return (
    <EditableResponseCell
      elementId={elementId}
      value={value}
      updateValue={updateValue}
      editor={TextAreaCellEditor}
      componentSettings={componentSettings}
    >
      {value === undefined || value === null ? <SkippedQuestion /> : value}
    </EditableResponseCell>
  );
};

export const TextAreaCellEditor: CellEditorComponent<
  string | null | undefined
> = ({ value, disabled, onChange, onRequestSave, onRequestCancel }) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <textarea
      disabled={disabled}
      autoFocus
      value={val || ""}
      onChange={(e) => setVal(e.target.value)}
      className={`p-1 block w-full h-full rounded m-0 text-xs ${
        disabled && "opacity-50 pointer-events-none"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.metaKey) {
          onRequestSave();
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    />
  );
};

export default TextArea;
