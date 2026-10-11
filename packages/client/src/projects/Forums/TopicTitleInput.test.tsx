import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopicTitleInput from "./TopicTitleInput";
import { TOPIC_TITLE_MAX_LENGTH } from "./topicTitle";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (!vars) {
        return key;
      }
      return key.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(vars[name] ?? "")
      );
    },
  }),
}));

test("shows the character count before the title is too long", () => {
  render(
    <TopicTitleInput title="Coast" onChange={jest.fn()} showRequired={false} />
  );
  expect(screen.getByRole("textbox", { name: "Topic title" })).toHaveValue(
    "Coast"
  );
  expect(screen.getByTitle("5 of 80 characters")).toHaveTextContent("5/80");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("explains when a title is over the character limit", () => {
  const title = "a".repeat(TOPIC_TITLE_MAX_LENGTH + 16);
  render(
    <TopicTitleInput title={title} onChange={jest.fn()} showRequired={false} />
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Titles must be 80 characters or fewer. This title is 96 characters."
  );
  expect(screen.getByRole("textbox")).toBeInvalid();
  expect(screen.getByTitle("96 of 80 characters")).toHaveTextContent("96/80");
});

test("counts emoji as single characters, matching the database limit", () => {
  render(
    <TopicTitleInput
      title={"👍".repeat(TOPIC_TITLE_MAX_LENGTH)}
      onChange={jest.fn()}
      showRequired={false}
    />
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByTitle("80 of 80 characters")).toBeInTheDocument();
});

test("shows a length message when the server rejects a title the client allowed", () => {
  render(
    <TopicTitleInput
      title="Coast"
      onChange={jest.fn()}
      showRequired={false}
      serverRejected
    />
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Titles must be 80 characters or fewer."
  );
  expect(screen.getByRole("textbox")).toBeInvalid();
});

test("asks for a title after a submit attempt when the field is blank", () => {
  const { rerender } = render(
    <TopicTitleInput title="" onChange={jest.fn()} showRequired={false} />
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  rerender(
    <TopicTitleInput title="   " onChange={jest.fn()} showRequired={true} />
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a title.");
  expect(screen.getByRole("textbox")).toBeInvalid();
});

test("reports each keystroke to the parent", () => {
  const onChange = jest.fn();
  render(
    <TopicTitleInput title="" onChange={onChange} showRequired={false} />
  );
  userEvent.type(screen.getByRole("textbox"), "A");
  expect(onChange).toHaveBeenCalledWith("A");
});
