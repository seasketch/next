import { motion } from "framer-motion";
import Spinner from "../../components/Spinner";
import { TrashIcon } from "@heroicons/react/solid";
import {
  JobFragment,
  MapBookmarkDetailsFragment,
  useGetBookmarkQuery,
  useMapBookmarkSubscription,
  WorkerJobStatus,
} from "../../generated/graphql";
import { useState, useCallback } from "react";
import { Blurhash } from "react-blurhash";
import { Trans } from "react-i18next";
import WorkerJobDetails from "../../components/WorkerJobDetails";
import { InformationCircleIcon } from "@heroicons/react/outline";
import MapBookmarkDetailsOverlay from "../../components/MapBookmarkDetailsOverlay";

export default function BookmarkItem({
  bookmark,
  removeBookmark,
  onHover,
  hasErrors,
  highlighted,
  onClick,
}: {
  removeBookmark?: (id: string) => void;
  bookmark: MapBookmarkDetailsFragment;
  onHover?: (id?: string) => void;
  hasErrors: Boolean;
  highlighted?: Boolean;
  onClick: (bookmark: MapBookmarkDetailsFragment) => void;
}) {
  const { data } = useGetBookmarkQuery({
    variables: {
      id: bookmark.id,
    },
    fetchPolicy:
      bookmark.screenshotJobStatus === WorkerJobStatus.Finished
        ? "cache-first"
        : "cache-and-network",
    skip:
      bookmark.screenshotJobStatus === WorkerJobStatus.Finished ||
      bookmark.screenshotJobStatus === WorkerJobStatus.Failed,
  });
  const [showBookmarkOverlayId, setShowBookmarkOverlayId] = useState<
    string | null
  >(null);

  useMapBookmarkSubscription({
    variables: {
      id: bookmark.id,
    },
    shouldResubscribe: true,
    skip:
      bookmark.screenshotJobStatus === WorkerJobStatus.Finished ||
      bookmark.screenshotJobStatus === WorkerJobStatus.Failed,
  });

  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageShown, setImageShown] = useState(false);

  const job = data?.bookmarkById?.job || bookmark.job;

  const status =
    data?.bookmarkById?.screenshotJobStatus || bookmark.screenshotJobStatus;
  const onBookmarkClick = useCallback(
    (e) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") {
        return;
      }
      onClick(bookmark);
    },
    [onClick, bookmark]
  );

  const editable = Boolean(removeBookmark);
  return (
    <motion.button
      onMouseOver={onHover ? () => onHover(bookmark.id) : undefined}
      onMouseOut={onHover ? () => onHover() : undefined}
      key={bookmark.id}
      onClick={onBookmarkClick}
      initial={{ opacity: 0.2, scale: 0.25 }}
      animate={{ opacity: 1, scale: 1 }}
      title={
        hasErrors
          ? "Bookmark refers to sketches that are no longer posted"
          : undefined
      }
      exit={{ opacity: 0, scale: 0.25 }}
      className={`group overflow-hidden box-content transform float-left ml-3.5 mt-2.5 rounded w-24 2xl:w-27 h-14 2xl:h-16 2xl:ml-2 2xl:mt-2 shadow-sm relative ${
        !bookmark.imageId && !bookmark.blurhash ? "bg-gray-50" : ""
      } ${
        hasErrors
          ? "border-red-500 border"
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
          className="group-hover:opacity-100 opacity-0 w-5 text-red-500 h-5 absolute right-2 top-2 z-10"
        >
          <TrashIcon />
        </button>
      )}
      {!editable && status === WorkerJobStatus.Failed && (
        <div className="text-xs text-gray-600 flex-col flex">
          <span className="font-bold">
            <Trans>Map Bookmark</Trans>
          </span>
          <span style={{ fontSize: 10 }}>
            <Trans>preview unavailable</Trans>
          </span>
        </div>
      )}
      {!bookmark.imageId && (status !== WorkerJobStatus.Failed || editable) && (
        <div className="flex flex-col items-center justify-center w-full h-full">
          {status !== WorkerJobStatus.Failed && <Spinner />}
          <span className="text-xs mt-1 text-gray-400">
            {job?.lastError ? (
              status === WorkerJobStatus.Failed ? (
                <Trans>screenshot failed</Trans>
              ) : (
                <Trans>screenshot error</Trans>
              )
            ) : (
              <Trans>creating preview</Trans>
            )}
          </span>
          {job?.lastError && (
            <button
              className="underline text-xs text-gray-400"
              onClick={(e) => {
                setJobDetailsOpen(true);
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {job?.attempts &&
              job?.maxAttempts &&
              status !== WorkerJobStatus.Failed ? (
                <Trans>
                  attempt {{ attempt: job.attempts }}/{{ of: job.maxAttempts }}
                </Trans>
              ) : (
                <Trans>show details</Trans>
              )}
            </button>
          )}
        </div>
      )}
      {(bookmark.blurhash || data?.bookmarkById?.blurhash) &&
        !imageShown &&
        !data?.bookmarkById?.job?.lastError && (
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
          src={`${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${
            bookmark.imageId || data?.bookmarkById?.imageId
          }/thumbnail`}
          onAnimationComplete={() => {
            if (imageLoaded) {
              setImageShown(true);
            }
          }}
        />
      )}
      {jobDetailsOpen && (data?.bookmarkById?.job || bookmark.job) && (
        <WorkerJobDetails
          job={(data?.bookmarkById?.job || bookmark.job) as JobFragment}
          onRequestClose={() => setJobDetailsOpen(false)}
        />
      )}
      {bookmark.imageId && (
        <button
          className="absolute right-1 bottom-1 bg-white bg-opacity-20 rounded-full group hover:bg-blue-700"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowBookmarkOverlayId(bookmark.id);
          }}
        >
          <InformationCircleIcon className="w-4 h-4 text-white" />
        </button>
      )}
      {showBookmarkOverlayId && (
        <MapBookmarkDetailsOverlay
          bookmarkId={showBookmarkOverlayId}
          onRequestClose={() => setShowBookmarkOverlayId(null)}
        />
      )}
    </motion.button>
  );
}
