import { FolderIcon } from "@heroicons/react/outline";
import { ReactNode } from "react";
import { ChangeLogDetailsFragment } from "../../generated/graphql";
import { summary, valueText } from "./fieldGroups/FieldGroupListItemBase";
import {
  tableNameFromSummary,
  tocItemIdFromMeta,
} from "./fieldGroups/dataTableSummary";
import { TOC_ENTITY_TYPE } from "../data/publishChangelogSummary";

export interface ChangeLogTocItem {
  id: number;
  title: string;
  isFolder: boolean;
  stableId: string;
  parentStableId?: string | null;
  hasDataLayer: boolean;
}

/** Stable ids whose map visibility this item controls. Folders include descendants. */
export function mappableStableIds(
  item: ChangeLogTocItem,
  items: readonly ChangeLogTocItem[]
): string[] {
  if (!item.isFolder) {
    return item.hasDataLayer ? [item.stableId] : [];
  }
  const childrenByParent = new Map<string, ChangeLogTocItem[]>();
  for (const candidate of items) {
    if (!candidate.parentStableId) {
      continue;
    }
    const siblings = childrenByParent.get(candidate.parentStableId);
    if (siblings) {
      siblings.push(candidate);
    } else {
      childrenByParent.set(candidate.parentStableId, [candidate]);
    }
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  const stack = [...(childrenByParent.get(item.stableId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current.stableId)) {
      continue;
    }
    seen.add(current.stableId);
    if (current.isFolder) {
      stack.push(...(childrenByParent.get(current.stableId) ?? []));
    } else if (current.hasDataLayer) {
      ids.push(current.stableId);
    }
  }
  return ids;
}

export interface ChangeLogDraftItem {
  id: number;
  title: string;
  isFolder: boolean;
  overlayDataTables?: { id: number; name?: string | null }[] | null;
  dataLayer?: {
    dataSource?: { dataLibraryTemplateId?: string | null } | null;
  } | null;
}

export interface ChangeLogEntityLookups {
  itemTitleById: Map<number, { title: string; isFolder: boolean }>;
  /** Active data-table id to name. */
  dataTableNameById: Map<number, string>;
  /** Items whose data source belongs to the Data Library (attribution fallback). */
  tocItemIdsWithDataLibrarySource: Set<number>;
}

export function buildChangeLogEntityLookups(
  items: readonly ChangeLogDraftItem[]
): ChangeLogEntityLookups {
  const itemTitleById = new Map<number, { title: string; isFolder: boolean }>();
  const dataTableNameById = new Map<number, string>();
  const tocItemIdsWithDataLibrarySource = new Set<number>();
  for (const item of items) {
    itemTitleById.set(item.id, { title: item.title, isFolder: item.isFolder });
    for (const table of item.overlayDataTables || []) {
      if (table.name) {
        dataTableNameById.set(table.id, table.name);
      }
    }
    const templateId = item.dataLayer?.dataSource?.dataLibraryTemplateId;
    if (templateId != null && templateId !== "") {
      tocItemIdsWithDataLibrarySource.add(item.id);
    }
  }
  return {
    itemTitleById,
    dataTableNameById,
    tocItemIdsWithDataLibrarySource,
  };
}

type TitledChangeLog = Pick<
  ChangeLogDetailsFragment,
  | "entityType"
  | "entityId"
  | "fieldGroup"
  | "meta"
  | "toSummary"
  | "fromSummary"
>;

/**
 * Heading shown beside the author for a change log that targets a layer,
 * folder or overlay data table. Falls back to titles recorded in the change
 * log itself, since the entity may have been renamed or deleted since.
 */
export function titleForChangeLog(
  changeLog: TitledChangeLog,
  itemTitleById: ChangeLogEntityLookups["itemTitleById"],
  dataTableNameById: ChangeLogEntityLookups["dataTableNameById"],
  fallback: (key: string) => string,
  renderLayerTitle?: (title: string, itemId: number) => ReactNode
) {
  if (changeLog.entityType === "overlay_data_table") {
    const tocItemId = tocItemIdFromMeta(changeLog.meta);
    const overlayTitle =
      tocItemId != null
        ? itemTitleById.get(tocItemId)?.title ?? fallback("Unknown layer")
        : fallback("Unknown layer");
    const overlayTitleNode =
      tocItemId != null &&
      itemTitleById.has(tocItemId) &&
      renderLayerTitle
        ? renderLayerTitle(overlayTitle, tocItemId)
        : overlayTitle;
    const tableName =
      tableNameFromSummary(summary(changeLog.toSummary)) ||
      tableNameFromSummary(summary(changeLog.fromSummary)) ||
      dataTableNameById.get(changeLog.entityId) ||
      "";
    if (!tableName) {
      return overlayTitleNode;
    }
    return (
      <span className="inline-flex h-6 min-w-0 items-center gap-1.5 align-middle leading-6">
        <span className="min-w-0 truncate">{overlayTitleNode}</span>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="flex-none text-gray-400" aria-hidden>
          ·
        </span>
        <span className="min-w-0 truncate">{tableName}</span>
      </span>
    );
  }

  if (changeLog.entityType !== TOC_ENTITY_TYPE) {
    return undefined;
  }
  const to = summary(changeLog.toSummary);
  const from = summary(changeLog.fromSummary);
  const currentItem = itemTitleById.get(changeLog.entityId);
  const title =
    currentItem?.title ||
    valueText(to.title) ||
    valueText(from.title) ||
    valueText(to.filename) ||
    fallback("Unknown layer");
  if (currentItem && renderLayerTitle) {
    return renderLayerTitle(title, changeLog.entityId);
  }
  const isFolder =
    currentItem?.isFolder ||
    to.is_folder === true ||
    from.is_folder === true ||
    changeLog.fieldGroup.startsWith("FOLDER");

  if (!isFolder) {
    return title;
  }

  return (
    <span className="inline-flex h-6 min-w-0 items-center gap-1 align-middle leading-6">
      <FolderIcon className="h-3.5 w-3.5 flex-none text-gray-400" aria-hidden />
      <span className="min-w-0 truncate leading-6">{title}</span>
    </span>
  );
}
