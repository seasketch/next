import { RefetchQueriesInclude } from "@apollo/client";
import {
  DataTableChangeLogDocument,
  GetLayerItemDocument,
} from "../../generated/graphql";
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

/** Refetch data table history and the layer item table list after a mutation. */
export function dataTableMutationRefetchQueries(
  tableOfContentsItemId: number,
): RefetchQueriesInclude {
  return [
    ...dataTableChangeLogRefetchQueries(tableOfContentsItemId),
    {
      query: GetLayerItemDocument,
      variables: { id: tableOfContentsItemId },
    },
  ] as unknown as RefetchQueriesInclude;
}
