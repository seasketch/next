import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Slider from "@radix-ui/react-slider";
import { Expression } from "mapbox-gl";
import { ReactNode } from "react";

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
}: {
  title: string | ReactNode;
  docs?: string;
  buttons?: ReactNode;
}) {
  return (
    <h3 className="flex-1 flex items-center space-x-1">
      <span>{title}</span>
      {docs && <DocumentationInfo href={docs} />}
      {buttons && (
        <div className="flex-1 flex items-center justify-end">{buttons}</div>
      )}
    </h3>
  );
}

export function Control({ children }: { children?: ReactNode }) {
  return <div className="flex items-center text-sm">{children}</div>;
}

export function Header({ title }: { title: string | ReactNode }) {
  return <h4 className="text-sm font-semibold py-3">{title}</h4>;
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
