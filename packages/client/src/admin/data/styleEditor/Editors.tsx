import {
  ChevronDownIcon,
  FontFamilyIcon,
  InfoCircledIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import * as Slider from "@radix-ui/react-slider";
import { Expression } from "mapbox-gl";
import {
  CSSProperties,
  Dispatch,
  InputHTMLAttributes,
  ReactNode,
  SetStateAction,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
} from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixSelect from "@radix-ui/react-select";
import { SeaSketchGlLayer } from "../../../dataLayers/legends/compileLegend";
import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { LayerUpdater, PropertyRef } from "./GUIStyleEditor";
import { VisualizationType } from "./visualizationTypes";
import { TFunction } from "i18next";
import { Trans } from "react-i18next";
import { colord } from "colord";
import { formatColor } from "./FillStyleEditor";
import { RgbaColorPicker } from "react-colorful";
import { createPortal } from "react-dom";
require("./layer-editor.css");

export const CardButtonsPortalRef = createContext<HTMLDivElement | null>(null);

export function DocumentationInfo({ href }: { href: string }) {
  return (
    <a
      className="text-gray-500 hover:text-gray-300"
      href={href}
      target="_blank"
      rel="noreferrer"
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
  className,
}: {
  title: string | ReactNode;
  docs?: string;
  buttons?: ReactNode;
  tooltip?: string | ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`flex-1 flex items-center space-x-1 ${className}`}>
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
                sideOffset={3}
                className="bg-gray-900 bg-opacity-90 text-white select-none  p-2 px-3 text-sm z-50 rounded"
                style={{ maxWidth: 100 }}
              >
                {tooltip}
                <RadixTooltip.Arrow style={{ stroke: "rgba(17, 24, 39, 1)" }} />
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
  className,
  buttonsContainerRef,
}: {
  children: ReactNode;
  buttons?: ReactNode;
  className?: string;
  buttonsContainerRef?: (ref: HTMLDivElement) => void;
}) {
  return (
    <div className={`flex flex-1 group pb-2 ${className}`}>
      <h3
        className="capitalize text-lg flex-1 space-x-2 flex"
        ref={buttonsContainerRef}
      >
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
  style,
  ...rest
}: {
  className?: string;
  "aria-label"?: string;
  style?: CSSProperties;
}) {
  console.log("rest", rest);
  return (
    <Slider.Thumb
      {...rest}
      className={`block w-3 h-5 rounded bg-gray-300  shadow hover:bg-gray-100 focus:outline-none focus:shadow ${className}`}
      style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)", ...style }}
      aria-label={ariaLabel}
    />
  );
}

export function CardButtons({ children }: { children: ReactNode }) {
  const context = useContext(CardButtonsPortalRef);
  if (context) {
    return createPortal(children, context);
  } else {
    return null;
  }
}

export type ExpressionCategory = { value: string | number; color: string };

export type SeaSketchLayerMetadata = { [key: string]: any } & {
  "s:excluded"?: (string | number | boolean)[];
  "s:palette"?: string[] | string;
  "s:legend-labels"?: { [key: string]: string };
  "s:sorted-categories"?: any[];
  "s:reverse-palette"?: boolean;
  "s:respect-scale-and-offset"?: boolean;
  "s:round-numbers"?: boolean;
  "s:value-suffix"?: string;
  "s:steps"?: string;
  "s:color-auto"?: boolean;
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
    if (typeof color !== "string" || color === undefined) {
      continue;
    } else {
      categories.push({ value, color });
    }
  }
  return categories as ExpressionCategory[];
}

export const GUIEditorContext = createContext<{
  glLayers: SeaSketchGlLayer[];
  geostats: GeostatsLayer | RasterInfo;
  updateLayer: LayerUpdater;
  deleteLayerProperties: (idx: number, properties: PropertyRef[]) => void;
  addLayer: (index: number, layer: SeaSketchGlLayer) => void;
  removeLayer: (index: number) => void;
  type?: VisualizationType;
  t: TFunction;
  previousSettings: { [key: string]: any };
  setPreviousSettings: Dispatch<SetStateAction<{ [key: string]: any }>>;
  supportedTypes: VisualizationType[];
  setVisualizationType?: (type: VisualizationType) => void;
}>({
  glLayers: [],
  geostats: { bands: [] } as unknown as RasterInfo,
  updateLayer: () => {},
  addLayer: () => {},
  deleteLayerProperties: () => {},
  removeLayer: () => {},
  t: (key: string) => key,
  previousSettings: {},
  setPreviousSettings: () => {},
  supportedTypes: [],
  setVisualizationType: () => {},
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

export const Tooltip = {
  ...RadixTooltip,
  Content: forwardRef((props: RadixTooltip.TooltipContentProps, ref) => (
    <RadixTooltip.Content
      {...props}
      // @ts-ignore
      className={`bg-gray-700 bg-opacity-90 text-white rounded z-50 text-sm p-2 ${props.className}`}
      style={{ backdropFilter: "blur(4px)" }}
      // @ts-ignore
      ref={ref}
    />
  )),
  Arrow: forwardRef((props: RadixTooltip.TooltipArrowProps, ref) => (
    <RadixTooltip.Arrow
      {...props}
      // @ts-ignore
      ref={ref}
      style={{
        fill: "rgb(55, 65, 81)",
      }}
    />
  )),
};

export const Select = {
  ...RadixSelect,
  Trigger: forwardRef((props: RadixSelect.SelectTriggerProps, ref) => (
    <RadixSelect.Trigger
      {...props}
      // @ts-ignore
      ref={ref}
      className={`inline-flex items-center justify-center rounded px-2.5 text-sm leading-none h-8 gap-1 text-gray-300 border border-gray-500 border-opacity-0 hover:border-opacity-50  outline-none focus:ring-2 focus:border-transparent ring-blue-600 ${props.className}`}
    />
  )),
  Content: forwardRef((props: RadixSelect.SelectContentProps, ref) => (
    <RadixSelect.Content
      position="popper"
      {...props}
      // @ts-ignore
      // className="PaletteSelectContent overflow-hidden bg-white  rounded-md shadow z-50"

      className={`PaletteSelectContent overflow-hidden bg-gray-700 border border-white border-opacity-20 text-white bg-opacity-80 rounded-md shadow z-50 ${props.className}`}
      style={{
        backdropFilter: "blur(8px)",
        stroke: "white",
      }}
      // @ts-ignore
      ref={ref}
    />
  )),
  Viewport: forwardRef((props: RadixSelect.SelectViewportProps, ref) => (
    <RadixSelect.Viewport
      {...props}
      // @ts-ignore
      className={`p-1 LayerEditorPalette ${props.className}`}
      // @ts-ignore
      ref={ref}
    />
  )),
  Item: forwardRef((props: RadixSelect.SelectItemProps, ref) => (
    <RadixSelect.Item
      {...props}
      // @ts-ignore
      className={`text-sm leading-none rounded flex items-start flex-col justify-center relative select-none bg-opacity-30 border border-transparent p-1 py-1.5 ${props.className}`}
      // @ts-ignore
      ref={ref}
      style={{ minWidth: 80 }}
    />
  )),
};

export function TextInput(
  props: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    type?: string;
  } & InputHTMLAttributes<HTMLInputElement>
) {
  const { value, onValueChange, className, ...rest } = props;
  return (
    <input
      value={value || ""}
      onChange={
        onValueChange ? (e) => onValueChange(e.target.value) : undefined
      }
      className={`bg-gray-700 py-0.5 px-2 text-sm rounded border border-opacity-10 focus:border-transparent focus:ring-offset-0 focus:ring-2 focus:ring-blue-600 focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function CustomExpressionIndicator({
  onClear,
}: {
  onClear?: () => void;
}) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger asChild>
          <div className="flex items-center border border-gray-600 rounded hover:border-gray-500">
            <div className="flex items-center bg-gray-900 bg-opacity-30 p-0 border-r border-gray-600 px-2 py-1">
              <FontFamilyIcon />
              <span
                style={{ bottom: -1, left: -1 }}
                className="font-mono text-xs relative"
              >
                []
              </span>
            </div>
            <span className="px-2 py-1">
              <Trans ns="admin:data">Custom Expression</Trans>
            </span>
          </div>
        </Tooltip.Trigger>
        {onClear && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={30}
              className="bg-gray-800 bg-opacity-90 text-white rounded z-50 text-sm px-4 py-2"
              style={{ backdropFilter: "blur(4px)" }}
            >
              <p className="w-72">
                <Trans ns="admin:data">
                  A custom expression function is being used for this property.
                  You can switch to the code editor to modify it, or delete the
                  expression so you may use the graphical editor.
                </Trans>
              </p>
              <button
                className="text-indigo-200 py-2 hover:underline flex items-center space-x-1"
                onClick={onClear}
              >
                <TrashIcon className="w-4 h-4" />
                <span>
                  <Trans ns="admin:data">Clear expression</Trans>
                </span>
              </button>
              <Tooltip.TooltipArrow style={{ fill: "rgb(31, 41, 55)" }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function Swatch({ color, auto }: { color: string; auto?: boolean }) {
  const isDark = colord(color).isDark();
  return (
    <div
      className="w-4 h-4 rounded-sm border border-black flex items-center justify-center text-xs"
      style={{
        backgroundColor: color,
      }}
    >
      <span className={isDark ? "text-white" : "text-black"}>
        {auto && "a"}
      </span>
    </div>
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
      <Thumb />
      {/* <Slider.Thumb
        className="block w-3 h-3 rounded-full bg-gray-300  shadow  hover:bg-gray-100 focus:outline-none focus:shadow"
        style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.5)" }}
      /> */}
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
          step={step}
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

export function ColorPicker({
  color,
  onChange,
  defaultColor,
}: {
  color?: string;
  defaultColor: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <TriggerDropdownButton>
          <span
            className="w-18 text-right overflow-hidden"
            style={{
              fontVariantNumeric: "tabular-nums",
              wordSpacing: "-3px",
            }}
          >
            {formatColor(color, defaultColor)}
          </span>
          {color !== "transparent" ? (
            <Swatch color={color || defaultColor} />
          ) : null}
          <ChevronDownIcon />
        </TriggerDropdownButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right">
          <RgbaColorPicker
            color={colord(color || defaultColor).toRgb()}
            onChange={(color) => {
              onChange(colord(color).toRgbString());
            }}
          />
          <Popover.Arrow />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
