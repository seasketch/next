import { TableIcon } from "@heroicons/react/outline";
import React, { useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { SurveyStyleContext } from "../surveys/appearance";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  FormLanguageContext,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type MatrixProps = {
  options?: FormElementOption[];
  rows?: FormElementOption[];
};

export type MatrixValue = {
  [row: string]: string;
};

const Matrix: FormElementComponent<MatrixProps, MatrixValue> = (props) => {
  const context = useContext(FormLanguageContext);
  const { isSmall } = useContext(SurveyStyleContext);
  const options = useLocalizedComponentSetting(
    "options",
    props
  ) as FormElementOption[];
  const rows = useLocalizedComponentSetting(
    "rows",
    props
  ) as FormElementOption[];

  function updateValue(row: FormElementOption, option: string) {
    const newValue = { ...props.value, [row.value || row.label]: option };
    if (option === "") {
      delete newValue[row.value || row.label];
    }
    props.onChange(
      newValue,
      validate(newValue, props.componentSettings, props.isRequired)
    );
  }

  // TODO: add validation when props.isRequired is true
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
        className="my-4"
        style={{
          gridRowGap: "5px",
          display: "grid",
          grid: `
        [row1-start] "shape slider" 1fr [row1-end]
        / ${isSmall ? "1fr 0fr" : "auto auto"}
        `,
        }}
      >
        <div></div>
        <div className="flex space-x-2">
          {isSmall
            ? null
            : options.map((option) => {
                return (
                  <div
                    key={option.label}
                    className="flex-1 text-center text-sm"
                  >
                    {option.label}
                  </div>
                );
              })}
        </div>
        {rows.map((row) => {
          return (
            <React.Fragment key={row.label}>
              <div className="px-2 items-center flex bg-black bg-opacity-10 ltr:rounded-l rtl:rounded-r">
                {row.label}
              </div>
              <div
                className={`flex w-32 sm:w-auto items-center bg-black bg-opacity-10 p-2 ltr:rounded-r rtl:rounded-l`}
              >
                {isSmall ? (
                  <>
                    <select
                      value={
                        props.value ? props.value[row.value || row.label] : ""
                      }
                      onChange={(e) => updateValue(row, e.target.value)}
                      className="w-full text-black opacity-90 active:opacity-100 text-sm pr-7 h-10 rounded "
                    >
                      <option value=""></option>
                      {options.map((option) => {
                        return (
                          <option
                            key={option.label}
                            value={option.value || option.label}
                          >
                            {option.label}
                          </option>
                        );
                      })}
                    </select>
                  </>
                ) : (
                  <>
                    {options.map((option) => {
                      return (
                        <div key={option.label} className="flex-1 text-center">
                          <input
                            checked={
                              props.value
                                ? props.value[row.value || row.label] ===
                                  (option.value || option.label)
                                : false
                            }
                            value={option.value || option.label}
                            name={row.value || row.label}
                            type="radio"
                            onChange={(e) => {
                              updateValue(row, e.target.value);
                            }}
                          />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              <FormElementOptionsInput
                heading="Rows"
                key={props.id}
                prop="rows"
                componentSettings={props.componentSettings}
                alternateLanguageSettings={props.alternateLanguageSettings}
                onChange={updateComponentSetting(
                  "rows",
                  props.componentSettings,
                  context?.lang.code,
                  props.alternateLanguageSettings
                )}
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

// Returns true if validation errors
function validate(
  value: MatrixValue | undefined,
  componentSettings: MatrixProps,
  isRequired: boolean
) {
  if (value === undefined) {
    return isRequired;
  }
  for (const row of componentSettings.rows || []) {
    if (value[row.value || row.label] === undefined) {
      return isRequired;
    }
  }
  return false;
}

Matrix.label = <Trans ns="admin:surveys">Matrix</Trans>;
Matrix.description = (
  <Trans ns="admin:surveys">Choose values for multiple items</Trans>
);
Matrix.defaultBody = questionBodyFromMarkdown(`
# 
`);
Matrix.defaultComponentSettings = {
  options: ["A", "B", "C"].map((value) => ({
    // eslint-disable-next-line i18next/no-literal-string
    label: `Option ${value}`,
    value,
  })),
  // eslint-disable-next-line i18next/no-literal-string
  rows: ["1", "2", "3"].map((value) => ({ value, label: `Row ${value}` })),
};

Matrix.icon = () => (
  <div className="bg-green-600 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <TableIcon className="w-7 h-7" />
  </div>
);

export default Matrix;
