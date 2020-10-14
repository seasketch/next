import React from "react";
import InputBlock from "../../../components/InputBlock";
import Switch from "../../../components/Switch";
import { ArcGISServiceSettings, MapServerImageFormat } from "./arcgis";

export default function DynamicMapServerSettingsForm(props: {
  settings: ArcGISServiceSettings;
  updateSettings: (settings: ArcGISServiceSettings) => void;
}) {
  const { settings, updateSettings } = props;
  const acceptableImageFormats = [
    "PNG",
    "PNG8",
    "PNG24",
    "PNG32",
    "GIF",
    "JPG",
  ];
  return (
    <div>
      <InputBlock
        title="Enable High-DPI Requests"
        className="mt-4 text-sm"
        input={
          <Switch
            isToggled={settings.enableHighDpi}
            onClick={() =>
              updateSettings({
                ...settings,
                enableHighDpi: !settings.enableHighDpi,
              })
            }
          />
        }
      >
        Request higher resolution images when the user has a "Retina" or 4k
        display. Maps will be much more detailed, but it demands more of the
        data server.
      </InputBlock>
      <InputBlock
        className="mt-4 text-sm"
        title="Image Format"
        input={
          <select
            id="imageFormat"
            className="form-select block w-full pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={settings.imageFormat}
            onChange={(e) => {
              updateSettings({
                ...settings,
                imageFormat: e.target.value as MapServerImageFormat,
              });
            }}
          >
            {acceptableImageFormats.map((f) => (
              <option key={f} value={f}>
                {f.toLocaleLowerCase()}
              </option>
            ))}
          </select>
        }
      >
        Imagery data looks best using <code>jpg</code>, for others{" "}
        <code>png</code> is a good choice.
      </InputBlock>
      <InputBlock
        className="mt-4 text-sm"
        title="Rendering order"
        input={
          <select
            id="renderUnder"
            className="form-select block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
            value={settings.renderUnder}
            onChange={(e) => {
              updateSettings({
                ...settings,
                renderUnder: e.target.value as "none" | "labels" | "land",
              });
            }}
          >
            <option value={"none"}>Cover basemap</option>
            <option value={"labels"}>Under labels</option>
            <option value={"land"}>Under land</option>
          </select>
        }
      >
        If your basemaps are configured to identify these special layers, you
        can render this service underneath labels or land.
      </InputBlock>
    </div>
  );
}
