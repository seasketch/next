/**
 * Publish overlay badge popover bodies.
 *
 * Convention (matches changelog rows):
 * - For each badge, logs are filtered to one field-group family.
 * - `fromSummary` = parsed from_summary on the *oldest* changelog in the publish window.
 * - `toSummary` = parsed to_summary on the *newest* changelog (current value).
 *
 * To add a new badge type: extend `PublishBadgeKey` + grouping in `publishChangelogSummary.ts`,
 * add a `case` below, and tune `badgePopoverContentClassName` if the panel needs more width.
 */

import { ReactNode } from "react";
import { Trans } from "react-i18next";
import Button from "../../../components/Button";
import {
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../../generated/graphql";
import {
  accessTypeLabel,
  downloadLabel,
  folderTypeLabel,
  interactivityTypeLabel,
} from "../../changelogs/fieldGroups/labels";
import {
  Summary,
  valueText,
} from "../../changelogs/fieldGroups/FieldGroupListItemBase";
import { oldestChangeLogId, PublishBadgeKey } from "../publishChangelogSummary";
import {
  buildFolderMovePathSegments,
  getPublishWindowEndpoints,
} from "./endpoints";
import PublishCartographyBadgePreview from "./PublishCartographyBadgePreview";

const CHANGE_SUMMARY_ARROW = String.fromCharCode(8594);

export type PublishBadgeDetailContentProps = {
  badgeKey: PublishBadgeKey;
  logs: ChangeLogDetailsFragment[];
  isFolder: boolean;
  t: (key: string) => string;
  tableOfContentsItemId: number;
  onOpenMetadata: () => void;
  onOpenCartography: () => void;
  /**
   * When true, metadata/cartography omit footer buttons; the badge itself opens the
   * full viewer on click (hover panel shows preview + instructions only).
   */
  omitInlineModalActions?: boolean;
};

function FromToLine({
  fromText,
  toText,
}: {
  fromText: string;
  toText: string;
}) {
  return (
    <p className="break-words text-sm leading-snug text-zinc-100">
      <span>{fromText}</span>
      <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
      <span>{toText}</span>
    </p>
  );
}

function MovePathLine({ segments }: { segments: string[] }) {
  return (
    <p className="break-words text-sm leading-snug text-zinc-100">
      {segments.map((seg, i) => (
        <span key={`${i}-${seg}`}>
          {i > 0 ? (
            <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
          ) : null}
          {seg}
        </span>
      ))}
    </p>
  );
}

function groupNamesFromAcl(groups: unknown): string[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups
    .map((g) => valueText(g).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function AccessInlineLine({
  fromSummary,
  toSummary,
  t,
}: {
  fromSummary: Summary;
  toSummary: Summary;
  t: PublishBadgeDetailContentProps["t"];
}) {
  const fromLabel = accessTypeLabel(t, fromSummary.type);
  const toLabel = accessTypeLabel(t, toSummary.type);
  const fromGroups =
    fromSummary.type === "group"
      ? groupNamesFromAcl(fromSummary.groups).join(", ")
      : "";
  const toGroups =
    toSummary.type === "group"
      ? groupNamesFromAcl(toSummary.groups).join(", ")
      : "";

  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm leading-snug text-zinc-100">
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-px">
        <span className="shrink-0 font-medium">{fromLabel}</span>
        {fromSummary.type === "group" && fromGroups ? (
          <span className="inline-flex min-w-0 max-w-[min(11rem,42vw)] items-baseline">
            <span className="shrink-0 text-zinc-400">(</span>
            <span className="min-w-0 truncate font-medium" title={fromGroups}>
              {fromGroups}
            </span>
            <span className="shrink-0 text-zinc-400">)</span>
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-px">
        <span className="shrink-0 font-medium">{toLabel}</span>
        {toSummary.type === "group" && toGroups ? (
          <span className="inline-flex min-w-0 max-w-[min(11rem,42vw)] items-baseline">
            <span className="shrink-0 text-zinc-400">(</span>
            <span className="min-w-0 truncate font-medium" title={toGroups}>
              {toGroups}
            </span>
            <span className="shrink-0 text-zinc-400">)</span>
          </span>
        ) : null}
      </span>
    </p>
  );
}

export default function PublishBadgeDetailContent(
  props: PublishBadgeDetailContentProps
) {
  const {
    badgeKey,
    logs,
    isFolder,
    t,
    tableOfContentsItemId,
    omitInlineModalActions = false,
  } = props;
  if (!logs.length) {
    return (
      <p className="text-sm text-zinc-400">
        <Trans ns="admin:data">No details available.</Trans>
      </p>
    );
  }

  const { fromSummary: fromS, toSummary: toS } = getPublishWindowEndpoints(logs);

  let main: ReactNode = null;

  switch (badgeKey) {
    case "title": {
      const from = valueText(fromS.title, t("Untitled"));
      const to = valueText(toS.title, t("Untitled"));
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "attribution": {
      const from = valueText(fromS.attribution, t("null"));
      const to = valueText(toS.attribution, t("null"));
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "access": {
      main = (
        <AccessInlineLine fromSummary={fromS} toSummary={toS} t={t} />
      );
      break;
    }
    case "downloads": {
      const from = downloadLabel(t, fromS.enable_download);
      const to = downloadLabel(t, toS.enable_download);
      main = <FromToLine fromText={from} toText={to} />;
      break;
    }
    case "interactivity": {
      const from = interactivityTypeLabel(t, fromS.type);
      const to = interactivityTypeLabel(t, toS.type);
      main =
        from !== to ? (
          <p className="text-sm text-zinc-100">
            <span className="font-medium">{from}</span>
            <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
            <span className="font-medium">{to}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            {t("Interactivity settings were updated.")}
          </p>
        );
      break;
    }
    case "moved": {
      const rootLabel = t("root");
      const path = buildFolderMovePathSegments(logs, rootLabel);
      main =
        path.length >= 2 ? (
          <MovePathLine segments={path} />
        ) : (
          <FromToLine
            fromText={valueText(fromS.folder, rootLabel)}
            toText={valueText(toS.folder, rootLabel)}
          />
        );
      break;
    }
    case "folderBehavior": {
      const from = folderTypeLabel(t, fromS.type);
      const to = folderTypeLabel(t, toS.type);
      main = (
        <p className="text-sm text-zinc-100">
          <span className="font-medium">{from}</span>
          <span className="mx-1.5 text-zinc-500">{CHANGE_SUMMARY_ARROW}</span>
          <span className="font-medium">{to}</span>
        </p>
      );
      break;
    }
    case "source": {
      const fromFn = valueText(fromS.filename);
      const toFn = valueText(toS.filename);
      main = (
        <div className="space-y-2 text-sm text-zinc-100">
          {fromFn && toFn && fromFn !== toFn ? (
            <FromToLine fromText={fromFn} toText={toFn} />
          ) : (
            <p>{toFn || t("uploaded source")}</p>
          )}
        </div>
      );
      break;
    }
    case "metadata": {
      main = (
        <p className="text-xs text-zinc-400">
          <Trans ns="admin:data">Click for metadata history</Trans>
        </p>
      );
      break;
    }
    case "cartography": {
      const oldestId = oldestChangeLogId(
        logs,
        ChangeLogFieldGroup.LayerCartography
      );
      main = (
        <div className="flex flex-col gap-1">
          {!isFolder ? (
            <PublishCartographyBadgePreview
              tableOfContentsItemId={tableOfContentsItemId}
              initialChangeLogId={oldestId ?? null}
            />
          ) : null}
          <p className="text-xs text-zinc-400">
            <Trans ns="admin:data">Click for change details</Trans>
          </p>
        </div>
      );
      break;
    }
    default:
      main = (
        <p className="text-sm text-zinc-400">
          <Trans ns="admin:data">This setting was updated.</Trans>
        </p>
      );
  }

  const showModalFooterButtons =
    !omitInlineModalActions &&
    ((badgeKey === "metadata" && !isFolder) ||
      (badgeKey === "cartography" && !isFolder));

  const footerActions = showModalFooterButtons ? (
    badgeKey === "metadata" ? (
      <Button
        small
        label={t("View metadata history")}
        onClick={props.onOpenMetadata}
      />
    ) : (
      <Button
        small
        label={t("View cartography history")}
        onClick={props.onOpenCartography}
      />
    )
  ) : null;

  const compactPopover =
    badgeKey === "metadata" || badgeKey === "cartography";

  return (
    <div className={compactPopover ? "space-y-1.5" : "space-y-3"}>
      {main}
      {footerActions ? (
        <div
          className={
            compactPopover
              ? "flex flex-wrap gap-2 border-t border-zinc-700 pt-1.5"
              : "flex flex-wrap gap-2 border-t border-zinc-700 pt-2"
          }
        >
          {footerActions}
        </div>
      ) : null}
    </div>
  );
}
