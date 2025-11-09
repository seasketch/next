import { Map } from "mapbox-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import getSlug from "../../getSlug";
import {
  useProjectRegionQuery,
  useGeographyClippingSettingsQuery,
} from "../../generated/graphql";
import bbox from "@turf/bbox";
import { XCircleIcon } from "@heroicons/react/solid";

export const STYLE = "mapbox://styles/seasketch/cl892c7ia001e14qpbr4gnf4k";
const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";

export type BasemapType = "mapbox" | "google-earth";

export interface AddRemoteServiceMapModalProps {
  onMapLoad: (map: Map) => void;
  onRequestClose: () => void;
  title: string;
  children: React.ReactNode;
  transformRequest?: mapboxgl.TransformRequestFunction;
  basemap?: BasemapType;
}

export default function AddRemoteServiceMapModal({
  onMapLoad,
  onRequestClose,
  title,
  children,
  transformRequest,
  basemap = "mapbox",
}: AddRemoteServiceMapModalProps) {
  const slug = getSlug();
  const projectMetadataQuery = useProjectRegionQuery({
    variables: {
      slug,
    },
  });
  const geographyData = useGeographyClippingSettingsQuery({
    variables: { slug },
    skip: !slug || basemap !== "google-earth",
  });
  const [mapDiv, setMapDiv] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    if (mapDiv) {
      if (map) {
        map.remove();
      }

      const bounds = projectMetadataQuery.data?.projectBySlug
        ? (bbox(projectMetadataQuery.data.projectBySlug.region.geojson) as [
            number,
            number,
            number,
            number
          ])
        : undefined;

      if (basemap === "google-earth") {
        const session = geographyData.data?.gmapssatellitesession?.session;
        if (session) {
          // Initialize with Google Earth tiles
          const m = new Map({
            container: mapDiv,
            style: {
              version: 8,
              sources: {
                satellite: {
                  type: "raster",
                  tiles: [
                    // eslint-disable-next-line i18next/no-literal-string
                    `${GOOGLE_MAPS_TILE_URL}?session=${session}&key=${process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY}`,
                  ],
                  // eslint-disable-next-line i18next/no-literal-string
                  format: "jpeg",
                  // eslint-disable-next-line i18next/no-literal-string
                  attribution: "Google",
                  tileSize: 512,
                },
              },
              layers: [
                {
                  id: "satellite-layer",
                  type: "raster",
                  source: "satellite",
                  minzoom: 0,
                  maxzoom: 22,
                },
              ],
            },
            ...(bounds
              ? {
                  bounds,
                  fitBoundsOptions: { padding: 80 },
                }
              : { center: [-119.7145, 34.4208], zoom: 3 }),
            transformRequest,
          });

          m.on("load", () => {
            m.resize();
            setMap(m);
            onMapLoad(m);
          });
        }
      } else {
        // Initialize with default Mapbox style
        const m = new Map({
          container: mapDiv,
          style: STYLE,
          bounds,
          transformRequest,
        });

        m.on("load", () => {
          m.resize();
          setMap(m);
          onMapLoad(m);
        });
      }
    }
  }, [mapDiv, basemap, geographyData.data?.gmapssatellitesession?.session]);
  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-30"
        onClick={onRequestClose}
      />
      <div className="z-30 pointer-events-none absolute bg-transparent left-0 top-0 w-screen h-screen flex items-center justify-center">
        <div className="bg-white w-3/4 h-3/4 pointer-events-auto shadow-lg rounded-lg flex flex-col items-center justify-center">
          <div className="flex flex-col w-full bg-gray-100 rounded-t-md p-4 font-semibold shadow z-10">
            <div className="flex items-center">
              <span className="flex-1">{title}</span>
              <button onClick={onRequestClose}>
                <XCircleIcon className="w-7 h-7 opacity-70 hover:opacity-90" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-green-200 w-full flex overflow-hidden relative">
            <div className="bg-white border-r w-96 flex flex-col">
              {children}
            </div>
            <div ref={setMapDiv} className={`bg-gray-50 flex-1`}></div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
