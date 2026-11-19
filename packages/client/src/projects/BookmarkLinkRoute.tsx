import { useHistory, useRouteMatch } from "react-router-dom";
import MapBookmarkDetailsOverlay from "../components/MapBookmarkDetailsOverlay";
import getSlug from "../getSlug";

export default function BookmarkLinkRoute() {
  const slug = getSlug();
  const history = useHistory();
  const match = useRouteMatch<{ bookmarkId: string }>(
    `/${slug}/bookmarks/:bookmarkId`
  );
  if (!match) {
    return null;
  }
  const bookmarkId = match.params.bookmarkId;
  return (
    <MapBookmarkDetailsOverlay
      bookmarkId={bookmarkId}
      onRequestClose={() => {
        history.replace(`/${slug}/app`);
      }}
    />
  );
}
