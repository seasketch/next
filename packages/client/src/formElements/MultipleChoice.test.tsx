/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MultipleChoice, { MultipleChoiceProps } from "./MultipleChoice";
import { commonFormElementArgs } from "./testHelpers";

const body = questionBodyFromMarkdown(`# Which option do you prefer?
`);
const makeArgs = (componentSettings: MultipleChoiceProps) => ({
  ...commonFormElementArgs,
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: false,
  alternateLanguageSettings: {},
  componentSettings: {
    options: MultipleChoice.defaultComponentSettings?.options,
    ...componentSettings,
  },
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
  surveySupportsFacilitation: true,
  isFacilitatedResponse: false,
});

test("Component renders with custom body", async () => {
  render(<MultipleChoice {...makeArgs({})} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  expect(screen.getByText("Option A")).toBeInTheDocument();
});

test("selecting an option", async () => {
  const args = makeArgs({});
  render(<MultipleChoice {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  fireEvent.click(screen.getByText("Option C"));
  expect(args.onChange).toBeCalledWith(["C"], false, true);
});

test("multipleSelect: selecting multiple options", async () => {
  const args = makeArgs({ multipleSelect: true });
  render(<MultipleChoice {...args} value={["B"]} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  fireEvent.click(screen.getByText("Option C"));
  expect(args.onChange).toBeCalledWith(["B", "C"], false);
});
