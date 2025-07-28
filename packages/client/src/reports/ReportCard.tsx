import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards/cards";
import { getCardComponent } from "./registerCard";
import { useReportContext } from "./ReportContext";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import { TrashIcon } from "@heroicons/react/outline";
import ReportCardTitleEditor from "./components/ReportCardTitleEditor";
import { FormLanguageContext } from "../formElements/FormElement";
import { useContext } from "react";

export type ReportCardComponentProps = {
  title: string;
  tint?: string; // Any Tailwind text color class
  backgroundTint?: "blue" | "yellow" | "red"; // Simple color enum
  icon?: "info" | "warning" | "error";
  alternateLanguageSettings: { [langCode: string]: any };
  children: React.ReactNode;
  dragHandleProps?: any; // Props from react-beautiful-dnd Draggable
  cardId?: number; // ID of the card for edit functionality
  onUpdate?: (config: ReportCardConfiguration<any>) => void; // Single update callback
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
  dragHandleProps,
  cardId,
  onUpdate,
  config,
}: ReportCardComponentProps & {
  config: ReportCardConfiguration<any>;
}) {
  const { t } = useTranslation("admin:sketching");
  const { adminMode, selectedForEditing, setSelectedForEditing, deleteCard } =
    useReportContext();
  const langContext = useContext(FormLanguageContext);

  // Get localized title
  let localizedTitle = title;
  if (
    langContext?.lang?.code !== "EN" &&
    alternateLanguageSettings[langContext?.lang?.code]?.title
  ) {
    localizedTitle = alternateLanguageSettings[langContext.lang.code].title;
  }

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

  // Create title update callback
  const handleTitleUpdate = (newTitle: string) => {
    if (onUpdate) {
      if (langContext?.lang?.code !== "EN") {
        // Save to alternateLanguageSettings for non-English languages
        const updatedConfig = {
          ...config,
          alternateLanguageSettings: {
            ...config.alternateLanguageSettings,
            [langContext.lang.code]: {
              ...config.alternateLanguageSettings[langContext.lang.code],
              title: newTitle,
            },
          },
        };
        onUpdate(updatedConfig);
      } else {
        // Save to main title for English
        onUpdate({
          ...config,
          title: newTitle,
        });
      }
    }
  };

  const isSelectedForEditing = selectedForEditing === cardId;
  const isDisabled = selectedForEditing && !isSelectedForEditing;

  return (
    <div
      className={`rounded w-full shadow-sm ${getBackgroundClasses()} group ${
        isSelectedForEditing ? "ring-2 ring-opacity-80 ring-blue-500" : ""
      } ${isDisabled ? "opacity-60 pointer-events-none select-none" : ""}`}
    >
      <div className={`p-4 pb-1 ${tint}`}>
        <div className="flex items-center space-x-2" {...dragHandleProps}>
          {icon && iconMap[icon] && (
            <div className="flex-shrink-0">{iconMap[icon]}</div>
          )}
          {localizedTitle &&
            (adminMode && isSelectedForEditing ? (
              <ReportCardTitleEditor
                title={localizedTitle}
                onUpdate={handleTitleUpdate}
                className={tint}
              />
            ) : (
              <h3
                className={`font-medium flex-1 ${
                  !selectedForEditing ? "cursor-move" : ""
                }`}
              >
                {localizedTitle}
              </h3>
            ))}
          {adminMode && !selectedForEditing && cardId && (
            <div className="flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
              {deleteCard && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCard(cardId);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  title={t("Delete card")}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedForEditing(cardId);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                title={t("Edit card")}
              >
                <Pencil1Icon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 text-sm pt-0">{children}</div>
    </div>
  );
}

export function ReportCardFactory({
  config,
  dragHandleProps,
  onUpdate,
}: {
  config: ReportCardConfiguration<any>;
  dragHandleProps?: any;
  onUpdate?: (config: ReportCardConfiguration<any>) => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const cardType = config.type;
  const CardComponent = getCardComponent(cardType);

  if (!CardComponent) {
    return (
      <ReportCard
        title={t("Unknown Card Type")}
        alternateLanguageSettings={config.alternateLanguageSettings}
        dragHandleProps={dragHandleProps}
        cardId={config.id}
        onUpdate={onUpdate}
        config={config}
      >
        <div>
          <p>{t("Unknown Card Type: {{cardType}}", { cardType })}</p>
        </div>
      </ReportCard>
    );
  }
  return (
    <CardComponent
      config={config}
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
    />
  );
}
