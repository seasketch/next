import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Slider from "@radix-ui/react-slider";
import { Expression } from "mapbox-gl";
import { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

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
}: {
  children?: ReactNode;
  block?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${block ? "space-y-1" : "flex h-10"} items-center relative ${
        className ? className : ""
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
  return <div className="flex items-center text-sm">{children}</div>;
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
