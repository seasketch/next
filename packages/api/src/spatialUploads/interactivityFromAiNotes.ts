import type { ProcessedUploadLayer } from "spatial-uploads-handler";

export type AiNotes = NonNullable<ProcessedUploadLayer["aiDataAnalystNotes"]>;

/** Interactivity modes we apply from AI notes (matches DB subset we support here). */
export type InteractivitySettingsFromAiNotes = {
  type: "NONE" | "BANNER" | "TOOLTIP" | "ALL_PROPERTIES_POPUP";
  short_template: string | null;
};

function isNonEmptyColumnName(s: string | undefined | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * First match wins: {@link AiNotes.chosen_presentation_column}, then
 * {@link AiNotes.best_label_column}, then {@link AiNotes.best_category_column}.
 * When the layer has vector {@link GeostatsLayer.attributes}, the name must match
 * an attribute; otherwise any non-empty trimmed string counts.
 */
export function pickColumnForInteractivityTemplate(
  notes: AiNotes,
  geostats: ProcessedUploadLayer["geostats"],
): string | null {
  const candidates = [
    notes.chosen_presentation_column,
    notes.best_label_column,
    notes.best_category_column,
  ];

  const attrNames =
    geostats &&
    typeof geostats === "object" &&
    "attributes" in geostats &&
    Array.isArray(
      (geostats as { attributes?: { attribute: string }[] }).attributes,
    )
      ? new Set(
          (
            geostats as { attributes: { attribute: string }[] }
          ).attributes.map((a) => a.attribute),
        )
      : null;

  for (const c of candidates) {
    if (!isNonEmptyColumnName(c)) {
      continue;
    }
    const name = c.trim();
    if (attrNames !== null && attrNames.size > 0 && !attrNames.has(name)) {
      continue;
    }
    return name;
  }
  return null;
}

/**
 * Maps AI {@link AiNotes.interactivity_type} into `interactivity_settings` rows.
 * Only NONE, BANNER, TOOLTIP, and ALL_PROPERTIES_POPUP are used; POPUP becomes
 * ALL_PROPERTIES_POPUP; anything else becomes NONE. BANNER and TOOLTIP require a
 * template column (see {@link pickColumnForInteractivityTemplate}); otherwise NONE.
 */
export function deriveInteractivitySettingsFromAiNotes(
  notes: AiNotes,
  geostats: ProcessedUploadLayer["geostats"],
): InteractivitySettingsFromAiNotes {
  let desired = notes.interactivity_type;

  if (desired === "POPUP") {
    desired = "ALL_PROPERTIES_POPUP";
  }

  switch (desired) {
    case "NONE":
      return { type: "NONE", short_template: null };
    case "ALL_PROPERTIES_POPUP":
      return { type: "ALL_PROPERTIES_POPUP", short_template: null };
    case "BANNER":
    case "TOOLTIP": {
      const column = pickColumnForInteractivityTemplate(notes, geostats);
      if (!column) {
        return { type: "NONE", short_template: null };
      }
      return {
        type: desired,
        short_template: `{{${column}}}`,
      };
    }
    default:
      return { type: "NONE", short_template: null };
  }
}
