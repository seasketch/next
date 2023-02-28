import { MapBookmarkAttachment } from "./PostContentEditor";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "../../components/Spinner";
import { XCircleIcon } from "@heroicons/react/solid";
import { useContext } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";

export default function BookmarksList({
  bookmarks,
  removeBookmark,
  highlightedBookmarkId,
  onHover,
}: {
  bookmarks: MapBookmarkAttachment[];
  removeBookmark: (id: string) => void;
  highlightedBookmarkId?: string | null;
  onHover: (id?: string) => void;
}) {
  const mapContext = useContext(MapContext);

  return (
    <div className={bookmarks.length > 0 ? `border-t border-gray-50 pb-2` : ""}>
      <AnimatePresence initial={false}>
        {bookmarks.map((attachment) => {
          const bookmark = attachment.attachment;
          return (
            <motion.button
              onMouseOver={() => onHover(bookmark.id)}
              onMouseOut={() => onHover()}
              key={bookmark.id}
              onClick={(e) => {
                if (mapContext.manager) {
                  mapContext.manager.showMapBookmark(bookmark);
                }
              }}
              initial={{ opacity: 0, translateX: 200 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, scale: 0.25 }}
              className={`group transform float-left border ml-3.5 mt-2.5 rounded w-24 2xl:w-27 h-14 2xl:h-16 2xl:ml-2 2xl:mt-2 shadow-sm relative ${
                !bookmark.thumbnailUrl ? "bg-gray-50" : ""
              } ${
                highlightedBookmarkId === bookmark.id ? "border-blue-200" : ""
              }`}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeBookmark(bookmark.id);
                }}
                className="group-hover:opacity-100 opacity-0 w-5 h-5 absolute -right-2 -top-2"
              >
                <XCircleIcon />
              </button>
              {!bookmark.thumbnailUrl && (
                <div className="flex flex-col items-center justify-center w-full h-full">
                  <Spinner />
                </div>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
      <div className="clear-both"></div>
    </div>
  );
}
