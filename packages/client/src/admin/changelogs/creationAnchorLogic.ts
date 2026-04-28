import {
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../generated/graphql";

/** Max difference between LayerUploaded.lastAt and dataSource.createdAt to treat upload as creation. */
export const CREATION_UPLOAD_MATCH_MS = 5 * 60 * 1000;

export function hasLoadedFullHistory(
  changeLogsLength: number,
  pageSize: number,
  showAllHistory: boolean
): boolean {
  if (changeLogsLength === 0) return true;
  if (changeLogsLength < pageSize) return true;
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
