import { Trans, useTranslation } from "react-i18next";
import {
  DataSourceDetailsFragment,
  useSetMaxZoomMutation,
} from "../../generated/graphql";
import {
  SettingsDLListItem,
  SettingsDefinitionList,
} from "../SettingsDefinitionList";
import Skeleton from "../../components/Skeleton";
import { useContext, useEffect, useMemo, useState } from "react";
import InputBlock from "../../components/InputBlock";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { MapContext } from "../../dataLayers/MapContextManager";
import { isArcGISTiledMapservice } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISTiledMapService";
import ArcGISTiledRasterBaseSettings from "./ArcGISTiledRasterBaseSettings";

export default function ArcGISTiledRasterSettings({
  source,
}: {
  source: DataSourceDetailsFragment;
}) {
  const { t } = useTranslation("admin:data");

  const onError = useGlobalErrorHandler();
  const [setMaxZoom] = useSetMaxZoomMutation({
    optimisticResponse: (data) => ({
      __typename: "Mutation",
      updateDataSource: {
        __typename: "UpdateDataSourcePayload",
        dataSource: {
          __typename: "DataSource",
          id: data.sourceId,
          maxzoom: data.maxzoom,
        },
      },
    }),
    onError,
  });

  const mapContext = useContext(MapContext);

  useEffect(() => {
    if (mapContext.manager) {
      // Update the source maxzoom
      const customSource = mapContext.manager.getCustomGLSource(source.id);
      if (customSource && isArcGISTiledMapservice(customSource)) {
        customSource.updateMaxZoom(source.maxzoom || undefined);
      }
    }
  }, [mapContext.manager, source.id, source.maxzoom]);

  return (
    <ArcGISTiledRasterBaseSettings
      url={source.url!}
      maxZoomSetting={source.maxzoom || null}
      onMaxZoomChange={(mz) =>
        setMaxZoom({
          variables: {
            sourceId: source.id,
            maxzoom: mz,
          },
        })
      }
    />
  );
}
