import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { getCardComponent } from "./registerCard";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";

export type ReportCardComponentProps = {
  title: string;
  tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  icon?: "info" | "warning" | "error";
  alternateLanguageSettings: { [langCode: string]: any };
  children: React.ReactNode;
};

// Icon mapping for named icons (no color classes, will inherit from parent)
const iconMap = {
  info: <InfoCircledIcon className="w-5 h-5" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5" />,
  error: <CrossCircledIcon className="w-5 h-5" />,
};

export default function ReportCard({
  title,
  tint = "text-black",
  backgroundTint,
  icon,
  alternateLanguageSettings,
  children,
}: ReportCardComponentProps) {
  const getBackgroundClasses = () => {
    switch (backgroundTint) {
      case "blue":
        return "bg-blue-50 border border-blue-500/10";
      case "yellow":
        return "bg-yellow-50 border border-yellow-400/15";
      case "red":
        return "bg-red-50 border border-red-500/10";
      default:
        return "bg-white";
    }
  };

  return (
    <div className={`rounded w-full shadow-sm ${getBackgroundClasses()}`}>
      <div className={`p-4 ${tint}`}>
        <div className="flex items-center space-x-2">
          {icon && iconMap[icon] && (
            <div className="flex-shrink-0">{iconMap[icon]}</div>
          )}
          {title && <h3 className="font-medium">{title}</h3>}
        </div>
      </div>
      <div className="p-4 text-sm pt-0">{children}</div>
    </div>
  );
}

export function ReportCardFactory({
  config,
}: {
  config: ReportCardConfiguration<any>;
}) {
  const { t } = useTranslation("admin:sketching");
  const cardType = config.type;
  const CardComponent = getCardComponent(cardType);
  if (!CardComponent) {
    return (
      <ReportCard
        title={t("Unknown Card Type")}
        alternateLanguageSettings={config.alternateLanguageSettings}
      >
        <div>
          <p>{t("Unknown Card Type: {{cardType}}", { cardType })}</p>
        </div>
      </ReportCard>
    );
  }
  return <CardComponent config={config} />;
}
