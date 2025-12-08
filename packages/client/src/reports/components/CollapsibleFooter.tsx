import { useState, useContext, useCallback, useRef, useEffect } from "react";
import { ReportCardConfiguration } from "../cards/cards";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { FormLanguageContext } from "../../formElements/FormElement";
import ReportCardBodyEditor from "./ReportCardBodyEditor";
import ReportCardBodyViewer from "./ReportCardBodyViewer";
import { useReportContext } from "../ReportContext";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";

interface CollapsibleFooterProps {
  config: ReportCardConfiguration<any>;
  onUpdate?: ReportCardConfigUpdateCallback;
}

export default function CollapsibleFooter({
  config,
  onUpdate,
}: CollapsibleFooterProps) {
  // All hooks must be called unconditionally before any early returns
  const { adminMode, selectedForEditing } = useReportContext();
  const langContext = useContext(FormLanguageContext);
  const { t } = useTranslation("reports");
  const isSelectedForEditing = selectedForEditing === config.id;

  // Use a ref to always get the current language code, even from debounced callbacks
  const langCodeRef = useRef<string>(langContext?.lang?.code || "EN");
  useEffect(() => {
    langCodeRef.current = langContext?.lang?.code || "EN";
  }, [langContext?.lang?.code]);

  // Auto-expand when in edit mode, otherwise allow manual toggle
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldBeExpanded =
    adminMode && isSelectedForEditing ? true : isExpanded;

  // Get localized body
  const getLocalizedBody = (): any => {
    if (
      langContext?.lang?.code &&
      langContext.lang.code !== "EN" &&
      config.alternateLanguageSettings?.[langContext.lang.code]
        ?.collapsibleFooterBody
    ) {
      return config.alternateLanguageSettings[langContext.lang.code]
        .collapsibleFooterBody;
    }
    return config.collapsibleFooterBody;
  };

  const localizedBody = getLocalizedBody();

  const handleBodyUpdate = useCallback(
    (newBody: any) => {
      if (onUpdate) {
        // Always read the current language code from ref, not from closure
        // This ensures debounced saves use the current language, not a stale one
        const currentLangCode = langCodeRef.current;

        if (currentLangCode !== "EN") {
          // Save to alternateLanguageSettings for non-English languages
          onUpdate((prevState) => ({
            ...prevState,
            alternateLanguageSettings: {
              ...prevState.alternateLanguageSettings,
              [currentLangCode]: {
                ...prevState.alternateLanguageSettings[currentLangCode],
                collapsibleFooterBody: newBody,
              },
            },
          }));
        } else {
          onUpdate((prevState) => ({
            ...prevState,
            collapsibleFooterBody: newBody,
          }));
        }
      }
    },
    [onUpdate]
  );

  // Helper function to extract footer title from prosemirror body
  const extractFooterTitle = (body: any): string => {
    if (
      body &&
      body.type === "doc" &&
      "content" in body &&
      Array.isArray(body.content) &&
      body.content.length > 0
    ) {
      for (const node of body.content) {
        if (
          node.type === "footerTitle" &&
          node.content &&
          node.content.length > 0
        ) {
          return node.content[0].text || "";
        }
      }
    }
    return "";
  };

  // Don't render if not enabled
  if (!config.collapsibleFooterEnabled) {
    return null;
  }

  // Extract title from prosemirror body, fallback to "Learn More"
  const localizedTitle = extractFooterTitle(localizedBody) || t("Learn More");

  // In edit mode, always show the footer (even if no content yet)
  // In view mode, only show if there's content
  const shouldShow =
    adminMode && isSelectedForEditing ? true : Boolean(localizedBody);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`mt-2 pt-2 ${""}`}>
      {adminMode && isSelectedForEditing ? (
        ""
      ) : (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          disabled={adminMode && isSelectedForEditing}
          className={`w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition-colors  ${
            adminMode && isSelectedForEditing ? "cursor-default" : ""
          }`}
          aria-expanded={shouldBeExpanded}
        >
          {adminMode && isSelectedForEditing ? (
            <span></span>
          ) : (
            <span className="font-medium">{localizedTitle}</span>
          )}
          {shouldBeExpanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </button>
      )}
      {shouldBeExpanded && (
        <div
          className={`text-sm text-gray-700 ${
            adminMode && isSelectedForEditing
              ? `-mt-3 ${isExpanded ? "" : "-mb-2"}`
              : "mt-2"
          }`}
        >
          {adminMode && isSelectedForEditing ? (
            <ReportCardBodyEditor
              body={
                localizedBody || {
                  type: "doc",
                  content: [
                    {
                      type: "footerTitle",
                      content: [],
                    },
                  ],
                }
              }
              onUpdate={handleBodyUpdate}
              isFooter={true}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
            />
          ) : (
            localizedBody && (
              <ReportCardBodyViewer
                body={localizedBody}
                isFooter
                className="ReportCardBody ProseMirrorBody"
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
