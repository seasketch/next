import { ChangeLogDetailsFragment } from "../../../generated/graphql";
import {
  summary,
  Summary,
  valueText,
} from "../../changelogs/fieldGroups/FieldGroupListItemBase";

/**
 * Sort changelog rows oldest-first (matches "All Changes" timeline order for computing
 * start-of-window vs end-of-window summaries).
 */
export function sortLogsOldestFirst(
  logs: ChangeLogDetailsFragment[]
): ChangeLogDetailsFragment[] {
  return [...logs].sort(
    (a, b) => new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime()
  );
}

export type PublishWindowEndpoints = {
  asc: ChangeLogDetailsFragment[];
  /** Oldest row in this badge's publish window */
  first: ChangeLogDetailsFragment | undefined;
  /** Newest row in this badge's publish window */
  last: ChangeLogDetailsFragment | undefined;
  /** Parsed from_summary on the oldest changelog — start of the window */
  fromSummary: Summary;
  /** Parsed to_summary on the newest changelog — current value */
  toSummary: Summary;
};

export function getPublishWindowEndpoints(
  logs: ChangeLogDetailsFragment[]
): PublishWindowEndpoints {
  const asc = sortLogsOldestFirst(logs);
  const first = asc[0];
  const last = asc[asc.length - 1];
  return {
    asc,
    first,
    last,
    fromSummary: summary(first?.fromSummary),
    toSummary: summary(last?.toSummary),
  };
}

/**
 * Full folder path across ordered move logs (oldest→newest): start from the oldest
 * changelog's `from_summary.folder`, then each step's `to_summary.folder`, collapsing
 * consecutive duplicates.
 */
export function buildFolderMovePathSegments(
  logs: ChangeLogDetailsFragment[],
  rootLabel: string
): string[] {
  const asc = sortLogsOldestFirst(logs);
  if (!asc.length) {
    return [];
  }
  const raw: string[] = [
    valueText(summary(asc[0].fromSummary).folder, rootLabel),
  ];
  for (const log of asc) {
    raw.push(valueText(summary(log.toSummary).folder, rootLabel));
  }
  const out: string[] = [];
  for (const segment of raw) {
    if (
      out.length === 0 ||
      out[out.length - 1] !== segment
    ) {
      out.push(segment);
    }
  }
  return out;
}
