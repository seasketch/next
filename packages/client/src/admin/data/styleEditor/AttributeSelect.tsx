import { GeostatsAttribute } from "@seasketch/geostats-types";
import { CSSProperties } from "react";
import * as Editor from "./Editors";
import { ChevronDownIcon } from "@radix-ui/react-icons";

const UNAVAILABLE_PREFIX = "__unavailable__:";

export type AttributeAvailability = {
  available: boolean;
  hint?: string;
};

function attributeExampleText(attr: GeostatsAttribute): string | null {
  if (
    attr.type === "number" &&
    attr.min !== undefined &&
    attr.max !== undefined
  ) {
    return attr.min.toLocaleString() + " - " + attr.max.toLocaleString();
  }
  const samples = Object.keys(attr.values || {}).slice(0, 10);
  if (samples.length > 0) {
    return samples.join(", ");
  }
  return null;
}

export default function AttributeSelect({
  attributes,
  value,
  onChange,
  placeholder = "Select an attribute",
  appearance = "dark",
  includeNone = false,
  placeholderDescription,
  id,
  disabled = false,
  fullWidth = false,
  triggerClassName,
  contentClassName,
  contentStyle,
  contentMaxWidth = 280,
  attributeAvailability,
  onUnavailableAttributeActivate,
}: {
  attributes: GeostatsAttribute[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  appearance?: "light" | "dark";
  includeNone?: boolean;
  placeholderDescription?: string;
  id?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  contentMaxWidth?: number;
  attributeAvailability?: (attr: GeostatsAttribute) => AttributeAvailability;
  onUnavailableAttributeActivate?: (attr: GeostatsAttribute) => void;
}) {
  const Select = Editor.Select;
  const isLight = appearance === "light";
  const triggerClass = [
    isLight
      ? "bg-white text-gray-700 border !border-black/15 hover:!border-gray-400 focus:ring-blue-600"
      : "",
    fullWidth ? "!flex h-[2.375rem] w-full !justify-between" : "",
    triggerClassName || "",
  ]
    .filter(Boolean)
    .join(" ");
  const contentClass = isLight
    ? [
        "bg-white text-gray-800 !border !border-black/10 shadow-lg",
        contentClassName || "",
      ]
        .filter(Boolean)
        .join(" ")
    : contentClassName || "";
  const iconClass = isLight ? "text-gray-500" : "text-gray-300";
  const itemTitleClass = isLight ? "text-gray-800" : "";
  const descClass = isLight
    ? "text-sm text-gray-600 description"
    : "text-sm text-gray-400 description";
  const wrapperTextClass = isLight ? "text-gray-800 focus:text-white" : "";
  const canActivateUnavailable = Boolean(onUnavailableAttributeActivate);
  const itemMaxWidth = { maxWidth: contentMaxWidth, overflow: "hidden" };
  const rootValue = includeNone && !value ? "__none__" : value || undefined;

  const handleChange = (v: string) => {
    if (includeNone && v === "__none__") {
      onChange("");
      return;
    }
    if (v.startsWith(UNAVAILABLE_PREFIX)) {
      const name = v.slice(UNAVAILABLE_PREFIX.length);
      const attr = attributes.find((item) => item.attribute === name);
      if (attr) {
        onUnavailableAttributeActivate?.(attr);
      }
      return;
    }
    onChange(v);
  };

  return (
    <Select.Root
      value={rootValue}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <Select.Trigger id={id} className={triggerClass}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className={iconClass}>
          <ChevronDownIcon className="w-4 h-4" style={{ stroke: "none" }} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          onCloseAutoFocus={(event) => event.preventDefault()}
          style={{
            stroke: "#555",
            ...contentStyle,
          }}
          sideOffset={5}
          className={contentClass}
        >
          <Select.Viewport
            style={{
              maxWidth: contentMaxWidth,
              width: "auto",
            }}
          >
            {includeNone && (
              <Select.Item
                key="__none__"
                value="__none__"
                style={itemMaxWidth}
                className={wrapperTextClass}
              >
                <div className={`px-1 overflow-hidden max-w-full`}>
                  <Select.ItemText className={itemTitleClass}>
                    {placeholder}
                  </Select.ItemText>
                  {placeholderDescription && (
                    <div className={descClass}>{placeholderDescription}</div>
                  )}
                </div>
              </Select.Item>
            )}
            {attributes.map((attr) => {
              const availability = attributeAvailability?.(attr) || {
                available: true,
              };
              const unavailable = !availability.available;
              const activateUnavailable =
                unavailable && canActivateUnavailable;
              const example = attributeExampleText(attr);
              return (
                <Select.Item
                  key={attr.attribute}
                  value={
                    activateUnavailable
                      ? UNAVAILABLE_PREFIX + attr.attribute
                      : attr.attribute
                  }
                  disabled={unavailable && !activateUnavailable}
                  data-unavailable={unavailable ? "true" : undefined}
                  title={availability.hint}
                  style={itemMaxWidth}
                  className={wrapperTextClass}
                >
                  <div className={`px-1 overflow-hidden max-w-full`}>
                    <Select.ItemText className={itemTitleClass}>
                      {attr.attribute}
                    </Select.ItemText>
                    {example && (
                      <div
                        className={
                          descClass +
                          " overflow-hidden whitespace-nowrap pr-2"
                        }
                      >
                        {example}
                      </div>
                    )}
                    {unavailable && availability.hint ? (
                      <div className={descClass + " pt-0.5 text-amber-200"}>
                        {availability.hint}
                      </div>
                    ) : null}
                  </div>
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
