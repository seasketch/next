export type MapViewOmissions = {
  sketches: boolean;
  unsharedSketches: boolean;
  unsavedDrawing: boolean;
};

/**
 * What the create-bookmark card should say was left out of the saved view.
 * Any sketch on screen is called out as private to the account. Unsaved
 * drawing markup is left out as well.
 */
export function mapViewOmissions(input: {
  sketches: { sharedInForum: boolean }[];
  unsavedDrawing: boolean;
}): MapViewOmissions {
  return {
    sketches: input.sketches.length > 0,
    unsharedSketches: input.sketches.some(
      (sketch) => sketch.sharedInForum !== true
    ),
    unsavedDrawing: input.unsavedDrawing,
  };
}

export function mapBookmarkPath(slug: string, bookmarkId: string) {
  // eslint-disable-next-line i18next/no-literal-string
  return `/${slug}/bookmarks/${bookmarkId}`;
}

export function mapBookmarkUrl(slug: string, bookmarkId: string) {
  const path = mapBookmarkPath(slug, bookmarkId);
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}
