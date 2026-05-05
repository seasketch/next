import type { WidgetExportRow } from "../types";
import type { ExportScope } from "../types";

export function baseRow(
  scope: ExportScope,
  sketchId: number | null,
  sketchName: string | null,
): WidgetExportRow {
  return {
    scope,
    sketchId: sketchId ?? "",
    sketchName: sketchName ?? "",
  };
}
