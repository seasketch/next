import { ClockIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { isTemporalInfo } from "@seasketch/geostats-types";
import {
  inclusiveThroughFromExclusive,
  isOneUnitInterval,
  SpanPrecision,
} from "../../data/TableOfContentsItemEditor/temporalCoverageForm";
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

function asSpanPrecision(precision: string): SpanPrecision {
  if (precision === "year" || precision === "month" || precision === "day") {
    return precision;
  }
  return "day";
}

/** Range separator: spaced when either bound has hyphens (ISO dates). */
export function formatCoverageRange(start: string, end: string): string {
  const spaced = start.indexOf("-") !== -1 || end.indexOf("-") !== -1;
  // eslint-disable-next-line i18next/no-literal-string
  return spaced ? `${start} \u2013 ${end}` : `${start}\u2013${end}`;
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
  const precision = asSpanPrecision(coverage.precision);
  if (coverage.end === null) {
    return formatCoverageRange(
      precision === "year"
        ? String(parseInt(coverage.start, 10) || coverage.start)
        : coverage.start,
      presentText
    );
  }
  if (precision === "year") {
    const start = parseInt(coverage.start, 10);
    const endInclusive = parseInt(coverage.end, 10) - 1;
    if (Number.isFinite(start) && Number.isFinite(endInclusive)) {
      return endInclusive <= start
        ? String(start)
        : formatCoverageRange(String(start), String(endInclusive));
    }
  }
  if (isOneUnitInterval(coverage.start, coverage.end, precision)) {
    return coverage.start;
  }
  const through =
    inclusiveThroughFromExclusive(coverage.end, precision) || coverage.end;
  return formatCoverageRange(coverage.start, through);
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
