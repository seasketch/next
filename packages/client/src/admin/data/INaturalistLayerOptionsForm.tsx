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

export type InaturalistOptionsFormValue = Pick<
  InaturalistQueryParams,
  "d1" | "d2" | "type" | "zoomCutoff" | "verifiable" | "showCallToAction"
> & {
  hasProject?: boolean;
};

export function INaturalistLayerOptionsForm({
  value,
  onChange,
}: {
  value: InaturalistOptionsFormValue;
  onChange: (partial: Partial<InaturalistOptionsFormValue>) => void;
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
            className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
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
            className="flex-1 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
          />
        </div>
      </div>

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
          className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
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
                className="zoom-cutoff-slider flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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

export default INaturalistLayerOptionsForm;
