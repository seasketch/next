import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopicTitleInput from "./TopicTitleInput";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

test("renders the title without a character counter", () => {
  render(<TopicTitleInput title="Coast" onChange={jest.fn()} />);
  expect(screen.getByRole("textbox", { name: "Topic title" })).toHaveValue(
    "Coast"
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText(/\/80/)).not.toBeInTheDocument();
});

test("marks the field invalid without adding a message of its own", () => {
  render(<TopicTitleInput title={"a".repeat(96)} onChange={jest.fn()} invalid />);
  expect(screen.getByRole("textbox")).toBeInvalid();
  expect(screen.getByRole("textbox")).toHaveAttribute(
    "aria-describedby",
    "new-topic-title-feedback"
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports each keystroke to the parent", () => {
  const onChange = jest.fn();
  render(<TopicTitleInput title="" onChange={onChange} />);
  userEvent.type(screen.getByRole("textbox"), "A");
  expect(onChange).toHaveBeenCalledWith("A");
});
