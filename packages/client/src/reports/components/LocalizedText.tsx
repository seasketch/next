import {
  ReportCardConfiguration,
  useLocalizedCardSetting,
} from "../cards/cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import InlineLocalizedInput from "./InlineLocalizedInput";

export default function LocalizedText({
  config,
  settingKey,
  fallback,
  editable,
  onUpdate,
  cardId,
  className,
}: {
  config: ReportCardConfiguration<any>;
  settingKey: string;
  fallback: string;
  editable?: boolean;
  onUpdate?: ReportCardConfigUpdateCallback;
  cardId?: number;
  className?: string;
}) {
  // Hooks must be called unconditionally across renders
  const text = useLocalizedCardSetting(config, settingKey as any, fallback);

  if (!editable) {
    return <span className={className}>{text}</span>;
  }

  return (
    <InlineLocalizedInput
      config={config}
      onUpdate={onUpdate}
      cardId={cardId}
      settingKey={settingKey}
      fallback={fallback}
      className={className}
    />
  );
}
