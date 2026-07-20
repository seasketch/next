import {
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../generated/graphql";

/** Max difference between LayerUploaded.lastAt and dataSource.createdAt to treat upload as creation. */
export const CREATION_UPLOAD_MATCH_MS = 5 * 60 * 1000;

/**
 * Whether the collapsed history fetch exhausted the list. Callers request
 * `pageSize + 1` when collapsed, so a result of `pageSize` or fewer means
 * there is nothing more to load.
 */
export function hasLoadedFullHistory(
  changeLogsLength: number,
  pageSize: number,
  showAllHistory: boolean
): boolean {
  if (changeLogsLength === 0) return true;
  if (changeLogsLength <= pageSize) return true;
  return showAllHistory;
}

export function oldestUploadMatchesCreation(params: {
  oldest: ChangeLogDetailsFragment | undefined;
  createdAt: Date;
}): boolean {
  const { oldest, createdAt } = params;
  if (!oldest) return false;
  if (oldest.fieldGroup !== ChangeLogFieldGroup.LayerUploaded) return false;
  const lastMs = new Date(oldest.lastAt).getTime();
  const createdMs = createdAt.getTime();
  return Math.abs(lastMs - createdMs) <= CREATION_UPLOAD_MATCH_MS;
}
