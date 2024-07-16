import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";
import { RasterInfo } from "@seasketch/geostats-types";
import { colord } from "colord";

export function RasterSaturationEditor({
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
      <div
        className="w-0.5 h-3 bg-gray-600 absolute left-1/2 top-10"
        style={{ marginLeft: -1 }}
      ></div>
      <Editor.Label
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-saturation"
        title={<Trans ns="admin:data">Saturation</Trans>}
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
          <Slider.Track className=" border-b border-gray-600 relative grow rounded h-2 w-full overflow-hidden">
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{
                filter: "blur(1px)",
                transform: "rotate(1.5deg) scale(1.5, 2.5)",
              }}
            >
              {colors.map((color) => (
                <div
                  key={color}
                  className="w-full h-full"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${colord(color)
                      .desaturate(1)
                      .toRgbString()}, ${colord(color)
                      .desaturate(0.2)
                      .toRgbString()} 50%, ${colord(color)
                      .saturate(1)
                      .toRgbString()} 100%`,
                  }}
                ></div>
              ))}
            </div>
          </Slider.Track>
          <Editor.Thumb aria-label="raster-saturation" />
        </Slider.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

function isColorful(color: string): boolean {
  const c = colord(color);
  // Convert to HSL
  const { h, s, l } = c.toHsl();

  // Filter out white, black, too light, or too dark
  if (l > 90 || l < 10 || s < 40) {
    return false;
  }

  // Filter out brown (approx. 30 < hue < 60 and low saturation)
  if (h > 30 && h < 60 && s < 0.5) {
    return false;
  }

  return true;
}

export function pickColorfulColor(colors: string[], number = 3) {
  const colorfulColors = colors.filter(isColorful);
  if (colorfulColors.length === 0) {
    return null;
  }
  // Sort by saturation in descending order and pick the most saturated color
  colorfulColors.sort((a, b) => colord(b).toHsl().s - colord(a).toHsl().s);
  if (colorfulColors.length < number) {
    return colorfulColors;
  } else {
    return colorfulColors.slice(0, number);
  }
}
