/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import Email, { EmailProps } from "./Email";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = questionBodyFromMarkdown(`# What is your email?`);
const makeArgs = (componentSettings: EmailProps) => ({
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: false,
  componentSettings: { ...componentSettings },
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
});

test("Component renders with custom body", async () => {
  render(<Email {...makeArgs({})} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent("What is your email?");
});

test("Entering text updates the value", async () => {
  const args = makeArgs({});
  render(<Email {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "me@example.com" } });
  expect(args.onChange).toBeCalledWith("me@example.com", false);
});

test("validates entry", async () => {
  const args = makeArgs({});
  render(<Email {...args} submissionAttempted={true} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "me_at_example.com" } });
  expect(args.onChange).toBeCalledWith("me_at_example.com", true);
  expect(
    screen.getByText("Does not appear to be a valid email")
  ).toBeInTheDocument();
});
