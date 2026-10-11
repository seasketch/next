/**
 * `topics.title` is limited by the database constraint `titlechk`:
 *   CHECK (char_length(title) <= 80)
 * PostgreSQL `char_length` counts Unicode code points, which `Array.from`
 * matches. JavaScript `string.length` counts UTF-16 code units and would
 * reject some titles the database accepts (for example emoji).
 *
 * Defined in packages/api/migrations/committed/000020.sql.
 */
export const TOPIC_TITLE_MAX_LENGTH = 80;

export type TopicTitleProblem = "required" | "tooLong";

export function topicTitleCharLength(title: string): number {
  return Array.from(title).length;
}

/**
 * Length is checked before emptiness so a long string of spaces is reported
 * as too long. That string would fail `titlechk` if it were submitted.
 */
export function topicTitleProblem(title: string): TopicTitleProblem | null {
  if (topicTitleCharLength(title) > TOPIC_TITLE_MAX_LENGTH) {
    return "tooLong";
  }
  if (title.trim().length === 0) {
    return "required";
  }
  return null;
}

const SUBSTANTIVE_NODE_TYPES = new Set(["sketch", "attachment", "image"]);

/** True when a forum post document has no text, sketch, image, or attachment. */
export function forumMessageIsEmpty(message: unknown): boolean {
  return !messageHasVisibleContent(message);
}

function messageHasVisibleContent(node: unknown): boolean {
  if (typeof node === "string") {
    return node.trim().length > 0;
  }
  if (Array.isArray(node)) {
    return node.some(messageHasVisibleContent);
  }
  if (node === null || typeof node !== "object") {
    return false;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim().length > 0) {
    return true;
  }
  if (
    typeof record.type === "string" &&
    SUBSTANTIVE_NODE_TYPES.has(record.type)
  ) {
    return true;
  }
  if ("content" in record) {
    return messageHasVisibleContent(record.content);
  }
  return false;
}

/**
 * True when createTopic failed because the title is too long.
 * Matches the database constraint name and the readable error thrown by the
 * API before that constraint is hit.
 */
export function isTopicTitleConstraintError(
  error: { message?: string } | null | undefined
): boolean {
  const message = error?.message || "";
  return (
    /titlechk/i.test(message) ||
    /Titles must be \d+ characters or fewer/i.test(message)
  );
}

/** True when the API rejected a blank topic title. */
export function isMissingTopicTitleError(
  error: { message?: string } | null | undefined
): boolean {
  return /Enter a topic title/i.test(error?.message || "");
}
