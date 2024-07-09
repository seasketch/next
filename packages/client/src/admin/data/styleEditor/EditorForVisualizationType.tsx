import { useContext } from "react";
import RasterLayerEditor from "./RasterLayerEditor";
import { VisualizationType } from "./visualizationTypes";
import { Card, GUIEditorContext } from "./Editors";
import { RasterInfo } from "@seasketch/geostats-types";
import { Trans } from "react-i18next";
import Warning from "../../../components/Warning";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import SimplePolygonEditor from "./SimplePolygonEditor";
import ContinuousPolygonEditor from "./ContinuousPolygonEditor";

export default function EditorForVisualizationType({
  type,
}: {
  type: VisualizationType;
}) {
  const context = useContext(GUIEditorContext);
  const rasterLayer = context?.glLayers.find((l) => l.type === "raster");
  switch (type) {
    case VisualizationType.CATEGORICAL_RASTER:
    case VisualizationType.CONTINUOUS_RASTER:
    case VisualizationType.RGB_RASTER:
      return (
        <>
          <RasterLayerEditor
            glLayer={rasterLayer!}
            deleteLayerProperties={(...args) =>
              context.deleteLayerProperties(
                context.glLayers.indexOf(rasterLayer!),
                ...args
              )
            }
            updateLayerProperty={(...args) =>
              context.updateLayer(
                context.glLayers.indexOf(rasterLayer!),
                ...args
              )
            }
            rasterInfo={context.geostats as RasterInfo}
            type={type}
          />
          {RasterLayerEditor.hasUnrelatedLayers(context.glLayers) && (
            <ExtraLayersWarning />
          )}
        </>
      );
    case VisualizationType.SIMPLE_POLYGON:
      return (
        <>
          <SimplePolygonEditor />
          {SimplePolygonEditor.hasUnrelatedLayers(context.glLayers) && (
            <ExtraLayersWarning />
          )}
        </>
      );
    case VisualizationType.CONTINUOUS_POLYGON:
      return (
        <>
          <ContinuousPolygonEditor />
          {ContinuousPolygonEditor.hasUnrelatedLayers(context.glLayers) && (
            <ExtraLayersWarning />
          )}
        </>
      );
    default:
      return (
        <Warning className="mx-4" level="error">
          <Trans ns="admin:data">
            No renderer found for visualization type {type}
          </Trans>
        </Warning>
      );
  }
}

function ExtraLayersWarning() {
  return (
    <Card>
      <div className="flex items-center">
        <div>
          <ExclamationTriangleIcon className="w-6 h-6 mr-4 ml-2" />
        </div>
        <p>
          <Trans ns="admin:data">
            This style contains more layers than can be modified using the
            editor. Switch to the code view to use edit these layers.
          </Trans>
        </p>
      </div>
    </Card>
  );
}
