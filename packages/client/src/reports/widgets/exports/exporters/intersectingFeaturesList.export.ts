import type { WidgetExporter, WidgetExportSection } from "../types";
import { baseRow } from "./shared";
import { combinePresenceTableMetrics } from "../../IntersectingFeaturesList.utils";

export const exportIntersectingFeaturesList: WidgetExporter = (input) => {
  const { metrics, componentSettings, subject } = input;
  const hidden = new Set(
    (componentSettings.hiddenColumns as string[] | undefined) ?? [],
  );

  const table = combinePresenceTableMetrics(metrics, false);

  const rows: WidgetExportSection["rows"] = [];
  for (const value of table.values) {
    if (!value || typeof value !== "object") continue;
    const flat: WidgetExportSection["rows"][0] = {
      ...baseRow("collection", subject.sketchId, subject.sketchName),
      __id: (value as { __id?: number }).__id ?? "",
    };
    for (const [k, v] of Object.entries(value)) {
      if (k === "__id" || hidden.has(k)) continue;
      if (v === null || v === undefined) {
        flat[k] = "";
      } else if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        flat[k] = v;
      } else {
        flat[k] = JSON.stringify(v);
      }
    }
    rows.push(flat);
  }

  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (k !== "scope" && k !== "sketchId" && k !== "sketchName") keys.add(k);
    }
  }
  const dynamicKeys = Array.from(keys).sort();

  const columns: WidgetExportSection["columns"] = [
    { key: "scope", label: "scope", type: "string" },
    { key: "sketchId", label: "sketchId" },
    { key: "sketchName", label: "sketchName", type: "string" },
    ...dynamicKeys.map((k) => ({
      key: k,
      label: k,
      type: "string" as const,
    })),
  ];

  return [
    {
      id: "intersecting-features",
      title: "Intersecting features",
      columns,
      rows,
      extras: {
        exceededLimit: table.exceededLimit,
        maxResults: table.maxResults,
        combineError: table.combineError,
      },
    },
  ];
};
