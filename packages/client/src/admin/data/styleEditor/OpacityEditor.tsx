import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";

export function OpacityEditor({
  value,
  onChange,
  fillColor,
}: {
  value?: number;
  onChange: (value: number) => void;
  fillColor?: string;
}) {
  return (
    <Editor.Root>
      <Editor.Label title={<Trans ns="admin:data">Opacity</Trans>} />
      <Editor.Control>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-44 h-5"
          value={[value !== undefined ? value : 1]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={(v) => {
            onChange(v[0]);
          }}
        >
          <Slider.Track className="bg-gray-800 bg-opacity-90 border-b border-gray-600  relative grow rounded h-2 w-full">
            <Slider.Range
              style={{
                opacity: 0.3,
                backgroundImage: `
              linear-gradient(45deg, lightgrey 25%, transparent 25%), 
              linear-gradient(135deg, lightgrey 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, lightgrey 75%),
              linear-gradient(135deg, transparent 75%, lightgrey 75%)`,

                backgroundSize: "7px 7px",
                backgroundPosition: "0 0, 3.5px 0, 3.5px -3.5px, 0px 3.5px",
              }}
              className="absolute rounded h-full shadow-inner"
            />
            <Slider.Range
              className="absolute bg-gradient-to-r from-transparent to-indigo-500 rounded h-full"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(0,0,0,0), ${
                  fillColor || "#aaa"
                } ${(1 / (value === undefined ? 1 : value)) * 90}%`,
              }}
            />
          </Slider.Track>
          <Editor.Thumb aria-label="Opacity" />
        </Slider.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
