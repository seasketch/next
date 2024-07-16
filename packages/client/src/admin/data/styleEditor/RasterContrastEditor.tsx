import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";

export function RasterContrastEditor({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Editor.Root block className="h-14">
      <div
        className="w-0.5 h-3 bg-gray-600 absolute left-1/2 top-10"
        style={{ marginLeft: -1 }}
      ></div>
      <Editor.Label
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-contrast"
        title={<Trans ns="admin:data">Contrast</Trans>}
      />
      <Editor.Control>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[value !== undefined ? value : 0]}
          min={-1}
          max={1}
          step={0.05}
          onValueChange={(v) => {
            onChange(v[0]);
          }}
        >
          <Slider.Track className="bg-gradient-to-r from-gray-900 to-gray-100 border-b border-gray-600 opacity-80 relative grow rounded h-2 w-full"></Slider.Track>
          <Editor.Thumb aria-label="raster-contrast" />
        </Slider.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
