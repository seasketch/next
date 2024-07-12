import { CaretDownIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import * as Editor from "./Editors";

export default function RasterResamplingEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: string) => void;
}) {
  const Select = Editor.Select;
  const { t } = useTranslation("admin:data");
  return (
    <Editor.Root>
      <Editor.Label
        title={<Trans ns="admin:data">Raster Resampling</Trans>}
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-resampling"
      />
      <Editor.Control>
        <Select.Root
          value={value}
          onValueChange={(v) => {
            onChange(v);
          }}
        >
          <Select.Trigger>
            <Select.Value placeholder={t("Select a resampling method")} />
            <CaretDownIcon className="w-5 h-5" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content>
              <Select.Viewport>
                <Select.Item value="linear">
                  <Select.ItemText>{t("linear")}</Select.ItemText>
                </Select.Item>
                <Select.Item value="nearest">
                  <Select.ItemText>{t("nearest")}</Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Editor.Control>
    </Editor.Root>
  );
}
