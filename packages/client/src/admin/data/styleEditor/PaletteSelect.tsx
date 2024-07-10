// import * as Select from "@radix-ui/react-select";
import * as Editor from "./Editors";
import { Trans } from "react-i18next";
import { ChevronDownIcon, UpdateIcon } from "@radix-ui/react-icons";
import { colorScales } from "./visualizationTypes";
import * as d3Palettes from "d3-scale-chromatic";
import { StepsSetting } from "./ContinuousStepsEditor";

export default function PaletteSelect({
  onChange,
  value,
  reversed,
  type,
  steps,
}: {
  value?: string;
  reversed?: boolean;
  onChange: (palette: string, reverse?: boolean) => void;
  type: "categorical" | "continuous";
  steps?: StepsSetting;
}) {
  const Select = Editor.Select;
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
          <Select.Trigger aria-label="Color Palette">
            <Select.Value placeholder="Custom palette" />
            <Select.Icon className="text-gray-500">
              <ChevronDownIcon className="w-4 h-4" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content sideOffset={5}>
              <Select.ScrollUpButton />
              <Select.Viewport className="LayerEditorPalette">
                {value === null && (
                  <Select.Item value="custom">
                    <Select.ItemText>
                      <Trans ns="admin:data">Custom palette</Trans>
                    </Select.ItemText>
                  </Select.Item>
                )}
                {type === "categorical" &&
                  colorScales.categorical.map((scale) => (
                    <CategoricalScaleItem
                      key={scale}
                      scale={(d3Palettes as any)[scale] as unknown as string[]}
                      value={scale as string}
                      reversed={reversed || false}
                    />
                  ))}
                {type === "continuous" &&
                  colorScales.continuous.sequential.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                      steps={steps}
                    />
                  ))}
                {type === "continuous" &&
                  colorScales.continuous.cyclical.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                      steps={steps}
                    />
                  ))}
                {type === "continuous" &&
                  colorScales.continuous.diverging.map((scale) => (
                    <ContinuousScaleItem
                      reversed={reversed}
                      key={scale}
                      value={scale}
                      steps={steps}
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
  const Select = Editor.Select;

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
    <Select.Item value={value}>
      <Select.ItemText>
        <div className="flex">{colorItems}</div>
      </Select.ItemText>
    </Select.Item>
  );
}

function ContinuousScaleItem({
  value,
  reversed,
  steps,
}: {
  value: string;
  reversed?: boolean;
  steps?: StepsSetting;
}) {
  const Select = Editor.Select;

  const fn = (d3Palettes as any)[value];
  return (
    <Select.Item value={value}>
      <Select.ItemText>
        <div className="">
          {value in d3Palettes ? (
            !steps || steps.steps === "continuous" ? (
              <div
                className="flex w-32 h-4 rounded-sm"
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
              <div
                className={`flex w-32 h-4 rounded-sm ${
                  reversed ? "flex-row-reverse" : ""
                }`}
              >
                {Array.from({ length: steps.n }, (_, i) => (
                  <div
                    key={i}
                    className="h-full flex-1"
                    style={{
                      backgroundColor: fn(i / (steps.n - 1)),
                    }}
                  ></div>
                ))}
              </div>
            )
          ) : (
            value
          )}
        </div>
      </Select.ItemText>
    </Select.Item>
  );
}
