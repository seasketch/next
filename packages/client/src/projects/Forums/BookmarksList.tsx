import { MapBookmarkAttachment } from "./PostContentEditor";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "../../components/Spinner";
import { XCircleIcon } from "@heroicons/react/solid";
import { useContext, useMemo } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";
import { SketchUIStateContext } from "../Sketches/SketchUIStateContextProvider";

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
  const mapContext = useContext(MapContext);
  const sketchUIContext = useContext(SketchUIStateContext);

  return (
    <div
      className={
        (className || "") +
        (bookmarks.length > 0 ? ` border-t border-gray-50 pb-2` : "")
      }
    >
      <AnimatePresence initial={false}>
        {bookmarks.map((attachment) => {
          const bookmark = attachment.attachment;
          const hasErrors = Boolean(errors?.find((e) => e.id === bookmark.id));
          return (
            <motion.button
              onMouseOver={onHover ? () => onHover(bookmark.id) : undefined}
              onMouseOut={onHover ? () => onHover() : undefined}
              key={bookmark.id}
              onClick={(e) => {
                if (mapContext.manager) {
                  mapContext.manager.showMapBookmark(bookmark);
                  if (bookmark.visibleSketches) {
                    sketchUIContext.setVisibleSketches(
                      bookmark.visibleSketches.map((id) => `Sketch:${id}`)
                    );
                  }
                }
              }}
              initial={{ opacity: 0, translateX: 200 }}
              animate={{ opacity: 1, translateX: 0 }}
              title={
                hasErrors
                  ? "Bookmark refers to sketches that are no longer posted"
                  : undefined
              }
              exit={{ opacity: 0, scale: 0.25 }}
              className={`group transform float-left border ml-3.5 mt-2.5 rounded w-24 2xl:w-27 h-14 2xl:h-16 2xl:ml-2 2xl:mt-2 shadow-sm relative ${
                !bookmark.thumbnailUrl ? "bg-gray-50" : ""
              } ${
                hasErrors
                  ? "border-red-200"
                  : highlightedBookmarkId === bookmark.id
                  ? "border-blue-200"
                  : ""
              }`}
            >
              {removeBookmark && (
                <button
                  onClick={
                    removeBookmark
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeBookmark(bookmark.id);
                        }
                      : undefined
                  }
                  className="group-hover:opacity-100 opacity-0 w-5 h-5 absolute -right-2 -top-2"
                >
                  <XCircleIcon />
                </button>
              )}
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
