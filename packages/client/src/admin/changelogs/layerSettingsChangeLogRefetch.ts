import type { RefetchQueriesInclude } from "@apollo/client";
import { LayerSettingsChangeLogDocument } from "../../generated/graphql";

/** Recent slice for layer settings history query (matches refetch mutation cache keys). */
export const LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE = 5;
/** Cap when user expands history (newest-first; unlikely to exceed in practice). */
export const LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST = 500;

/** Refetches both paginated variants of {@link LayerSettingsChangeLogDocument} (Apollo cache keys differ by `first`). */
export function layerSettingsChangeLogRefetchQueries(
  tableOfContentsItemId: number,
): RefetchQueriesInclude {
  return [
    {
      query: LayerSettingsChangeLogDocument,
      variables: {
        id: tableOfContentsItemId,
        first: LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE,
      },
    },
    {
      query: LayerSettingsChangeLogDocument,
      variables: {
        id: tableOfContentsItemId,
        first: LAYER_SETTINGS_CHANGE_LOG_EXPANDED_FIRST,
      },
    },
  ] as unknown as RefetchQueriesInclude;
}
