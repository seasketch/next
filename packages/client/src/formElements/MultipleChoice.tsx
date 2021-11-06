import { CheckIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyButton from "./SurveyButton";

export type MultipleChoiceProps = {
  multipleSelect?: boolean;
  options?: FormElementOption[];
};

const MultipleChoice: FormElementComponent<MultipleChoiceProps, string[]> = (
  props
) => {
  const { t } = useTranslation("surveys");

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div className="inline-block">
        <div
          className="py-4 pb-6 space-y-2 flex flex-col"
          // style={{
          //   width:
          //     Math.max(
          //       ...(props.componentSettings.options || []).map(
          //         (o) => o.label.length
          //       )
          //     ) * 12,
          // }}
        >
          {(props.componentSettings.options || []).map(({ label, value }) => {
            const current = props.value || [];
            const selected = current.indexOf(value || label) !== -1;
            return (
              <SurveyButton
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
                      props.onChange([value || label], false);
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
                title={t("Multiple Select")}
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
              <FormElementOptionsInput
                key={props.id}
                initialValue={props.componentSettings.options || []}
                onChange={updateComponentSetting(
                  "options",
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

export default MultipleChoice;
