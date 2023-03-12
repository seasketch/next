import { MapBookmarkAttachment } from "./PostContentEditor";
import { motion, AnimatePresence } from "framer-motion";
import BookmarkItem from "./BookmarkItem";

export default function BookmarksList({
  bookmarks,
  removeBookmark,
  highlightedBookmarkId,
  onHover,
  errors,
  className,
}: {
  bookmarks: MapBookmarkAttachment[];
  removeBookmark?: (id: string) => void;
  highlightedBookmarkId?: string | null;
  onHover?: (id?: string) => void;
  errors?: { id: string; error: string }[];
  className?: string;
}) {
  return (
    <div
      className={
        (className || "") +
        (bookmarks.length > 0 ? ` border-t border-gray-50 pb-2` : "")
      }
    >
      <AnimatePresence initial={false}>
        {bookmarks.map((attachment) => {
          const hasErrors = Boolean(
            errors?.find((e) => e.id === attachment.data.id)
          );
          return (
            <BookmarkItem
              key={attachment.id}
              highlighted={Boolean(
                highlightedBookmarkId === attachment.data.id
              )}
              bookmark={attachment.data}
              onHover={onHover}
              removeBookmark={removeBookmark}
              hasErrors={hasErrors}
            />
          );
        })}
      </AnimatePresence>
      <div className="clear-both"></div>
    </div>
  );
}
