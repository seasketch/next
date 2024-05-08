import {
  FullAdminDataLayerFragment,
  FullAdminSourceFragment,
  useUpdateEnableHighDpiRequestsMutation,
  useUpdateQueryParametersMutation,
} from "../../../generated/graphql";
import { SettingsDLListItem } from "../../SettingsDefinitionList";
import InputBlock from "../../../components/InputBlock";
import { gql, useApolloClient } from "@apollo/client";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Switch from "../../../components/Switch";

export default function ArcGISDynamicMapServiceLayerInfo({
  source,
  readonly,
  layer,
}: {
  source: Pick<
    FullAdminSourceFragment,
    | "type"
    | "url"
    | "originalSourceUrl"
    | "uploadedSourceFilename"
    | "hostingQuotaUsed"
    | "outputs"
    | "queryParameters"
    | "id"
    | "useDevicePixelRatio"
  >;
  readonly?: boolean;
  layer: Pick<FullAdminDataLayerFragment, "sublayer" | "sublayerType">;
}) {
  const { t } = useTranslation("admin:data");
  const client = useApolloClient();
  const [updateQueryParameters] = useUpdateQueryParametersMutation();
  const onError = useGlobalErrorHandler();
  const [updateEnableHighDpiRequests] = useUpdateEnableHighDpiRequestsMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            id: data.sourceId,
            useDevicePixelRatio: data.useDevicePixelRatio,
          },
        },
      };
    },
  });

  return (
    <>
      <SettingsDLListItem
        term={"Sublayer"}
        description={<div>{layer.sublayer}</div>}
      />
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
          Request higher resolution images when the user has a "Retina" or 4k
          display. Maps will be much more detailed, but it demands more of the
          data server.
        </Trans>
      </InputBlock>
      <InputBlock
        className="py-4 text-sm font-medium text-gray-500 px-2"
        title={t("Image Format")}
        input={
          <select
            disabled={readonly}
            id="imageFormat"
            className="rounded form-select block w-full pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={source.queryParameters?.format || "PNG"}
            onChange={(e) => {
              client.writeFragment({
                id: `DataSource:${source.id}`,
                fragment: gql`
                  fragment UpdateFormat on DataSource {
                    queryParameters
                  }
                `,
                data: {
                  queryParameters: {
                    ...source.queryParameters,
                    format: e.target.value,
                  },
                },
              });
              updateQueryParameters({
                variables: {
                  sourceId: source.id,
                  queryParameters: {
                    ...source.queryParameters,
                    format: e.target.value,
                  },
                },
              });
            }}
          >
            {["PNG", "PNG8", "PNG24", "PNG32", "GIF", "JPG"].map((f) => (
              <option key={f} value={f}>
                {f.toLocaleLowerCase()}
              </option>
            ))}
          </select>
        }
      >
        <Trans ns="admin:data">
          Imagery data looks best using <code>jpg</code>, for all others{" "}
          <code>png</code> is usually the right choice.
        </Trans>
      </InputBlock>
    </>
  );
}
