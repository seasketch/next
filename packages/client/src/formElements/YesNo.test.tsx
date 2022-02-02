/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";
import YesNo, { YesNoProps } from "./YesNo";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = questionBodyFromMarkdown(`
# Would you like fries with that?
`);

const makeArgs = (componentSettings: YesNoProps) => ({
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: false,
  componentSettings: { ...componentSettings },
  alternateLanguageSettings: {},
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
});

test("Component renders with custom body", async () => {
  const args = makeArgs({});
  render(<YesNo {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Would you like fries with that"
    );
  });
});

test("Clicking yes", async () => {
  const args = makeArgs({});
  render(<YesNo {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Would you like fries with that"
    );
  });
  expect(screen.getByText("Yes")).toBeInTheDocument();
  const yes = screen.getByText("Yes");
  fireEvent.click(yes);
  expect(args.onChange).toBeCalledWith(true, false, true);
});

test("Clicking no", async () => {
  const args = makeArgs({});
  render(<YesNo {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Would you like fries with that"
    );
  });
  expect(screen.getByText("No")).toBeInTheDocument();
  const no = screen.getByText("No");
  fireEvent.click(no);
  expect(args.onChange).toBeCalledWith(false, false, true);
});
