import {
  FieldRuleOperator,
  FormLogicCommand,
  FormLogicCondition,
  FormLogicOperator,
  LogicRuleDetailsFragment,
  SketchFormElementFragment,
} from "../../generated/graphql";
import { ReactNode, useCallback, useMemo, useState } from "react";
import FormElementFactory from "../../surveys/FormElementFactory";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import { defaultStyle } from "../../surveys/appearance";
require("./sketching.css");

type SketchProperties = { name?: string } & { [id: number]: string };

interface FormState {
  [id: number]: {
    value: any;
    error?: boolean;
  };
}

export default function SketchForm({
  startingProperties,
  onChange,
  submissionAttempted,
  formElements,
  editable,
  onSubmissionRequested,
  logicRules,
  ...props
}: {
  startingProperties: { [id: number]: any };
  onChange?: (
    properties: SketchProperties,
    hasValidationErrors: boolean
  ) => void;
  onSubmissionRequested?: () => void;
  submissionAttempted: boolean;
  formElements: SketchFormElementFragment[];
  editable?: boolean;
  logicRules: LogicRuleDetailsFragment[];
  renderElement?: (
    children: ReactNode,
    element: SketchFormElementFragment,
    index: number
  ) => ReactNode;
}) {
  const [state, setState] = useState<FormState>(
    Object.keys(startingProperties).reduce(
      (state, id) => {
        state[parseInt(id)] = {
          value: startingProperties[parseInt(id)],
        };
        return state;
      },
      {} as {
        [id: number]: {
          value: any;
          error?: boolean;
        };
      }
    )
  );

  const noop = useCallback(() => {}, []);

  const hiddenElements = useMemo(() => {
    if (editable) {
      return [];
    } else {
      return evaluateVisibilityRules(state || {}, logicRules);
    }
  }, [logicRules, state, editable]);

  const renderElement = useCallback(
    (element: SketchFormElementFragment) => {
      if (hiddenElements.includes(element.id)) {
        return null;
      }
      return (
        <FormElementFactory
          key={`${element.typeId}-${element.id}`}
          typeName={element.type!.componentName}
          componentSettings={element.componentSettings}
          value={state[element.id] ? state[element.id].value : undefined}
          id={element.id}
          isRequired={element.isRequired}
          alternateLanguageSettings={element.alternateLanguageSettings}
          body={element.body}
          onChange={(value, validationErrors) => {
            setState((prev) => ({
              ...prev,
              [element.id]: {
                value,
                error: validationErrors,
              },
            }));
            if (onChange) {
              let otherValidationErrors = false;
              const hiddenFields = evaluateVisibilityRules(
                {
                  ...state,
                  [element.id]: {
                    value,
                    error: validationErrors,
                  },
                },
                logicRules
              );
              for (const id in state) {
                if (
                  !hiddenFields.includes(parseInt(id)) &&
                  state[id].error &&
                  parseInt(id) !== element.id
                ) {
                  otherValidationErrors = true;
                }
              }
              const hasErrors = validationErrors || otherValidationErrors;
              const newProperties: { [id: number]: any } = {
                [element.id]: value,
              };
              for (const strId in state) {
                const id = parseInt(strId);
                if (id !== element.id) {
                  newProperties[id] = state[id].value;
                }
              }
              onChange(newProperties, hasErrors);
            }
          }}
          submissionAttempted={submissionAttempted}
          onSubmit={
            element.typeId === "FeatureName"
              ? onSubmissionRequested || noop
              : noop
          }
          isSpatial={false}
          featureNumber={0}
          onRequestStageChange={noop}
          onRequestNext={noop}
          onRequestPrevious={noop}
          stage={0}
          isSketchWorkflow={true}
          editable={editable}
          autoFocus={element.typeId === "FeatureName"}
        />
      );
    },
    [editable, noop, onChange, state, submissionAttempted]
  );

  return (
    <div className="SketchForm" dir="ltr">
      <FormElementLayoutContext.Provider
        value={{
          mapPortal: null,
          style: {
            ...defaultStyle,
            isDark: false,
            textClass: "text-black",
            backgroundColor: "#eee",
            secondaryColor: "#999",
            secondaryColor2: "#aaa",
            isSmall: false,
            compactAppearance: true,
          },
          navigatingBackwards: false,
        }}
      >
        <div>
          {formElements.map((element, i) => {
            if (props.renderElement) {
              return props.renderElement(renderElement(element), element, i);
            } else {
              return renderElement(element);
            }
          })}
        </div>
      </FormElementLayoutContext.Provider>
    </div>
  );
}

/**
 * Evaluates the visibility rules and returns a list of form elements that should be hidden
 *
 * @param state Form values and errors, keyed by FormElement id
 * @param logicRules Visibility rules and conditions that apply to the form
 */
export function evaluateVisibilityRules(
  state: FormState,
  logicRules: LogicRuleDetailsFragment[]
) {
  const hidden: number[] = [];
  for (const rule of logicRules) {
    if (
      rule.command === FormLogicCommand.Show ||
      rule.command === FormLogicCommand.Hide
    ) {
      const passes = evaluateVisibilityRule(rule, state);
      if (rule.command === FormLogicCommand.Show) {
        if (!passes) {
          hidden.push(rule.formElementId);
        }
      } else if (rule.command === FormLogicCommand.Hide) {
        if (passes) {
          hidden.push(rule.formElementId);
        }
      }
    }
  }
  return hidden;
}

function evaluateVisibilityRule(
  rule: LogicRuleDetailsFragment,
  state: FormState
) {
  for (const condition of rule.conditions || []) {
    const passes = evaluateCondition(
      condition,
      state[condition.subjectId]?.value
    );
    if (passes && rule.booleanOperator === FormLogicOperator.Or) {
      return true;
    } else if (rule.booleanOperator === FormLogicOperator.And && !passes) {
      return false;
    }
  }
  if (rule.booleanOperator === FormLogicOperator.Or) {
    return false;
  } else {
    return true;
  }
}

function evaluateCondition(
  condition: Pick<FormLogicCondition, "operator" | "subjectId" | "value">,
  value?: any
) {
  // First, normalize value
  if (
    Array.isArray(value) &&
    condition.operator !== FieldRuleOperator.Contains
  ) {
    value = value[0];
  }
  switch (condition.operator) {
    case FieldRuleOperator.IsBlank:
      return value === undefined || value === null || value === "";
    case FieldRuleOperator.Equal:
      return value === condition.value;
    case FieldRuleOperator.NotEqual:
      return value !== condition.value;
    case FieldRuleOperator.GreaterThan:
      return value > condition.value;
    case FieldRuleOperator.LessThan:
      return value < condition.value;
    case FieldRuleOperator.Contains:
      return Array.isArray(value) && value.includes(condition.value);
  }
  return false;
}
