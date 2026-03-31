import type {
  AiDataAnalystNotes,
  GenerateAttributionResult,
  GenerateColumnIntelligenceResult,
  GenerateTitleResult,
} from "ai-data-analyst";
export function isAiDataAnalystEnabled(): boolean {
  return Boolean(process.env.CF_AIG_TOKEN && process.env.CF_AIG_URL);
}

type TitleOutcome = GenerateTitleResult | { error: string };
type AttributionOutcome = GenerateAttributionResult | { error: string };
type ColumnOutcome = GenerateColumnIntelligenceResult | { error: string };

export function asNeverReject<T>(
  p: Promise<T>,
  label: string,
): Promise<T | { error: string }> {
  return p.catch((e: unknown) => ({
    error: `${label}: ${e instanceof Error ? e.message : String(e)}`,
  }));
}

/**
 * Await in-flight AI tasks and merge into {@link AiDataAnalystNotes} when column
 * intelligence succeeds. Title and attribution are best-effort overlays.
 */
export async function composeAiDataAnalystNotesFromPromises(options: {
  uploadFilename: string;
  titleP: Promise<TitleOutcome | { error: string }> | null;
  attributionP: Promise<AttributionOutcome | { error: string }> | null;
  columnP: Promise<ColumnOutcome | { error: string }> | null;
}): Promise<AiDataAnalystNotes | undefined> {
  const { uploadFilename, titleP, attributionP, columnP } = options;
  const errors: string[] = [];

  const [titleRaw, attributionRaw, columnRaw] = await Promise.all([
    titleP ?? Promise.resolve(null),
    attributionP ?? Promise.resolve(null),
    columnP ?? Promise.resolve(null),
  ]);

  let best_layer_title: string | undefined;
  if (titleRaw && "title" in titleRaw && titleRaw.title) {
    best_layer_title = titleRaw.title;
  } else if (titleRaw && "error" in titleRaw && titleRaw.error) {
    errors.push(`title: ${titleRaw.error}`);
  }

  let attribution: string | null | undefined;
  if (
    attributionRaw &&
    "attribution" in attributionRaw &&
    !("error" in attributionRaw)
  ) {
    attribution = attributionRaw.attribution;
  } else if (
    attributionRaw &&
    "error" in attributionRaw &&
    attributionRaw.error
  ) {
    errors.push(`attribution: ${attributionRaw.error}`);
  }

  if (!columnRaw || !("result" in columnRaw)) {
    if (columnRaw && "error" in columnRaw) {
      errors.push(`columnIntelligence: ${columnRaw.error}`);
    }
    if (errors.length) {
      console.warn(
        `[ai data analyst] Notes skipped for ${uploadFilename}: column intelligence did not succeed. ${errors.join(
          "; ",
        )}`,
      );
    }
    return undefined;
  }

  const merged: AiDataAnalystNotes = {
    ...columnRaw.result,
    ...(best_layer_title !== undefined ? { best_layer_title } : {}),
    ...(attribution !== undefined ? { attribution } : {}),
    ...(errors.length ? { errors: errors.join("; ") } : {}),
  };

  return merged;
}
