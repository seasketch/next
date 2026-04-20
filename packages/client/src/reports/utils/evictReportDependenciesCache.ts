/* GraphQL fragments for Apollo cache reads — not user-visible strings. */
/* eslint-disable i18next/no-literal-string */
import { ApolloCache, gql } from "@apollo/client";

const SketchReportEvictionFragment = gql`
  fragment SketchReportEviction on Sketch {
    id
    sketchClass {
      reportId
    }
  }
`;

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
}

/**
 * Reads `sketchClass.reportId` from the Apollo cache for this sketch and evicts
 * that report's dependencies field for this sketch id. No-op if the sketch is
 * missing or has no report.
 */
export function evictReportDependenciesForSketchId(
  cache: ApolloCache<object>,
  sketchId: number
): void {
  const sketchRef = cache.identify({ __typename: "Sketch", id: sketchId });
  if (!sketchRef) {
    return;
  }
  try {
    const data = cache.readFragment<{
      sketchClass?: { reportId?: number | null } | null;
    }>({
      id: sketchRef,
      fragment: SketchReportEvictionFragment,
    });
    const reportId = data?.sketchClass?.reportId;
    if (reportId == null) {
      return;
    }
    evictReportDependenciesForReportAndSketch(cache, reportId, sketchId);
  } catch {
    // Sketch not in cache or fragment fields missing
  }
}

/**
 * Prefer this when the mutation payload includes `sketchClass.reportId` on a
 * collection sketch (avoids relying on a fully-populated cache entry).
 */
export function evictReportDependenciesForUpdatedCollectionSketch(
  cache: ApolloCache<object>,
  collection: {
    id: number;
    sketchClass?: { reportId?: number | null } | null;
  }
): void {
  const reportId = collection.sketchClass?.reportId;
  if (collection.id != null && reportId != null) {
    evictReportDependenciesForReportAndSketch(cache, reportId, collection.id);
  } else {
    evictReportDependenciesForSketchId(cache, collection.id);
  }
}
