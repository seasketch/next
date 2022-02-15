import { CheckIcon } from "@heroicons/react/outline";
import { useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import Badge from "../components/Badge";
import Button from "../components/Button";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import { ChoiceAdminValueInput } from "./ComboBox";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyInputButton from "./SurveyInputButton";

export type MultipleChoiceProps = {
  multipleSelect?: boolean;
  options?: FormElementOption[];
};

export type MultipleChoiceValue = string[];

const MultipleChoice: FormElementComponent<
  MultipleChoiceProps,
  MultipleChoiceValue
> = (props) => {
  const { t } = useTranslation("surveys");
  const context = useContext(SurveyContext);
  const options = useLocalizedComponentSetting(
    "options",
    props
  ) as FormElementOption[];
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
      <div className="block sm:inline-block">
        <div className="py-4 pb-6 space-y-2 flex flex-col">
          {(options || []).map(({ label, value }) => {
            const current = props.value || [];
            const selected = current.indexOf(value || label) !== -1;
            return (
              <SurveyInputButton
                key={value || label}
                className={"w-full"}
                label={label}
                iconPlacement={
                  props.componentSettings.multipleSelect ? "left" : "right"
                }
                Icon={
                  props.componentSettings.multipleSelect
                    ? selected
                      ? CheckIcon
                      : (props) => (
                          <div
                            className={`inline transform scale-75 border rounded border-opacity-50 ${props.className}`}
                          ></div>
                        )
                    : selected
                    ? CheckIcon
                    : (props) => null
                }
                selected={selected}
                onClick={() => {
                  const current = props.value || [];
                  if (props.componentSettings.multipleSelect) {
                    const newVal = selected
                      ? current.filter((v) => v !== (value || label))
                      : [...current, value || label];
                    props.onChange(newVal.length ? newVal : undefined, false);
                  } else {
                    if (selected) {
                      props.onChange(undefined, false);
                    } else {
                      props.onChange([value || label], false, true);
                    }
                  }
                }}
              />
            );
          })}
        </div>
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Multiple Select", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={props.componentSettings.multipleSelect}
                    onClick={updateComponentSetting(
                      "multipleSelect",
                      props.componentSettings
                    )}
                  />
                }
              />
              <Button
                small
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        "Are you sure? ComboBox's do not support multiple-select. You can always change back.",
                        { ns: "admin:surveys" }
                      )
                    )
                  ) {
                    updateBaseSetting("typeId")("ComboBox");
                  }
                }}
                label={t("Change to ComboBox", { ns: "admin:surveys" })}
              />
              <FormElementOptionsInput
                key={props.id}
                prop="options"
                componentSettings={props.componentSettings}
                alternateLanguageSettings={props.alternateLanguageSettings}
                onChange={updateComponentSetting(
                  "options",
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

MultipleChoice.label = <Trans ns="admin:surveys">Multiple Choice</Trans>;
MultipleChoice.description = <Trans>Choose one or more values</Trans>;
MultipleChoice.defaultBody = questionBodyFromMarkdown(`
# 
`);
MultipleChoice.defaultComponentSettings = {
  options: ["A", "B", "C"].map((value) => ({
    // eslint-disable-next-line i18next/no-literal-string
    label: `Option ${value}`,
    value,
  })),
};
MultipleChoice.advanceAutomatically = (settings) => !settings.multipleSelect;

MultipleChoice.icon = () => (
  <div className="bg-green-600 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <svg
      viewBox="0 0 16 16"
      height="20"
      width="20"
      focusable="false"
      role="img"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-1zM0 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm7-1.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-1zm0-5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 8a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zM3 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"></path>
    </svg>
  </div>
);

MultipleChoice.adminValueInput = ChoiceAdminValueInput;

MultipleChoice.ResponseGridCell = function ({ value, componentSettings }) {
  return (
    <div className="space-x-1">
      {(componentSettings.options || [])
        .filter((o) => value.indexOf(o.value || o.label) !== -1)
        .map((option) => (
          <Badge key={option.value || option.label} variant="green">
            {option.label}
          </Badge>
        ))}
    </div>
  );
};

export default MultipleChoice;
