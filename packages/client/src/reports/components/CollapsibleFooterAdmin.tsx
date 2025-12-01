import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "../cards/cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import Switch from "../../components/Switch";
import { useCardLocalizedStringAdmin } from "../cards/cards";

interface CollapsibleFooterAdminProps {
  config: ReportCardConfiguration<any>;
  onUpdate: ReportCardConfigUpdateCallback;
}

export default function CollapsibleFooterAdmin({
  config,
  onUpdate,
}: CollapsibleFooterAdminProps) {
  const { t } = useTranslation("admin:sketching");
  const { getInputValue, getPlaceholder, setValue } =
    useCardLocalizedStringAdmin(config, onUpdate);

  const isEnabled = Boolean(config.collapsibleFooterEnabled);

  return (
    <div className="space-y-6">
      <div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              {t("Collapsible Footer")}
            </label>
            <p className="text-xs text-gray-500">
              {t(
                "Enable a 'Learn More' expandable section at the bottom of the card. If enabled, you can edit the contents directly from the card."
              )}
            </p>
          </div>
          <Switch
            isToggled={isEnabled}
            onClick={(enabled: boolean) => {
              onUpdate((prev) => ({
                ...prev,
                collapsibleFooterEnabled: enabled,
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
