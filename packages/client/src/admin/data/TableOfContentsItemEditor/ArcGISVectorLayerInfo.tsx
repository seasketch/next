import bytes from "bytes";
import {
  ArcgisFeatureLayerFetchStrategy,
  DataUploadOutputType,
  FullAdminDataLayerFragment,
  FullAdminSourceFragment,
  useUpdateFetchStrategyMutation,
} from "../../../generated/graphql";
import { SettingsDLListItem } from "../../SettingsDefinitionList";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Trans, useTranslation } from "react-i18next";
import "./TooltipContent.css";
import { humanizeOutputType } from "../QuotaUsageTreemap";
import InputBlock from "../../../components/InputBlock";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import { ChartBarIcon } from "@heroicons/react/solid";
import FeatureLayerPerformanceDetailsModal from "../FeatureLayerPerformanceDetailsModal";
import { useState } from "react";

export default function ArcGISVectorLayerInfo({
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
    | "arcgisFetchStrategy"
    | "id"
  >;
  layer: Pick<
    FullAdminDataLayerFragment,
    "sublayer" | "sublayerType" | "sourceLayer"
  >;
  readonly?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const sublayer = layer.sublayer?.toString() || source.url!.split("/").pop();
  const onError = useGlobalErrorHandler();
  const [perfModalOpen, setPerfModalOpen] = useState<string | false>(false);

  const [updateFetchStrategy] = useUpdateFetchStrategyMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            id: data.sourceId,
            arcgisFetchStrategy: data.fetchStrategy,
          },
        },
      };
    },
  });

  const [selectOpen, setSelectOpen] = useState(false);
  return (
    <>
      <SettingsDLListItem term={t("Sublayer")} description={sublayer} />{" "}
      <InputBlock
        className="py-4 text-sm font-medium text-gray-500 px-2"
        title={t("Fetch Strategy")}
        input={
          <select
            onClick={(e) => setSelectOpen(true)}
            onBlur={() => setSelectOpen(false)}
            id="imageFormat"
            className="rounded form-select block pl-3 pr-7 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5 w-28 truncate"
            value={
              source.arcgisFetchStrategy || ArcgisFeatureLayerFetchStrategy.Auto
            }
            onChange={(e) => {
              setSelectOpen(false);
              updateFetchStrategy({
                variables: {
                  sourceId: source.id,
                  fetchStrategy: e.target
                    .value as ArcgisFeatureLayerFetchStrategy,
                },
              });
            }}
          >
            <option value={ArcgisFeatureLayerFetchStrategy.Auto}>
              {selectOpen ? "Auto - For debugging only" : "Auto"}
            </option>
            <option value={ArcgisFeatureLayerFetchStrategy.Raw}>
              {selectOpen
                ? "GeoJSON - Best for small datasets downloadable in one request"
                : "GeoJSON"}
            </option>
            <option value={ArcgisFeatureLayerFetchStrategy.Tiled}>
              {selectOpen
                ? "Tiled - For larger datasets or those with > 2000 features"
                : "Tiled"}
            </option>
          </select>
        }
      >
        <Trans ns="admin:data">
          SeaSketch determines an appropriate strategy for retrieving vector
          data at import time.
          <br />
          <button
            className="underline text-primary-500 mt-1"
            onClick={() => setPerfModalOpen(source!.url!)}
          >
            <ChartBarIcon className=" w-4 h-4 inline mr-1" />
            {t("Analyze layer performance details")}
          </button>
        </Trans>
      </InputBlock>
      {perfModalOpen && (
        <FeatureLayerPerformanceDetailsModal
          url={source.url!}
          sourceName={source.url!.split("/").slice(-3).join("/")}
          onRequestClose={() => setPerfModalOpen(false)}
        />
      )}
    </>
  );
}
