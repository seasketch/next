import { XIcon } from "@heroicons/react/outline";
import { useEffect, useState, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useGetBookmarkQuery } from "../generated/graphql";
import { Blurhash } from "react-blurhash";
import Spinner from "./Spinner";
import { motion } from "framer-motion";
import { useGlobalErrorHandler } from "./GlobalErrorHandler";
import { useTranslation, Trans } from "react-i18next";
import { MapContext } from "../dataLayers/MapContextManager";
import { ExclamationCircleIcon, XCircleIcon } from "@heroicons/react/solid";
import Warning from "./Warning";

const coordinateFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6,
});

export default function MapBookmarkDetailsOverlay({
  bookmarkId,
  onRequestClose,
}: {
  bookmarkId: string;
  onRequestClose: () => void;
}) {
  const onError = useGlobalErrorHandler();
  const { data, loading } = useGetBookmarkQuery({
    variables: {
      id: bookmarkId,
    },
    onError,
  });

  // Image loading state
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageShown, setImageShown] = useState(false);

  const { t } = useTranslation("mapBookmarks");

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRequestClose();
      }
    };
    document.body.addEventListener("keydown", handler);
    return () => {
      document.body.removeEventListener("keydown", handler);
    };
  }, [onRequestClose]);

  const mapContext = useContext(MapContext);
  const bookmark = data?.bookmarkById;

  const imageRatio = useMemo(() => {
    if (data?.bookmarkById?.mapDimensions) {
      const [width, height] = data?.bookmarkById?.mapDimensions;
      if (width && height) {
        const wider = width > height;
        if (wider) {
          return {
            width: "100%",
            height: (height / width) * 100 + "%",
          };
        } else {
          return {
            height: "100%",
            width: (width / height) * 100 + "%",
          };
        }
      } else {
        return undefined;
      }
    } else {
      return null;
    }
  }, [data?.bookmarkById?.mapDimensions]);

  const errors = useMemo(() => {
    if (data?.bookmarkById && mapContext.manager) {
      return mapContext.manager.getErrorsForBookmark(data.bookmarkById);
    } else {
      return null;
    }
  }, [data?.bookmarkById, mapContext.manager]);

  const hasErrors = useMemo(() => {
    return (
      errors?.missingBasemap ||
      Boolean(errors?.missingLayers?.length) ||
      Boolean(errors?.missingSketches?.length)
    );
  }, [errors]);

  return createPortal(
    <div
      id="overlay-body"
      className="w-full h-full bg-black bg-opacity-80 absolute left-0 top-0 z-50 flex"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target instanceof HTMLElement) {
          if (
            e.target.tagName === "DIV" &&
            !e.target.classList.contains("screenshot")
          ) {
            onRequestClose();
          }
        }
      }}
    >
      {loading && (
        <div className="absolute top-1/2 left-1/2 -ml-5 -mt-5">
          <Spinner large />
        </div>
      )}
      {data?.bookmarkById && (
        <>
          <div className="flex-2 flex items-center p-4 relative">
            {data?.bookmarkById?.blurhash && !imageShown && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <Blurhash
                  hash={data.bookmarkById.blurhash}
                  width={imageRatio ? imageRatio.width : "100%"}
                  height={imageRatio ? imageRatio.height : "100%"}
                />
                <div className="mx-auto z-10 absolute top-1/2 -mt-5 flex flex-col text-center items-center justify-center">
                  <Spinner large />
                  <span className="text-gray-500 mt-1">
                    <Trans ns="mapBookmarks">Loading screenshot...</Trans>
                  </span>
                </div>
              </div>
            )}
            {bookmark && (
              <motion.img
                variants={{
                  hidden: { opacity: 0.01 },
                  visible: { opacity: 1 },
                }}
                animate={imageLoaded ? "visible" : "hidden"}
                transition={{ duration: 0.15 }}
                onLoad={() => setImageLoaded(true)}
                alt="Bookmark preview thumbnail"
                className="absolute top-0 left-0 w-full h-full"
                style={{ objectFit: "contain" }}
                onAnimationComplete={() => {
                  if (imageLoaded) {
                    setImageShown(true);
                  }
                }}
                src={`${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${
                  bookmark.imageId || data?.bookmarkById?.imageId
                }/public`}
              />
            )}
          </div>
          <div className="flex-1 p-0 lg:p-4 text-white font-bold h-full bg-gray-700 bg-opacity-50 max-w-lg lg:max-w-xl">
            <div className="mx-auto  p-0 lg:p-4 overflow-y-auto max-h-full">
              <div className="flex items-center mb-2">
                <h1 className="flex-1">
                  <Trans ns="mapBookmarks">Map Bookmark Details</Trans>
                </h1>
                <button
                  className="rounded-full bg-white bg-opacity-20 p-2 -mt-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRequestClose();
                  }}
                >
                  <XIcon className="w-6 h-6 text-white" />
                </button>
              </div>
              {bookmark && (
                <div className="">
                  <dl>
                    <div className="py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                      <dt className="text-sm font-medium text-white">
                        {t("Created")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        {new Date(bookmark.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    <div className="py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                      <dt className="text-sm font-medium text-white">
                        {t("Dimensions")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        {bookmark?.mapDimensions[0]}
                        {
                          // eslint-disable-next-line i18next/no-literal-string
                          " x "
                        }
                        {bookmark?.mapDimensions[1]}
                      </dd>
                    </div>
                    <div className="  py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                      <dt className="text-sm font-medium text-white">
                        {t("Zoom Level")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        {Math.round(bookmark?.cameraOptions.zoom * 10) / 10}
                      </dd>
                    </div>{" "}
                    <div className="  py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                      <dt className="text-sm font-medium text-white">
                        {t("Center")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        {coordinateFormatter.format(
                          bookmark?.cameraOptions.center[0]
                        )}
                        ,{" "}
                        {coordinateFormatter.format(
                          bookmark?.cameraOptions.center[1]
                        )}
                      </dd>
                    </div>
                    <div className=" py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                      <dt className="text-sm font-medium text-white">
                        {t("Downloads")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        <ul className="divide-y divide-gray-600 rounded-md border border-gray-600">
                          <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                            <div className="flex w-0 flex-1 items-center">
                              <span className="ml-2 w-0 flex-1 truncate">
                                {
                                  // eslint-disable-next-line i18next/no-literal-string
                                  "fullsize.png"
                                }
                              </span>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <button
                                onClick={() => {
                                  downloadImage(
                                    `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${data?.bookmarkById?.imageId}/public`,
                                    "fullsize.png"
                                  );
                                }}
                                className="font-medium text-indigo-300 hover:text-indigo-400"
                              >
                                {t("Download")}
                              </button>
                            </div>
                          </li>
                          <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                            <div className="flex w-0 flex-1 items-center">
                              <span className="ml-2 w-0 flex-1 truncate">
                                {
                                  // eslint-disable-next-line i18next/no-literal-string
                                  "thumbnail.png"
                                }
                              </span>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <button
                                onClick={() => {
                                  downloadImage(
                                    `${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${data?.bookmarkById?.imageId}/thumbnail`,
                                    "thumbnail.png"
                                  );
                                }}
                                className="font-medium text-indigo-300 hover:text-indigo-400"
                              >
                                {t("Download")}
                              </button>
                            </div>
                          </li>
                        </ul>
                      </dd>
                    </div>
                    {hasErrors && (
                      <Warning level="error">
                        <Trans ns="mapBookmarks">
                          Some map data referenced in this bookmark is no longer
                          available.
                        </Trans>{" "}
                        {bookmark.imageId && (
                          <Trans ns="mapBookmarks">
                            The screenshot shown represents how the map appeared
                            when the bookmark was created.
                          </Trans>
                        )}
                      </Warning>
                    )}
                    <div className="  py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                      <dt className="text-sm font-medium text-white">
                        {t("Basemap")}
                      </dt>
                      <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                        {bookmark.basemapName ||
                          "Basemap:" + bookmark.selectedBasemap}
                      </dd>
                    </div>
                    {Boolean(bookmark.visibleDataLayers.length) && (
                      <div className=" py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                        <dt className="text-sm font-medium text-white">
                          {t("Visible Layers")}
                        </dt>
                        <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                          <ul className="divide-y divide-gray-600 rounded-md border border-gray-600">
                            {bookmark.visibleDataLayers.map((lyr) => {
                              const name =
                                lyr &&
                                bookmark.layerNames &&
                                bookmark.layerNames[lyr]
                                  ? bookmark.layerNames[lyr]
                                  : lyr;
                              return (
                                <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                                  <div className="flex w-0 flex-1 items-center">
                                    <span className="ml-2 w-0 flex-1 truncate">
                                      {name}
                                    </span>
                                    {lyr &&
                                      errors &&
                                      errors.missingLayers.indexOf(lyr) !==
                                        -1 && (
                                        <div className="flex-none text-red-500 font-thin">
                                          <XCircleIcon className="w-5 h-5  inline mr-1" />
                                          {t("missing")}
                                        </div>
                                      )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {bookmark.visibleSketches &&
                      bookmark.visibleSketches.length > 0 && (
                        <div className=" py-5 sm:grid sm:grid-cols-3 sm:gap-4 ">
                          <dt className="text-sm font-medium text-white">
                            {t("Visible Sketches")}
                          </dt>
                          <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                            <ul className="divide-y divide-gray-600 rounded-md border border-gray-600">
                              {bookmark.visibleSketches.map((id) => {
                                const name =
                                  id &&
                                  bookmark.sketchNames &&
                                  bookmark.sketchNames[id]
                                    ? bookmark.sketchNames[id]
                                    : id;
                                return (
                                  <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                                    <div className="flex w-0 flex-1 items-center">
                                      <span className="ml-2 w-0 flex-1 truncate">
                                        {name}
                                      </span>
                                      {id &&
                                        errors &&
                                        errors.missingSketches.indexOf(id) !==
                                          -1 && (
                                          <div className="flex-none text-red-500 font-thin">
                                            <XCircleIcon className="w-5 h-5  inline mr-1" />
                                            {t("missing")}
                                          </div>
                                        )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </dd>
                        </div>
                      )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

function downloadImage(url: string, filename: string) {
  var link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
