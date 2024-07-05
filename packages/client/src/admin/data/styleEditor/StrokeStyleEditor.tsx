import { Trans, useTranslation } from "react-i18next";
import * as Editor from "./Editors";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { StrokeType } from "./StrokeEditor";

const Select = Editor.Select;

export default function StrokeStyleEditor({
  value,
  dasharray,
  onChange,
}: {
  value: StrokeType;
  dasharray?: string;
  onChange: (value: StrokeType, dasharray?: string) => void;
}) {
  const { t } = useTranslation("admin:data");

  const isCustomDashArray =
    dasharray && !DASHARRAYS.find((d) => d.mapbox.join(",") === dasharray);

  return (
    <Editor.Root>
      <Editor.Label title={t("Stroke Style")} />
      <Editor.Control>
        <Select.Root
          value={value}
          onValueChange={(value) => {
            if (value === "None") {
              onChange(StrokeType.None);
            } else if (value === "Outline") {
              onChange(StrokeType.Outline);
            } else if (value === "Solid") {
              onChange(StrokeType.Solid);
            } else {
              if (value === "0,2") {
                onChange(StrokeType.Dotted, value);
              } else {
                onChange(StrokeType.Dashed, value);
              }
            }
          }}
        >
          <Select.Trigger className="w-32" aria-label="Stroke Style">
            <Select.Value placeholder="None" />
            <Select.Icon className="text-gray-500">
              <ChevronDownIcon className="w-4 h-4" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content position="popper" className="w-32" sideOffset={5}>
              <Select.ScrollUpButton />
              <Select.Viewport>
                <Select.Item value="None">
                  <Select.ItemText>
                    <div className="flex">
                      <Trans ns="admin:data">None</Trans>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                <Select.Item value="Outline">
                  <Select.ItemText>
                    <div className="flex h-full overflow-hidden items-center space-x-2">
                      <span className="flex-1">{t("Outline")}</span>
                      <svg width="flex-2" height="10">
                        <line
                          strokeWidth={0.5}
                          x1="0"
                          y1="5"
                          x2="100%"
                          y2="5"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                {isCustomDashArray && (
                  <Select.Item value={value}>
                    <Select.ItemText>
                      <div className="flex">
                        <Trans ns="admin:data">Custom Dash Array</Trans>
                      </div>
                    </Select.ItemText>
                  </Select.Item>
                )}
                <Select.Item value="Solid">
                  <Select.ItemText>
                    <div className="flex items-center space-x-2">
                      <span className="flex-1">{t("Solid")}</span>
                      <svg width="flex-2" height="10">
                        <line
                          strokeWidth={2}
                          x1="0"
                          y1="5"
                          x2="100%"
                          y2="5"
                          stroke="#888"
                        />
                      </svg>
                    </div>
                  </Select.ItemText>
                </Select.Item>
                {DASHARRAYS.map((dasharray) => (
                  <Select.Item
                    key={dasharray.mapbox.join(",")}
                    value={dasharray.mapbox.join(",")}
                  >
                    <Select.ItemText>
                      <div className="flex">
                        <svg width="100%" height="10">
                          <line
                            strokeWidth={2}
                            strokeDasharray={dasharray.svg}
                            x1="0"
                            y1="5"
                            x2="100%"
                            y2="5"
                            stroke="#888"
                          />
                        </svg>
                      </div>
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Editor.Control>
    </Editor.Root>
  );
}

export const DASHARRAYS = [
  {
    mapbox: [4, 4],
    svg: "6,6",
  },
  {
    mapbox: [4, 2],
    svg: "6,2",
  },
  {
    mapbox: [0, 2],
    svg: "2,2",
  },
];
