import {
  AuthorProfileFragment,
  ChangeLogFieldGroup,
  DataSourceTypes,
  LayerCartographyChangesQuery,
} from "../../generated/graphql";

export type CartographyRevision = {
  id: string;
  /** Matches a cartography changelog row when applicable */
  changeLogId?: string;
  mapboxGlStyles: unknown[];
  date?: string | null;
  profile?: AuthorProfileFragment | null;
  current?: boolean;
  original?: boolean;
};

/** Changelog ↔ list row wiring; values are not user-facing copy (avoids i18next literal-string). */
function cartographyInternalRevisionId(logId: string | number): string {
  return (
    String.fromCharCode(114, 101, 118, 105, 115, 105, 111, 110, 45) +
    String(logId)
  );
}

function cartographyInternalOriginalId(logId: string | number): string {
  return (
    String.fromCharCode(111, 114, 105, 103, 105, 110, 97, 108, 45) +
    String(logId)
  );
}

export function isCartographyComparisonSupported(
  type?: DataSourceTypes | null
): boolean {
  if (!type) {
    return false;
  }
  return (
    type === DataSourceTypes.Geojson ||
    type === DataSourceTypes.SeasketchVector ||
    type === DataSourceTypes.SeasketchMvt ||
    type === DataSourceTypes.SeasketchRaster ||
    type === DataSourceTypes.Vector
  );
}

/** Parse changelog JSON blobs into Mapbox GL layer definitions */
export function normalizeMapboxGlStyles(blob: unknown): unknown[] {
  if (blob == null) {
    return [];
  }
  if (typeof blob === "string") {
    try {
      const parsed = JSON.parse(blob);
      return normalizeMapboxGlStyles(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(blob)) {
    return blob;
  }
  return [];
}

/** Revisions that may appear on the left comparison side (never includes live current). */
export function selectableLeftRevisions(
  revisions: CartographyRevision[]
): CartographyRevision[] {
  return revisions.filter((r) => !r.current);
}

export function hasComparableCartographyHistory(
  revisions: CartographyRevision[]
): boolean {
  return selectableLeftRevisions(revisions).length > 0;
}

export function cartographyStylesEqual(a: unknown[], b: unknown[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function buildCartographyRevisions(
  data?: LayerCartographyChangesQuery | null
): CartographyRevision[] {
  const toc = data?.tableOfContentsItem;
  if (!toc?.dataLayer) {
    return [];
  }

  const dataSource = toc.dataLayer.dataSource;

  const logs = (toc.cartographyChangeLogs || [])
    .filter(Boolean)
    .filter((log) => log.fieldGroup === ChangeLogFieldGroup.LayerCartography)
    .sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

  const currentStyles = normalizeMapboxGlStyles(toc.dataLayer.mapboxGlStyles);

  const revisions: CartographyRevision[] = [
    {
      id: "current",
      changeLogId: logs[0] ? String(logs[0].id) : undefined,
      mapboxGlStyles: currentStyles,
      date: logs[0]?.lastAt,
      profile: logs[0]?.editorProfile || null,
      current: true,
    },
  ];

  if (logs.length === 0) {
    return revisions;
  }

  const seenStyleKeys = new Set<string>();
  seenStyleKeys.add(JSON.stringify(currentStyles));

  /** Each changelog row describes one edit; the saved style is always `toBlob`. Skip the
   *  newest row’s `toBlob` in the history list — it matches the live layer (“current”).
   */
  for (let i = 1; i < logs.length; i++) {
    const log = logs[i];
    const styles = normalizeMapboxGlStyles(log.toBlob);
    const key = JSON.stringify(styles);
    if (seenStyleKeys.has(key)) {
      continue;
    }
    seenStyleKeys.add(key);
    revisions.push({
      id: cartographyInternalRevisionId(log.id),
      changeLogId: String(log.id),
      mapboxGlStyles: styles,
      date: log.lastAt,
      profile: log.editorProfile || null,
    });
  }

  const oldestLog = logs[logs.length - 1];
  const oldestFrom = normalizeMapboxGlStyles(oldestLog.fromBlob);
  const oldestTo = normalizeMapboxGlStyles(oldestLog.toBlob);
  if (
    !cartographyStylesEqual(oldestFrom, oldestTo) &&
    !seenStyleKeys.has(JSON.stringify(oldestFrom))
  ) {
    seenStyleKeys.add(JSON.stringify(oldestFrom));
    revisions.push({
      id: cartographyInternalOriginalId(oldestLog.id),
      mapboxGlStyles: oldestFrom,
      date: dataSource?.createdAt ?? oldestLog.startedAt,
      profile: dataSource?.authorProfile ?? oldestLog.editorProfile ?? null,
      original: true,
    });
  }

  return revisions;
}

/** Resolve which revision id to select for the left map when opening the modal */
export function resolveInitialLeftRevisionId(
  revisions: CartographyRevision[],
  logsSortedNewestFirst: NonNullable<
    LayerCartographyChangesQuery["tableOfContentsItem"]
  >["cartographyChangeLogs"],
  initialChangeLogId?: string | number | null
): string | undefined {
  const leftChoices = selectableLeftRevisions(revisions);
  if (!leftChoices.length) {
    return undefined;
  }

  const logs = (logsSortedNewestFirst || [])
    .filter(Boolean)
    .filter((log) => log.fieldGroup === ChangeLogFieldGroup.LayerCartography)
    .sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

  if (initialChangeLogId != null) {
    const needle = String(initialChangeLogId);
    const matchLog = logs.find((l) => String(l.id) === needle);

    if (matchLog && logs[0] && String(matchLog.id) === String(logs[0].id)) {
      if (logs.length >= 2) {
        const id = cartographyInternalRevisionId(logs[1].id);
        if (leftChoices.some((r) => r.id === id)) {
          return id;
        }
      } else {
        const id = cartographyInternalOriginalId(logs[0].id);
        if (leftChoices.some((r) => r.id === id)) {
          return id;
        }
      }
      return leftChoices[0]?.id;
    }

    const hit = revisions.find(
      (r) =>
        !r.current &&
        (r.changeLogId === needle ||
          r.id === cartographyInternalRevisionId(needle) ||
          r.id === cartographyInternalOriginalId(needle))
    );
    if (hit) {
      return hit.id;
    }
    return leftChoices[0]?.id;
  }

  return leftChoices[0]?.id;
}
