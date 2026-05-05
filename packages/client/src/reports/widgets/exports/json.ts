import type { WidgetExportSection } from "./types";
import { buildRawExportPayload } from "./raw";
import type { CardExportInput } from "./types";

export function buildJsonExportDocument(
  input: CardExportInput,
  sections: WidgetExportSection[],
) {
  const raw = buildRawExportPayload(input);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    format: "seasketch-report-card-export",
    meta: {
      reportId: input.reportId,
      cardId: input.cardId,
      cardTitle: input.cardTitle,
      subjectSketchId: input.subject.sketchId,
      subjectSketchName: input.subject.sketchName,
      isCollection: input.subject.isCollection,
    },
    sections,
    raw,
  };
}
