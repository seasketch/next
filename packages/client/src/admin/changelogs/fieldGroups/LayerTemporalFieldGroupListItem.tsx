import { ClockIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { isTemporalInfo } from "@seasketch/geostats-types";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";

/**
 * Compact human label for a TemporalInfo document in changelog copy.
 * Year-precision intervals render as "2019" (single year; end is exclusive)
 * or "2015–2019" (range). Open-ended intervals render as "2015–present".
 * Other precisions fall back to the raw ISO strings.
 */
function temporalCoverage(value: unknown): {
  start: string;
  end: string | null;
  precision: string;
} | null {
  if (!isTemporalInfo(value)) {
    return null;
  }
  if (typeof value !== "object" || value === null || !("coverage" in value)) {
    return null;
  }
  const coverage = value.coverage;
  if (typeof coverage !== "object" || coverage === null) {
    return null;
  }
  if (
    !("start" in coverage) ||
    typeof coverage.start !== "string" ||
    !("precision" in coverage) ||
    typeof coverage.precision !== "string" ||
    !("end" in coverage) ||
    (coverage.end !== null && typeof coverage.end !== "string")
  ) {
    return null;
  }
  return {
    start: coverage.start,
    end: coverage.end,
    precision: coverage.precision,
  };
}

export function temporalCoverageLabel(
  value: unknown,
  nullText: string,
  presentText: string
): string {
  const coverage = temporalCoverage(value);
  if (!coverage) {
    return nullText;
  }
  if (coverage.precision === "year") {
    const start = parseInt(coverage.start, 10);
    if (coverage.end === null) {
      // eslint-disable-next-line i18next/no-literal-string
      return `${start}–${presentText}`;
    }
    const endInclusive = parseInt(coverage.end, 10) - 1;
    if (Number.isFinite(start) && Number.isFinite(endInclusive)) {
      return endInclusive <= start
        ? String(start)
        : // eslint-disable-next-line i18next/no-literal-string
          `${start}–${endInclusive}`;
    }
  }
  // eslint-disable-next-line i18next/no-literal-string
  return `${coverage.start}–${coverage.end ?? presentText}`;
}

export default function LayerTemporalFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ClockIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      <Trans ns="admin:data">
        changed temporal coverage from{" "}
        <ChangeValue deleted>
          {temporalCoverageLabel(from.temporal, t("null"), t("present"))}
        </ChangeValue>{" "}
        {" -> "}{" "}
        <ChangeValue>
          {temporalCoverageLabel(to.temporal, t("null"), t("present"))}
        </ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
