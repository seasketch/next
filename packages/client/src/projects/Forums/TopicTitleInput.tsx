import { useTranslation } from "react-i18next";

export default function TopicTitleInput({
  title,
  onChange,
  autoFocus,
  invalid,
}: {
  title: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  /** Title failed validation. The explanation is rendered outside this field. */
  invalid?: boolean;
}) {
  const { t } = useTranslation("forums");

  return (
    <input
      id="new-topic-title"
      autoFocus={autoFocus}
      className={`-mt-0.5 pb-1 pt-0 pl-3 border-none outline-none focus:outline-none active:outline-none focus:border-none focus:ring-0 w-full font-semibold text-lg ${
        invalid ? "text-red-800" : ""
      }`}
      type="text"
      value={title}
      placeholder={t("New Topic Title...")}
      aria-label={t("Topic title")}
      aria-invalid={Boolean(invalid)}
      aria-describedby={invalid ? "new-topic-title-feedback" : undefined}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
