export type PublishKind = "added" | "updated" | "removed";

/** One checkbox unit. Bundle followers are listed but are not their own checkbox. */
export type SelectiveUnit = {
  stableId: string;
  kind: PublishKind;
  title: string;
  isFolder: boolean;
  parentStableId: string | null;
  requiresStableIds: string[];
  bundleId: string | null;
  includedInBundle: boolean;
  draftId: number | null;
};

export function isPublishKind(value: unknown): value is PublishKind {
  return value === "added" || value === "updated" || value === "removed";
}

export function checkableUnits(units: readonly SelectiveUnit[]): SelectiveUnit[] {
  return units.filter((unit) => !unit.includedInBundle);
}

function indexUnits(units: readonly SelectiveUnit[]) {
  const byId = new Map<string, SelectiveUnit>();
  const byBundle = new Map<string, SelectiveUnit[]>();
  for (const unit of units) {
    byId.set(unit.stableId, unit);
    if (unit.bundleId) {
      const list = byBundle.get(unit.bundleId) ?? [];
      list.push(unit);
      byBundle.set(unit.bundleId, list);
    }
  }
  return { byId, byBundle };
}

/** Explicit ids plus every unit they require and every bundle-mate. Unknown ids are ignored. */
export function closureOf(
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): string[] {
  const { byId, byBundle } = indexUnits(units);
  const closed = new Set<string>();
  const stack = explicitIds.filter((id) => byId.has(id));
  while (stack.length) {
    const id = stack.pop();
    if (id == null || closed.has(id)) {
      continue;
    }
    closed.add(id);
    const unit = byId.get(id);
    if (!unit) {
      continue;
    }
    for (const required of unit.requiresStableIds) {
      if (byId.has(required) && !closed.has(required)) {
        stack.push(required);
      }
    }
    if (unit.bundleId) {
      for (const mate of byBundle.get(unit.bundleId) ?? []) {
        if (!closed.has(mate.stableId)) {
          stack.push(mate.stableId);
        }
      }
    }
  }
  return Array.from(closed);
}

export function impliedOf(
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): string[] {
  const explicit = new Set(explicitIds);
  return closureOf(explicitIds, units).filter((id) => !explicit.has(id));
}

/** Checkbox rows pulled in by the closure. Nested bundle followers are not counted here. */
export function impliedCheckable(
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): SelectiveUnit[] {
  const implied = new Set(impliedOf(explicitIds, units));
  return checkableUnits(units).filter((unit) => implied.has(unit.stableId));
}

export function checkUnit(
  explicitIds: readonly string[],
  stableId: string
): string[] {
  if (explicitIds.includes(stableId)) {
    return [...explicitIds];
  }
  return [...explicitIds, stableId];
}

/** Explicit units, other than `stableId`, whose own closure contains it. */
export function explicitDependents(
  stableId: string,
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): string[] {
  return explicitIds.filter((id) => {
    if (id === stableId) {
      return false;
    }
    return closureOf([id], units).includes(stableId);
  });
}

export type UncheckResult = {
  explicit: string[];
  /** Explicit rows cleared because they depended on the row that was unchecked. */
  cascaded: string[];
};

export function uncheckUnit(
  explicitIds: readonly string[],
  stableId: string,
  units: readonly SelectiveUnit[]
): UncheckResult {
  if (!explicitIds.includes(stableId)) {
    return { explicit: [...explicitIds], cascaded: [] };
  }
  const cascaded = explicitDependents(stableId, explicitIds, units);
  const drop = new Set([stableId, ...cascaded]);
  return {
    explicit: explicitIds.filter((id) => !drop.has(id)),
    cascaded,
  };
}

export type ImpliedClickResult = {
  explicit: string[];
  /** Explicit dependents to highlight. The implied row stays checked and becomes explicit. */
  nudged: string[];
};

export function promoteImplied(
  explicitIds: readonly string[],
  stableId: string,
  units: readonly SelectiveUnit[]
): ImpliedClickResult {
  return {
    explicit: checkUnit(explicitIds, stableId),
    nudged: explicitDependents(stableId, explicitIds, units),
  };
}

export function setSectionChecked(
  explicitIds: readonly string[],
  sectionIds: readonly string[],
  checked: boolean,
  units: readonly SelectiveUnit[]
): UncheckResult {
  if (checked) {
    return {
      explicit: Array.from(new Set([...explicitIds, ...sectionIds])),
      cascaded: [],
    };
  }
  let explicit = [...explicitIds];
  const cascaded: string[] = [];
  for (const id of sectionIds) {
    const result = uncheckUnit(explicit, id, units);
    for (const cascadedId of result.cascaded) {
      if (!cascaded.includes(cascadedId)) {
        cascaded.push(cascadedId);
      }
    }
    explicit = result.explicit;
  }
  return { explicit, cascaded };
}

export function bundleMates(
  unit: SelectiveUnit,
  units: readonly SelectiveUnit[]
): SelectiveUnit[] {
  if (!unit.bundleId) {
    return [];
  }
  return units.filter(
    (other) =>
      other.bundleId === unit.bundleId &&
      other.includedInBundle &&
      other.stableId !== unit.stableId
  );
}

export function isSharedSourceBundle(bundleId: string | null): boolean {
  return Boolean(bundleId && bundleId.startsWith("source:"));
}

/**
 * The checkbox row and the rows it is directly bound to.
 * Implied rows point at the explicit units that require them, and the reverse.
 */
export function linkedRowIds(
  stableId: string,
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): string[] {
  const ids = new Set<string>([stableId]);
  const explicit = new Set(explicitIds);
  const unit = units.find((row) => row.stableId === stableId);
  if (!unit) {
    return [stableId];
  }
  if (explicit.has(stableId)) {
    const implied = new Set(impliedOf(explicitIds, units));
    for (const required of unit.requiresStableIds) {
      if (implied.has(required)) {
        ids.add(required);
      }
    }
  } else {
    for (const other of units) {
      if (
        explicit.has(other.stableId) &&
        other.requiresStableIds.includes(stableId)
      ) {
        ids.add(other.stableId);
      }
    }
  }
  return Array.from(ids);
}

/** Titles of the explicit units that pull this row in. Direct requirements come first. */
export function includedWithTitles(
  stableId: string,
  explicitIds: readonly string[],
  units: readonly SelectiveUnit[]
): string[] {
  const explicit = new Set(explicitIds);
  const direct = units.filter(
    (unit) => explicit.has(unit.stableId) && unit.requiresStableIds.includes(stableId)
  );
  const source = direct.length
    ? direct
    : units.filter(
        (unit) =>
          explicit.has(unit.stableId) &&
          unit.stableId !== stableId &&
          closureOf([unit.stableId], units).includes(stableId)
      );
  return source.map((unit) => unit.title);
}

export type CrumbSource = {
  title: string;
  parentStableId: string | null;
  added: boolean;
};

export type AncestorCrumb = {
  stableId: string;
  title: string;
  added: boolean;
};

export function ancestorCrumbs(
  parentStableId: string | null,
  sources: ReadonlyMap<string, CrumbSource>
): AncestorCrumb[] {
  const crumbs: AncestorCrumb[] = [];
  const seen = new Set<string>();
  let current = parentStableId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const source = sources.get(current);
    if (!source) {
      break;
    }
    crumbs.push({
      stableId: current,
      title: source.title,
      added: source.added,
    });
    current = source.parentStableId;
  }
  crumbs.reverse();
  return crumbs;
}
