import * as Select from "@radix-ui/react-select";
import * as Editor from "./Editors";
import { Trans } from "react-i18next";
import { ChevronDownIcon, UpdateIcon } from "@radix-ui/react-icons";
import { colorScales } from "./visualizationTypes";
import * as d3Palettes from "d3-scale-chromatic";
import { SuggestedRasterPresentation } from "@seasketch/geostats-types";

export default function RasterColorPalette({
  onChange,
  value,
  reversed,
  type,
}: {
  value?: string;
  reversed?: boolean;
  onChange: (palette: string, reverse?: boolean) => void;
  type:
    | SuggestedRasterPresentation.categorical
    | SuggestedRasterPresentation.continuous;
}) {
  return (
    <Editor.Root>
      <Editor.Label
        title={
          <div className="flex items-center w-full space-x-2">
            <span className="">
              <Trans ns="admin:data">Color Palette</Trans>
            </span>
          </div>
        }
      />
      <Editor.Control>
        {value && value !== "custom" && (
          <div className="flex-1 flex items-center mr-4">
            <button
              className="text-indigo-200 opacity-20 hover:opacity-80"
              title="reverse colors"
              onClick={() => {
                onChange(value, !reversed);
              }}
            >
              <UpdateIcon />
            </button>
          </div>
        )}
        <Select.Root
          value={value || "custom"}
          onValueChange={(v) => {
            onChange(v, reversed);
          }}
        >
          <Select.Trigger
            className="inline-flex items-center justify-center rounded px-4 text-sm leading-none h-8 gap-1 bg-gray-700 text-gray-400 shadow  outline-none border border-gray-500"
            aria-label="Color Palette"
          >
            <Select.Value placeholder="Custom palette" />
            <Select.Icon className="text-violet11">
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              className="PaletteSelectContent overflow-hidden bg-white  rounded-md shadow z-50"
              sideOffset={5}
            >
              <Select.ScrollUpButton />
              <Select.Viewport className="p-2 LayerEditorPalette">
                {value === null && (
                  <Select.Item
                    value="custom"
                    className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none`}
                  >
                    <Select.ItemText>
                      <Trans ns="admin:data">Custom palette</Trans>
                    </Select.ItemText>
                  </Select.Item>
                )}
                {type === SuggestedRasterPresentation.categorical &&
                  colorScales.categorical.map((scale) => (
                    <CategoricalScaleItem
                      key={scale}
                      scale={(d3Palettes as any)[scale] as unknown as string[]}
                      value={scale as string}
                      reversed={reversed || false}
                    />
                  ))}
                {type === SuggestedRasterPresentation.continuous &&
                  colorScales.continuous.sequential.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                    />
                  ))}
                {type === SuggestedRasterPresentation.continuous &&
                  colorScales.continuous.cyclical.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                    />
                  ))}
                {type === SuggestedRasterPresentation.continuous &&
                  colorScales.continuous.diverging.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                    />
                  ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

function CategoricalScaleItem({
  scale,
  reversed,
  value,
}: {
  scale: string[];
  value: string;
  reversed?: boolean;
}) {
  const colorItems = Array.from({ length: scale.length }, (_, i) => (
    <div
      key={i}
      className="w-4 h-4"
      style={{
        backgroundColor: scale[i],
      }}
    ></div>
  ));
  if (reversed) {
    colorItems.reverse();
  }
  return (
    <Select.Item
      value={value}
      className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
    >
      <Select.ItemText>
        <div className="flex">{colorItems}</div>
      </Select.ItemText>
    </Select.Item>
  );
}

function ContinuousScaleItem({
  value,
  reversed,
}: {
  value: string;
  reversed?: boolean;
}) {
  const fn = (d3Palettes as any)[value];
  return (
    <Select.Item
      value={value}
      className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
    >
      <Select.ItemText>
        {value in d3Palettes ? (
          <div
            className="flex w-32 h-4"
            style={{
              backgroundImage: `linear-gradient(${
                reversed ? "to left" : "to right"
              }, ${fn(0)} 0%, ${fn(0.1)} 10%, ${fn(0.2)} 20%, ${fn(
                0.3
              )} 30%, ${fn(0.4)} 40%, ${fn(0.5)} 50%, ${fn(0.6)} 60%, ${fn(
                0.7
              )} 70%, ${fn(0.8)} 80%, ${fn(0.9)} 90%, ${fn(1)} 100%`,
            }}
          ></div>
        ) : (
          value
        )}
      </Select.ItemText>
    </Select.Item>
  );
}
