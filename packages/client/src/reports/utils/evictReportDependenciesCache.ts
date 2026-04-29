/* GraphQL fragments for Apollo cache reads — not user-visible strings. */
/* eslint-disable i18next/no-literal-string */
import { ApolloCache, gql } from "@apollo/client";
import {
  bumpReportDependenciesInvalidation,
  bumpReportDependenciesInvalidationForSketch,
} from "./reportDependenciesInvalidation";

const ROOT_QUERY = "ROOT_QUERY";

const SketchReportIdFragment = gql`
  fragment SketchReportId on Sketch {
    id
    sketchClass {
      reportId
    }
  }
`;

export type EvictSubjectReportCachesOpts = {
  /** When the sketch is not in the cache or lacks `sketchClass.reportId` on the stored shape */
  reportId?: number | null;
  /**
   * When evicting many subjects in a loop, pass true and call `cache.gc()` once
   * at the end to avoid repeated GC work.
   */
  skipGarbageCollection?: boolean;
};

/**
 * Evicts cached `Report.dependencies(sketchId)` for the given report. Use when
 * metrics for that sketch subject may have changed server-side.
 */
export function evictReportDependenciesForReportAndSketch(
  cache: ApolloCache<object>,
  reportId: number,
  sketchId: number
): void {
  const reportEntityId = cache.identify({
    __typename: "Report",
    id: reportId,
  });
  if (!reportEntityId) {
    return;
  }
  cache.evict({
    id: reportEntityId,
    fieldName: "dependencies",
    args: { sketchId },
  });
  bumpReportDependenciesInvalidation({ reportId, sketchId });
}

/**
 * Evicts cached `Report.overlaySources` for the given report. Use when overlay
 * card configuration changes — not for collection membership / subject changes.
 */
export function evictReportOverlaySourcesForReport(
  cache: ApolloCache<object>,
  reportId: number
): void {
  const reportEntityId = cache.identify({
    __typename: "Report",
    id: reportId,
  });
  if (!reportEntityId) {
    return;
  }
  cache.evict({
    id: reportEntityId,
    fieldName: "overlaySources",
  });
}

/**
 * Drops the cached **root query field** `sketch(id: …)` for this id. That is
 * what `useSubjectReportContextQuery` / `query SubjectReportContext` read, so
 * the next request refetches children, siblings, and related fragment data.
 *
 * This is **not** the same as `cache.evict({ id: "Sketch:…" })` — it does not
 * remove the normalized `Sketch` entity; it only invalidates this root field
 * entry on `ROOT_QUERY` (and any query result that shared this field + args).
 */
function evictRootSketchQueryFieldForSubjectReport(
  cache: ApolloCache<object>,
  sketchId: number
): void {
  cache.evict({
    id: ROOT_QUERY,
    fieldName: "sketch",
    args: { id: sketchId },
  });
}

/**
 * Invalidates (1) `Report.dependencies` for this report + sketch and (2) the
 * cached `sketch(id: …)` **query result** used for subject report context.
 * Does **not** evict `Report.overlaySources`, `sketchClass(…)` (base report
 * context), or normalized `Sketch` / `SketchClass` entities.
 */
export function evictSubjectReportCachesForSketchId(
  cache: ApolloCache<object>,
  sketchId: number,
  opts?: EvictSubjectReportCachesOpts
): void {
  let reportId = opts?.reportId ?? null;

  if (reportId == null) {
    const sketchRef = cache.identify({ __typename: "Sketch", id: sketchId });
    if (sketchRef) {
      try {
        const data = cache.readFragment<{
          sketchClass?: { reportId?: number | null } | null;
        }>({
          id: sketchRef,
          fragment: SketchReportIdFragment,
        });
        reportId = data?.sketchClass?.reportId ?? null;
      } catch {
        // Sketch not in cache or fragment fields missing
      }
    }
  }

  if (reportId != null) {
    evictReportDependenciesForReportAndSketch(cache, reportId, sketchId);
  } else {
    bumpReportDependenciesInvalidationForSketch(sketchId);
  }

  evictRootSketchQueryFieldForSubjectReport(cache, sketchId);

  if (!opts?.skipGarbageCollection) {
    cache.gc();
  }
}

/**
 * Evicts subject report + `Report.dependencies` for this sketch (see
 * {@link evictSubjectReportCachesForSketchId}).
 */
export function evictReportDependenciesForSketchId(
  cache: ApolloCache<object>,
  sketchId: number
): void {
  evictSubjectReportCachesForSketchId(cache, sketchId);
}

/**
 * Parse `deleteSketchTocItems` / similar payload entries such as `Sketch:123`.
 */
export function parseSketchIdFromTocDeletedItemRef(ref: string): number | null {
  const m = /^Sketch:(\d+)$/.exec(ref);
  if (!m) {
    return null;
  }
  return parseInt(m[1], 10);
}
