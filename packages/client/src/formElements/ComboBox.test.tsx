/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ComboBox, { ComboBoxProps } from "./ComboBox";
import { commonFormElementArgs } from "./testHelpers";

const body = questionBodyFromMarkdown(`# Which option do you prefer?
`);
const makeArgs = (componentSettings: ComboBoxProps) => ({
  ...commonFormElementArgs,
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: false,
  alternateLanguageSettings: {},
  componentSettings: {
    options: ComboBox.defaultComponentSettings?.options,
    ...componentSettings,
  },
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
  surveySupportsFacilitation: true,
  isFacilitatedResponse: false,
});

test("Component renders with custom body", async () => {
  render(<ComboBox {...makeArgs({})} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  fireEvent.click(screen.getByLabelText("toggle menu"));
  expect(screen.getByText("Option A")).toBeInTheDocument();
});

test("selecting an option", async () => {
  const args = makeArgs({});
  render(<ComboBox {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  fireEvent.click(screen.getByLabelText("toggle menu"));
  fireEvent.click(screen.getByText("Option C"));
  expect(args.onChange).toBeCalledWith("c", false);
});

test("searching", async () => {
  const args = makeArgs({
    options: ["Apple", "Banana", "Pear"].map((label) => ({ label })),
  });
  render(<ComboBox {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Which option do you prefer?"
    );
  });
  fireEvent.click(screen.getByRole("textbox"));
  fireEvent.input(screen.getByRole("textbox"), { target: { value: "Ba" } });
  expect(screen.getByText("Banana")).toBeInTheDocument();
  expect(screen.queryAllByText("Apple").length).toBe(0);
});
