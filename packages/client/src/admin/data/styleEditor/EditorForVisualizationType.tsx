import { useCallback, useContext, useState } from "react";
import RasterLayerEditor, { isRasterLayer } from "./RasterLayerEditor";
import { VisualizationType } from "./visualizationTypes";
import { Card, GUIEditorContext } from "./Editors";
import { RasterInfo } from "@seasketch/geostats-types";
import { Trans } from "react-i18next";
import Warning from "../../../components/Warning";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import SimplePolygonEditor from "./SimplePolygonEditor";
import ContinuousPolygonEditor from "./ContinuousPolygonEditor";
import CategoricalPolygonEditor from "./CategoricalPolygonEditor";
import * as Editor from "./Editors";
import VisualizationTypeControl from "./VisualizationTypeControl";
import { ErrorBoundary } from "@sentry/react";
import SimplePointEditor from "./SimplePointEditor";
import CategoricalPointEditor from "./CategoricalPointEditor";
import HeatmapEditor from "./HeatmapEditor";
import ProportionalSymbolEditor from "./ProportionalSymbolEditor";

export default function EditorForVisualizationType({
  type,
}: {
  type: VisualizationType;
}) {
  const context = useContext(GUIEditorContext);
  const updateLayerProperty = useCallback(
    (...args) => {
      context.updateLayer(
        context.glLayers.findIndex((l) => isRasterLayer(l)),
        // @ts-ignore
        ...args
      );
    },
    [context.glLayers, context.updateLayer]
  );

  const [buttonsContainerRef, setButtonsContainerRef] = useState<
    HTMLDivElement | undefined
  >();

  return (
    <Editor.Card>
      <VisualizationTypeControl buttonsContainerRef={setButtonsContainerRef} />
      <ErrorBoundary
        key={type}
        fallback={
          <Warning>
            <Trans ns="admin:data">
              An error occured when rendering the controls for this
              visualization type. You may change visualization types to restore
              editing capability, or use the code editor.
            </Trans>
          </Warning>
        }
      >
        <Editor.CardButtonsPortalRef.Provider
          value={buttonsContainerRef || null}
        >
          {(type === VisualizationType.CATEGORICAL_RASTER ||
            type === VisualizationType.CONTINUOUS_RASTER ||
            type === VisualizationType.RGB_RASTER) && (
            <>
              <RasterLayerEditor
                deleteLayerProperties={(...args) =>
                  context.deleteLayerProperties(
                    context.glLayers.findIndex((l) => isRasterLayer(l)),
                    ...args
                  )
                }
                updateLayerProperty={updateLayerProperty}
                rasterInfo={context.geostats as RasterInfo}
                type={type}
              />
              {RasterLayerEditor.hasUnrelatedLayers(context.glLayers) && (
                <ExtraLayersWarning />
              )}
            </>
          )}
          {type === VisualizationType.SIMPLE_POLYGON && (
            <>
              <SimplePolygonEditor />
              {SimplePolygonEditor.hasUnrelatedLayers(context.glLayers) && (
                <ExtraLayersWarning />
              )}
            </>
          )}
          {type === VisualizationType.CATEGORICAL_POLYGON && (
            <>
              <CategoricalPolygonEditor />
              {CategoricalPolygonEditor.hasUnrelatedLayers(
                context.glLayers
              ) && <ExtraLayersWarning />}
            </>
          )}
          {type === VisualizationType.CONTINUOUS_POLYGON && (
            <>
              <ContinuousPolygonEditor />
              {ContinuousPolygonEditor.hasUnrelatedLayers(context.glLayers) && (
                <ExtraLayersWarning />
              )}
            </>
          )}
          {type === VisualizationType.SIMPLE_POINT && (
            <>
              <SimplePointEditor />
              {SimplePointEditor.hasUnrelatedLayers(context.glLayers) && (
                <ExtraLayersWarning />
              )}
            </>
          )}
          {type === VisualizationType.CATEGORICAL_POINT && (
            <>
              <CategoricalPointEditor />
            </>
          )}
          {type === VisualizationType.HEATMAP && (
            <>
              <HeatmapEditor />
              {HeatmapEditor.hasUnrelatedLayers(context.glLayers) && (
                <ExtraLayersWarning />
              )}
            </>
          )}
          {type === VisualizationType.PROPORTIONAL_SYMBOL && (
            <>
              <ProportionalSymbolEditor />
              {ProportionalSymbolEditor.hasUnrelatedLayers(
                context.glLayers
              ) && <ExtraLayersWarning />}
            </>
          )}
        </Editor.CardButtonsPortalRef.Provider>
      </ErrorBoundary>
    </Editor.Card>
  );
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
            editor. Switch to the code editor to modify these layers.
          </Trans>
        </p>
      </div>
    </Card>
  );
}
