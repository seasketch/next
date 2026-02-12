import {
  DataSourceDetailsFragment,
  useSetMaxZoomMutation,
} from "../../generated/graphql";
import { useContext, useEffect } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { isArcGISTiledMapservice } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISTiledMapService";
import ArcGISTiledRasterBaseSettings from "./ArcGISTiledRasterBaseSettings";

export default function ArcGISTiledRasterSettings({
  source,
  readonly,
  hideLocation,
  hideType,
}: {
  source: Pick<DataSourceDetailsFragment, "id" | "maxzoom" | "minzoom" | "url">;
  readonly?: boolean;
  hideLocation?: boolean;
  hideType?: boolean;
}) {
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

  const { manager } = useContext(MapManagerContext);

  useEffect(() => {
    if (manager) {
      // Update the source maxzoom
      const customSource = manager.getCustomGLSource(source.id);
      if (customSource && isArcGISTiledMapservice(customSource)) {
        customSource.updateMaxZoom(source.maxzoom || undefined);
      }
    }
  }, [manager, source.id, source.maxzoom]);

  return (
    <ArcGISTiledRasterBaseSettings
      url={source.url!}
      maxZoomSetting={source.maxzoom || null}
      readonly={readonly}
      hideLocation={hideLocation}
      hideType={hideType}
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
