import { ReactElement, useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { SurveyStyleContext } from "../surveys/appearance";
import { MinusIcon, PlusIcon } from "@heroicons/react/outline";
import NumberInput from "../components/NumberInput";
import InputBlock from "../components/InputBlock";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
require("./Number.css");

export type NumberProps = {
  min?: number;
  max?: number;
  defaultValue?: number;
};

/**
 * Email text input with validation. Automatically populates from registered
 * email if the user is logged in.
 */
const Number: FormElementComponent<NumberProps, number | null> = (props) => {
  const { t } = useTranslation("surveys");
  const style = useContext(SurveyLayoutContext).style;
  const defaultValue = props.componentSettings.defaultValue || 0;
  const min = valueOrUndefined(props.componentSettings.min);
  const max = valueOrUndefined(props.componentSettings.max);

  const [state, setState] = useState<{
    value: string;
    errors: ReactElement | string | null;
  }>({
    value:
      props.value === undefined
        ? defaultValue?.toString() || ""
        : props.value?.toString() || "",
    errors: validate(
      props.value?.toString() || defaultValue.toString() || "",
      props.componentSettings,
      props.isRequired,
      !!props.submissionAttempted
    ).errors,
  });

  useEffect(() => {
    if (props.value === undefined) {
      props.onChange(defaultValue, !!state.errors);
    }
  }, []);

  function updateValue(value: string) {
    const results = validate(
      value,
      { min, max },
      props.isRequired,
      !!props.submissionAttempted
    );
    setState({
      value: value,
      errors: results.errors,
    });
    props.onChange(results.value, !!results.errors);
  }

  function increment(amount: number) {
    return () => {
      let from = parseInt(state.value);
      if (isNaN(from)) {
        from = defaultValue;
      }
      // decrementing
      if (amount < 0 && max !== undefined && from > max) {
        from = max - amount;
      }
      // incrementing
      if (amount > 0 && min !== undefined && from < min) {
        from = min - amount;
      }
      updateValue((from + amount).toString());
    };
  }

  // eslint-disable-next-line i18next/no-literal-string
  const buttonClass = `flex-1 text-center flex items-center justify-center focus:bg-black focus:bg-opacity-10 focus:ring-transparent focus:outline-none h-full hover:bg-black hover:bg-opacity-10
  `;
  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div
        className="max-w-full form-element-short-text flex flex-row h-12 w-40 overflow-hidden bg-opacity-10 text-4xl rounded-md shadow-lg mt-4 mb-4 focus:outline-white items-center"
        style={{
          background: `linear-gradient(170deg, ${style.secondaryColor}, ${style.secondaryColor2})`,
        }}
      >
        <button
          title={t("Subtract")}
          disabled={
            !(
              // enabled if
              (
                min === undefined ||
                parseInt(state.value) > min ||
                state.value === ""
              )
            )
          }
          className={buttonClass}
          onMouseDown={increment(-1)}
        >
          <MinusIcon className={`h-4 w-4 ${style.secondaryTextClass}`} />
        </button>
        <input
          className={`block bg-transparent text-xl font-bold form-element-number-input text-center h-full border-none shadow-inner focus:ring-transparent  mt-2 mb-2 bg-opacity-90 ${
            state.errors ? "bg-red-50 text-red-900" : "bg-white text-gray-900"
          }`}
          style={{
            width: 70,
            borderTop: `2px solid ${style.secondaryColor}`,
            borderBottom: `2px solid ${style.secondaryColor2}`,
          }}
          type="number"
          value={state.value}
          onChange={(e) => {
            updateValue(e.target.value);
          }}
          max={max}
          min={min}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              props.onSubmit();
            }
          }}
          autoFocus={true}
          required={props.isRequired}
        />
        <button
          title={t("Add")}
          disabled={
            !(
              // enabled if
              (
                max === undefined ||
                parseInt(state.value) < max ||
                state.value === ""
              )
            )
          }
          className={buttonClass}
          onMouseDown={increment(1)}
        >
          <PlusIcon className={`h-4 w-4 ${style.secondaryTextClass}`} />
        </button>
      </div>
      {state.errors && <p className="mb-4 text-red-500">{state.errors}</p>}
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <InputBlock
                labelType="small"
                title={t("Default Value", { ns: "admin:surveys" })}
                input={
                  <NumberInput
                    required={true}
                    placeholder={t("none")}
                    name="defaultValue"
                    value={props.componentSettings.defaultValue}
                    onChange={(value) =>
                      updateComponentSetting(
                        "defaultValue",
                        props.componentSettings
                      )(value || 0)
                    }
                  />
                }
              />
              <InputBlock
                labelType="small"
                title={t("Minimum", { ns: "admin:surveys" })}
                input={
                  <NumberInput
                    placeholder={t("none")}
                    name="min"
                    value={props.componentSettings.min}
                    onChange={(value) =>
                      updateComponentSetting(
                        "min",
                        props.componentSettings
                      )(value !== null ? value : undefined)
                    }
                  />
                }
              />
              <InputBlock
                labelType="small"
                title={t("Maximum", { ns: "admin:surveys" })}
                input={
                  <NumberInput
                    placeholder={t("none")}
                    name="max"
                    value={props.componentSettings.max}
                    onChange={(value) =>
                      updateComponentSetting(
                        "max",
                        props.componentSettings
                      )(value !== null ? value : undefined)
                    }
                  />
                }
              />
            </>
          );
        }}
      />
    </>
  );
};

Number.label = <Trans>Number</Trans>;
Number.description = <Trans>Single integer input</Trans>;
// eslint-disable-next-line i18next/no-literal-string
Number.defaultBody = questionBodyFromMarkdown(`
# 
`);
Number.defaultComponentSettings = { defaultValue: 0 };

function validate(
  valueString: string,
  { min, max }: { min?: number; max?: number },
  isRequired: boolean,
  submissionAttempted: boolean
) {
  let errors: ReactElement | null = null;
  let value: number | null = null;
  if (valueString !== "") {
    value = parseInt(valueString);
  }
  if (value === null && isRequired && submissionAttempted) {
    errors = <Trans ns="surveys">Number required</Trans>;
  } else if (
    min !== undefined &&
    value !== undefined &&
    value !== null &&
    value < min
  ) {
    errors = (
      <Trans ns="admin">
        Number must be equal to or greater than {min.toString()}
      </Trans>
    );
  } else if (
    max !== undefined &&
    value !== undefined &&
    value !== null &&
    value > max
  ) {
    errors = (
      <Trans ns="admin">
        Number must be equal to or less than {max.toString()}
      </Trans>
    );
  }

  return { value, errors };
}

function valueOrUndefined(value: any | undefined | null) {
  if (value === null || value === undefined) {
    return undefined;
  } else {
    return value;
  }
}

Number.icon = () => (
  <div className="bg-red-800 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <MinusIcon strokeWidth={4} className="w-1/3 h-1/3" />
    <PlusIcon className="w-1/3 h-1/3" />
  </div>
);

Number.adminValueInput = function ({
  value,
  onChange,
  componentSettings,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: NumberProps;
}) {
  return (
    <input
      autoComplete="false"
      spellCheck={false}
      type="number"
      min={componentSettings.min}
      max={componentSettings.max}
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value || ""}
      onChange={(e) => onChange(parseInt(e.target.value))}
    />
  );
};

export default Number;
