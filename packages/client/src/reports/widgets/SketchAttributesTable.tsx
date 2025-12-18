import { useContext, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { useReportContext } from "../ReportContext";
import { FormLanguageContext } from "../../formElements/FormElement";
import type { ReportWidget } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";

type SketchAttributesTableSettings = {
  /**
   * IDs of attributes to hide from the table.
   */
  hiddenAttributeIds?: number[];
};

type FormElement = {
  id: number;
  typeId: string;
  isInput: boolean;
  position: number;
  generatedLabel: string;
  alternateLanguageSettings?: Record<string, { body?: any }>;
};

export const SketchAttributesTable: ReportWidget<
  SketchAttributesTableSettings
> = ({ componentSettings }) => {
  const { t } = useTranslation("reports");
  const { sketchClass, sketch } = useReportContext();
  const langContext = useContext(FormLanguageContext);

  const hiddenIds = new Set(componentSettings?.hiddenAttributeIds || []);

  const allFormElements = useMemo(() => {
    const formElements = (sketchClass?.form?.formElements ||
      []) as FormElement[];
    return formElements
      .filter((element) => element.typeId !== "FeatureName")
      .filter((element) => element.isInput)
      .sort((a, b) => a.position - b.position);
  }, [sketchClass?.form?.formElements]);

  const visibleFormElements = useMemo(
    () => allFormElements.filter((el) => !hiddenIds.has(el.id)),
    [allFormElements, hiddenIds]
  );

  const values = (sketch?.properties || {}) as Record<string, any>;

  if (!sketchClass || !sketch) {
    return null;
  }

  if (allFormElements.length === 0) {
    return (
      <div className="border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No attributes found.</Trans>
      </div>
    );
  }

  return (
    <div className="my-2">
      <div className="border border-black/10 rounded-lg overflow-hidden shadow-sm bg-white">
        <table className="w-full text-sm">
          <tbody>
            {visibleFormElements.map((element, idx) => {
              const label = getAttributeLabel(element, langContext?.lang?.code);
              const value = values[String(element.id)];
              const displayType = ["TextArea", "ShortText"].includes(
                element.typeId
              )
                ? "block"
                : "inline";
              const formatted = formatValue(value);

              const zebra = idx % 2 === 0 ? "bg-white" : "bg-gray-50/60";

              if (displayType === "block") {
                return (
                  <tr key={element.id} className={zebra}>
                    <td className="px-3 py-2">
                      <div className="text-xs font-semibold text-gray-600">
                        {label}
                      </div>
                      <div className="mt-1 text-gray-800 whitespace-pre-wrap break-words">
                        {formatted}
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={element.id} className={zebra}>
                  <td className="px-3 py-2 font-medium text-gray-700 align-top w-[55%]">
                    {label}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-right align-top w-[45%]">
                    {formatted}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleFormElements.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 italic">
          {t("No attributes selected")}
        </div>
      )}
    </div>
  );
};

export const SketchAttributesTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate }) => {
    const { t } = useTranslation("admin:sketching");
    const { sketchClass } = useReportContext();
    const langContext = useContext(FormLanguageContext);

    const componentSettings: SketchAttributesTableSettings =
      node.attrs?.componentSettings || {};
    const hidden = new Set(componentSettings.hiddenAttributeIds || []);

    const allFormElements = useMemo(() => {
      const formElements = (sketchClass?.form?.formElements ||
        []) as FormElement[];
      return formElements
        .filter((element) => element.typeId !== "FeatureName")
        .filter((element) => element.isInput)
        .sort((a, b) => a.position - b.position);
    }, [sketchClass?.form?.formElements]);

    const [open, setOpen] = useState(false);

    const toggleHidden = (id: number) => {
      const next = new Set(hidden);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onUpdate({
        componentSettings: {
          ...componentSettings,
          hiddenAttributeIds: Array.from(next),
        },
      });
    };

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none"
          >
            <MixerHorizontalIcon className="w-3 h-3" />
            <span>{t("Attributes")}</span>
          </button>
        </Popover.Trigger>
        <TooltipPopoverContent title={t("Attributes")}>
          <div className="px-1">
            {allFormElements.length === 0 ? (
              <div className="text-xs text-gray-500 italic">
                {t("No attributes available")}
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {allFormElements.map((el) => {
                  const label = getAttributeLabel(el, langContext?.lang?.code);
                  const isVisible = !hidden.has(el.id);
                  return (
                    <label
                      key={el.id}
                      className="flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleHidden(el.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-800 flex-1">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </TooltipPopoverContent>
      </Popover.Root>
    );
  };

function formatValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const listValues = JSON.parse(value);
      if (Array.isArray(listValues)) {
        return listValues.map((v) => formatValue(v)).join(", ");
      }
    } catch {
      // ignore
    }
  }
  return String(value);
}

function getAttributeLabel(element: FormElement, langCode?: string): string {
  let label = element.generatedLabel;
  const code = (langCode || "EN").toUpperCase();
  if (code !== "EN" && element.alternateLanguageSettings?.[code]?.body) {
    label = collectTextFromProsemirrorBodyForLabel(
      element.alternateLanguageSettings?.[code]?.body
    );
  }

  // eslint-disable-next-line i18next/no-literal-string
  return label || `Field ${element.id}`;
}

/**
 * Extracts text from a ProseMirror body JSON for use as a label.
 * Based on the PostgreSQL function collect_text_from_prosemirror_body_for_label.
 */
function collectTextFromProsemirrorBodyForLabel(body: any): string {
  let output = "";

  if (body && typeof body === "object" && body.text) {
    output += body.text;
  }

  if (
    body &&
    typeof body === "object" &&
    body.type &&
    body.type !== "paragraph" &&
    body.content
  ) {
    for (const item of body.content) {
      if (output.length > 32) {
        return output;
      }

      if (
        item &&
        typeof item === "object" &&
        item.type &&
        item.type !== "paragraph"
      ) {
        output += collectTextFromProsemirrorBodyForLabel(item);
      }
    }
  }

  return output;
}
