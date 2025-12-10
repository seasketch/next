import { Trans, useTranslation } from "react-i18next";
import { TextBlockCardConfiguration } from "./TextBlockCard";
import {
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";
import { ReportCardConfigUpdateCallback } from "../registerCard";

interface TextBlockCardAdminProps {
  config: TextBlockCardConfiguration;
  onUpdate: ReportCardConfigUpdateCallback;
}

export default function TextBlockCardAdmin({
  config,
  onUpdate,
}: TextBlockCardAdminProps) {
  const { t } = useTranslation("admin:sketching");
  const { presentation } = config.componentSettings;

  const presentationTypes = [
    {
      value: "default" as const,
      label: t("Default"),
      icon: null,
      className: "bg-white border-gray-200 hover:bg-gray-50",
      activeClassName: "border-blue-500 ",
    },
    {
      value: "info" as const,
      label: t("Info"),
      icon: <InfoCircledIcon className="w-4 h-4 text-blue-600" />,
      className: "bg-blue-50 border-blue-200 hover:bg-blue-100",
      activeClassName: "border-blue-500 bg-blue-100",
    },
    {
      value: "warning" as const,
      label: t("Warning"),
      icon: <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600" />,
      className: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
      activeClassName: "border-yellow-500 bg-yellow-100",
    },
    {
      value: "error" as const,
      label: t("Error"),
      icon: <CrossCircledIcon className="w-4 h-4 text-red-600" />,
      className: "bg-red-50 border-red-200 hover:bg-red-100",
      activeClassName: "border-red-500 bg-red-100",
    },
  ];

  const handlePresentationChange = (newPresentation: typeof presentation) => {
    onUpdate((prevState) => ({
      ...prevState,
      componentSettings: {
        ...prevState.componentSettings,
        presentation: newPresentation,
      },
    }));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t("Presentation Style")}
      </label>
      <div className="flex flex-col space-y-2">
        {presentationTypes.map((type) => {
          const isActive = presentation === type.value;
          return (
            <button
              key={type.value}
              onClick={() => handlePresentationChange(type.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                isActive ? type.activeClassName : type.className
              } ${isActive ? "ring outline-blue-500" : ""}`}
              title={type.label}
            >
              <div className="flex items-center space-x-2">
                {type.icon}
                <span>{type.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
