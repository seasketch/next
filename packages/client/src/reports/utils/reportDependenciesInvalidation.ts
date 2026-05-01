/**
 * Client-side invalidation ticks for open report dependency queries.
 *
 * Apollo often keeps showing previous `useReportDependenciesQuery` data until a
 * refetch completes, so cache eviction alone does not immediately drive loading UI.
 * Call {@link bumpReportDependenciesInvalidation} whenever `Report.dependencies`
 * cache entries are evicted so reports show skeleton state before responses arrive.
 */

type StoreChange = () => void;

const tickByKey = new Map<string, number>();
const listenersByKey = new Map<string, Set<StoreChange>>();

function notify(key: string) {
  const set = listenersByKey.get(key);
  if (!set) {
    return;
  }
  for (const fn of set) {
    fn();
  }
}

function bumpKey(key: string) {
  tickByKey.set(key, (tickByKey.get(key) ?? 0) + 1);
  notify(key);
}

export function reportSketchInvalidationKey(
  reportId: number,
  sketchId: number
): string {
  return [String(reportId), String(sketchId)].join(":");
}

export function sketchScopeInvalidationKey(sketchId: number): string {
  return ["sketch", String(sketchId)].join(":");
}

export function invalidationKeysForReportAndSketch(
  reportId: number,
  sketchId: number
): [string, string] {
  return [
    reportSketchInvalidationKey(reportId, sketchId),
    sketchScopeInvalidationKey(sketchId),
  ];
}

export function bumpReportDependenciesInvalidation(args: {
  reportId: number;
  sketchId: number;
}): void {
  bumpKey(reportSketchInvalidationKey(args.reportId, args.sketchId));
}

/**
 * When `reportId` is unknown but `Report.dependencies(sketchId)` may still be
 * watched (sketch-only eviction paths).
 */
export function bumpReportDependenciesInvalidationForSketch(sketchId: number): void {
  bumpKey(sketchScopeInvalidationKey(sketchId));
}

export function invalidationTickForKeys(keys: string[]): number {
  let max = 0;
  for (const k of keys) {
    const t = tickByKey.get(k) ?? 0;
    if (t > max) {
      max = t;
    }
  }
  return max;
}

export function subscribeReportDependenciesInvalidation(
  keys: string[],
  onStoreChange: StoreChange
): () => void {
  for (const key of keys) {
    let set = listenersByKey.get(key);
    if (!set) {
      set = new Set();
      listenersByKey.set(key, set);
    }
    set.add(onStoreChange);
  }
  return () => {
    for (const key of keys) {
      listenersByKey.get(key)?.delete(onStoreChange);
    }
  };
}
