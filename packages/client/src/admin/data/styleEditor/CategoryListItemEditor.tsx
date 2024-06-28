import {
  ExpressionCategory,
  SeaSketchLayerMetadata,
  extractCategoriesFromExpression,
} from "./Editors";
import * as Popover from "@radix-ui/react-popover";
import { RgbaColorPicker } from "react-colorful";
import { colord } from "colord";
import {
  applyExcludedValuesToCategoryExpression,
  replaceColorForValueInExpression,
} from "./visualizationTypes";
import { Expression } from "mapbox-gl";
import {
  DragHandleDots2Icon,
  EyeClosedIcon,
  EyeOpenIcon,
} from "@radix-ui/react-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function CategoryListItemEditor({
  category,
  metadata,
  expression,
  onChange,
}: {
  category: ExpressionCategory;
  metadata?: SeaSketchLayerMetadata;
  expression: Expression;
  onChange: (expression: Expression, metadata: { [key: string]: any }) => void;
}) {
  const excluded = metadata?.["s:excluded"]?.includes(category.value);
  const labelOverrides: any = metadata?.["s:legend-labels"] || {};
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: category.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      className={`flex items-center justify-between p-2 px-0 w-full group space-x-2 ${
        excluded && "opacity-50 line-through"
      }`}
      ref={setNodeRef}
      style={style}
    >
      <DragHandleDots2Icon
        {...attributes}
        {...listeners}
        className={`w-5 h-5 text-gray-500 cursor-grab active:cursor-grabbing ${
          excluded ? "opacity-0 pointer-events-none" : ""
        }`}
      />
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
                    backgroundPosition: "0 0, 10px 0, 10px -10px, 0px 10px",
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
                const colorString = `rgba(${color.r},${color.g},${color.b},${
                  color.a === 1 ? "1.0" : color.a.toString()
                })`;
                const newExpression = replaceColorForValueInExpression(
                  expression,
                  category.value,
                  colorString
                );
                const colors = extractCategoriesFromExpression(
                  newExpression
                ).map((c) => c.color);
                onChange(newExpression, {
                  ...metadata,
                  "s:palette": colors,
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
          excluded ? "" : `opacity-0 group-hover:opacity-100 focus:opacity-100`
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
          const newExpression = applyExcludedValuesToCategoryExpression(
            expression,
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
            labelOverrides[category.value] ? labelOverrides[category.value] : ""
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
            onChange(expression, newMetadata);
          }}
        />
      </span>
    </li>
  );
}
