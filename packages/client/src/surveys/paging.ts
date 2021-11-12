import { collectText } from "../admin/surveys/collectText";
import {
  FieldRuleOperator,
  FormLogicCondition,
  FormLogicOperator,
  FormLogicRuleConditionsArgs,
  SurveyAppFormElementFragment,
  SurveyAppRuleFragment,
} from "../generated/graphql";

export interface SurveyPagingState<T> {
  /** If true, previous FormElement is WelcomeMessage */
  isFirstQuestion: boolean;
  /** If true, next FormElement is ThankYou */
  isLastQuestion: boolean;
  /** Next FormElement that should be displayed */
  nextFormElement: T | null;
  previousFormElement: T | null;
  sortedFormElements: T[];
}
/**
 * Takes the current state of a survey and determines the next page that should
 * be displayed based on question order, rule conditions, and answers
 *
 * @param currentIndex index of current FormElement/page displayed
 * @param sortedFormElements form elements sorted by position, with
 * WelcomeMessage and ThankYou at the ends
 * @param rules FormLogicRules that determine advancement based on answers
 * @param answers All answers to questions, keyed by FormElement.id
 * @returns
 */
export function getSurveyPagingState<
  T extends Pick<SurveyAppFormElementFragment, "id" | "jumpToId" | "typeId">
>(
  currentIndex: number,
  sortedFormElements: T[],
  rules: Pick<
    SurveyAppRuleFragment,
    "booleanOperator" | "conditions" | "jumpToId" | "position" | "formElementId"
  >[],
  answers: { [formElementId: number]: any }
): SurveyPagingState<T> {
  const current = sortedFormElements[currentIndex];
  if (!current) {
    throw new Error(`No FormElement at index ${currentIndex}`);
  }
  // Full path up to this point must be calculated so that previousFormElement
  // can be determined.
  const path = calculatePathToElement(
    current.id,
    sortedFormElements,
    rules,
    answers
  );

  const next = getNextFormElement(current, sortedFormElements, rules, answers);
  return {
    isLastQuestion: next?.typeId === "ThankYou",
    isFirstQuestion: currentIndex === 1,
    previousFormElement: path[path.length - 2],
    nextFormElement: next,
    sortedFormElements,
  };
}

function calculatePathToElement<
  T extends Pick<SurveyAppFormElementFragment, "id" | "jumpToId">
>(
  currentId: number,
  sortedFormElements: T[],
  rules: Pick<
    SurveyAppRuleFragment,
    "booleanOperator" | "conditions" | "jumpToId" | "position" | "formElementId"
  >[],
  answers: { [formElementId: number]: any }
): T[] {
  const currentIndex = sortedFormElements.findIndex(
    (el) => el.id === currentId
  );
  if (currentIndex === 0) {
    return [sortedFormElements[0]];
  }
  const path: T[] = [];
  let recursionLimit = 20_000;
  let step: T | null = sortedFormElements[0];
  path.push(sortedFormElements[0]);
  while (step !== null && recursionLimit--) {
    step = getNextFormElement(step, sortedFormElements, rules, answers);
    if (step) {
      path.push(step);
      if (step.id === currentId) {
        return path;
      }
      if (sortedFormElements.indexOf(step) > currentIndex) {
        throw new Error("Stepped past current formElement!");
      }
    }
  }
  if (recursionLimit < 1) {
    throw new Error(`Reached recursion limit while calculating survey path`);
  } else {
    throw new Error(`Never reached currentIndex while calculating survey path`);
  }
}

function getNextFormElement<
  T extends Pick<SurveyAppFormElementFragment, "id" | "jumpToId">
>(
  current: T,
  sortedFormElements: T[],
  rules: Pick<
    SurveyAppRuleFragment,
    "booleanOperator" | "conditions" | "jumpToId" | "position" | "formElementId"
  >[],
  answers: { [formElementId: number]: any }
): T | null {
  const currentIndex = sortedFormElements.indexOf(current);
  let nextByPosition = sortedFormElements[currentIndex + 1];
  let nextByJumpToId = current.jumpToId
    ? sortedFormElements.find((el) => el.id === current.jumpToId)
    : undefined;
  if (
    nextByJumpToId &&
    sortedFormElements.indexOf(nextByJumpToId) < currentIndex
  ) {
    console.warn(
      `Ignoring invalid skip logic rule that would jump backward in survey`
    );
    nextByJumpToId = undefined;
  }
  if (currentIndex === 0) {
    // On WelcomeMessage page, no answers to evaluate
    return nextByPosition;
  } else if (currentIndex === sortedFormElements.length - 1) {
    // On ThankYou page, survey is complete
    return null;
  } else if (currentIndex === sortedFormElements.length - 2) {
    // On the last question before ThankYou page. Cannot jump since that would
    // require going backwards
    return nextByPosition;
  } else {
    // Could be anywhere from the first question to the 2nd to last question

    // See what rules apply to the current formElement and sort them into
    // evaluation order
    const currentRules = rules
      .filter((rule) => rule.formElementId === current.id)
      .sort((a, b) => a.position - b.position);

    // Evaluate current rules to see if any pass and redirect the flow
    for (const rule of currentRules) {
      if (evaluateRule(rule, answers)) {
        // If passes, find the form element specified that should be skipped to
        const next = sortedFormElements.find((el) => el.id === rule.jumpToId!);
        if (!next) {
          console.warn(
            `Could not find FormElement refered to by jumpToId=${rule.jumpToId}`
          );
        } else if (
          // make sure it would not require skipping backwards
          sortedFormElements.indexOf(next) < currentIndex
        ) {
          console.warn(`Skipping logic rule that would mean jumping backwards`);
        } else {
          // If everything looks good, follow the skip
          return next;
        }
      }
    }
    // If no rules evaluate to true, go to the next element, whether that is
    // specified by current FormElement.jumpToId or just the next in the list
    return nextByJumpToId || nextByPosition;
  }
}

function evaluateRule(
  rule: Pick<SurveyAppRuleFragment, "conditions" | "booleanOperator">,
  answers: { [formElementId: number]: any }
): boolean {
  for (const condition of rule.conditions || []) {
    const answer = answers[condition.subjectId];
    if (evaluateCondition(condition.operator, condition.value, answer)) {
      // if OR, early return true if passing.
      if (rule.booleanOperator === FormLogicOperator.Or) {
        return true;
      }
    } else {
      // if AND, early return false if not passing
      if (rule.booleanOperator === FormLogicOperator.And) {
        return false;
      }
    }
  }
  // If AND, all have passed by here
  // If Or, all have failed
  return rule.booleanOperator === FormLogicOperator.And;
}

function evaluateCondition(
  operator: FieldRuleOperator,
  value: any,
  answer: any
) {
  switch (operator) {
    case FieldRuleOperator.Contains:
      throw new Error("Not implemented");
    case FieldRuleOperator.Equal:
      if (Array.isArray(answer)) {
        return answer.indexOf(value) !== -1;
      } else {
        return answer == value;
      }
    case FieldRuleOperator.GreaterThan:
      return answer > value;
    case FieldRuleOperator.IsBlank:
      return (
        answer == null || answer == undefined || answer == "" || answer == " "
      );
    case FieldRuleOperator.LessThan:
      return answer < value;
    case FieldRuleOperator.NotEqual:
      if (Array.isArray(answer)) {
        return answer.indexOf(value) === -1;
      } else {
        return answer != value;
      }
    default:
      throw new Error(`Unsupported operator ${operator}`);
  }
}
