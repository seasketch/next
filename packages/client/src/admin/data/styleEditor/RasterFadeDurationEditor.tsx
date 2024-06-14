import { Trans } from "react-i18next";
import * as Editor from "./Editors";

export default function RasterFadDurationEditor({
  onChange,
  value,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Editor.Root>
      <Editor.Label
        title={<Trans ns="admin:data">Raster Fade Duration</Trans>}
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-fade-duration"
      />
      <Editor.Control>
        <input
          className="bg-gray-700 rounded py-0.5 pr-0.5"
          type="number"
          value={value === undefined ? "" : value}
          placeholder="300"
          min={0}
          max={5000}
          step={100}
          onChange={(e) => {
            onChange(
              e.target.value === "" ? undefined : parseFloat(e.target.value)
            );
          }}
        />
      </Editor.Control>
    </Editor.Root>
  );
}
