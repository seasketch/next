/**
 * Compress repeated `subject` blobs on spatial metrics for GraphQL wire payloads.
 * Geography subjects become `g` (project_geography id). Fragment subjects are
 * deduped into `fragmentSubjectCatalog` and referenced by index `f`.
 */
export type FragmentSubjectCatalogEntry = {
  __typename: "FragmentSubject";
  hash: string;
  sketches: number[];
  geographies: number[];
};

export function compressSpatialMetricSubjectsForWire(metrics: unknown[]): {
  metrics: unknown[];
  fragmentSubjectCatalog: FragmentSubjectCatalogEntry[];
} {
  const catalog: FragmentSubjectCatalogEntry[] = [];
  const hashToIndex = new Map<string, number>();

  const compressed = metrics.map((metric) => {
    if (!metric || typeof metric !== "object") {
      return metric;
    }
    const m = metric as Record<string, unknown>;
    const subject = m.subject as Record<string, unknown> | null | undefined;
    const { subject: _drop, g: _g, f: _f, ...rest } = m;

    if (!subject || typeof subject !== "object") {
      return { ...rest };
    }

    if (
      subject.__typename === "GeographySubject" ||
      (subject.id != null && subject.hash == null)
    ) {
      return {
        ...rest,
        g: subject.id as number,
      };
    }

    if (subject.hash != null) {
      const hash = String(subject.hash);
      let idx = hashToIndex.get(hash);
      if (idx === undefined) {
        idx = catalog.length;
        hashToIndex.set(hash, idx);
        catalog.push({
          __typename: "FragmentSubject",
          hash,
          sketches: Array.isArray(subject.sketches)
            ? [...(subject.sketches as number[])]
            : [],
          geographies: Array.isArray(subject.geographies)
            ? [...(subject.geographies as number[])]
            : [],
        });
      }
      return {
        ...rest,
        f: idx,
      };
    }

    return { ...rest, subject };
  });

  return { metrics: compressed, fragmentSubjectCatalog: catalog };
}
