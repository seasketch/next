import { GeostatsAttribute } from "@seasketch/geostats-types";
import * as Editor from "./Editors";
import { ChevronDownIcon } from "@radix-ui/react-icons";

export default function AttributeSelect({
  attributes,
  value,
  onChange,
  placeholder = "Select an attribute",
  appearance = "dark",
  includeNone = false,
  placeholderDescription,
}: {
  attributes: GeostatsAttribute[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  appearance?: "light" | "dark";
  includeNone?: boolean;
  placeholderDescription?: string;
}) {
  const Select = Editor.Select;
  const isLight = appearance === "light";
  const triggerClass = isLight
    ? "bg-white text-gray-700 border border-gray-300 hover:border-gray-400 focus:ring-blue-600"
    : "";
  const contentClass = isLight
    ? "bg-white text-gray-800 border border-gray-200 shadow-lg"
    : "";
  const iconClass = isLight ? "text-gray-500" : "text-gray-300";
  const itemTitleClass = isLight ? "text-gray-800" : "";
  const descClass = isLight
    ? "text-sm text-gray-600 description"
    : "text-sm text-gray-400 description";
  const wrapperTextClass = isLight ? "text-gray-800 focus:text-white" : "";
  const handleChange = (v: string) => {
    if (includeNone && v === "__none__") {
      onChange("");
    } else {
      onChange(v);
    }
  };

  return (
    <Select.Root value={value} onValueChange={handleChange}>
      <Select.Trigger className={triggerClass}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className={iconClass}>
          <ChevronDownIcon className="w-4 h-4" style={{ stroke: "none" }} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          // className="w-44"
          style={{
            stroke: "#555",
          }}
          sideOffset={5}
          className={contentClass}
        >
          <Select.Viewport
            style={{
              maxWidth: 280,
              width: "auto",
            }}
          >
            {includeNone && (
              <Select.Item
                key="__none__"
                value="__none__"
                style={{ maxWidth: 280, overflow: "hidden" }}
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
            {attributes.map((attr) => (
              <Select.Item
                key={attr.attribute}
                value={attr.attribute}
                style={{ maxWidth: 280, overflow: "hidden" }}
                className={wrapperTextClass}
              >
                <div className={`px-1 overflow-hidden max-w-full`}>
                  <Select.ItemText className={itemTitleClass}>
                    {attr.attribute}
                  </Select.ItemText>
                  {attr.type === "number" &&
                    attr.min !== undefined &&
                    attr.max !== undefined && (
                      <div className={descClass}>
                        {attr.min.toLocaleString()} -{" "}
                        {attr.max.toLocaleString()}
                      </div>
                    )}
                  {attr.type === "string" &&
                    attr.values &&
                    Object.keys(attr.values).length && (
                      <div
                        className={`${descClass} overflow-hidden whitespace-nowrap pr-2`}
                      >
                        {Object.keys(attr.values).slice(0, 10).join(", ")}
                      </div>
                    )}
                </div>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
