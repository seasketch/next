import {
  ReportCardConfiguration,
  useCardLocalizedStringAdmin,
  useLocalizedCardSetting,
} from "../cards/cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useReportContext } from "../ReportContext";

export default function InlineLocalizedInput({
  config,
  onUpdate,
  settingKey,
  fallback,
  className,
  cardId,
  inputProps,
}: {
  config: ReportCardConfiguration<any>;
  onUpdate?: ReportCardConfigUpdateCallback;
  settingKey: string;
  fallback: string;
  className?: string;
  cardId?: number;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const reportContext = useReportContext();
  const isSelectedForEditing =
    reportContext.selectedForEditing === (cardId ?? config.id);

  const localizedValue = useLocalizedCardSetting(
    config,
    settingKey as any,
    fallback
  );
  const { getInputValue, getPlaceholder, setValue } =
    useCardLocalizedStringAdmin(
      config,
      onUpdate || (((u: any) => config) as any)
    );

  if (!isSelectedForEditing || !onUpdate) {
    return <span className={className}>{localizedValue}</span>;
  }

  return (
    <input
      key={`inline-input-${config.id}-${settingKey}`}
      type="text"
      value={getInputValue(settingKey)}
      onChange={(e) => setValue(settingKey, e.target.value)}
      placeholder={getPlaceholder(settingKey, fallback)}
      className={`relative z-10 w-full bg-transparent border border-transparent hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-300 rounded-sm px-0 py-0 text-inherit placeholder:text-gray-400 truncate ${
        className || ""
      }`}
      {...inputProps}
    />
  );
}
