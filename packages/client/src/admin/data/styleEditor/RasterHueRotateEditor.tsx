import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";
import { RasterInfo } from "@seasketch/geostats-types";
import { colord } from "colord";
import { pickColorfulColor } from "./RasterSaturationEditor";

export function RasterHueRotateEditor({
  value,
  onChange,
  rasterInfo,
}: {
  value?: number;
  onChange: (value: number) => void;
  rasterInfo?: RasterInfo;
}) {
  let colors = ["#6366f1"];
  if (rasterInfo?.representativeColorsForRGB) {
    // pick a color that is not white or black, and is otherwise colorful
    const colorful = pickColorfulColor(
      // eslint-disable-next-line i18next/no-literal-string
      rasterInfo.representativeColorsForRGB.map((c) => `rgb(${c.join(",")})`)
    );
    if (colorful) {
      colors = colorful;
    }
    // sort colors by brightness and hue
    colors
      .sort((a, b) => {
        const aCol = colord(a);
        const bCol = colord(b);
        const aHSL = aCol.toHsl();
        const bHSL = bCol.toHsl();
        if (aHSL.h === bHSL.h) {
          return aHSL.l - bHSL.l;
        }
        return aHSL.h - bHSL.h;
      })
      .reverse();
  }

  return (
    <Editor.Root block className="h-14">
      <Editor.Label
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-hue-rotate"
        title={<Trans ns="admin:data">Hue Rotation</Trans>}
      />
      <Editor.Control>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[value !== undefined ? value : 0]}
          min={0}
          max={359}
          step={1}
          onValueChange={(v) => {
            onChange(v[0]);
          }}
        >
          <Slider.Track className=" border-b border-gray-600 relative grow rounded h-2 w-full overflow-hidden">
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{
                filter: "blur(1px)",
                // transform: "rotate(1deg) scale(1.5, 2)",
              }}
            >
              {colors.slice(0, 2).map((color) => (
                <div
                  key={color}
                  className="w-full h-full"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${color} 0%, ${[
                      36, 72, 108, 144, 180, 216, 252, 288, 324,
                    ]
                      .map((deg, i) => {
                        return (
                          colord(color).rotate(deg).toRgbString() +
                          " " +
                          i * 10 +
                          "%"
                        );
                      })
                      .join(", ")})`,
                  }}
                ></div>
              ))}
            </div>
          </Slider.Track>
          <Editor.Thumb aria-label="raster-hue-rotate" />
        </Slider.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
