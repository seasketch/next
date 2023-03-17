/* eslint-disable i18next/no-literal-string */
import { XIcon } from "@heroicons/react/outline";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Trans } from "react-i18next";
import { useGetBookmarkQuery } from "../generated/graphql";

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
  const { data } = useGetBookmarkQuery({
    variables: {
      id: bookmarkId,
    },
  });

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
  }, []);

  const bookmark = data?.bookmarkById;

  return createPortal(
    <div
      id="overlay-body"
      className="w-full h-full bg-black bg-opacity-80 absolute left-0 top-0 z-50 flex"
      onClick={(e) => {
        if (e.target instanceof HTMLElement) {
          if (
            e.target.tagName === "DIV" &&
            !e.target.classList.contains("screenshot")
          ) {
            e.preventDefault();
            e.stopPropagation();
            onRequestClose();
          }
        }
      }}
    >
      <div className="flex-2 flex items-center p-4">
        {bookmark && (
          <div
            className="w-full h-full screenshot"
            style={{
              backgroundImage: `url(${process.env.REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT}${data?.bookmarkById?.imageId}/public)`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              // backgroundColor: "black",
            }}
          />
        )}
      </div>
      <div className="flex-1 p-4 text-white font-bold h-full bg-gray-700 bg-opacity-50">
        <div className="mx-auto  p-4 overflow-y-auto max-h-full">
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
                <div className=" px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">Dimensions</dt>
                  <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                    {bookmark?.mapDimensions[0]} x {bookmark?.mapDimensions[1]}
                  </dd>
                </div>
                <div className=" px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">Zoom Level</dt>
                  <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                    {Math.round(bookmark?.cameraOptions.zoom * 10) / 10}
                  </dd>
                </div>{" "}
                <div className=" px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">Center</dt>
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
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">Downloads</dt>
                  <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                    <ul
                      role="list"
                      className="divide-y divide-gray-600 rounded-md border border-gray-600"
                    >
                      <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                        <div className="flex w-0 flex-1 items-center">
                          <span className="ml-2 w-0 flex-1 truncate">
                            fullsize.png
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
                            Download
                          </button>
                        </div>
                      </li>
                      <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                        <div className="flex w-0 flex-1 items-center">
                          <span className="ml-2 w-0 flex-1 truncate">
                            thumbnail.png
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
                            Download
                          </button>
                        </div>
                      </li>
                    </ul>
                  </dd>
                </div>
                <div className=" px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">Basemap</dt>
                  <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                    {bookmark.basemapName ||
                      "Basemap:" + bookmark.selectedBasemap}
                  </dd>
                </div>
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-white">
                    Visible Layers
                  </dt>
                  <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">
                    <ul
                      role="list"
                      className="divide-y divide-gray-600 rounded-md border border-gray-600"
                    >
                      {bookmark.visibleDataLayers.map((lyr) => {
                        const name =
                          lyr && bookmark.layerNames && bookmark.layerNames[lyr]
                            ? bookmark.layerNames[lyr]
                            : lyr;
                        return (
                          <li className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                            <div className="flex w-0 flex-1 items-center">
                              <span className="ml-2 w-0 flex-1 truncate">
                                {name}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
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
