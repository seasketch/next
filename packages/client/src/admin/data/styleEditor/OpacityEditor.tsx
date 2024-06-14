import { Trans } from "react-i18next";
import * as Editor from "./Editors";

export function OpacityEditor({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Editor.Root>
      <Editor.Label title={<Trans ns="admin:data">Opacity</Trans>} />
      <Editor.Control>
        <input
          style={{ accentColor: "rgba(91, 102, 241)" }}
          type="range"
          value={value !== undefined ? value : 1}
          min={0}
          max={1}
          step={0.1}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </Editor.Control>
    </Editor.Root>
  );
}
