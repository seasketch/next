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
          className="w-32"
          sideOffset={5}
          style={{ stroke: "#555" }}
        >
          {attributes.map((attr) => (
            <Select.Item key={attr.attribute} value={attr.attribute}>
              <Select.ItemText>{attr.attribute}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
