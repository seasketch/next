/* eslint-disable i18next/no-literal-string */
import { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import googleMapsLogo from "../assets/google-maps/GoogleMaps_Logo_WithLightOutline.svg";

export default function GoogleMapsAttribution({
  className,
  copyright,
}: {
  className?: string;
  copyright?: string;
}) {
  return (
    <div
      className={`absolute bottom-0 right-0 z-10 pointer-events-none flex flex-col items-end ${className}`}
      aria-label="Google Maps attribution"
    >
      <div className="mr-[10px] mb-1 rounded bg-black/50 px-1.5 py-1 text-[10px] leading-none text-white shadow-sm">
        {copyright || "Map data © Google Maps"}
      </div>
      <div className="px-[10px] pt-[10px] pb-[5px]">
        <img
          src={googleMapsLogo}
          alt="Google Maps"
          className="h-[18px] w-auto"
        />
      </div>
    </div>
  );
}

export function useGoogleMapsViewportCopyright(
  map: mapboxgl.Map | null,
  session?: string | null
) {
  const [copyright, setCopyright] = useState("Map data © Google Maps");

  useEffect(() => {
    if (!map || !session) {
      return;
    }

    let cancelled = false;
    let timeout: number | undefined;

    const updateCopyright = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        try {
          const bounds = map.getBounds();
          const north = clampLatitude(bounds.getNorth());
          const south = clampLatitude(bounds.getSouth());
          const east = clampLongitude(bounds.getEast());
          const west = clampLongitude(bounds.getWest());
          const zoom = Math.max(0, Math.min(22, Math.round(map.getZoom())));
          const params = new URLSearchParams({
            session,
            key: process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY,
            zoom: zoom.toString(),
            north: north.toString(),
            south: south.toString(),
            east: east.toString(),
            west: west.toString(),
          });
          const response = await fetch(
            `https://tile.googleapis.com/tile/v1/viewport?${params.toString()}`
          );
          if (!response.ok) {
            throw new Error(response.statusText);
          }
          const json = await response.json();
          if (!cancelled && json?.copyright) {
            setCopyright(json.copyright);
          }
        } catch (e) {
          if (!cancelled) {
            setCopyright("Map data © Google Maps");
          }
        }
      }, 200);
    };

    updateCopyright();
    map.on("moveend", updateCopyright);
    map.on("zoomend", updateCopyright);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map.off("moveend", updateCopyright);
      map.off("zoomend", updateCopyright);
    };
  }, [map, session]);

  return copyright;
}

function clampLatitude(latitude: number) {
  return Math.max(-89.999999, Math.min(89.999999, latitude));
}

function clampLongitude(longitude: number) {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  if (normalized <= -180) {
    return -179.999999;
  }
  if (normalized >= 180) {
    return 179.999999;
  }
  return normalized;
}
