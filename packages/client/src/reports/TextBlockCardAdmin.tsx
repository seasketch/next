import { Trans } from "react-i18next";
import { TextBlockCardConfiguration } from "./TextBlockCard";

interface TextBlockCardAdminProps {
  config: TextBlockCardConfiguration;
  onUpdate: (config: TextBlockCardConfiguration) => void;
}

export default function TextBlockCardAdmin({
  config,
  onUpdate,
}: TextBlockCardAdminProps) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Text Block Settings</h3>
      <div className="space-y-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={config.componentSettings.presentation === "default"}
            onChange={(e) =>
              onUpdate({
                ...config,
                componentSettings: {
                  ...config.componentSettings,
                  presentation: e.target.checked ? "default" : "info",
                },
              })
            }
            className="mr-2"
          />
          <Trans ns="admin:sketching">Use default presentation</Trans>
        </label>
      </div>
    </div>
  );
}
