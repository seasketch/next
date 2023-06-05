import { ReactElement, useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  adminValueInputCommonClassNames,
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import {
  CheckIcon,
  MinusIcon,
  PlusIcon,
  UserAddIcon,
  XIcon,
} from "@heroicons/react/outline";
import NumberInput from "../components/NumberInput";
import InputBlock from "../components/InputBlock";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import { SkippedQuestion } from "../admin/surveys/ResponseGrid";
import EditableResponseCell, {
  CellEditorComponent,
} from "../admin/surveys/EditableResponseCell";
import SurveyInputButton from "./SurveyInputButton";
require("./Number.css");

export type ParticipantCountProps = {
  max?: number;
  howManyBody?: any;
};

/**
 * Identifies whether this survey response represents an individual or a group
 * Can be paired with DemographicInput to collect more information about the group
 */
const ParticipantCount: FormElementComponent<
  ParticipantCountProps,
  number | null
> = (props) => {
  const { t } = useTranslation("surveys");
  const style = useContext(FormElementLayoutContext).style;
  const defaultValue = 10;
  const max = valueOrUndefined(props.componentSettings.max);
  const numberInputMin = 2;
  const [yesNoState, setYesNoState] = useState(
    props.value ? props.value !== 1 : undefined
  );

  const [state, setState] = useState<{
    value: string;
    errors: ReactElement | string | null;
  }>({
    value:
      props.value === undefined
        ? defaultValue?.toString() || ""
        : props.value?.toString() || "",
    errors: validate(
      yesNoState,
      props.value?.toString() || defaultValue.toString() || "",
      props.componentSettings,
      true,
      !!props.submissionAttempted
    ).errors,
  });

  // useEffect(() => {
  //   if (props.value === undefined) {
  //     props.onChange(defaultValue, !!state.errors);
  //   }
  // }, []);

  function updateValue(value: string, isGroup?: boolean) {
    const results = validate(
      isGroup !== undefined ? isGroup : yesNoState,
      value,
      { min: numberInputMin, max },
      true,
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
      if (amount > 0 && numberInputMin !== undefined && from < numberInputMin) {
        from = numberInputMin - amount;
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
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div className="w-full max-w-full form-element-short-text pt-1 my-4 space-x-3 rtl:space-x-reverse">
        <SurveyInputButton
          label={t("Yes")}
          Icon={CheckIcon}
          selected={yesNoState === true}
          onClick={() => {
            setYesNoState(true);
            updateValue(
              props.value && props.value > 1
                ? props.value.toString()
                : defaultValue.toString(),
              true
            );
          }}
          className={
            props.submissionAttempted && props.value === undefined
              ? "text-red-500"
              : ""
          }
        />
        <SurveyInputButton
          label={t("No")}
          Icon={XIcon}
          selected={yesNoState === false}
          onClick={() => {
            setYesNoState(false);
            updateValue("1", false);
          }}
          className={
            props.submissionAttempted && props.value === undefined
              ? "text-red-500"
              : ""
          }
        />
      </div>
      {yesNoState === true && (
        <>
          <FormElementBody
            formElementId={props.id}
            isInput={true}
            body={
              props.componentSettings.howManyBody ||
              ParticipantCount.defaultComponentSettings?.howManyBody
            }
            componentSettingName="howManyBody"
            componentSettings={props.componentSettings}
            required={props.isRequired}
            editable={props.editable}
            alternateLanguageSettings={props.alternateLanguageSettings}
          />
          <div
            className={`max-w-full form-element-short-text flex flex-row ${
              style.compactAppearance
                ? "w-32 h-8 shadow-sm"
                : "h-12 w-40 shadow-lg"
            } overflow-hidden bg-opacity-10 text-4xl rounded-md mt-4 mb-4 focus:outline-white items-center`}
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
                    numberInputMin === undefined ||
                    parseInt(state.value) > numberInputMin ||
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
              className={`block bg-transparent ${
                style.compactAppearance
                  ? "text-base font-normal p-0"
                  : "text-xl font-bold"
              }  form-element-number-input text-center h-full border-none shadow-inner focus:ring-transparent  mt-2 mb-2 bg-opacity-90 ${
                state.errors
                  ? "bg-red-50 text-red-900"
                  : "bg-white text-gray-900"
              }`}
              style={{
                width: style.compactAppearance ? 60 : 70,
                borderTop: `2px solid ${style.secondaryColor}`,
                borderBottom: `2px solid ${style.secondaryColor2}`,
              }}
              type="number"
              value={state.value}
              onChange={(e) => {
                updateValue(e.target.value);
              }}
              max={max}
              min={numberInputMin}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  props.onSubmit();
                }
              }}
              autoFocus={props.autoFocus}
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
        </>
      )}
      {state.errors && <p className="mb-4 text-red-500">{state.errors}</p>}
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
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

ParticipantCount.label = <Trans ns="admin:surveys">Participant Count</Trans>;
ParticipantCount.description = (
  <Trans ns="admin:surveys">To support group responses</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
ParticipantCount.defaultBody = questionBodyFromMarkdown(`
# Is this a group response?
If yes, you will be asked to provide a count of the number of people represented.
`);

ParticipantCount.defaultComponentSettings = {
  max: 200,
  howManyBody: questionBodyFromMarkdown(`
# How many people are represented in this response?
`),
};

function validate(
  yesNoState: boolean | undefined,
  valueString: string,
  { min, max }: { min?: number; max?: number },
  isRequired: boolean,
  submissionAttempted: boolean
) {
  if (yesNoState === false) {
    return { value: 1, errors: null };
  }
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

ParticipantCount.icon = () => (
  <div className="bg-blue-700 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <UserAddIcon className="w-2/3" />
  </div>
);

ParticipantCount.adminValueInput = function ({
  value,
  onChange,
  componentSettings,
}: {
  value: any;
  onChange: (value: any) => void;
  componentSettings: ParticipantCountProps;
}) {
  return (
    <input
      autoComplete="false"
      spellCheck={false}
      type="number"
      min={1}
      max={componentSettings.max}
      className={`bg-transparent border-none text-center w-full ${adminValueInputCommonClassNames}`}
      value={value || ""}
      onChange={(e) => onChange(parseInt(e.target.value))}
    />
  );
};

ParticipantCount.ResponseGridCell = function ({
  value,
  componentSettings,
  elementId,
  updateValue,
}) {
  return (
    <EditableResponseCell
      elementId={elementId}
      value={value}
      updateValue={updateValue}
      editor={NumberCellEditor}
      componentSettings={componentSettings}
    >
      {value === null || value === undefined ? (
        <SkippedQuestion />
      ) : (
        <span className="font-mono lining-nums">{value.toString()}</span>
      )}
    </EditableResponseCell>
  );
};

export const NumberCellEditor: CellEditorComponent<
  number | undefined | null,
  ParticipantCountProps
> = ({
  value,
  disabled,
  onChange,
  onRequestSave,
  onRequestCancel,
  componentSettings,
}) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <input
      className="p-1 text-sm w-full rounded"
      type="number"
      min={1}
      max={componentSettings.max}
      defaultValue={1}
      value={val || ""}
      onChange={(e) => setVal(parseInt(e.target.value))}
    />
  );
};

ParticipantCount.defaultExportId = "participants";

export default ParticipantCount;
