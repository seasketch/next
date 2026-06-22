import {
  FullAdminDataLayerFragment,
  FullAdminSourceFragment,
  useUpdateEnableHighDpiRequestsMutation,
  useUpdateQueryParametersMutation,
} from "../../../generated/graphql";
import { SettingsDLListItem } from "../../SettingsDefinitionList";
import InputBlock from "../../../components/InputBlock";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Switch from "../../../components/Switch";
import { Trans, useTranslation } from "react-i18next";
import { DataSourceTypes } from "../../../generated/graphql";
import { parseWmsSettings } from "../../../dataLayers/wms/wmsSettings";

export default function WMSLayerInfo({
  source,
  readonly,
  layer,
}: {
  source: Pick<
    FullAdminSourceFragment,
    | "type"
    | "url"
    | "queryParameters"
    | "id"
    | "useDevicePixelRatio"
    | "wmsSettings"
    | "tileSize"
  >;
  readonly?: boolean;
  layer: Pick<FullAdminDataLayerFragment, "sublayer">;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const [updateQueryParameters] = useUpdateQueryParametersMutation({ onError });
  const [updateEnableHighDpiRequests] = useUpdateEnableHighDpiRequestsMutation({
    onError,
    optimisticResponse: (data) => ({
      __typename: "Mutation",
      updateDataSource: {
        __typename: "UpdateDataSourcePayload",
        dataSource: {
          __typename: "DataSource",
          id: data.sourceId,
          useDevicePixelRatio: data.useDevicePixelRatio,
        },
      },
    }),
  });

  if (source.type !== DataSourceTypes.Wms) {
    return null;
  }

  const settings = parseWmsSettings(source);

  return (
    <>
      <SettingsDLListItem
        term={t("WMS layer")}
        description={<div>{layer.sublayer}</div>}
      />
      <SettingsDLListItem
        term={t("Service endpoint")}
        description={
          <a
            className="text-primary-600 underline break-all"
            href={source.url || "#"}
            target="_blank"
            rel="noreferrer"
          >
            {source.url}
          </a>
        }
      />
      <SettingsDLListItem
        term={t("WMS version")}
        description={settings.version || "1.3.0"}
      />
      <SettingsDLListItem
        term={t("Request mode")}
        description={
          settings.requestMode === "tiled"
            ? t("Tiled (256px raster tiles)")
            : t("Dynamic (single viewport image)")
        }
      />
      <SettingsDLListItem
        term={t("Image format")}
        description={settings.imageFormat || "image/png"}
      />
      <SettingsDLListItem term={t("CRS")} description={settings.crs || "EPSG:3857"} />
      <div className="px-2 py-2 text-xs text-gray-500">
        <Trans ns="admin:data">
          These settings apply to the whole WMS service. All layers imported from
          this service share z-order and opacity as a group.
        </Trans>
      </div>
      <InputBlock
        title={t("Enable High-DPI Requests")}
        className="py-4 text-sm font-medium text-gray-500 px-2"
        input={
          <Switch
            disabled={readonly}
            isToggled={!!source.useDevicePixelRatio}
            onClick={(value) => {
              updateEnableHighDpiRequests({
                variables: {
                  sourceId: source.id,
                  useDevicePixelRatio: value,
                },
              });
            }}
          />
        }
      >
        <Trans ns="admin">
          Request higher resolution images when the user has a Retina or 4k
          display.
        </Trans>
      </InputBlock>
      {settings.requestMode === "tiled" && (
        <SettingsDLListItem
          term={t("Tile size")}
          description={String(source.tileSize || settings.tileSize || 256)}
        />
      )}
      <InputBlock
        title={t("Transparent background")}
        className="py-4 text-sm font-medium text-gray-500 px-2"
        input={
          <Switch
            disabled={readonly}
            isToggled={settings.transparent !== false}
            onClick={(value) => {
              updateQueryParameters({
                variables: {
                  sourceId: source.id,
                  queryParameters: {
                    ...(source.queryParameters || {}),
                    transparent: value ? "TRUE" : "FALSE",
                  },
                },
              });
            }}
          />
        }
      />
    </>
  );
}
