import type { TFunction } from "i18next";
import type { MetricDependency } from "overlay-engine";
import type {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
} from "../../../generated/graphql";

export type ExportScope = "collection" | "sketch" | "geography";

export type WidgetExportColumn = {
  key: string;
  label: string;
  type?: "string" | "number" | "boolean" | "percent";
  unit?: string;
};

export type WidgetExportRow = Record<string, string | number | boolean | null>;

export type WidgetExportSection = {
  id: string;
  title: string;
  columns: WidgetExportColumn[];
  rows: WidgetExportRow[];
  extras?: Record<string, unknown>;
};

export type SketchClassForExport = Pick<
  ReportContextSketchClassDetailsFragment,
  | "id"
  | "projectId"
  | "geometryType"
  | "form"
  | "clippingGeographies"
  | "project"
  | "validChildren"
>;

export type ExportSubjectContext = {
  sketchId: number;
  sketchName: string;
  isCollection: boolean;
  childSketches: { id: number; name: string }[];
};

/** Fragment subjects from subject report (same shape as MetricSubjectFragment). */
export type RelatedFragmentLike = {
  hash: string;
  geographies: number[];
  sketches: number[];
};

export type WidgetExporterInput = {
  dependencies: MetricDependency[];
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  geographies: Pick<
    Geography,
    "id" | "name" | "translatedProps" | "stableIds"
  >[];
  componentSettings: Record<string, unknown>;
  sketchClass: SketchClassForExport;
  subject: ExportSubjectContext;
  relatedFragments: RelatedFragmentLike[];
  /** Primary clipping geography id when resolved (for class-table widgets). */
  primaryGeographyId?: number;
  t: TFunction;
};

export type WidgetExporter = (
  input: WidgetExporterInput,
) => WidgetExportSection[];

export type ProsemirrorJsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProsemirrorJsonNode[];
};

export type CardExportInput = {
  reportId: number;
  cardId: number;
  cardTitle?: string;
  body: ProsemirrorJsonNode | null | undefined;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  geographies: Pick<
    Geography,
    "id" | "name" | "translatedProps" | "stableIds"
  >[];
  sketchClass: SketchClassForExport;
  subject: ExportSubjectContext;
  relatedFragments: RelatedFragmentLike[];
  primaryGeographyId?: number;
  t: TFunction;
};

export type CardExportFormat = "json" | "csv";

export type CardExportJsonResult = {
  format: "json";
  body: Record<string, unknown>;
  mimeType: "application/json";
  filename: string;
};

export type CardExportCsvResult = {
  format: "csv";
  blob: Blob;
  mimeType: string;
  filename: string;
};

export type CardExportZipResult = {
  format: "zip";
  blob: Blob;
  mimeType: "application/zip";
  filename: string;
};

export type CardExportResult =
  | CardExportJsonResult
  | CardExportCsvResult
  | CardExportZipResult;
