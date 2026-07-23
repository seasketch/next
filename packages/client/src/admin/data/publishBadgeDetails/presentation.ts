import { PublishBadgeKey } from "../publishChangelogSummary";

/** Radix popover content width classes — wider panels for dense or map content */
export function badgePopoverContentClassName(badgeKey: PublishBadgeKey): string {
  switch (badgeKey) {
    case "cartography":
      return "w-[320px] max-w-[min(100vw,320px)]";
    case "access":
      return "max-w-md";
    case "metadata":
      return "max-w-xs";
    case "comments":
      return "w-[30rem] max-w-[min(calc(100vw-1rem),30rem)]";
    case "dataTables":
      return "max-w-md";
    default:
      return "max-w-sm";
  }
}
