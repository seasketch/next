import * as Select from "@radix-ui/react-select";
import * as Editor from "./Editors";
import { Trans } from "react-i18next";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { colorScales } from "./visualizationTypes";
import * as d3Palettes from "d3-scale-chromatic";

export default function RasterColorPalette({
  onChange,
  value,
}: {
  value?: string;
  onChange: (palette: string) => void;
}) {
  return (
    <Editor.Root>
      <Editor.Label title={<Trans ns="admin:data">Color Palette</Trans>} />
      <Editor.Control>
        <Select.Root
          value={value || "custom"}
          onValueChange={(v) => {
            onChange(v);
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
              className="overflow-hidden bg-white rounded-md shadow z-50"
              sideOffset={5}
            >
              <Select.ScrollUpButton />
              <Select.Viewport className="p-2">
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
                {colorScales.categorical.map((scale) => (
                  <Select.Item
                    key={scale}
                    value={scale}
                    className={`text-sm leading-none rounded flex items-center h-8 pr-1 pl-1 relative select-none hover:bg-indigo-50 hover:border-indigo-500 bg-opacity-30 border border-transparent`}
                  >
                    <Select.ItemText>
                      {scale in d3Palettes ? (
                        <div className="flex">
                          {
                            // get the length of the color scale, create an array
                            // of that length, and map over it to create a div for
                            // each color in the scale
                            Array.from(
                              { length: (d3Palettes as any)[scale].length },
                              (_, i) => (
                                <div
                                  key={i}
                                  className="w-4 h-4"
                                  style={{
                                    backgroundColor: (d3Palettes as any)[scale][
                                      i
                                    ],
                                  }}
                                ></div>
                              )
                            )
                          }
                        </div>
                      ) : (
                        scale
                      )}
                    </Select.ItemText>
                  </Select.Item>
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
