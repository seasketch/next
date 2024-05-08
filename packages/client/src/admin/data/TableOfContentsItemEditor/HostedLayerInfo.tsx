import bytes from "bytes";
import {
  DataUploadOutputType,
  FullAdminOverlayFragment,
  FullAdminSourceFragment,
  useLayerTotalQuotaUsedQuery,
} from "../../../generated/graphql";
import { SettingsDLListItem } from "../../SettingsDefinitionList";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslation } from "react-i18next";
import "./TooltipContent.css";
import { humanizeOutputType } from "../QuotaUsageTreemap";

export default function HostedLayerInfo({
  source,
  readonly,
  layerId,
  version,
}: {
  source: Pick<
    FullAdminSourceFragment,
    | "type"
    | "url"
    | "originalSourceUrl"
    | "uploadedSourceFilename"
    | "hostingQuotaUsed"
    | "outputs"
  >;
  readonly?: boolean;
  layerId: number;
  version?: number;
}) {
  const { data } = useLayerTotalQuotaUsedQuery({
    variables: {
      id: layerId,
    },
  });
  const { t } = useTranslation("admin:data");
  const original = (source.outputs || []).find((output) => output.isOriginal);
  return (
    <>
      {original && (
        <SettingsDLListItem
          term={"Uploaded File"}
          description={
            <div className="truncate">
              <a
                className="text-primary-500 underline"
                href={original.url}
                target="_blank"
                download={original.originalFilename}
              >
                {original.originalFilename || original.url}
              </a>
            </div>
          }
        />
      )}
      <SettingsDLListItem
        term={"Quota Used"}
        description={
          <div className="flex items-center space-x-1">
            <span>{bytes(parseInt(source.hostingQuotaUsed || "0"))}</span>
            <Tooltip.Provider>
              <Tooltip.Root delayDuration={10}>
                <Tooltip.Trigger asChild>
                  <button className="IconButton">
                    <InfoCircledIcon />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    className="TooltipContent"
                    sideOffset={5}
                  >
                    <div className="text-sm">
                      <h5 className="font-medium">{t("Assets")}</h5>
                      {(source.outputs || []).map((output) => (
                        <div className="flex items-center" key={output.id}>
                          <span className="w-36">
                            {humanizeOutputType(output.type)}{" "}
                            {output.isOriginal ? "(" + t("original") + ")" : ""}
                          </span>
                          <span className="text-gray-500">
                            {bytes(parseInt(output.size), {
                              unitSeparator: " ",
                            })}{" "}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Tooltip.Arrow className="TooltipArrow" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
            {version &&
              version > 1 &&
              data?.dataLayer?.totalQuotaUsed &&
              data?.dataLayer?.totalQuotaUsed >
                (source.hostingQuotaUsed || 0) && (
                <span>
                  {" "}
                  /{" "}
                  {bytes(parseInt(data.dataLayer.totalQuotaUsed), {
                    unitSeparator: " ",
                  })}
                  {t(" for all versions")}
                </span>
              )}
          </div>
        }
      />
    </>
  );
}

export function humanizeSourceType(type: DataUploadOutputType) {
  switch (type) {
    case DataUploadOutputType.FlatGeobuf:
      return "FlatGeobuf";
    case DataUploadOutputType.GeoJson:
      return "GeoJSON";
    case DataUploadOutputType.GeoTiff:
      return "GeoTIFF";
    case DataUploadOutputType.Pmtiles:
      return "Map Tiles";
    case DataUploadOutputType.Png:
      return "PNG";
    case DataUploadOutputType.ZippedShapefile:
      return "Shapefile";
    default:
      return type;
  }
}
