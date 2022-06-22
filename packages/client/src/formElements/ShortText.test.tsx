/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import ShortText, { ShortTextProps } from "./ShortText";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { commonFormElementArgs } from "./testHelpers";

const body = questionBodyFromMarkdown(`# What is your name?`);
const makeArgs = (componentSettings: ShortTextProps) => {
  return {
    ...commonFormElementArgs,
    body,
    id: 1,
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    editable: false,
    componentSettings,
    isRequired: false,
  };
};

test("Component renders with custom body", async () => {
  render(<ShortText {...makeArgs({})} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent("What is your name?");
});

test("Entering text updates the value", async () => {
  const args = makeArgs({});
  const { onChange } = args;
  render(<ShortText {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "My Name" } });
  expect(onChange).toBeCalledWith("My Name", false);
});

test("Required fields validate input after submission attempt", async () => {
  const args = makeArgs({});
  const { rerender } = render(<ShortText {...args} isRequired={false} />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.queryByText("Required field")).not.toBeInTheDocument();
  rerender(
    <ShortText
      {...args}
      value=""
      isRequired={true}
      submissionAttempted={true}
    />
  );
  await waitFor(() => {
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });
});

test("minLength", async () => {
  const args = makeArgs({ minLength: 8 });
  const { rerender } = render(
    <ShortText
      {...args}
      isRequired={true}
      value="Hi"
      submissionAttempted={true}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByText(/must be/)).toBeInTheDocument();
  rerender(
    <ShortText {...makeArgs({ minLength: 1 })} isRequired={true} value="Hi" />
  );
  await waitFor(() => {
    expect(screen.queryByText(/must be/)).toBeNull();
  });
});

test("maxLength", async () => {
  const args = makeArgs({ maxLength: 2 });
  render(
    <ShortText
      {...args}
      value="Bababhbabhabhabababbdab"
      submissionAttempted={true}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByText(/must be/)).toBeInTheDocument();
});

test("Pressing return key advances to next field", async () => {
  const args = makeArgs({});
  const { onSubmit } = args;
  render(<ShortText {...args} isRequired={false} value="foo" />);
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "Enter",
    code: "Enter",
    charCode: 13,
    shiftKey: false,
  });
  expect(onSubmit).toBeCalled();
});
