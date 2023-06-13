import { render, screen } from "@testing-library/react";
import SketchForm from "./SketchForm";
import {
  FormElementFullDetailsFragment,
  LogicRuleDetailsFragment,
} from "../../generated/graphql";

const formElements = [
  {
    __typename: "FormElement",
    body: {
      type: "doc",
      content: [
        {
          type: "question",
          attrs: {},
          content: [
            {
              text: "Location Name",
              type: "text",
            },
          ],
        },
      ],
    },
    componentSettings: {
      generatedNamePrefix: "Location",
    },
    alternateLanguageSettings: {},
    exportId: "feature_name",
    formId: 307,
    id: 3316,
    isRequired: true,
    position: 1,
    jumpToId: null,
    type: {
      __typename: "FormElementType",
      componentName: "FeatureName",
      isHidden: true,
      isInput: true,
      isSingleUseOnly: true,
      isSurveysOnly: false,
      label: "Feature Name",
      supportedOperators: [],
      isSpatial: false,
      allowedLayouts: null,
    },
    isInput: true,
    typeId: "FeatureName",
    backgroundColor: null,
    secondaryColor: null,
    backgroundImage: null,
    layout: null,
    backgroundPalette: null,
    textVariant: "DYNAMIC",
    unsplashAuthorUrl: null,
    unsplashAuthorName: null,
    backgroundWidth: null,
    backgroundHeight: null,
    subordinateTo: null,
    mapBasemaps: null,
    mapCameraOptions: null,
    generatedExportId: "feature_name",
    generatedLabel: "Location Name",
  },
  {
    __typename: "FormElement",
    body: {
      type: "doc",
      content: [
        {
          type: "question",
          content: [
            {
              text: "What type of animal is it?",
              type: "text",
            },
          ],
        },
      ],
    },
    componentSettings: {
      options: [
        {
          label: "Fish",
          value: "fish",
        },
        {
          label: "Mammal",
          value: "mammal",
        },
        {
          label: "Bird",
          value: "bird",
        },
      ],
    },
    alternateLanguageSettings: {},
    exportId: "type",
    formId: 307,
    id: 3317,
    isRequired: true,
    position: 2,
    jumpToId: null,
    type: {
      __typename: "FormElementType",
      componentName: "MultipleChoice",
      isHidden: false,
      isInput: true,
      isSingleUseOnly: false,
      isSurveysOnly: false,
      label: "Multiple Choice",
      supportedOperators: ["EQUAL", "NOT_EQUAL", "CONTAINS"],
      isSpatial: false,
      allowedLayouts: null,
    },
    isInput: true,
    typeId: "MultipleChoice",
    backgroundColor: null,
    secondaryColor: null,
    backgroundImage: null,
    layout: null,
    backgroundPalette: null,
    textVariant: "DYNAMIC",
    unsplashAuthorUrl: null,
    unsplashAuthorName: null,
    backgroundWidth: null,
    backgroundHeight: null,
    subordinateTo: null,
    mapBasemaps: null,
    mapCameraOptions: null,
    generatedExportId: "type",
    generatedLabel: "What type of animal is it?",
  },
  {
    __typename: "FormElement",
    body: {
      type: "doc",
      content: [
        {
          type: "question",
          content: [
            {
              text: "Was it a type of shark or ray?",
              type: "text",
            },
          ],
        },
      ],
    },
    componentSettings: {},
    alternateLanguageSettings: {},
    exportId: "fish_type",
    formId: 307,
    id: 3318,
    isRequired: true,
    position: 3,
    jumpToId: null,
    type: {
      __typename: "FormElementType",
      componentName: "YesNo",
      isHidden: false,
      isInput: true,
      isSingleUseOnly: false,
      isSurveysOnly: false,
      label: "Yes/No",
      supportedOperators: ["EQUAL", "IS_BLANK"],
      isSpatial: false,
      allowedLayouts: null,
    },
    isInput: true,
    typeId: "YesNo",
    backgroundColor: null,
    secondaryColor: null,
    backgroundImage: null,
    layout: null,
    backgroundPalette: null,
    textVariant: "DYNAMIC",
    unsplashAuthorUrl: null,
    unsplashAuthorName: null,
    backgroundWidth: null,
    backgroundHeight: null,
    subordinateTo: null,
    mapBasemaps: null,
    mapCameraOptions: null,
    generatedExportId: "fish_type",
    generatedLabel: "Was it a type of shark or ray?",
  },
  {
    __typename: "FormElement",
    body: {
      type: "doc",
      content: [
        {
          type: "question",
          content: [
            {
              text: "Please describe the mammal",
              type: "text",
            },
          ],
        },
      ],
    },
    componentSettings: {},
    alternateLanguageSettings: {},
    exportId: "please_describe_the_mammal",
    formId: 307,
    id: 3319,
    isRequired: true,
    position: 4,
    jumpToId: null,
    type: {
      __typename: "FormElementType",
      componentName: "ShortText",
      isHidden: false,
      isInput: true,
      isSingleUseOnly: false,
      isSurveysOnly: false,
      label: "Short Text",
      supportedOperators: ["IS_BLANK"],
      isSpatial: false,
      allowedLayouts: null,
    },
    isInput: true,
    typeId: "ShortText",
    backgroundColor: null,
    secondaryColor: null,
    backgroundImage: null,
    layout: null,
    backgroundPalette: null,
    textVariant: "DYNAMIC",
    unsplashAuthorUrl: null,
    unsplashAuthorName: null,
    backgroundWidth: null,
    backgroundHeight: null,
    subordinateTo: null,
    mapBasemaps: null,
    mapCameraOptions: null,
    generatedExportId: "please_describe_the_mammal",
    generatedLabel: "Please describe the mammal",
  },
].reverse() as FormElementFullDetailsFragment[];

const logicRules = [
  {
    __typename: "FormLogicRule",
    booleanOperator: "OR",
    command: "SHOW",
    id: 1275,
    jumpToId: null,
    position: 0,
    formElementId: 3318,
    conditions: [
      {
        __typename: "FormLogicCondition",
        id: 1308,
        operator: "EQUAL",
        value: "fish",
        subjectId: 3317,
        ruleId: 1275,
      },
    ],
  },
  {
    __typename: "FormLogicRule",
    booleanOperator: "OR",
    command: "SHOW",
    id: 1276,
    jumpToId: null,
    position: 0,
    formElementId: 3319,
    conditions: [
      {
        __typename: "FormLogicCondition",
        id: 1309,
        operator: "EQUAL",
        value: "mammal",
        subjectId: 3317,
        ruleId: 1276,
      },
    ],
  },
] as LogicRuleDetailsFragment[];

test("Renders form elements sorted by position", async () => {
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{ 3317: "mammal" }}
      submissionAttempted={false}
      editable={false}
      featureNumber={1}
    />
  );
  const location = screen.getByText("Location Name");
  const type = screen.getByText("What type of animal is it?");
  const describe = screen.getByText("Please describe the mammal");

  expect(location.compareDocumentPosition(type)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
  expect(type.compareDocumentPosition(describe)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
});

test("Renders a default name for FeatureName if part of a survey", async () => {
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{}}
      submissionAttempted={false}
      editable={false}
      featureNumber={2}
    />
  );
  expect(screen.getByRole("textbox")).toHaveValue("Location 2");
});

test("Displays validation errors if submissionAttempted is true", async () => {
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{}}
      submissionAttempted
      editable={false}
      featureNumber={1}
    />
  );
  const button = screen.getByText("Bird");
  expect(button.parentElement).toHaveClass("border-red-300");
});

test("Does not show validation errors if submissionAttempted is false", async () => {
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{}}
      submissionAttempted={false}
      editable={false}
      featureNumber={1}
    />
  );
  const button = screen.getByText("Bird");
  expect(button.parentElement).not.toHaveClass("border-red-300");
});

test("Hides elements that are hidden by logic rules", async () => {
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{}}
      submissionAttempted={false}
      editable={false}
      featureNumber={1}
    />
  );
  expect(screen.queryAllByText("Was it a type of shark or ray?").length).toBe(
    0
  );
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={(props, hasErrors) => {}}
      isSketchWorkflow={false}
      startingProperties={{ 3317: "fish" }}
      submissionAttempted={false}
      editable={false}
      featureNumber={1}
    />
  );
  expect(screen.queryAllByText("Was it a type of shark or ray?").length).toBe(
    1
  );
});

test("Returns validation errors for required elements only if visible", async () => {
  const onChange = jest.fn();
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={onChange}
      isSketchWorkflow={false}
      startingProperties={{ 3317: "bird" }}
      submissionAttempted={true}
      editable={false}
      featureNumber={1}
    />
  );
  let lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  expect(lastCall[1]).toBe(false);
  screen.getByText("Fish").click();
  lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  expect(lastCall[1]).toBe(true);
});

test("onChange only contains answers for visible elements", async () => {
  const onChange = jest.fn();
  render(
    <SketchForm
      formElements={formElements}
      logicRules={logicRules}
      onChange={onChange}
      isSketchWorkflow={false}
      startingProperties={{ 3317: "mammal", 3319: "It's a big whale" }}
      submissionAttempted={true}
      editable={false}
      featureNumber={1}
    />
  );
  let lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  expect(lastCall[0][3319]).toBe("It's a big whale");
  screen.getByText("Bird").click();
  lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  expect(lastCall[0][3319]).toBe(undefined);
});
