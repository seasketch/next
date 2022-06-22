/* eslint-disable i18next/no-literal-string */
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Rating, { RatingProps } from "./Rating";
import { commonFormElementArgs } from "./testHelpers";

const body = questionBodyFromMarkdown(`# How do you like SeaSketch?
`);
const makeArgs = (componentSettings: RatingProps) => ({
  ...commonFormElementArgs,
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
  surveySupportsFacilitation: true,
  isFacilitatedResponse: false,
});

test("Component renders with custom body", async () => {
  render(<Rating {...makeArgs({})} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "How do you like SeaSketch?"
    );
  });
  expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
});

test("Clicking a star sets the value", async () => {
  const args = makeArgs({});
  render(<Rating {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "How do you like SeaSketch?"
    );
  });
  expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
  const fourStars = screen.getByLabelText("4 stars");
  fireEvent.click(fourStars);
  expect(args.onChange).toBeCalledWith(4, false);
});

test("Can increase number of stars", async () => {
  const args = makeArgs({ max: 10 });
  render(<Rating {...args} />);
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "How do you like SeaSketch?"
    );
  });
  expect(screen.getByLabelText("10 stars")).toBeInTheDocument();
  const fourStars = screen.getByLabelText("10 stars");
  fireEvent.click(fourStars);
  expect(args.onChange).toBeCalledWith(10, false);
});
