/** Query param used to open a draft TOC item in Data Layer Admin. */
// eslint-disable-next-line i18next/no-literal-string
export const LAYER_ADMIN_TOC_ITEM_QUERY_PARAM = "tocItemId";

/** Path + query for the data admin deep link. Ephemeral after bootstrap. */
export function layerAdminUrl(slug: string, tocItemId: number): string {
  // eslint-disable-next-line i18next/no-literal-string
  return `/${slug}/admin/data?${LAYER_ADMIN_TOC_ITEM_QUERY_PARAM}=${tocItemId}`;
}

/** Parse a draft TOC item id from a location search string. */
export function parseTocItemIdFromSearch(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get(LAYER_ADMIN_TOC_ITEM_QUERY_PARAM);
  if (!raw) {
    return null;
  }
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return id;
}
