import React from "react";
import Button from "../../../components/Button";
import InputBlock from "../../../components/InputBlock";
import Switch from "../../../components/Switch";
import { ArcGISServiceSettings, MapServerImageFormat } from "./arcgis";

export default function VectorFeatureLayerSettingsForm(props: {
  settings: ArcGISServiceSettings;
  updateSettings: (settings: ArcGISServiceSettings) => void;
}) {
  const { settings, updateSettings } = props;
  return (
    <div>
      <div className="mt-6 mb-5 bg-cool-gray-100 rounded py-2 px-4 pb-3">
        <h3 className="font-medium">Import Layers</h3>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Before importing vector sources, SeaSketch needs to analyze these
          layers for compatability and file size issues. Once completed you will
          receive recommendations on how to best use them in your project.
        </p>
        <Button className="mr-4" label={`Analyze services`} />
        <Button disabled={true} primary={true} label={`Import layers`} />
      </div>
      <InputBlock
        className="mt-4 text-sm"
        title="Enable Instant Layers"
        input={
          <Switch
            isToggled={settings.preferInstantLayers}
            onClick={() =>
              updateSettings({
                ...settings,
                preferInstantLayers: !settings.preferInstantLayers,
              })
            }
          />
        }
      >
        Creates an optimized copy of these data that will be hosted on our
        content delivery network for quick and reliable access anywhere in the
        world. This copy can be manually updated whenever data changes at the
        source.
      </InputBlock>
    </div>
  );
}
