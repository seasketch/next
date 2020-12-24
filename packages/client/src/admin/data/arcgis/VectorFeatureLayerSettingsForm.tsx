import React, { useContext } from "react";
import Button from "../../../components/Button";
import InputBlock from "../../../components/InputBlock";
import Switch from "../../../components/Switch";
import { LayerManagerContext } from "../../../dataLayers/LayerManager";
import { ArcGISServiceSettings, MapServerImageFormat } from "./arcgis";

export default function VectorFeatureLayerSettingsForm(props: {
  settings: ArcGISServiceSettings;
  updateSettings: (settings: ArcGISServiceSettings) => void;
}) {
  const { settings, updateSettings } = props;
  return (
    <div>
      <div className="mt-6 mb-5 bg-gray-100 rounded py-2 px-4 pb-3">
        <h3 className="font-medium">Import Layers</h3>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Before importing vector sources, SeaSketch will these vector sources
          for compatability and file size issues.
        </p>
        <Button
          primary={true}
          label={`Import ${settings.vectorSublayerSettings.length} layers`}
        />
      </div>
    </div>
  );
}
