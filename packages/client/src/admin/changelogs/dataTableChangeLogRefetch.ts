import type { RefetchQueriesInclude } from "@apollo/client";
import { DataTableChangeLogDocument } from "../../generated/graphql";
import {
  LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST,
  LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
} from "./layerSettingsChangeLogRefetch";

export {
  LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE as DATA_TABLE_CHANGE_LOG_PAGE_SIZE,
  LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST as DATA_TABLE_CHANGE_LOG_EXPANDED_FIRST,
};

/** Refetches both paginated variants of {@link DataTableChangeLogDocument}. */
export function dataTableChangeLogRefetchQueries(
  tableOfContentsItemId: number,
): RefetchQueriesInclude {
  return [
    {
      query: DataTableChangeLogDocument,
      variables: {
        id: tableOfContentsItemId,
        first: LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
      },
    },
    {
      query: DataTableChangeLogDocument,
      variables: {
        id: tableOfContentsItemId,
        first: LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST,
      },
    },
  ] as unknown as RefetchQueriesInclude;
}
