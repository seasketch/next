import { useTranslation } from "react-i18next";
import { ReportCardConfiguration } from "./cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useContext, useCallback, useRef, useEffect, useState } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import ReportCardBodyEditor from "../components/ReportCardBodyEditor";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import CollapsibleFooterAdmin from "../components/CollapsibleFooterAdmin";

type AdminConfig = ReportCardConfiguration<{
  presenceBody?: any;
  absenceBody?: any;
}>;

export default function PresenceCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  const langContext = useContext(FormLanguageContext);
  const [editingMode, setEditingMode] = useState<"presence" | "absence">(
    "presence"
  );

  // Use a ref to always get the current language code, even from debounced callbacks
  const langCodeRef = useRef<string>(langContext?.lang?.code || "EN");
  useEffect(() => {
    langCodeRef.current = langContext?.lang?.code || "EN";
  }, [langContext?.lang?.code]);

  // Get localized body for the current editing mode
  const getLocalizedBody = (mode: "presence" | "absence"): any => {
    const settingKey = mode === "presence" ? "presenceBody" : "absenceBody";
    const defaultBody =
      mode === "presence"
        ? config.componentSettings?.presenceBody
        : config.componentSettings?.absenceBody;

    if (
      langContext?.lang?.code &&
      langContext.lang.code !== "EN" &&
      config.alternateLanguageSettings?.[langContext.lang.code]?.[settingKey]
    ) {
      return config.alternateLanguageSettings[langContext.lang.code][
        settingKey
      ];
    }
    return defaultBody;
  };

  const localizedBody = getLocalizedBody(editingMode);

  const handleBodyUpdate = useCallback(
    (newBody: any) => {
      if (onUpdate) {
        const currentLangCode = langCodeRef.current;
        const settingKey =
          editingMode === "presence" ? "presenceBody" : "absenceBody";

        if (currentLangCode !== "EN") {
          // Save to alternateLanguageSettings for non-English languages
          onUpdate((prevState) => ({
            ...prevState,
            alternateLanguageSettings: {
              ...prevState.alternateLanguageSettings,
              [currentLangCode]: {
                ...prevState.alternateLanguageSettings[currentLangCode],
                [settingKey]: newBody,
              },
            },
          }));
        } else {
          // Save to componentSettings for English
          onUpdate((prevState) => ({
            ...prevState,
            componentSettings: {
              ...prevState.componentSettings,
              [settingKey]: newBody,
            },
          }));
        }
      }
    },
    [onUpdate, editingMode]
  );

  // Default bodies if not set
  const defaultPresenceBody = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Features from this layer are present within the sketch.",
          },
        ],
      },
    ],
  };

  const defaultAbsenceBody = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "No features from this layer overlap with the sketch.",
          },
        ],
      },
    ],
  };

  const bodyToEdit =
    localizedBody ||
    (editingMode === "presence" ? defaultPresenceBody : defaultAbsenceBody);

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">
          {t("Edit Content For")}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {t(
            "Switch between editing content for when features are present or absent."
          )}
        </p>
        <div className="flex gap-4">
          <div className="flex items-center">
            <input
              type="radio"
              id="presence"
              name="presence-mode"
              value="presence"
              checked={editingMode === "presence"}
              onChange={(e) =>
                setEditingMode(e.target.value as "presence" | "absence")
              }
              className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-purple-500 checked:border-purple-500 checked:bg-purple-500 appearance-none cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              style={{
                backgroundImage:
                  editingMode === "presence"
                    ? "radial-gradient(circle, white 35%, transparent 35%)"
                    : "none",
              }}
            />
            <label
              htmlFor="presence"
              className="pl-2 text-sm text-gray-700 cursor-pointer"
            >
              {t("Features Present")}
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              id="absence"
              name="presence-mode"
              value="absence"
              checked={editingMode === "absence"}
              onChange={(e) =>
                setEditingMode(e.target.value as "presence" | "absence")
              }
              className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-purple-500 checked:border-purple-500 checked:bg-purple-500 appearance-none cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              style={{
                backgroundImage:
                  editingMode === "absence"
                    ? "radial-gradient(circle, white 35%, transparent 35%)"
                    : "none",
              }}
            />
            <label
              htmlFor="absence"
              className="pl-2 text-sm text-gray-700 cursor-pointer"
            >
              {t("No Features Present")}
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">
          {editingMode === "presence"
            ? t("Content When Features Are Present")
            : t("Content When No Features Are Present")}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {editingMode === "presence"
            ? t(
                "This content will be displayed when features from the layer overlap with the sketch."
              )
            : t(
                "This content will be displayed when no features from the layer overlap with the sketch."
              )}
        </p>
        <div className="border border-gray-200 rounded-md p-3 bg-white">
          <ReportCardBodyEditor
            body={bodyToEdit}
            onUpdate={handleBodyUpdate}
            className="min-h-[100px]"
          />
        </div>
      </div>

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />

      <CollapsibleFooterAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
