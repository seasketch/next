import { FontFamilyIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import * as Slider from "@radix-ui/react-slider";
import { Expression, Layer } from "mapbox-gl";
import {
  ReactNode,
  createContext,
  forwardRef,
  useEffect,
  useState,
} from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixSelect from "@radix-ui/react-select";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import {
  LayerPropertyUpdater,
  LayerUpdater,
  PropertyRef,
} from "./GUIStyleEditor";
import { VisualizationType } from "./visualizationTypes";
import { TFunction } from "i18next";
import { Trans } from "react-i18next";

export function DocumentationInfo({ href }: { href: string }) {
  return (
    <a
      className="text-gray-500 hover:text-gray-300"
      href={href}
      target="_blank"
    >
      <InfoCircledIcon />
    </a>
  );
}

export function Root({
  children,
  block,
  className,
  disabled,
}: {
  children?: ReactNode;
  block?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`${
        block ? "space-y-1" : "flex h-10"
      } items-center select-none relative ${className ? className : ""} ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Label({
  title,
  docs,
  buttons,
  tooltip,
}: {
  title: string | ReactNode;
  docs?: string;
  buttons?: ReactNode;
  tooltip?: string | ReactNode;
}) {
  return (
    <h3 className="flex-1 flex items-center space-x-1">
      <span>{title}</span>
      {docs && <DocumentationInfo href={docs} />}
      {tooltip && (
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={100}>
            <Tooltip.Trigger>
              <InfoCircledIcon className="text-gray-500" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-gray-900 bg-opacity-90 text-white select-none  p-2 px-3 text-sm z-50 rounded"
                style={{ maxWidth: 200 }}
              >
                {tooltip}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
      {buttons && (
        <div className="flex-1 flex items-center justify-end">{buttons}</div>
      )}
    </h3>
  );
}

export function Control({ children }: { children?: ReactNode }) {
  return <div className={`flex items-center text-sm `}>{children}</div>;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`LayerEditor m-3 p-4 bg-gray-700 bg-opacity-20 border border-white border-opacity-5 text-white text-sm rounded ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  buttons,
}: {
  children: ReactNode;
  buttons?: ReactNode;
}) {
  return (
    <div className="flex flex-1 group pb-2">
      <h3 className="capitalize text-lg flex-1 space-x-2 flex">
        <span className="flex-1">{children}</span>
        {buttons}
      </h3>
    </div>
  );
}

export function Header({
  title,
  className,
}: {
  title: string | ReactNode;
  className?: string;
}) {
  return <h4 className={`text-sm font-semibold py-3 ${className}`}>{title}</h4>;
}

export function Thumb({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Slider.Thumb
      className={`block w-3 h-5 bg-gray-300  shadow rounded hover:bg-gray-100 focus:outline-none focus:shadow ${className}`}
      style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
      aria-label={ariaLabel}
    />
  );
}

export type ExpressionCategory = { value: string | number; color: string };

export type SeaSketchLayerMetadata = { [key: string]: any } & {
  "s:excluded"?: (string | number)[];
  "s:palette"?: string[];
  "s:legend-labels"?: { [key: string]: string };
  "s:sorted-categories"?: any[];
  "s:reverse-palette"?: boolean;
  "s:respect-scale-and-offset"?: boolean;
  "s:round-numbers"?: boolean;
  "s:value-suffix"?: string;
  "s:steps"?: string;
};

export function extractCategoriesFromExpression(expression: Expression) {
  const categories: { value: string | number; color: string }[] = [];
  // Extract categories from raster-color expression. Assumes that the
  // expression is a step or match expression.
  const expressionType = expression[0];
  if (expressionType !== "step" && expressionType !== "match") {
    throw new Error("Invalid expression type");
  }
  let i = expressionType === "step" ? 3 : 2;
  while (i < expression.length) {
    const value = expression[i];
    const color = expression[i + 1];
    i += 2;
    if (typeof color !== "string") {
      continue;
    }
    categories.push({ value, color });
  }
  return categories as ExpressionCategory[];
}

export const GUIEditorContext = createContext<{
  glLayers: SeaSketchGlLayer[];
  geostats: GeostatsLayer | RasterInfo;
  updateLayer: LayerUpdater;
  deleteLayerProperties: (idx: number, properties: PropertyRef[]) => void;
  addLayer: (index: number, layer: SeaSketchGlLayer) => void;
  type?: VisualizationType;
  t: TFunction;
}>({
  glLayers: [],
  geostats: { bands: [] } as unknown as RasterInfo,
  updateLayer: () => {},
  addLayer: () => {},
  deleteLayerProperties: () => {},
  t: (key: string) => key,
});

export const Popover = {
  ...RadixPopover,
  Content: forwardRef((props: RadixPopover.PopoverContentProps, ref) => (
    <RadixPopover.Content
      {...props}
      // @ts-ignore
      className={`rounded-lg p-0.5 z-50 bg-gray-600 shadow-xl ${props.className}`}
      // @ts-ignore
      ref={ref}
    />
  )),
};

export const Select = {
  ...RadixSelect,
};

export function CustomExpressionIndicator() {
  return (
    <div className="flex items-center space-x-1">
      <span>
        <Trans ns="admin:data">Custom Expression</Trans>
      </span>

      <div className="flex items-center bg-gray-900 bg-opacity-30 rounded p-0.5">
        <FontFamilyIcon />
        <span
          style={{ bottom: -1, left: -1 }}
          className="font-mono text-xs relative"
        >
          ()
        </span>
      </div>
    </div>
  );
}

export function Swatch({ color }: { color: string }) {
  return (
    <div
      className="w-4 h-4 rounded-sm border border-black"
      style={{
        backgroundColor: color,
      }}
    ></div>
  );
}

export const TriggerDropdownButton = forwardRef<
  undefined,
  { children?: ReactNode }
>((props, ref) => (
  <button
    {...props}
    // @ts-ignore
    ref={ref}
    className="rounded p-2 py-1 border border-gray-500 border-opacity-0 hover:border-opacity-50 flex items-center space-x-1 text-gray-300"
  />
));

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (number: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const [state, setState] = useState(value.toString());

  useEffect(() => {
    if (value.toString() !== state) {
      setState(value.toString());
    }
  }, [value]);

  return (
    <div className="text-gray-200">
      <input
        className="bg-gray-700 py-0 px-2 text-center rounded GUIEditorNumberInput"
        type="number"
        value={state}
        onChange={(e) => {
          setState(e.target.value);
          const value = parseFloat(e.target.value);
          if (!isNaN(value)) {
            onChange(value);
          }
        }}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

export function NumberSlider({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (number: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <Slider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      className="relative flex items-center select-none touch-none full h-5"
    >
      <Slider.Track className="bg-gray-800 bg-opacity-90 border-b border-gray-600  relative grow rounded h-1 w-full">
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb
        className="block w-3 h-3 rounded-full bg-gray-300  shadow  hover:bg-gray-100 focus:outline-none focus:shadow"
        style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
      />
    </Slider.Root>
  );
}

export function NumberSliderAndInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (number: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center space-x-1">
      <div className="flex-1 w-32 px-2">
        <NumberSlider
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={(step || 1) / 2}
        />
      </div>
      <NumberInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
