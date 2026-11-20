/* eslint-disable i18next/no-literal-string */
import {
  FieldRuleOperator,
  FormLogicOperator,
} from "../generated/graphql";
import { getUnskippedInputElementsForCompletedResponse } from "./paging";

const elements = [
  { id: 1, typeId: "WelcomeMessage", isInput: false },
  { id: 2, typeId: "YesNo", isInput: true },
  { id: 3, typeId: "Email", isInput: true },
  { id: 4, typeId: "ShortText", isInput: true },
  { id: 5, typeId: "SaveScreen", isInput: false },
  { id: 6, typeId: "ThankYou", isInput: false },
].map((el) => ({ ...el, jumpToId: null, componentSettings: {} }));

function rule(value: boolean | null) {
  return {
    formElementId: 2,
    jumpToId: 4,
    position: 1,
    booleanOperator: FormLogicOperator.Or,
    conditions: [
      {
        subjectId: 2,
        operator: FieldRuleOperator.Equal,
        value,
      },
    ],
  };
}

function path(value: boolean | null, answers: { [id: number]: any }) {
  return getUnskippedInputElementsForCompletedResponse(
    elements,
    [rule(value)] as any,
    answers
  ).map((el) => el.id);
}

test("a No rule skips unless the answer is Yes", () => {
  expect(path(false, { 2: false })).toEqual([2, 4]);
  expect(path(false, {})).toEqual([2, 4]);
  expect(path(false, { 2: true })).toEqual([2, 3, 4]);
});

test("a Yes rule skips only when the answer is Yes", () => {
  expect(path(true, { 2: true })).toEqual([2, 4]);
  expect(path(true, { 2: false })).toEqual([2, 3, 4]);
  expect(path(true, {})).toEqual([2, 3, 4]);
});

test("an unset yes/no rule, shown as No in the editor, skips unless the answer is Yes", () => {
  expect(path(null, { 2: false })).toEqual([2, 4]);
  expect(path(null, {})).toEqual([2, 4]);
  expect(path(null, { 2: true })).toEqual([2, 3, 4]);
});
