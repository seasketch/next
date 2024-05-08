import { Trans, useTranslation } from "react-i18next";
import {
  SettingsDLListItem,
  SettingsDefinitionList,
} from "../SettingsDefinitionList";
import Skeleton from "../../components/Skeleton";
import { useEffect, useMemo, useState } from "react";
import InputBlock from "../../components/InputBlock";

export default function ArcGISTiledRasterBaseSettings({
  url,
  onMaxZoomChange,
  maxZoomSetting,
  readonly,
  hideLocation,
  hideType,
}: {
  url: string;
  onMaxZoomChange: (maxzoom: number | null) => void;
  maxZoomSetting: number | null;
  readonly?: boolean;
  hideLocation?: boolean;
  hideType?: boolean;
}) {
  const [state, setState] = useState<
    | {
        minzoom: number;
        maxzoom: number;
        format: string;
      }
    | undefined
  >(undefined);

  const availableMaxZoomLevels = useMemo(() => {
    if (state) {
      return Array.from({ length: state.maxzoom - state.minzoom + 1 }).map(
        (_, i) => i + state.minzoom
      );
    } else {
      return [];
    }
  }, [state]);

  const { t } = useTranslation("admin:data");

  useEffect(() => {
    setState(undefined);
    if (url) {
      fetch(url + "?f=json")
        .then((r) => r.json())
        .then((data) => {
          setState({
            format: data.tileInfo.format,
            minzoom: data.tileInfo.lods[0].level,
            maxzoom: data.tileInfo.lods[data.tileInfo.lods.length - 1].level,
          });
        });
    }
  }, [url]);

  return (
    <SettingsDefinitionList>
      {!hideType && (
        <SettingsDLListItem
          term={t("Source Type")}
          description={t("Raster tiles hosted on ArcGIS Server")}
        />
      )}
      {!hideLocation && (
        <SettingsDLListItem
          truncate
          term={t("Source Server")}
          description={
            <a
              target="_blank"
              className="text-primary-600 underline"
              href={url!}
              rel="noreferrer"
            >
              {url!.replace("https://", "").replace("http://", "")}
            </a>
          }
        />
      )}
      <SettingsDLListItem
        term={t("Image Format")}
        description={
          state ? (
            state.format
          ) : (
            <div className="flex space-x-2 items-center">
              <Skeleton className="w-10 h-5" />
            </div>
          )
        }
      />
      <SettingsDLListItem
        term={t("Supported Zoom Levels")}
        description={
          state ? (
            <div>
              {state.minzoom} - {state.maxzoom}
            </div>
          ) : (
            <div className="flex space-x-2 items-center">
              <Skeleton className="w-10 h-5" />
              <Skeleton className="w-10 h-5" />
            </div>
          )
        }
      />
      <InputBlock
        className="py-4 text-sm font-medium text-gray-500 px-2"
        title={t("Adjusted Maximum Zoom Level")}
        input={
          state ? (
            <select
              id="location"
              disabled={Boolean(readonly)}
              name="location"
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={maxZoomSetting === null ? "" : maxZoomSetting}
              onChange={(e) => {
                onMaxZoomChange(
                  e.target.value === "" ? null : parseInt(e.target.value)
                );
              }}
            >
              <option value={""}>{t("Auto")}</option>
              {availableMaxZoomLevels
                .filter((z) => z > 2)
                .map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
            </select>
          ) : (
            <Skeleton className="w-24 h-8" />
          )
        }
        description={
          <Trans ns="admin:data">
            Some Esri basemaps include blank tiles that read "Map data not yet
            available" at higher zoom levels. You may be able to set the max
            zoom level lower to avoid this issue. Otherwise, this should be set
            to auto to use the service metadata.
          </Trans>
        }
      />
    </SettingsDefinitionList>
  );
}
