/* eslint-disable i18next/no-literal-string */
import React from "react";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import ShortText from "./ShortText";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = questionBodyFromMarkdown(`# What is your name?`);

test("Component renders with custom body", async () => {
  render(
    <ShortText
      body={body}
      id={1}
      onChange={() => null}
      onSubmit={() => null}
      editable={false}
      isRequired={false}
      componentSettings={{}}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent("What is your name?");
});

test("Entering text updates the value", async () => {
  const onChange = jest.fn();
  const onSubmit = jest.fn();
  render(
    <ShortText
      body={body}
      id={1}
      onChange={onChange}
      onSubmit={onSubmit}
      editable={false}
      isRequired={false}
      componentSettings={{}}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "My Name" } });
  expect(onChange).toBeCalledWith("My Name", false);
});

test("Required fields validate input after submission attempt", async () => {
  const { rerender } = render(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      isRequired={true}
      componentSettings={{}}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.queryByText("Required field")).not.toBeInTheDocument();
  rerender(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      isRequired={true}
      componentSettings={{}}
      submissionAttempted={true}
      value=""
    />
  );
  await waitFor(() => {
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });
});

test("minLength", async () => {
  const { rerender } = render(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      componentSettings={{ minLength: 8 }}
      submissionAttempted={true}
      isRequired={true}
      value="Hi"
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByText(/must be/)).toBeInTheDocument();
  rerender(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      componentSettings={{ minLength: 1 }}
      submissionAttempted={true}
      isRequired={true}
      value="Hi"
    />
  );
  await waitFor(() => {
    expect(screen.queryByText(/must be/)).toBeNull();
  });
});

test("maxLength", async () => {
  const { rerender } = render(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      componentSettings={{ maxLength: 8 }}
      submissionAttempted={true}
      isRequired={true}
      value="Bababhbabhabhabababbdab"
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByText(/must be/)).toBeInTheDocument();
  rerender(
    <ShortText
      body={body}
      id={1}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      editable={false}
      componentSettings={{ maxLength: 8 }}
      submissionAttempted={true}
      isRequired={true}
      value="Hi"
    />
  );
  await waitFor(() => {
    expect(screen.queryByText(/must be/)).toBeNull();
  });
});

test("Pressing return key advances to next field", async () => {
  const onSubmit = jest.fn();
  render(
    <ShortText
      body={body}
      id={1}
      onChange={() => null}
      onSubmit={onSubmit}
      editable={false}
      isRequired={false}
      componentSettings={{}}
      value="foo"
    />
  );
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
