import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import Button from "../../components/Button";
import truncate from "@turf/truncate";
import { encode } from "@mapbox/polyline";
import { BBox } from "geojson";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DrawRectangle from "mapbox-gl-draw-rectangle-mode";

export default function BoundsInput({
  value,
  onChange,
  map,
  onBeforeInput,
  onAfterInput,
  disabled,
}: {
  value?: BBox;
  onChange?: (value: BBox) => void;
  map?: Map;
  onBeforeInput?: () => void;
  onAfterInput?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("admin:surveys");

  const [digitizing, setDigitizing] = useState(false);
  const [showBounds, setShowBounds] = useState(false);

  useEffect(() => {
    if (map && value) {
      if (map.isStyleLoaded()) {
        if (showBounds) {
          const poly = bboxPolygon(value);
          map.addSource("bounds-input", {
            type: "geojson",
            data: poly,
          });
          map.addLayer({
            id: "bounds-input-fill",
            type: "fill",
            source: "bounds-input", // reference the data source
            layout: {},
            paint: {
              "fill-color": "#ffa424", // blue color fill
              "fill-opacity": 0.2,
            },
          });

          map.addLayer({
            id: "bounds-input-line",
            type: "line",
            source: "bounds-input",
            layout: {},
            paint: {
              "line-color": "#ffa424",
              "line-width": 2,
            },
          });

          return () => {
            map.removeLayer("bounds-input-fill");
            map.removeLayer("bounds-input-line");
            map.removeSource("bounds-input");
          };
        }
      }
    }
  }, [showBounds, map, value]);

  useEffect(() => {
    if (map && digitizing) {
      const draw = new MapboxDraw({
        userProperties: true,
        displayControlsDefault: false,
        modes: {
          ...MapboxDraw.modes,
          draw_rectangle: DrawRectangle,
        },
      });
      map.addControl(draw);
      draw.changeMode("draw_rectangle");
      const onCreate = (e: any) => {
        const box = bbox(e.features[0]);
        setTimeout(() => {
          // @ts-ignore
          map.fitBounds(box, { animate: true });
        }, 100);
        if (onChange) {
          onChange(box);
        }
        setDigitizing(false);
      };
      map.on("draw.create", onCreate);
      return () => {
        map.off("draw.create", onCreate);
        map.removeControl(draw);
        if (onAfterInput) {
          onAfterInput();
        }
      };
    }
  }, [map, digitizing]);

  let encodedPolyline: string | null = null;
  if (value) {
    const poly = bboxPolygon(value);
    encodedPolyline = encode(
      // @ts-ignore
      truncate(poly, {
        precision: 3,
      }).geometry.coordinates[0].map((position) => position.reverse())
    );
  }

  return (
    <div>
      <h4 className="block text-sm font-medium leading-5 text-gray-800">
        {t("Starting Bounds")}
      </h4>
      <p className="text-sm text-gray-500 mb-2 mt-1">
        <Trans ns="admin:surveys">
          The map will be adjusted to start showing the entire region of
          interest
        </Trans>
      </p>
      <div className="relative">
        {!digitizing && (
          <button
            onMouseEnter={() => setShowBounds(true)}
            onMouseOut={() => setShowBounds(false)}
            onClick={() => {
              if (onBeforeInput) {
                onBeforeInput();
              }
              setDigitizing(true);
              setShowBounds(false);
            }}
            className="absolute top-9 bg-opacity-60 bg-yellow-100 rounded px-2 py-1 shadow left-1/2 -ml-6"
          >
            {t("Edit")}
          </button>
        )}
        {digitizing && (
          <span className="absolute w-full p-4 text-white z-10">
            <Trans ns="admin:surveys">
              Use the map on the left to draw a new extent, or{" "}
              <button
                onClick={() => setDigitizing(false)}
                className="underline"
              >
                cancel
              </button>
            </Trans>
          </span>
        )}
        {encodedPolyline ? (
          <img
            alt="Region of interest"
            className={
              digitizing
                ? "filter saturate-0 brightness-50 contrast-50 rounded"
                : "rounded"
            }
            src={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path+ffa424+ffdd00-0.1(${encodeURIComponent(
              encodedPolyline
            )})/auto/230x100@2x?before_layer=admin-0-boundary&padding=18&access_token=${
              process.env.REACT_APP_MAPBOX_ACCESS_TOKEN
            }`}
          />
        ) : (
          ""
        )}
      </div>
      {/* {digitizing && (
        <Button
          onClick={() => {
            if (onAfterInput) {
              onAfterInput();
            }
            setDigitizing(false);
          }}
          small
          label={t("Cancel")}
        />
      )} */}
    </div>
  );
}
