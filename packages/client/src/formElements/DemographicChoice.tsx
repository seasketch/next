import { CheckIcon } from "@heroicons/react/outline";
import { useCallback, useContext, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell from "../admin/surveys/EditableResponseCell";
import { ChoiceAdminValueInput, SingleSelectCellEditor } from "./ComboBox";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  FormLanguageContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import SurveyInputButton from "./SurveyInputButton";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import Badge from "../components/Badge";

export type DemographicChoiceProps = {
  options?: FormElementOption[];
  groupResponseBody: any;
};

export enum STAGES {
  SINGLE_RESPONDENT,
  GROUP_RESPONSE,
}

export type DemographicChoiceValue = { [option: string]: number };

const DemographicChoice: FormElementComponent<
  DemographicChoiceProps,
  DemographicChoiceValue
> = (props) => {
  const { t } = useTranslation("surveys");
  const context = useContext(FormLanguageContext);
  const options = useLocalizedComponentSetting(
    "options",
    props
  ) as FormElementOption[];

  const [state, setState] = useState<{
    value: DemographicChoiceValue;
    sum: number;
  }>(
    (() => {
      const value = props.value || {};
      if (!props.value) {
        for (const option of props.componentSettings.options || []) {
          value[option.value || option.label] = 0;
        }
        props.onChange(value, props.surveyParticipantCount !== 0);
      }
      let sum = 0;
      for (const key of Object.keys(value)) {
        if (value[key] > 0) {
          sum += value[key];
        }
      }
      return {
        value,
        sum,
      };
    })()
  );

  const updateValue = useCallback(
    (key: string, value: string) => {
      setState((prev) => {
        const newValue = { value: { ...prev.value }, sum: 0 };
        if (value === "") {
          delete newValue.value[key];
        } else {
          newValue.value[key] = parseInt(value);
        }
        for (const key of Object.keys(newValue.value)) {
          if (newValue.value[key] > 0) {
            newValue.sum += newValue.value[key];
          }
        }
        props.onChange(
          newValue.value,
          newValue.sum !== props.surveyParticipantCount
        );
        return newValue;
      });
    },
    [setState, props.onChange, props.surveyParticipantCount]
  );

  const noValue = !props.value || Object.keys(props.value).length === 0;
  const style = useContext(FormElementLayoutContext).style;

  const langContext = useContext(FormLanguageContext);

  return (
    <>
      {props.stage === STAGES.GROUP_RESPONSE ? (
        <>
          <FormElementBody
            key="groupResponseBody"
            formElementId={props.id}
            isInput={true}
            body={
              props.componentSettings.groupResponseBody ||
              DemographicChoice.defaultComponentSettings?.groupResponseBody
            }
            componentSettingName="groupResponseBody"
            componentSettings={props.componentSettings}
            required={props.isRequired}
            editable={props.editable}
            alternateLanguageSettings={props.alternateLanguageSettings}
          />
          <div className="block sm:inline-block">
            <div className="py-4 pb-6 space-y-2 flex flex-col">
              {(options || []).map(({ label, value }) => {
                let count = state.value[value || label]?.toString();

                return (
                  <div
                    key={value || label}
                    style={{ minWidth: 256 }}
                    className="max-w-full flex items-center justify-center border border-white rounded"
                  >
                    <div className="flex-1 px-4 truncate">{label || value}</div>
                    <div className="flex-none">
                      <input
                        style={{
                          backgroundColor: style.secondaryColor,
                        }}
                        className={`w-24 ${style.secondaryTextClass} ${
                          langContext.lang.rtl ? "text-left" : "text-right"
                        } rounded-r`}
                        type="number"
                        min={0}
                        max={props.surveyParticipantCount || 1}
                        id={value || label}
                        name={value || label}
                        value={count}
                        onChange={(e) => {
                          updateValue(value || label, e.target.value);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className={`py-2 flex items-center justify-center rounded mb-5 font-semibold ${
                state.sum === props.surveyParticipantCount
                  ? style.secondaryTextClass
                  : "text-red-800"
              }`}
              style={{ background: style.secondaryColor }}
            >
              {/* show sum total for all options vs props.surveyParticipantCount */}
              <div className="flex-1 px-4">{t("Total")}</div>
              <div className="flex-none py-0 px-2">
                {
                  // sum for all options
                  state.sum
                }{" "}
                / {props.surveyParticipantCount || 1}
              </div>
            </div>
          </div>
        </>
      ) : (
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
                const count = (props.value || {})[value || label];
                const selected = Boolean(count && count >= 1);
                return (
                  <SurveyInputButton
                    key={value || label}
                    className={`w-full ${
                      props.isRequired && noValue && props.submissionAttempted
                        ? `border-red-300`
                        : ""
                    }`}
                    label={label}
                    iconPlacement={"right"}
                    Icon={
                      props.stage === STAGES.GROUP_RESPONSE || !selected
                        ? () => null
                        : CheckIcon
                    }
                    selected={selected}
                    onClick={() => {
                      if (selected) {
                        props.onChange(
                          {
                            [value || label]: 0,
                          },
                          false,
                          false
                        );
                      } else {
                        props.onChange(
                          {
                            [value || label]: 1,
                          },
                          false,
                          !props.isLastQuestion
                        );
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
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

DemographicChoice.label = <Trans ns="admin:surveys">Demographic Choice</Trans>;
DemographicChoice.description = (
  <Trans ns="admin:surveys">For individuals or groups</Trans>
);
DemographicChoice.defaultBody = questionBodyFromMarkdown(`
# What is your age?
Demographic Choice questions work in conjunction with Participant Count questions to collect info about the people taking your survey. Switch "stages" to see how this question will look for individuals vs groups.
`);
DemographicChoice.defaultComponentSettings = {
  options: ["<18", "18-30", "30-50", "50+"].map((value) => ({
    // eslint-disable-next-line i18next/no-literal-string
    label: `${value}`,
    value,
  })),
  groupResponseBody: questionBodyFromMarkdown(`
# What are the ages of everyone in the group?
Please make sure your answers total the number of people in the group.
`),
};
DemographicChoice.advanceAutomatically = (settings, isGroupResponse) =>
  !isGroupResponse;

DemographicChoice.icon = () => (
  <div className="bg-blue-700 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
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

DemographicChoice.adminValueInput = ChoiceAdminValueInput;

DemographicChoice.ResponseGridCell = function ({
  value,
  componentSettings,
  updateValue,
  elementId,
}) {
  let invalidValue = false;
  if (value && typeof value !== "object") {
    invalidValue = true;
  }
  return (
    <EditableResponseCell
      elementId={elementId}
      value={value}
      updateValue={updateValue}
      editor={SingleSelectCellEditor}
      componentSettings={componentSettings}
    >
      <div className="space-x-1">
        {invalidValue && (
          <Badge variant="error">
            <Trans ns="admin:surveys">Invalid value</Trans>
          </Badge>
        )}
        {/* TODO: make editable? */}
        {!invalidValue && Object.keys(value || {}).length === 1 && (
          <Badge variant="secondary">{Object.keys(value || {})[0]}</Badge>
        )}
        {!invalidValue &&
          Object.keys(value || {}).length > 1 &&
          (componentSettings.options || [])
            .filter((o) => (value || {})[o.value || o.label] >= 1)
            .map((option) => (
              <Badge key={option.value || option.label} variant="secondary">
                "{option.label}":
                <span className="font-mono ml-0.5">
                  {(value || {})[option.value || option.label]}
                </span>
              </Badge>
            ))}
      </div>
    </EditableResponseCell>
  );
};

DemographicChoice.stages = STAGES;

DemographicChoice.getInitialStage = (
  value,
  componentSettings,
  isGroupResponse
) => (isGroupResponse ? STAGES.GROUP_RESPONSE : STAGES.SINGLE_RESPONDENT);

export default DemographicChoice;
