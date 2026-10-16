import { useTranslation } from "react-i18next";
import {
  TOPIC_TITLE_MAX_LENGTH,
  topicTitleCharLength,
  topicTitleProblem,
} from "./topicTitle";

export default function TopicTitleInput({
  title,
  onChange,
  autoFocus,
  showRequired,
  serverRejected,
}: {
  title: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  /** Show the missing-title message. Length errors are always visible. */
  showRequired: boolean;
  /**
   * The server rejected this title for length. Shown when the client count
   * and the database disagree, so the raw constraint error stays hidden.
   */
  serverRejected?: boolean;
}) {
  const { t } = useTranslation("forums");
  const length = topicTitleCharLength(title);
  const problem = topicTitleProblem(title);
  const tooLong = problem === "tooLong" || Boolean(serverRejected);
  const missing = showRequired && problem === "required";
  const invalid = tooLong || missing;
  const countLabel = t("{{count}} of {{max}} characters", {
    count: length,
    max: TOPIC_TITLE_MAX_LENGTH,
  });
  let message: string | null = null;
  if (problem === "tooLong") {
    message = t(
      "Titles must be {{max}} characters or fewer. This title is {{count}} characters.",
      { max: TOPIC_TITLE_MAX_LENGTH, count: length }
    );
  } else if (serverRejected) {
    message = t("Titles must be {{max}} characters or fewer.", {
      max: TOPIC_TITLE_MAX_LENGTH,
    });
  } else if (missing) {
    message = t("Enter a title.");
  }

  return (
    <div className="contents">
      <div className="col-start-2 flex min-w-0 items-center">
        <input
          id="new-topic-title"
          autoFocus={autoFocus}
          className={`-mt-0.5 min-w-0 flex-1 pb-1 pt-0 pl-3 border-none outline-none focus:outline-none active:outline-none focus:border-none focus:ring-0 font-semibold text-lg ${
            invalid ? "text-red-800" : ""
          }`}
          type="text"
          value={title}
          placeholder={t("New Topic Title...")}
          aria-label={t("Topic title")}
          aria-invalid={invalid}
          aria-describedby={
            message
              ? "new-topic-title-feedback new-topic-title-count"
              : "new-topic-title-count"
          }
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
        <span
          id="new-topic-title-count"
          className={`shrink-0 pr-1 text-xs tabular-nums ${
            tooLong ? "font-medium text-red-600" : "text-gray-400"
          }`}
          aria-label={countLabel}
          title={countLabel}
        >
          {t("{{count}}/{{max}}", {
            count: length,
            max: TOPIC_TITLE_MAX_LENGTH,
          })}
        </span>
      </div>
      {message && (
        <p
          id="new-topic-title-feedback"
          role="alert"
          className="col-start-2 pl-3 pr-2 pb-1 text-sm text-red-600"
        >
          {message}
        </p>
      )}
    </div>
  );
}
