import { MapBookmarkAttachment } from "./PostContentEditor";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "../../components/Spinner";
import { XCircleIcon } from "@heroicons/react/solid";
import { useContext, useMemo } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";
import { SketchUIStateContext } from "../Sketches/SketchUIStateContextProvider";
import {
  MapBookmarkDetailsFragment,
  useGetBookmarkLazyQuery,
  useGetBookmarkQuery,
} from "../../generated/graphql";
import { useEffect, useState } from "react";
import { decode } from "blurhash";
import { Blurhash } from "react-blurhash";

export default function BookmarkItem({
  bookmark,
  removeBookmark,
  onHover,
  hasErrors,
  highlighted,
}: {
  removeBookmark?: (id: string) => void;
  bookmark: MapBookmarkDetailsFragment;
  onHover?: (id?: string) => void;
  hasErrors: Boolean;
  highlighted?: Boolean;
}) {
  const mapContext = useContext(MapContext);
  const sketchUIContext = useContext(SketchUIStateContext);

  const { data, loading, error, refetch, stopPolling, startPolling } =
    useGetBookmarkQuery({
      variables: {
        id: bookmark.id,
      },
      skip: Boolean(bookmark.imageId),
      // pollInterval: 800,
    });

  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (bookmark.imageId || data?.bookmarkById?.imageId) {
      stopPolling();
    } else {
      startPolling(200);
    }
  }, [
    data?.bookmarkById?.imageId,
    bookmark.imageId,
    stopPolling,
    bookmark.id,
    startPolling,
    data,
  ]);

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
      className={`group box-content transform float-left ml-3.5 mt-2.5 rounded w-24 2xl:w-27 h-14 2xl:h-16 2xl:ml-2 2xl:mt-2 shadow-sm relative ${
        !bookmark.imageId && !bookmark.blurhash ? "bg-gray-50" : ""
      } ${
        hasErrors
          ? "border-red-200 border"
          : highlighted
          ? "border-blue-500 border"
          : "border "
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
          className="group-hover:opacity-100 opacity-0 w-5 h-5 absolute -right-2 -top-2 z-10"
        >
          <XCircleIcon />
        </button>
      )}
      {!data?.bookmarkById?.blurhash && (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <Spinner />
        </div>
      )}
      {(bookmark.blurhash || data?.bookmarkById?.blurhash) && (
        // <motion.div
        //   initial={{ opacity: 0 }}
        //   animate={{ opacity: 1 }}
        //   exit={{ opacity: 0 }}
        //   className="w-full h-full"
        // >
        <div className="absolute top-0 left-0 w-full h-full">
          <Blurhash
            hash={bookmark.blurhash || data?.bookmarkById?.blurhash!}
            width="100%"
            height="100%"
          />
          {((!bookmark.imageId && !data?.bookmarkById?.imageId) ||
            // Show loading spinner while loading image if this map bookmark was
            // just now created by the user
            (!imageLoaded && !bookmark.imageId)) && (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
        // </motion.div>
      )}
      {(bookmark.imageId || data?.bookmarkById?.imageId) && (
        <motion.img
          variants={{ hidden: { opacity: 0.01 }, visible: { opacity: 1 } }}
          animate={imageLoaded ? "visible" : "hidden"}
          transition={{ duration: 0.15 }}
          onLoad={() => setImageLoaded(true)}
          alt="Bookmark preview thumbnail"
          className="absolute top-0 left-0 w-full h-full"
          style={{ objectFit: "cover" }}
          src={`https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/${
            bookmark.imageId || data?.bookmarkById?.imageId
          }/thumbnail`}
        />
        // <motion.div
        //   initial={{ opacity: 0 }}
        //   animate={{ opacity: 1 }}
        //   exit={{ opacity: 0 }}
        //   className="absolute top-0 left-0 w-full h-full"
        //   style={
        //     bookmark.imageId || data?.bookmarkById?.imageId
        //       ? {
        //           backgroundImage: `url(https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/${
        //             bookmark.imageId || data?.bookmarkById?.imageId
        //           }/thumbnail)`,
        //           backgroundSize: "cover",
        //           filter: "contrast(110%)",
        //           backgroundPosition: "center",
        //         }
        //       : {}
        //   }
        // ></motion.div>
      )}
    </motion.button>
  );
}
