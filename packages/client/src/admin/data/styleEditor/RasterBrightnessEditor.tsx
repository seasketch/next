import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";

export function RasterBrightnessEditor({
  value,
  onChange,
  defaultValue,
  property,
}: {
  value?: number;
  onChange: (value: number) => void;
  defaultValue: number;
  property: string;
}) {
  return (
    <Editor.Root block className="h-14">
      <Editor.Label
        docs={`https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-${property}`}
        title={
          <span className="capitalize">
            <Trans ns="admin:data">Brightness</Trans>{" "}
            {property.replace("raster-brightness-", "")}
          </span>
        }
      />
      <Editor.Control>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[value !== undefined ? value : defaultValue]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={(v) => {
            onChange(v[0]);
          }}
        >
          <Slider.Track className="bg-gradient-to-r from-gray-900 to-gray-100 border-b border-gray-600 opacity-80 relative grow rounded h-2 w-full"></Slider.Track>
          <Editor.Thumb aria-label={"raster-brightness-min"} />
        </Slider.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
