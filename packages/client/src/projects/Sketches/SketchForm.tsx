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
import { sortFormElements } from "../../formElements/sortFormElements";
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
  editable,
  onSubmissionRequested,
  logicRules,
  featureNumber,
  isSketchWorkflow,
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
  featureNumber?: number;
  isSketchWorkflow?: boolean;
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

  // formElements need to be sorted before display
  const formElements = useMemo<SketchFormElementFragment[]>(() => {
    return sortFormElements(props.formElements!);
  }, [props.formElements]);

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
            setState((prev) => {
              const newState = {
                ...prev,
                [element.id]: {
                  value,
                  error: validationErrors,
                },
              };
              if (onChange) {
                const hasErrors = doSketchPropertiesHaveErrors(
                  newState,
                  formElements,
                  logicRules
                );
                onChange(
                  sketchFormStateToProperties(
                    newState,
                    formElements,
                    logicRules
                  ),
                  hasErrors
                );
              }
              return newState;
            });
          }}
          submissionAttempted={submissionAttempted}
          onSubmit={
            element.typeId === "FeatureName"
              ? onSubmissionRequested || noop
              : noop
          }
          isSpatial={false}
          featureNumber={featureNumber || 0}
          onRequestStageChange={noop}
          onRequestNext={noop}
          onRequestPrevious={noop}
          stage={0}
          isSketchWorkflow={Boolean(isSketchWorkflow)}
          editable={editable}
          autoFocus={element.typeId === "FeatureName"}
        />
      );
    },
    [editable, noop, onChange, state, submissionAttempted]
  );

  return (
    <div>
      {formElements.map((element, i) => {
        if (props.renderElement) {
          return props.renderElement(renderElement(element), element, i);
        } else {
          return renderElement(element);
        }
      })}
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

export interface SketchFormState {
  [formElementId: number]: {
    value: any;
    error?: boolean;
  };
}

/**
 * Evaluates the form state and returns true if any errors are found
 * @param state
 * @param formElements
 * @param logicRules
 * @param additionalHiddenElements
 * @returns boolean indicating whether errors were found
 */
export function doSketchPropertiesHaveErrors(
  state: SketchFormState,
  formElements: Pick<SketchFormElementFragment, "id" | "isRequired">[],
  logicRules: LogicRuleDetailsFragment[],
  additionalHiddenElements: number[] = []
) {
  const hiddenElements = evaluateVisibilityRules(state, logicRules);
  for (const element of formElements) {
    if (
      !hiddenElements.includes(element.id) &&
      !additionalHiddenElements.includes(element.id)
    ) {
      if (element.isRequired && !state[element.id]) {
        return true;
      } else if (state[element.id] && state[element.id].error) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Converts a SketchFormState to a list of geojson properties. Evaluates
 * visibility rules and excludes hidden elements, as well as elements with
 * errors
 * @returns geojson feature properties
 */
export function sketchFormStateToProperties(
  state: SketchFormState,
  formElements: Pick<SketchFormElementFragment, "id" | "isRequired">[],
  logicRules: LogicRuleDetailsFragment[],
  additionalHiddenElements: number[] = []
) {
  const hiddenElements = evaluateVisibilityRules(state, logicRules);
  const properties: { [formElementId: number]: any } = {};
  for (const element of formElements) {
    if (
      !hiddenElements.includes(element.id) &&
      !state[element.id]?.error &&
      !additionalHiddenElements.includes(element.id)
    ) {
      properties[element.id] = state[element.id]?.value || undefined;
    }
  }
  return properties;
}
