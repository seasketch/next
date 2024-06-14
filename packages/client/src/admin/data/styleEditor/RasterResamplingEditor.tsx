import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import * as Editor from "./Editors";

export default function RasterResamplingEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: string) => void;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <Editor.Root>
      <Editor.Label
        title={<Trans ns="admin:data">Raster Resampling</Trans>}
        docs="https://docs.mapbox.com/style-spec/reference/layers/#paint-raster-raster-resampling"
      />
      <Editor.Control>
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="bg-gray-700 rounded text-sm py-1"
        >
          <option value="linear">{t("linear")}</option>
          <option value="nearest">{t("nearest")}</option>
        </select>
      </Editor.Control>
    </Editor.Root>
  );
}
