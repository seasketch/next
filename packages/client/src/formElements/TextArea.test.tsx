/* eslint-disable i18next/no-literal-string */
import React from "react";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import TextArea, { TextAreaProps } from "./TextArea";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = questionBodyFromMarkdown(`# Tell us about yourself`);

const makeArgs = (componentSettings: TextAreaProps) => ({
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
  render(<TextArea {...makeArgs({ compact: true })} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Tell us about yourself"
  );
});

test("Entering text updates the value", async () => {
  const args = makeArgs({ compact: true });
  render(<TextArea {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Hello" } });
  expect(args.onChange).toBeCalledWith("Hello", false);
});

test("Required fields validate input after submission attempt", async () => {
  const args1 = makeArgs({ compact: true });
  const { rerender } = render(<TextArea {...args1} isRequired={true} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("textbox")).not.toHaveAttribute(
    "placeholder",
    "Required field"
  );
  const args2 = makeArgs({ compact: true });
  rerender(
    <TextArea
      {...args2}
      isRequired={true}
      submissionAttempted={true}
      value=""
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "Required field"
    );
  });
});

test("Pressing return+meta key advances to next field", async () => {
  const args = makeArgs({});
  render(<TextArea {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    code: "Enter",
    charCode: 13,
    shiftKey: false,
    metaKey: true,
  });
  expect(args.onSubmit).toBeCalled();
});
