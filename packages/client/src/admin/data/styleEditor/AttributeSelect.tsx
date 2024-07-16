import { GeostatsAttribute } from "@seasketch/geostats-types";
import * as Editor from "./Editors";
import { ChevronDownIcon } from "@radix-ui/react-icons";

export default function AttributeSelect({
  attributes,
  value,
  onChange,
}: {
  attributes: GeostatsAttribute[];
  value?: string;
  onChange: (value: string) => void;
}) {
  const Select = Editor.Select;
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger>
        <Select.Value placeholder="Select an attribute" />
        <Select.Icon className="text-gray-300">
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
        >
          <Select.Viewport
            style={{
              maxWidth: 280,
              width: "auto",
            }}
          >
            {attributes.map((attr) => (
              <Select.Item
                key={attr.attribute}
                value={attr.attribute}
                style={{ maxWidth: 280, overflow: "hidden" }}
              >
                <div className="px-1 overflow-hidden max-w-full">
                  <Select.ItemText>{attr.attribute}</Select.ItemText>
                  {attr.type === "number" &&
                    attr.min !== undefined &&
                    attr.max !== undefined && (
                      <div className="text-sm text-gray-400 description">
                        {attr.min.toLocaleString()} -{" "}
                        {attr.max.toLocaleString()}
                      </div>
                    )}
                  {attr.type === "string" &&
                    attr.values &&
                    Object.keys(attr.values).length && (
                      <div className="text-sm text-gray-400 description overflow-hidden whitespace-nowrap pr-2">
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
