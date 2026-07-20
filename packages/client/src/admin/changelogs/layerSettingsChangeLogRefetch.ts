import { RefetchQueriesInclude } from "@apollo/client";
import { LayerSettingsChangeLogDocument } from "../../generated/graphql";

/** How many history items to show before "View full history". */
export const LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE = 5;
/**
 * Collapsed fetch size: one more than the visible page so we can tell
 * "exactly PAGE_SIZE items" from "there are more".
 */
export const LAYER_SETTINGS_CHANGE_LOG_COLLAPSED_FIRST =
  LAYER_SETTINGS_CHANGE_LOG_PAGE_SIZE + 1;
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
        first: LAYER_SETTINGS_CHANGE_LOG_COLLAPSED_FIRST,
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
