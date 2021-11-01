/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import Number, { NumberProps } from "./Number";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = questionBodyFromMarkdown(`# How many fingers do you have?`);
const makeArgs = (componentSettings: NumberProps) => ({
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: true,
  componentSettings: { ...componentSettings },
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
});

test("Component renders with custom body", async () => {
  render(<Number {...makeArgs({ defaultValue: 0 })} />);
  await waitFor(() => {
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent("fingers");
});

test("Entering text updates the value", async () => {
  const args = makeArgs({ defaultValue: 0 });
  render(<Number {...args} />);
  await waitFor(() => {
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });
  const input = screen.getByDisplayValue("0");
  fireEvent.change(input, { target: { value: "10" } });
  expect(args.onChange).toBeCalledWith(10, false);
});

test("validates entry", async () => {
  const args = makeArgs({ min: 0, max: 10, defaultValue: 0 });
  render(<Number {...args} submissionAttempted={true} />);
  await waitFor(() => {
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });
  const input = screen.getByDisplayValue("0");
  fireEvent.change(input, { target: { value: "15" } });
  expect(args.onChange).toBeCalledWith(15, true);
  expect(
    screen.getByText("Number must be equal to or less than 10")
  ).toBeInTheDocument();
  args.onChange.mockClear();
  fireEvent.change(input, { target: { value: "-5" } });
  expect(args.onChange).toBeCalledWith(-5, true);
  expect(
    screen.getByText("Number must be equal to or greater than 0")
  ).toBeInTheDocument();
});
