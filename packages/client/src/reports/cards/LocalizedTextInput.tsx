import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useCardLocalizedStringAdmin } from "./cards";

export default function LocalizedTextInput({
  config,
  onUpdate,
  settingKey,
  label,
  placeholderDefault,
  className,
}: {
  config: ReportCardConfiguration<any>;
  onUpdate: ReportCardConfigUpdateCallback;
  settingKey: string;
  label: string;
  placeholderDefault: string;
  className?: string;
}) {
  const { getInputValue, getPlaceholder, setValue } =
    useCardLocalizedStringAdmin(config, onUpdate);

  return (
    <div className={className}>
      <label className="text-sm text-gray-700">{label}</label>
      <input
        type="text"
        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        value={getInputValue(settingKey)}
        onChange={(e) => setValue(settingKey, e.target.value)}
        placeholder={getPlaceholder(settingKey, placeholderDefault)}
      />
    </div>
  );
}
