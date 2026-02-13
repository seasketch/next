import { CameraOptions, Layer } from "mapbox-gl";
import { useMemo, useState, useContext } from "react";
import { useTranslation, Trans } from "react-i18next";
import Spinner from "../components/Spinner";
import {
  BasemapType,
  useGetBasemapQuery,
  BasemapDetailsFragment,
} from "../generated/graphql";

import { useMapboxStyle } from "../useMapboxStyle";
import { useMediaQuery } from "beautiful-react-hooks";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/outline";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import { MapManagerContext } from "../dataLayers/MapContextManager";
import BasemapContextProvider from "../dataLayers/BasemapContext";
import MapManagerContextProvider from "../dataLayers/MapManagerContextProvider";
import MapUIProvider from "../dataLayers/MapUIContext";
import BasemapOfflineSettings from "./BasemapOfflineSettings";
import BasemapEditorPanelMap from "../admin/data/BasemapEditorMap";
import CreateOptionalLayerModal from "../admin/data/CreateOptionalLayerModal";
import getSlug from "../getSlug";

export default function AdminOfflineTileSettingsMap({
  basemapId,
  onRequestClose,
  className,
  hideTerrain,
  showMap,
  cameraOptions,
  returnToUrl,
}: {
  basemapId: number;
  onRequestClose?: () => void;
  className?: string;
  hideTerrain?: boolean;
  showMap?: boolean;
  cameraOptions?: CameraOptions;
  returnToUrl?: string;
}) {
  const [createOptionOpen, setCreateOptionOpen] = useState(false);
  const { t } = useTranslation("admin");
  const { data } = useGetBasemapQuery({
    variables: {
      id: basemapId,
    },
  });
  const basemap = data?.basemap;
  const isPhone = useMediaQuery("(max-width: 767px)");

  const basemapIds = useMemo(() => {
    return data?.basemap ? [data.basemap.id] : [];
  }, [data?.basemap]);

  const essentials = useMapEssentials({
    filterBasemapIds: basemapIds,
    cameraOptions,
  });

  const slug = getSlug();

  const mapboxStyle = useMapboxStyle(
    basemap && basemap.type === BasemapType.Mapbox ? basemap.url : undefined
  );
  let layerIds: Layer[] = [];
  if (mapboxStyle.data) {
    layerIds = [...(mapboxStyle.data.layers || [])];
    layerIds.reverse();
  }

  return (
    <div
      className={`bg-white z-20 absolute bottom-0 w-128 h-full grid gap-0 shadow-xl ${className} ${
        showMap ? "w-full" : ""
      }`}
      style={
        showMap
          ? isPhone
            ? {
                grid: `
          [row1-start] "header" auto [row1-end]
          [row2-start] "sidebar" 1fr [row2-end]
          / 1fr`,
              }
            : {
                grid: `
          [row1-start] "header header" auto [row1-end]
          [row2-start] "sidebar map" 1fr [row2-end]
          / 512px 1fr`,
              }
          : {
              grid: `
            [row1-start] "header" auto [row1-end]
            [row2-start] "sidebar" 1fr [row2-end]
            / 512px`,
            }
      }
    >
      <BasemapContextProvider
        basemaps={essentials.basemaps}
        preferencesKey={`${slug}-admin-offline-tile-settings`}
      >
        <MapManagerContextProvider
          bounds={essentials.bounds}
          camera={essentials.cameraOptions}
        >
          <MapUIProvider
            preferencesKey={`${slug}-admin-offline-tile-settings-ui`}
          >
            <div
              className="flex-0 p-4 border-b shadow-sm bg-primary-600 flex items-center"
              style={{ gridArea: "header" }}
            >
              <h4
                className={`${
                  showMap ? "text-2xl" : ""
                } text-white font-medium flex-1 flex items-center`}
              >
                {returnToUrl && (
                  <Link replace={true} to={returnToUrl}>
                    <ArrowLeftIcon className="w-8 h-8 mr-4" />
                  </Link>
                )}
                <Trans ns={["admin"]}>Offline Tile Settings</Trans>
              </h4>

              {!returnToUrl && (
                <button
                  className="bg-gray-300 bg-opacity-25 hover:bg-gray-200 hover:bg-opacity-25  rounded-full p-1 cursor-pointer focus:ring-blue-300"
                  onClick={onRequestClose}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className={
                      showMap ? "w-8 h-8 text-white" : "w-5 h-5 text-white"
                    }
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {returnToUrl && (
                <Link
                  to={returnToUrl}
                  replace={true}
                  className="bg-gray-300 text-white px-4 py-2 bg-opacity-25 hover:bg-gray-200 hover:bg-opacity-25  rounded-full p-1 cursor-pointer focus:ring-blue-300"
                  onClick={onRequestClose}
                >
                  <Trans ns="admin">Done</Trans>
                </Link>
              )}
            </div>
            {!basemap || mapboxStyle.loading ? (
              <div
                className="w-full mt-20 flex items-center justify-center text-gray-600"
                style={{ gridArea: "sidebar" }}
              >
                <span className="mx-1">{t("Loading style")}</span>
                <Spinner className="ml-0.5" />
              </div>
            ) : (
              <div
                className="w-full h-full overflow-y-auto px-4 pb-4 max-w-xl"
                style={{ gridArea: "sidebar" }}
              >
                {!createOptionOpen && (
                  <div className="my-5">
                    <h5 className="block text-sm font-medium leading-5 text-gray-700">
                      <BasemapOfflineSettings basemapId={basemap.id} />
                    </h5>
                  </div>
                )}
              </div>
            )}
            {showMap && basemap && (
              <div className="flex-1 bg-gray-50" style={{ gridArea: "map" }}>
                <BasemapEditorPanelMap
                  basemap={basemap as BasemapDetailsFragment}
                  cameraOptions={cameraOptions}
                />
              </div>
            )}
            {createOptionOpen && (
              <CreateOptionalLayerModal
                onRequestClose={() => setCreateOptionOpen(false)}
                basemapId={basemapId}
              />
            )}
          </MapUIProvider>
        </MapManagerContextProvider>
      </BasemapContextProvider>
    </div>
  );
}
