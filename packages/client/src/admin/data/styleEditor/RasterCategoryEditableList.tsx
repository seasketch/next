import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import { Expression } from "mapbox-gl";
import { useMemo } from "react";
import { Cross1Icon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import {
  applyExcludedValuesToCategoryExpression,
  replaceColorForValueInExpression,
} from "./visualizationTypes";
import * as Popover from "@radix-ui/react-popover";
import { RgbaColorPicker } from "react-colorful";
import { colord } from "colord";

export function RasterCategoryEditableList({
  rasterColorExpression,
  metadata,
  onChange,
}: {
  rasterColorExpression: Expression;
  metadata?: { [key: string]: any };
  onChange: (expression: Expression, metadata: { [key: string]: any }) => void;
}) {
  const categories = useMemo(() => {
    return extractCategoriesFromExpression(rasterColorExpression);
  }, [rasterColorExpression]);

  return (
    <Editor.Root block className="pt-3">
      <div className="border rounded border-gray-500 p-4 bg-gray-700">
        <Editor.Label title={<Trans ns="admin:data">Categories</Trans>} />
        <Editor.Control>
          <ul className="w-full px-2 py-2">
            {categories.map((category, i) => {
              const excluded = metadata?.["s:excluded"]?.includes(
                category.value
              );
              const labelOverrides: any = metadata?.["s:legend-labels"] || {};
              return (
                <li
                  key={i}
                  className={`flex items-center justify-between p-2 px-0 w-full group space-x-1 ${
                    excluded && "opacity-50 line-through"
                  }`}
                >
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        tabIndex={1}
                        className="w-5 h-5 rounded mr-2"
                        style={
                          excluded || category.color === "transparent"
                            ? {
                                backgroundImage: `
                                linear-gradient(45deg, lightgrey 25%, transparent 25%), 
                                linear-gradient(135deg, lightgrey 25%, transparent 25%),
                                linear-gradient(45deg, transparent 75%, lightgrey 75%),
                                linear-gradient(135deg, transparent 75%, lightgrey 75%)`,
                                backgroundSize: "20px 20px",
                                backgroundPosition:
                                  "0 0, 10px 0, 10px -10px, 0px 10px",
                              }
                            : {
                                backgroundColor: category.color,
                              }
                        }
                      ></button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="rounded-lg p-0.5 z-50 bg-gray-500 shadow-xl"
                        sideOffset={5}
                      >
                        <RgbaColorPicker
                          color={colord(category.color).toRgb()}
                          onChange={(color) => {
                            const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
                            const newExpression =
                              replaceColorForValueInExpression(
                                rasterColorExpression,
                                category.value,
                                colorString
                              );
                            onChange(newExpression, {
                              ...metadata,
                              "s:palette": undefined,
                            });
                          }}
                        />
                        <Popover.Arrow style={{ fill: "rgb(107, 114, 128)" }} />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                  <button
                    tabIndex={2}
                    className={
                      excluded
                        ? ""
                        : `opacity-0 group-hover:opacity-100 focus:opacity-100`
                    }
                    onClick={() => {
                      let excludedValues = metadata?.["s:excluded"] || [];
                      if (excluded) {
                        excludedValues = excludedValues.filter(
                          (v: string | number) => v !== category.value
                        );
                      } else {
                        excludedValues.push(category.value);
                      }
                      const newMetadata: { [key: string]: any } = {
                        ...metadata,
                        "s:excluded": excludedValues,
                      };
                      const newExpression =
                        applyExcludedValuesToCategoryExpression(
                          rasterColorExpression,
                          newMetadata["s:excluded"] || [],
                          newMetadata["s:palette"]
                        );
                      onChange(newExpression, newMetadata);
                    }}
                  >
                    {excluded ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                  <span className="flex-1 text-right">
                    <input
                      tabIndex={3}
                      type="text"
                      className="bg-gray-700 p-0.5 text-sm text-right border-none"
                      placeholder={category.value.toString()}
                      value={
                        labelOverrides[category.value]
                          ? labelOverrides[category.value]
                          : ""
                      }
                      onChange={(e) => {
                        const label = e.target.value;
                        const newMetadata = {
                          ...metadata,
                          "s:legend-labels": {
                            ...labelOverrides,
                            [category.value]: label,
                          },
                        };
                        if (!label || label.trim().length === 0) {
                          delete newMetadata["s:legend-labels"][category.value];
                        }
                        onChange(rasterColorExpression, newMetadata);
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Editor.Control>
      </div>
    </Editor.Root>
  );
}

function extractCategoriesFromExpression(expression: Expression) {
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
  return categories;
}
