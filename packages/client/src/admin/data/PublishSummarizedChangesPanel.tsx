import {
  ExternalLinkIcon,
  EyeIcon,
  FolderIcon,
  ViewListIcon,
} from "@heroicons/react/outline";
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { MouseEvent, ReactNode, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import ProfilePhoto from "../users/ProfilePhoto";
import {
  AuthorProfileFragment,
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../generated/graphql";
import { nameForProfile } from "../../projects/Forums/TopicListItem";
import LayerCartographyRevisionModal from "./LayerCartographyRevisionModal";
import LayerMetadataRevisionModal from "./LayerMetadataRevisionModal";
import {
  badgePopoverContentClassName,
  PublishBadgeDetailContent,
} from "./publishBadgeDetails";
import {
  buildPublishChangeSummary,
  DraftTocItemForPublishSummary,
  oldestChangeLogId,
  PublishBadgeKey,
  PublishSummaryRow,
  PublishZOrderSummary,
} from "./publishChangelogSummary";
import { CHANGE_LOG_INTRODUCTION_DATE } from "../changelogs/constants";

const relFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const METADATA_BULLET = String.fromCharCode(183);

const relDivisions: {
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

function formatRelativeTimeAgo(iso: string): string {
  const date = new Date(iso);
  let duration = (date.getTime() - new Date().getTime()) / 1000;
  if (Math.abs(duration) < 60) {
    return relFormatter.format(0, "seconds");
  }
  for (let i = 0; i < relDivisions.length; i++) {
    const division = relDivisions[i];
    if (Math.abs(duration) < division.amount) {
      return relFormatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  return relFormatter.format(0, "seconds");
}

/** Absolute wall time for native tooltip (`title`) on relative-time labels */
function formatExactTimestampTitle(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function badgeLabel(key: PublishBadgeKey, t: (s: string) => string): string {
  switch (key) {
    case "title":
      return t("title");
    case "access":
      return t("access");
    case "attribution":
      return t("attribution");
    case "metadata":
      return t("metadata");
    case "cartography":
      return t("cartography");
    case "downloads":
      return t("downloads");
    case "interactivity":
      return t("interactivity");
    case "moved":
      return t("moved");
    case "source":
      return t("source");
    case "folderBehavior":
      return t("folder behavior");
    case "comments":
      return t("comments");
    default:
      return key;
  }
}

export default function PublishSummarizedChangesPanel({
  changeLogs,
  draftItems,
  tableOfContentsLastPublished,
}: {
  changeLogs: ChangeLogDetailsFragment[];
  draftItems: DraftTocItemForPublishSummary[];
  tableOfContentsLastPublished?: string | null;
}) {
  const { t } = useTranslation("admin:data");
  const { t: adminT } = useTranslation("admin");

  const summaryModel = buildPublishChangeSummary({
    changeLogs,
    draftItems,
    tableOfContentsLastPublished,
  });

  const [metadataModal, setMetadataModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);
  const [cartographyModal, setCartographyModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);

  if (!changeLogs.length) {
    const daysSinceIntroduction = Math.floor(
      (Date.now() - CHANGE_LOG_INTRODUCTION_DATE.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        {daysSinceIntroduction < 90
          ? t(
              "No unpublished changes were found. Change logging was introduced on {{date}}, so any changes made before that date were not logged. In the future, you can look forward to seeing detailed change history for layer list updates.",
              {
                date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString(),
              }
            )
          : t(
              "No unpublished changes were found in the changelog. There may still be changes not recorded by the changelog system that need publishing."
            )}
      </div>
    );
  }

  let totalChangeEvents = 0;
  for (const r of summaryModel.added) {
    totalChangeEvents += r.changeCount;
  }
  for (const r of summaryModel.updated) {
    totalChangeEvents += r.changeCount;
  }
  for (const r of summaryModel.removed) {
    totalChangeEvents += r.changeCount;
  }
  if (summaryModel.zOrderSummary) {
    totalChangeEvents += summaryModel.zOrderSummary.changeCount;
  }

  const affectedEntityCount =
    summaryModel.added.length +
    summaryModel.updated.length +
    summaryModel.removed.length +
    (summaryModel.zOrderSummary ? 1 : 0);

  const otherChangesCount = summaryModel.zOrderSummary ? 1 : 0;

  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
      <>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-600 pb-2">
            <Trans ns="admin:data">
              This list includes all changes to the layers list since the last
              publication. Review them before publishing to your project's
              users.
            </Trans>
          </p>
        </div>

        <div className="flex flex-col gap-8 pb-1">
          <SummarizedSection
            tone="removed"
            title={adminT("Removed")}
            count={summaryModel.removed.length}
          >
            {summaryModel.removed.map((row) => (
              <SummarizedRow
                key={row.entityId}
                row={row}
                t={t}
                removed
                onOpenMetadata={(tocId, initialId) =>
                  setMetadataModal({ tocId, initialId })
                }
                onOpenCartography={(tocId, initialId) =>
                  setCartographyModal({ tocId, initialId })
                }
              />
            ))}
          </SummarizedSection>

          <SummarizedSection
            tone="added"
            title={adminT("Added")}
            count={summaryModel.added.length}
          >
            {summaryModel.added.map((row) => (
              <SummarizedRow
                key={row.entityId}
                row={row}
                t={t}
                onOpenMetadata={(tocId, initialId) =>
                  setMetadataModal({ tocId, initialId })
                }
                onOpenCartography={(tocId, initialId) =>
                  setCartographyModal({ tocId, initialId })
                }
              />
            ))}
          </SummarizedSection>

          <SummarizedSection
            tone="updated"
            title={adminT("Updated")}
            count={summaryModel.updated.length}
          >
            {summaryModel.updated.map((row) => (
              <SummarizedRow
                key={row.entityId}
                row={row}
                t={t}
                onOpenMetadata={(tocId, initialId) =>
                  setMetadataModal({ tocId, initialId })
                }
                onOpenCartography={(tocId, initialId) =>
                  setCartographyModal({ tocId, initialId })
                }
              />
            ))}
          </SummarizedSection>

          <SummarizedSection
            tone="other"
            title={adminT("Other Changes")}
            count={otherChangesCount}
          >
            {summaryModel.zOrderSummary ? (
              <ZOrderSummarizedRow summary={summaryModel.zOrderSummary} t={t} />
            ) : null}
          </SummarizedSection>
        </div>

        {metadataModal && (
          <LayerMetadataRevisionModal
            tableOfContentsItemId={metadataModal.tocId}
            initialChangeLogId={metadataModal.initialId}
            onRequestClose={() => setMetadataModal(null)}
          />
        )}
        {cartographyModal && (
          <LayerCartographyRevisionModal
            tableOfContentsItemId={cartographyModal.tocId}
            initialChangeLogId={cartographyModal.initialId}
            onRequestClose={() => setCartographyModal(null)}
          />
        )}
      </>
    </Tooltip.Provider>
  );
}

function ZOrderSummarizedRow({
  summary,
  t,
}: {
  summary: PublishZOrderSummary;
  t: (key: string) => string;
}) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold leading-snug text-slate-900">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ViewListIcon
                className="h-[1.125rem] w-[1.125rem] flex-none text-indigo-500"
                aria-hidden
              />
              <span className="min-w-0">
                <Trans ns="admin:data">Layer z-order stacking updated</Trans>
              </span>
            </span>
          </p>
          <SummaryMetaRow
            editors={summary.editors}
            primaryEditor={summary.primaryEditor}
            changeCount={summary.changeCount}
            lastChangeAt={summary.lastChangeAt}
            t={t}
          />
        </div>
      </div>
    </li>
  );
}

function SummaryMetaRow({
  editors,
  primaryEditor,
  changeCount,
  lastChangeAt,
  t,
}: {
  editors: AuthorProfileFragment[];
  primaryEditor: AuthorProfileFragment | null;
  changeCount: number;
  lastChangeAt: string;
  t: (key: string) => string;
}) {
  const { t: adminT } = useTranslation("admin");
  const primaryName = nameForProfile(primaryEditor) || t("Unknown editor");
  const otherEditors = editors.filter(
    (p) => p.userId !== primaryEditor?.userId
  );

  const editorLabel =
    otherEditors.length === 0
      ? primaryName
      : adminT("{{name}} +{{n}} other", {
          name: primaryName,
          n: otherEditors.length,
        });

  const editorNamesTrigger =
    editors.length > 1 ? (
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-sm font-medium text-slate-600 underline decoration-dotted decoration-slate-400 underline-offset-2 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label={adminT("Show all editors")}
          >
            {editorLabel}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-[200] max-h-[min(60vh,18rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg outline-none"
          >
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Trans ns="admin">Editors</Trans>
            </p>
            <ul className="py-1">
              {editors.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center gap-2 px-3 py-1.5 text-slate-800"
                >
                  <span className="relative inline-block h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200">
                    <ProfilePhoto {...p} canonicalEmail="" />
                  </span>
                  <span className="min-w-0 truncate">
                    {nameForProfile(p) || t("Unknown editor")}
                  </span>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    ) : (
      <span className="shrink-0 font-medium text-slate-600">{editorLabel}</span>
    );

  return (
    <div className="flex max-w-full flex-nowrap items-center gap-x-2 overflow-x-auto text-xs text-slate-500 [scrollbar-width:thin]">
      <span className="inline-flex shrink-0 -space-x-1.5">
        {editors.slice(0, 4).map((p) => (
          <span
            key={p.userId}
            className="relative inline-block h-6 w-6 overflow-hidden rounded-full ring-2 ring-slate-100"
          >
            <ProfilePhoto {...p} canonicalEmail="" />
          </span>
        ))}
      </span>
      {editorNamesTrigger}
      <span className="shrink-0 text-slate-300" aria-hidden>
        {METADATA_BULLET}
      </span>
      <span className="shrink-0">
        {adminT("{{count}} changes", { count: changeCount })}
      </span>
      <span className="shrink-0 text-slate-300" aria-hidden>
        {METADATA_BULLET}
      </span>
      <span
        className="shrink-0 cursor-default whitespace-nowrap text-slate-400"
        title={formatExactTimestampTitle(lastChangeAt)}
      >
        {adminT("last {{time}}", {
          time: formatRelativeTimeAgo(lastChangeAt),
        })}
      </span>
    </div>
  );
}

function SummarizedSection({
  tone,
  title,
  count,
  children,
}: {
  tone: "added" | "removed" | "updated" | "other";
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (!count) {
    return null;
  }

  const accentDot =
    tone === "added"
      ? "bg-emerald-500"
      : tone === "removed"
      ? "bg-rose-500"
      : tone === "updated"
      ? "bg-sky-500"
      : "bg-violet-500";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/5">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${accentDot}`}
            aria-hidden
          />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </h3>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-700">
          {count}
        </span>
      </header>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function SummarizedRow({
  row,
  t,
  removed,
  onOpenMetadata,
  onOpenCartography,
}: {
  row: PublishSummaryRow;
  t: (key: string) => string;
  removed?: boolean;
  onOpenMetadata: (tocId: number, initialId?: string) => void;
  onOpenCartography: (tocId: number, initialId?: string) => void;
}) {
  const metaRow = (
    <SummaryMetaRow
      editors={row.editors}
      primaryEditor={row.primaryEditor}
      changeCount={row.changeCount}
      lastChangeAt={row.lastChangeAt}
      t={t}
    />
  );

  if (removed) {
    return (
      <li className="px-4 py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="min-w-0 text-sm font-medium leading-snug text-slate-400 line-through">
            {row.isFolder ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <FolderIcon
                  className="h-4 w-4 flex-none text-slate-300"
                  aria-hidden
                />
                <span className="min-w-0 truncate">{row.title}</span>
              </span>
            ) : (
              <span className="min-w-0 truncate">{row.title}</span>
            )}
          </p>
          <div className="shrink-0 sm:text-right">{metaRow}</div>
        </div>
      </li>
    );
  }

  return (
    <li className="px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold leading-snug text-slate-900">
            {row.isFolder ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <FolderIcon
                  className="h-[1.125rem] w-[1.125rem] flex-none text-slate-400"
                  aria-hidden
                />
                <span className="min-w-0">{row.title}</span>
              </span>
            ) : (
              <span className="min-w-0">{row.title}</span>
            )}
          </p>
          {metaRow}
        </div>
        {row.badges.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-1.5 lg:max-w-[min(24rem,48%)] lg:justify-end lg:pt-0.5">
            {row.badges.map((b) => (
              <PublishBadge
                key={b.key}
                badgeKey={b.key}
                logs={b.logs}
                t={t}
                isFolder={row.isFolder}
                tableOfContentsItemId={row.entityId}
                onOpenMetadata={() =>
                  onOpenMetadata(
                    row.entityId,
                    oldestChangeLogId(b.logs, ChangeLogFieldGroup.LayerMetadata)
                  )
                }
                onOpenCartography={() =>
                  onOpenCartography(
                    row.entityId,
                    oldestChangeLogId(
                      b.logs,
                      ChangeLogFieldGroup.LayerCartography
                    )
                  )
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function PublishBadge({
  badgeKey,
  logs,
  t,
  isFolder,
  tableOfContentsItemId,
  onOpenMetadata,
  onOpenCartography,
}: {
  badgeKey: PublishBadgeKey;
  logs: ChangeLogDetailsFragment[];
  t: (key: string) => string;
  isFolder: boolean;
  tableOfContentsItemId: number;
  onOpenMetadata: () => void;
  onOpenCartography: () => void;
}) {
  const label = badgeLabel(badgeKey, t);
  const showViewerEscalation =
    (badgeKey === "metadata" || badgeKey === "cartography") &&
    !isFolder &&
    logs.length > 0;

  const detail = (
    <PublishBadgeDetailContent
      badgeKey={badgeKey}
      logs={logs}
      isFolder={isFolder}
      t={t}
      tableOfContentsItemId={tableOfContentsItemId}
      onOpenMetadata={onOpenMetadata}
      onOpenCartography={onOpenCartography}
      omitInlineModalActions
    />
  );

  const leadGlyph =
    badgeKey === "moved" ? (
      <FolderIcon className="h-3 w-3 flex-none text-gray-500" aria-hidden />
    ) : badgeKey === "comments" ? (
      <CommentBadgeIcon />
    ) : showViewerEscalation ? (
      <ExternalLinkIcon
        className="h-3 w-3 flex-none text-gray-500"
        aria-hidden
      />
    ) : (
      <EyeIcon className="h-3 w-3 flex-none text-gray-500" aria-hidden />
    );

  const pill = (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium leading-none text-slate-600">
      {leadGlyph}
      {label}
    </span>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={
            showViewerEscalation
              ? t("Hover for a summary; click to open the full viewer.")
              : t("Hover for change details.")
          }
          onClick={(_e: MouseEvent<HTMLButtonElement>) => {
            if (showViewerEscalation) {
              if (badgeKey === "metadata") {
                onOpenMetadata();
              } else {
                onOpenCartography();
              }
            }
          }}
        >
          {pill}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className={clsx(
            "z-[100] max-h-[min(80vh,36rem)] overflow-y-auto rounded-md text-sm shadow-xl outline-none",
            badgeKey === "comments"
              ? "border border-gray-200 bg-white p-0 text-gray-800"
              : clsx(
                  "border border-zinc-700 bg-neutral-950 text-zinc-100",
                  badgeKey === "metadata" || badgeKey === "cartography"
                    ? "p-2"
                    : "p-3"
                ),
            badgePopoverContentClassName(badgeKey)
          )}
        >
          {detail}
          <Tooltip.Arrow
            className={
              badgeKey === "comments" ? "fill-white" : "fill-neutral-950"
            }
          />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function CommentBadgeIcon() {
  return (
    <svg
      className="h-3 w-3 flex-none text-gray-500"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h5A2.5 2.5 0 0 1 15 6.5v3A2.5 2.5 0 0 1 12.5 12H10l-3.25 3v-3.1A2.5 2.5 0 0 1 5 9.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
