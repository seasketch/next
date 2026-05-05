import type { CompatibleSpatialMetricDetailsFragment } from "../../../generated/graphql";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import type { CardExportInput, SketchClassForExport } from "./types";

function stripTypename<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripTypename(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("__typename" in obj) {
      const { __typename: _t, ...rest } = obj;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(rest)) {
        out[k] = stripTypename(rest[k]);
      }
      return out as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      out[k] = stripTypename(obj[k]);
    }
    return out as unknown as T;
  }
  return value;
}

function normalizeSketchClass(sc: SketchClassForExport) {
  return stripTypename({
    id: sc.id,
    projectId: sc.projectId,
    geometryType: sc.geometryType,
    clippingGeographies: sc.clippingGeographies,
    validChildren: sc.validChildren?.map((c) =>
      c
        ? {
            id: c.id,
            geometryType: c.geometryType,
            isArchived: c.isArchived,
            clippingGeographies: c.clippingGeographies,
          }
        : null,
    ),
  });
}

function buildSourceTitleByUrl(
  sources: CardExportInput["sources"],
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of sources) {
    if (s.sourceUrl && s.tableOfContentsItem?.title) {
      m[s.sourceUrl] = s.tableOfContentsItem.title;
    }
  }
  return m;
}

function normalizeMetric(
  m: CompatibleSpatialMetricDetailsFragment,
  sourceTitleByUrl: Record<string, string>,
) {
  return stripTypename({
    id: m.id,
    type: m.type,
    state: m.state,
    value: m.value,
    parameters: m.parameters,
    subject: m.subject,
    dependencyHash: m.dependencyHash,
    sourceTitle: m.sourceUrl ? sourceTitleByUrl[m.sourceUrl] ?? null : null,
    g: m.g,
    f: m.f,
    errorMessage: m.errorMessage,
    progress: m.progress,
    jobKey: m.jobKey,
    sourceProcessingJobDependency: m.sourceProcessingJobDependency,
    eta: m.eta,
    startedAt: m.startedAt,
    durationSeconds: m.durationSeconds,
    updatedAt: m.updatedAt,
    createdAt: m.createdAt,
  });
}

export function buildRawExportPayload(input: CardExportInput) {
  const fragmentMetrics: ReturnType<typeof normalizeMetric>[] = [];
  const geographyMetrics: ReturnType<typeof normalizeMetric>[] = [];
  const sourceTitleByUrl = buildSourceTitleByUrl(input.sources);
  for (const m of input.metrics) {
    const nm = normalizeMetric(m, sourceTitleByUrl);
    if (subjectIsFragment(m.subject)) fragmentMetrics.push(nm);
    else if (subjectIsGeography(m.subject)) geographyMetrics.push(nm);
  }

  const geographies = input.geographies.map((g) =>
    stripTypename({
      id: g.id,
      name: g.name,
      stableIds: g.stableIds,
    }),
  );

  const sketches: ReturnType<typeof stripTypename>[] = [
    stripTypename({
      id: input.subject.sketchId,
      name: input.subject.sketchName,
      isCollection: input.subject.isCollection,
      childSketchIds: input.subject.childSketches.map((c) => c.id),
      childSketches: input.subject.childSketches,
    }),
  ];

  const fragments = input.relatedFragments.map((f) =>
    stripTypename({
      hash: f.hash,
      geographies: f.geographies,
      sketches: f.sketches,
    }),
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    context: {
      report: { id: input.reportId },
      card: { id: input.cardId, title: input.cardTitle },
      sketchClass: normalizeSketchClass(input.sketchClass),
      geographies,
      sketches,
      fragments,
      primaryGeographyId: input.primaryGeographyId,
    },
    metrics: {
      fragments: fragmentMetrics,
      geographies: geographyMetrics,
    },
  };
}
