export type BookmarkLayerCatalog = {
  /** False until the table of contents has been loaded. An empty catalog is not evidence that saved layers are gone. */
  loaded: boolean;
  stableIds: readonly string[];
  /** Older bookmarks stored geoprocessing reference ids, data-layer ids, static ids, or table-of-contents row ids. */
  aliases: readonly string[];
};

/**
 * Layer ids from a bookmark that are not in the current project.
 * Saved ids that match any current identifier are kept. A catalog that has
 * not loaded yet reports nothing missing.
 */
export function missingBookmarkLayerIds(
  layerIds: readonly string[],
  catalog: BookmarkLayerCatalog
): string[] {
  const ids = layerIds.filter((id) => id.length > 0);
  if (!catalog.loaded) {
    return [];
  }
  const known = new Set<string>([...catalog.stableIds, ...catalog.aliases]);
  return ids.filter((id) => !known.has(id));
}
