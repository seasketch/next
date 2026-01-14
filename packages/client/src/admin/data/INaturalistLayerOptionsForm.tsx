/* eslint-disable i18next/no-literal-string */
import { Trans, useTranslation } from "react-i18next";
import Switch from "../../components/Switch";
import { useMemo } from "react";
import {
  DEFAULT_ZOOM_CUTOFF,
  MAX_ZOOM_CUTOFF,
  MIN_ZOOM_CUTOFF,
  InaturalistQueryParams,
} from "../../dataLayers/inaturalist";
import { XIcon } from "@heroicons/react/outline";

export type InaturalistOptionsFormValue = Pick<
  InaturalistQueryParams,
  "d1" | "d2" | "type" | "zoomCutoff" | "verifiable" | "showCallToAction"
> & {
  hasProject?: boolean;
  nelat?: number | null;
  nelng?: number | null;
  swlat?: number | null;
  swlng?: number | null;
};

export default function INaturalistLayerOptionsForm({
  value,
  onChange,
  disabled,
  onStartDrawingBbox,
  onCancelDrawingBbox,
  isDrawingBbox,
}: {
  value: InaturalistOptionsFormValue;
  onChange: (partial: Partial<InaturalistOptionsFormValue>) => void;
  disabled?: boolean;
  onStartDrawingBbox?: () => void;
  onCancelDrawingBbox?: () => void;
  isDrawingBbox?: boolean;
}) {
  const { t } = useTranslation("admin:data");

  const showZoom =
    value.type === "grid+points" || value.type === "heatmap+points";

  const zoomGradient = useMemo(() => {
    const pct =
      ((value.zoomCutoff - MIN_ZOOM_CUTOFF) /
        (MAX_ZOOM_CUTOFF - MIN_ZOOM_CUTOFF)) *
      100;
    return `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;
  }, [value.zoomCutoff]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
          <Trans ns="admin:data">Date Range (optional)</Trans>
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={value.d1 || ""}
            onChange={(e) =>
              onChange({
                d1: e.target.value || null,
                zoomCutoff:
                  value.zoomCutoff === undefined
                    ? DEFAULT_ZOOM_CUTOFF
                    : value.zoomCutoff,
              })
            }
            disabled={disabled}
            className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-gray-500">
            <Trans ns="admin:data">to</Trans>
          </span>
          <input
            type="date"
            value={value.d2 || ""}
            onChange={(e) =>
              onChange({
                d2: e.target.value || null,
                zoomCutoff:
                  value.zoomCutoff === undefined
                    ? DEFAULT_ZOOM_CUTOFF
                    : value.zoomCutoff,
              })
            }
            min={value.d1 || undefined}
            disabled={disabled}
            className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {onStartDrawingBbox && (
        <BoundingBoxFilter
          value={{
            nelat:
              typeof value.nelat === "number" || value.nelat === null
                ? value.nelat
                : null,
            nelng:
              typeof value.nelng === "number" || value.nelng === null
                ? value.nelng
                : null,
            swlat:
              typeof value.swlat === "number" || value.swlat === null
                ? value.swlat
                : null,
            swlng:
              typeof value.swlng === "number" || value.swlng === null
                ? value.swlng
                : null,
          }}
          isDrawing={isDrawingBbox || false}
          onStartDrawing={onStartDrawingBbox}
          onCancelDrawing={onCancelDrawingBbox || (() => {})}
          onClear={() =>
            onChange({
              nelat: null,
              nelng: null,
              swlat: null,
              swlng: null,
            } as Partial<InaturalistOptionsFormValue>)
          }
        />
      )}

      <div>
        <label className="block text-sm font-medium leading-5 text-gray-800 mb-2">
          <Trans ns="admin:data">Layer Presentation</Trans>
        </label>
        <select
          value={value.type}
          onChange={(e) =>
            onChange({
              type: e.target.value as InaturalistQueryParams["type"],
            })
          }
          disabled={disabled}
          className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="grid+points">{t("Grid + Points")}</option>
          <option value="heatmap+points">{t("Heatmap + Points")}</option>
          <option value="points">{t("Points")}</option>
          <option value="grid">{t("Grid")}</option>
          <option value="heatmap">{t("Heatmap")}</option>
        </select>
        {showZoom && (
          <div className="mt-3">
            <label className="block text-sm font-medium leading-5 text-gray-800 mb-2">
              <Trans ns="admin:data">Point Layer Reveal Zoom Level</Trans>
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min={MIN_ZOOM_CUTOFF}
                max={MAX_ZOOM_CUTOFF}
                step="1"
                value={value.zoomCutoff}
                onChange={(e) => {
                  const zoomCutoff = parseInt(e.target.value, 10);
                  onChange({ zoomCutoff });
                }}
                disabled={disabled}
                className="zoom-cutoff-slider flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: zoomGradient }}
              />
              <span className="text-sm font-medium text-gray-700 w-8 text-center">
                {value.zoomCutoff}
              </span>
            </div>
            <style>
              {`.zoom-cutoff-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
              .zoom-cutoff-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
              .zoom-cutoff-slider:focus {
                outline: none;
              }
              .zoom-cutoff-slider:focus::-webkit-slider-thumb {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
              }
              .zoom-cutoff-slider:focus::-moz-range-thumb {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
              }`}
            </style>
            <p className="text-xs text-gray-500 mt-1">
              {value.type === "grid+points" ? (
                <Trans
                  ns="admin:data"
                  i18nKey="Grid tiles will be shown at zoom levels 0-{{cutoff}}, and point tiles at zoom levels {{cutoffPlus}} and above."
                  values={{
                    cutoff: value.zoomCutoff - 1,
                    cutoffPlus: value.zoomCutoff,
                  }}
                />
              ) : (
                <Trans
                  ns="admin:data"
                  i18nKey="Heatmap tiles will be shown at zoom levels 0-{{cutoff}}, and point tiles at zoom levels {{cutoffPlus}} and above."
                  values={{
                    cutoff: value.zoomCutoff - 1,
                    cutoffPlus: value.zoomCutoff,
                  }}
                />
              )}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium leading-5 text-gray-800">
            <Trans ns="admin:data">Show only verifiable observations</Trans>
          </label>
          <Switch
            isToggled={value.verifiable}
            onClick={(val) => onChange({ verifiable: val })}
            disabled={disabled}
          />
        </div>

        <div
          className={`transition-opacity ${
            !value.hasProject ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium leading-5 text-gray-800">
              <Trans ns="admin:data">Show Call to Action</Trans>
            </label>
            <Switch
              isToggled={Boolean(value.showCallToAction && value.hasProject)}
              disabled={!value.hasProject}
              onClick={(val) => {
                if (!value.hasProject) {
                  return;
                }
                onChange({ showCallToAction: val });
              }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {value.hasProject ? (
              <Trans ns="admin:data">
                If enabled, users will be encouraged to contribute observations
                to the associated iNaturalist project.
              </Trans>
            ) : (
              <Trans ns="admin:data">
                Select a project above to enable this option. If enabled, users
                will be encouraged to contribute observations to the associated
                iNaturalist project.
              </Trans>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function BoundingBoxFilter({
  value,
  isDrawing,
  onStartDrawing,
  onCancelDrawing,
  onClear,
}: {
  value: {
    nelat?: number | null;
    nelng?: number | null;
    swlat?: number | null;
    swlng?: number | null;
  };
  isDrawing: boolean;
  onStartDrawing: () => void;
  onCancelDrawing: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const hasBbox =
    value.nelat !== null &&
    value.nelat !== undefined &&
    value.nelng !== null &&
    value.nelng !== undefined &&
    value.swlat !== null &&
    value.swlat !== undefined &&
    value.swlng !== null &&
    value.swlng !== undefined;

  const formatCoordinate = (coord: number | null | undefined): string => {
    if (coord === null || coord === undefined) return "";
    return coord.toFixed(6);
  };

  const truncateCoords = (): string => {
    if (!hasBbox) return "";
    return `${formatCoordinate(value.swlat)}, ${formatCoordinate(
      value.swlng
    )}, ${formatCoordinate(value.nelat)}, ${formatCoordinate(value.nelng)}`;
  };

  if (isDrawing) {
    return (
      <div className="border border-blue-500 rounded-md p-4 bg-blue-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-900">
            <Trans ns="admin:data">Drawing bounding box</Trans>
          </span>
          <button
            type="button"
            onClick={onCancelDrawing}
            className="px-3 py-1 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {t("Cancel")}
          </button>
        </div>
        <p className="text-sm text-blue-700">
          <Trans ns="admin:data">
            Draw a rectangle on the map to set the bounding box filter. Click
            cancel to abort.
          </Trans>
        </p>
      </div>
    );
  }

  if (hasBbox) {
    return (
      <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
              <Trans ns="admin:data">Bounding Box Filter</Trans>
            </label>
            <div className="text-xs text-gray-600 font-mono truncate">
              {truncateCoords()}
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <button
              type="button"
              onClick={onStartDrawing}
              className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t("Modify")}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label={t("Clear bounding box")}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
        <Trans ns="admin:data">Bounding Box Filter (optional)</Trans>
      </label>
      <button
        type="button"
        onClick={onStartDrawing}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Trans ns="admin:data">Limit to bounding box</Trans>
      </button>
    </div>
  );
}
