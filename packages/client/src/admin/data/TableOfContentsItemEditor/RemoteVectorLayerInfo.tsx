import { ZoomInIcon } from "@radix-ui/react-icons";
import { FullAdminSourceFragment } from "../../../generated/graphql";
import { SettingsDLListItem } from "../../SettingsDefinitionList";
import { useTranslation } from "react-i18next";
import { MapContext } from "../../../dataLayers/MapContextManager";
import { useContext } from "react";
import { map } from "d3";

export default function RemoteVectorLayerInfo({
  source,
  readonly,
}: {
  source: Pick<
    FullAdminSourceFragment,
    | "type"
    | "url"
    | "originalSourceUrl"
    | "uploadedSourceFilename"
    | "hostingQuotaUsed"
    | "outputs"
    | "tiles"
    | "tileSize"
    | "minzoom"
    | "maxzoom"
    | "bounds"
  >;
  readonly?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const mapContext = useContext(MapContext);

  return (
    <>
      <SettingsDLListItem
        term={t("URL Template")}
        description={
          <div className="overflow-auto max-h-24">{source.tiles?.[0]}</div>
        }
      />
      <SettingsDLListItem
        term={t("Min, Max Zoom")}
        description={
          <div>
            {source.minzoom !== undefined ? "z" + source.minzoom : ""}
            {source.minzoom !== undefined && source.maxzoom !== undefined
              ? " - "
              : ""}
            {source.maxzoom !== undefined ? "z" + source.maxzoom : ""}
          </div>
        }
      />
      {source.bounds && (
        <SettingsDLListItem
          term={t("Bounds")}
          description={
            <div className="font-mono font-medium text-blue-500 flex items-center space-x-2">
              <span>
                [
                {source.bounds
                  .map((b) => Math.round(b * 1000) / 1000)
                  .join(", ")}
                ]
              </span>
              <button
                onClick={() => {
                  if (mapContext.manager?.map) {
                    mapContext.manager.map.fitBounds(source.bounds as any);
                  }
                }}
              >
                <ZoomInIcon />
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
