import {
  AuthorProfileFragment,
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../generated/graphql";
import { summary } from "../changelogs/fieldGroups/FieldGroupListItemBase";

export const TOC_ENTITY_TYPE = "table_of_contents_items";

export type PublishBadgeKey =
  | "title"
  | "access"
  | "attribution"
  | "metadata"
  | "cartography"
  | "downloads"
  | "interactivity"
  | "moved"
  | "source"
  | "folderBehavior"
  | "comments";

/** Display order for badges in summarized rows */
export const PUBLISH_BADGE_ORDER: PublishBadgeKey[] = [
  "source",
  "title",
  "access",
  "attribution",
  "metadata",
  "cartography",
  "downloads",
  "interactivity",
  "comments",
  "moved",
  "folderBehavior",
];

const FIELD_GROUP_TO_BADGE: Partial<
  Record<ChangeLogFieldGroup, PublishBadgeKey>
> = {
  [ChangeLogFieldGroup.LayerTitle]: "title",
  [ChangeLogFieldGroup.FolderTitle]: "title",
  [ChangeLogFieldGroup.LayerAcl]: "access",
  [ChangeLogFieldGroup.FolderAcl]: "access",
  [ChangeLogFieldGroup.LayerAttribution]: "attribution",
  [ChangeLogFieldGroup.LayerMetadata]: "metadata",
  [ChangeLogFieldGroup.LayerCartography]: "cartography",
  [ChangeLogFieldGroup.LayerDownloadable]: "downloads",
  [ChangeLogFieldGroup.LayerInteractivity]: "interactivity",
  [ChangeLogFieldGroup.LayerParentChanged]: "moved",
  [ChangeLogFieldGroup.LayerUploaded]: "source",
  [ChangeLogFieldGroup.FolderType]: "folderBehavior",
  [ChangeLogFieldGroup.ResolvableLayerCommentsCreated]: "comments",
  [ChangeLogFieldGroup.ResolvableLayerCommentsResponded]: "comments",
  [ChangeLogFieldGroup.ResolvableLayerCommentsResolved]: "comments",
  [ChangeLogFieldGroup.ResolvableLayerCommentsReopened]: "comments",
};

export type DraftTocItemForPublishSummary = {
  id: number;
  title: string;
  isFolder: boolean;
  dataLayer?: {
    id: number;
    dataSource?: { createdAt?: string | null } | null;
  } | null;
};

export type PublishSummaryRow = {
  entityId: number;
  title: string;
  isFolder: boolean;
  category: "added" | "updated" | "removed";
  /** All changelog rows for this TOC item in the publish window (newest-first API order preserved in input) */
  logs: ChangeLogDetailsFragment[];
  changeCount: number;
  lastChangeAt: string;
  editors: AuthorProfileFragment[];
  primaryEditor: AuthorProfileFragment | null;
  badges: {
    key: PublishBadgeKey;
    logs: ChangeLogDetailsFragment[];
  }[];
};

export type PublishZOrderSummary = {
  /** All project-level z-order changelog rows in the publish window */
  logs: ChangeLogDetailsFragment[];
  /** Number of distinct z-order events (= logs.length) */
  changeCount: number;
  lastChangeAt: string;
  editors: AuthorProfileFragment[];
  primaryEditor: AuthorProfileFragment | null;
};

export type PublishChangeSummary = {
  lastPublishIso: string | null;
  /** Collapsed z-order updates for the project (not TOC entities) */
  zOrderSummary: PublishZOrderSummary | null;
  added: PublishSummaryRow[];
  updated: PublishSummaryRow[];
  removed: PublishSummaryRow[];
  /** Distinct TOC entity ids with any changelog in this window */
  tocEntityCount: number;
};

function sortByLastAtAsc<T extends { lastAt: string }>(logs: T[]): T[] {
  return [...logs].sort(
    (a, b) => new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime()
  );
}

function sortByLastAtDesc<T extends { lastAt: string }>(logs: T[]): T[] {
  return [...logs].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

function uniqueEditors(logs: ChangeLogDetailsFragment[]): AuthorProfileFragment[] {
  const byUser = new Map<number, AuthorProfileFragment>();
  for (const log of sortByLastAtDesc(logs)) {
    const p = log.editorProfile;
    if (p?.userId != null && !byUser.has(p.userId)) {
      byUser.set(p.userId, p as AuthorProfileFragment);
    }
  }
  return Array.from(byUser.values());
}

function primaryEditorFromLogs(
  logs: ChangeLogDetailsFragment[]
): AuthorProfileFragment | null {
  const sorted = sortByLastAtDesc(logs);
  const p = sorted[0]?.editorProfile;
  return (p as AuthorProfileFragment) ?? null;
}

function badgeKeyForFieldGroup(
  fg: ChangeLogFieldGroup
): PublishBadgeKey | null {
  return FIELD_GROUP_TO_BADGE[fg] ?? null;
}

function shouldOmitLogForBadges(
  log: ChangeLogDetailsFragment,
  category: PublishSummaryRow["category"]
): boolean {
  if (log.fieldGroup === ChangeLogFieldGroup.FolderCreated) {
    return true;
  }
  if (
    log.fieldGroup === ChangeLogFieldGroup.LayerUploaded &&
    category === "added"
  ) {
    return true;
  }
  return false;
}

function groupLogsIntoBadges(
  logs: ChangeLogDetailsFragment[],
  category: PublishSummaryRow["category"]
): PublishSummaryRow["badges"] {
  const byBadge = new Map<PublishBadgeKey, ChangeLogDetailsFragment[]>();
  for (const log of logs) {
    if (shouldOmitLogForBadges(log, category)) {
      continue;
    }
    const key = badgeKeyForFieldGroup(log.fieldGroup);
    if (!key) {
      continue;
    }
    const arr = byBadge.get(key) ?? [];
    arr.push(log);
    byBadge.set(key, arr);
  }
  const badges: PublishSummaryRow["badges"] = [];
  for (const key of PUBLISH_BADGE_ORDER) {
    const group = byBadge.get(key);
    if (group?.length) {
      badges.push({
        key,
        logs: sortByLastAtAsc(group),
      });
    }
  }
  return badges;
}

export function isRemovedLogs(logs: ChangeLogDetailsFragment[]): boolean {
  return logs.some(
    (l) =>
      l.fieldGroup === ChangeLogFieldGroup.LayerDeleted ||
      l.fieldGroup === ChangeLogFieldGroup.FolderDeleted
  );
}

export function isAddedItem(
  item: DraftTocItemForPublishSummary,
  logs: ChangeLogDetailsFragment[],
  lastPublish: Date | null
): boolean {
  if (item.isFolder) {
    return logs.some((l) => l.fieldGroup === ChangeLogFieldGroup.FolderCreated);
  }
  if (logs.some((l) => l.fieldGroup === ChangeLogFieldGroup.LayerUploaded)) {
    return true;
  }
  const createdAt = item.dataLayer?.dataSource?.createdAt;
  if (lastPublish && createdAt) {
    return new Date(createdAt) > lastPublish;
  }
  return false;
}

function titleForRemovedItem(logs: ChangeLogDetailsFragment[]): string {
  const del = logs.find(
    (l) =>
      l.fieldGroup === ChangeLogFieldGroup.LayerDeleted ||
      l.fieldGroup === ChangeLogFieldGroup.FolderDeleted
  );
  if (!del) {
    return "";
  }
  const from = summary(del.fromSummary);
  const t = from.title as unknown;
  if (typeof t === "string" && t.length) {
    return t;
  }
  return "";
}

function buildZOrderSummary(
  logs: ChangeLogDetailsFragment[]
): PublishZOrderSummary {
  const sortedDesc = sortByLastAtDesc(logs);
  const lastChangeAt = sortedDesc[0]?.lastAt ?? new Date().toISOString();
  return {
    logs,
    changeCount: logs.length,
    lastChangeAt,
    editors: uniqueEditors(logs),
    primaryEditor: primaryEditorFromLogs(logs),
  };
}

function rowFromLogs(
  entityId: number,
  title: string,
  isFolder: boolean,
  category: PublishSummaryRow["category"],
  logs: ChangeLogDetailsFragment[]
): PublishSummaryRow {
  const sortedDesc = sortByLastAtDesc(logs);
  const lastChangeAt = sortedDesc[0]?.lastAt ?? new Date().toISOString();
  return {
    entityId,
    title,
    isFolder,
    category,
    logs,
    changeCount: logs.length,
    lastChangeAt,
    editors: uniqueEditors(logs),
    primaryEditor: primaryEditorFromLogs(logs),
    badges: groupLogsIntoBadges(logs, category),
  };
}

export function buildPublishChangeSummary({
  changeLogs,
  draftItems,
  tableOfContentsLastPublished,
}: {
  changeLogs: ChangeLogDetailsFragment[];
  draftItems: DraftTocItemForPublishSummary[];
  tableOfContentsLastPublished?: string | null;
}): PublishChangeSummary {
  const lastPublishIso = tableOfContentsLastPublished ?? null;
  const lastPublishDate = lastPublishIso ? new Date(lastPublishIso) : null;

  const zOrderLogs = changeLogs.filter(
    (l) =>
      l.fieldGroup === ChangeLogFieldGroup.LayersZOrderChange &&
      l.entityType === "projects"
  );
  const zOrderSummary =
    zOrderLogs.length > 0 ? buildZOrderSummary(zOrderLogs) : null;

  const tocLogs = changeLogs.filter((l) => l.entityType === TOC_ENTITY_TYPE);
  const byEntity = new Map<number, ChangeLogDetailsFragment[]>();
  for (const log of tocLogs) {
    const list = byEntity.get(log.entityId) ?? [];
    list.push(log);
    byEntity.set(log.entityId, list);
  }

  const draftById = new Map(draftItems.map((i) => [i.id, i]));

  const added: PublishSummaryRow[] = [];
  const updated: PublishSummaryRow[] = [];
  const removed: PublishSummaryRow[] = [];

  for (const [entityId, logs] of byEntity) {
    if (isRemovedLogs(logs)) {
      const title = titleForRemovedItem(logs);
      const del = logs.find(
        (l) =>
          l.fieldGroup === ChangeLogFieldGroup.LayerDeleted ||
          l.fieldGroup === ChangeLogFieldGroup.FolderDeleted
      );
      const isFolder =
        del?.fieldGroup === ChangeLogFieldGroup.FolderDeleted ||
        summary(del?.fromSummary ?? {}).is_folder === true;
      removed.push(rowFromLogs(entityId, title, Boolean(isFolder), "removed", logs));
      continue;
    }

    const draft = draftById.get(entityId);
    if (!draft) {
      continue;
    }

    const category: PublishSummaryRow["category"] = isAddedItem(
      draft,
      logs,
      lastPublishDate
    )
      ? "added"
      : "updated";

    const row = rowFromLogs(
      entityId,
      draft.title,
      draft.isFolder,
      category,
      logs
    );
    if (category === "added") {
      added.push(row);
    } else {
      updated.push(row);
    }
  }

  const sortRows = (a: PublishSummaryRow, b: PublishSummaryRow) =>
    new Date(b.lastChangeAt).getTime() - new Date(a.lastChangeAt).getTime();

  added.sort(sortRows);
  updated.sort(sortRows);
  removed.sort(sortRows);

  return {
    lastPublishIso,
    zOrderSummary,
    added,
    updated,
    removed,
    tocEntityCount: byEntity.size,
  };
}

/** Oldest cartography / metadata changelog id in this publish window (for modal initial selection). */
export function oldestChangeLogId(
  logs: ChangeLogDetailsFragment[],
  fieldGroup: ChangeLogFieldGroup
): string | undefined {
  const filtered = logs.filter((l) => l.fieldGroup === fieldGroup);
  if (!filtered.length) {
    return undefined;
  }
  const oldest = sortByLastAtAsc(filtered)[0];
  return oldest ? String(oldest.id) : undefined;
}
