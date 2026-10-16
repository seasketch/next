import {
  TOPIC_TITLE_MAX_LENGTH,
  forumMessageIsEmpty,
  isMissingTopicTitleError,
  isTopicTitleConstraintError,
  topicTitleCharLength,
  topicTitleProblem,
} from "./topicTitle";

describe("topicTitleCharLength", () => {
  test("counts Unicode code points the way PostgreSQL char_length does", () => {
    expect(topicTitleCharLength("")).toBe(0);
    expect(topicTitleCharLength("a")).toBe(1);
    expect("👍".length).toBe(2);
    expect(topicTitleCharLength("👍")).toBe(1);
    expect(topicTitleCharLength("👍".repeat(TOPIC_TITLE_MAX_LENGTH))).toBe(
      TOPIC_TITLE_MAX_LENGTH
    );
  });
});

describe("topicTitleProblem", () => {
  test("accepts a title at the 80 character limit", () => {
    expect(topicTitleProblem("a".repeat(TOPIC_TITLE_MAX_LENGTH))).toBeNull();
    expect(
      topicTitleProblem("👍".repeat(TOPIC_TITLE_MAX_LENGTH))
    ).toBeNull();
  });

  test("rejects a title one character over the limit", () => {
    expect(topicTitleProblem("a".repeat(TOPIC_TITLE_MAX_LENGTH + 1))).toBe(
      "tooLong"
    );
    expect(topicTitleProblem("👍".repeat(TOPIC_TITLE_MAX_LENGTH + 1))).toBe(
      "tooLong"
    );
    expect(topicTitleProblem(`${"a".repeat(TOPIC_TITLE_MAX_LENGTH)} `)).toBe(
      "tooLong"
    );
  });

  test("requires a non-blank title", () => {
    expect(topicTitleProblem("")).toBe("required");
    expect(topicTitleProblem("   ")).toBe("required");
    expect(topicTitleProblem("\n\t")).toBe("required");
  });

  test("reports an over-long blank title as too long", () => {
    expect(topicTitleProblem(" ".repeat(TOPIC_TITLE_MAX_LENGTH + 1))).toBe(
      "tooLong"
    );
  });

  test("allows surrounding spaces when the full title fits", () => {
    expect(topicTitleProblem("  coast  ")).toBeNull();
  });
});

describe("forumMessageIsEmpty", () => {
  test("treats missing and blank documents as empty", () => {
    expect(forumMessageIsEmpty(undefined)).toBe(true);
    expect(forumMessageIsEmpty(null)).toBe(true);
    expect(forumMessageIsEmpty({})).toBe(true);
    expect(
      forumMessageIsEmpty({
        type: "doc",
        content: [{ type: "paragraph" }, { type: "attachments" }],
      })
    ).toBe(true);
    expect(
      forumMessageIsEmpty({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "   " }],
          },
        ],
      })
    ).toBe(true);
  });

  test("accepts text, sketches, images, and attachments", () => {
    expect(
      forumMessageIsEmpty({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello" }],
          },
        ],
      })
    ).toBe(false);
    expect(forumMessageIsEmpty({ type: "sketch", attrs: { items: [] } })).toBe(
      false
    );
    expect(
      forumMessageIsEmpty({
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://example.com/a.png" } }],
      })
    ).toBe(false);
    expect(
      forumMessageIsEmpty({
        type: "doc",
        content: [
          {
            type: "attachments",
            content: [
              {
                type: "attachment",
                attrs: { id: "1", type: "FileUpload", data: {} },
              },
            ],
          },
        ],
      })
    ).toBe(false);
  });
});

describe("isTopicTitleConstraintError", () => {
  test("recognizes the database constraint and ignores other failures", () => {
    expect(
      isTopicTitleConstraintError({
        message:
          'new row for relation "topics" violates check constraint "titlechk"',
      })
    ).toBe(true);
    expect(
      isTopicTitleConstraintError({
        message:
          'ApolloError: new row for relation "topics" violates check constraint "titlechk"',
      })
    ).toBe(true);
    expect(
      isTopicTitleConstraintError({
        message:
          "Titles must be 80 characters or fewer. This title is 96 characters.",
      })
    ).toBe(true);
    expect(
      isTopicTitleConstraintError({
        message: "User profile must be shared in order to post in the forum",
      })
    ).toBe(false);
    expect(isTopicTitleConstraintError(null)).toBe(false);
    expect(isTopicTitleConstraintError(undefined)).toBe(false);
    expect(isMissingTopicTitleError({ message: "Enter a topic title." })).toBe(
      true
    );
    expect(
      isMissingTopicTitleError({
        message: "Titles must be 80 characters or fewer.",
      })
    ).toBe(false);
  });
});
