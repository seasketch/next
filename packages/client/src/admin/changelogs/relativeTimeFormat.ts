/**
 * Same humanized “time ago” as change history (ChangeLogTimelineItem) and publish summaries.
 */
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const DIVISIONS: {
  amount: number;
  name: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";
}[] = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function formatRelativeTimeSince(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  let duration = (date.getTime() - new Date().getTime()) / 1000;
  if (Math.abs(duration) < 60) {
    return formatter.format(0, "seconds");
  }
  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  return formatter.format(0, "seconds");
}

/** Wall-clock time for tooltips (matches change log `<time title=…>`). */
export function formatExactTimestampTooltip(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return date.toLocaleString();
}
