export type LayerLinkProjectAccess = "public" | "invite_only" | "admins_only";

export type LayerLinkRestriction = {
  title: string;
  isFolder: boolean;
  type: "admins_only" | "group";
  groups: string[];
};

export type LayerLinkSharing = {
  projectName: string;
  projectAccess: LayerLinkProjectAccess;
  title: string;
  attribution: string | null;
  folderTitles: string[];
  restrictions: LayerLinkRestriction[];
};

export type LayerLinkNotice =
  | { kind: "fullyOpen" }
  | { kind: "projectInvite"; projectName: string }
  | { kind: "projectAdmins"; projectName: string }
  | { kind: "adminsOnly"; title: string; isFolder: boolean }
  | {
      kind: "groups";
      title: string;
      isFolder: boolean;
      groups: string[];
    };

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isRestriction(value: unknown): value is LayerLinkRestriction {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.title !== "string" || typeof value.isFolder !== "boolean") {
    return false;
  }
  if (value.type !== "admins_only" && value.type !== "group") {
    return false;
  }
  if (!isStringArray(value.groups)) {
    return false;
  }
  return true;
}

export function isLayerLinkSharing(value: unknown): value is LayerLinkSharing {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.projectName !== "string" || typeof value.title !== "string") {
    return false;
  }
  if (
    value.projectAccess !== "public" &&
    value.projectAccess !== "invite_only" &&
    value.projectAccess !== "admins_only"
  ) {
    return false;
  }
  if (value.attribution !== null && typeof value.attribution !== "string") {
    return false;
  }
  if (!isStringArray(value.folderTitles)) {
    return false;
  }
  if (
    !Array.isArray(value.restrictions) ||
    !value.restrictions.every((entry) => isRestriction(entry))
  ) {
    return false;
  }
  return true;
}

export function layerLinkPath(slug: string, bookmarkId: string) {
  // eslint-disable-next-line i18next/no-literal-string
  return `/${slug}/layers/${bookmarkId}`;
}

export function layerLinkUrl(slug: string, bookmarkId: string) {
  if (typeof window === "undefined") {
    return layerLinkPath(slug, bookmarkId);
  }
  return `${window.location.origin}${layerLinkPath(slug, bookmarkId)}`;
}

/**
 * Notices shown to the admin who creates the link. Order is project gate
 * first, then each non-public ACL from the folder path down to the layer.
 */
export function layerLinkNotices(summary: LayerLinkSharing): {
  tone: "open" | "restricted";
  blocks: LayerLinkNotice[];
} {
  const blocks: LayerLinkNotice[] = [];
  if (summary.projectAccess === "invite_only") {
    blocks.push({
      kind: "projectInvite",
      projectName: summary.projectName,
    });
  } else if (summary.projectAccess === "admins_only") {
    blocks.push({
      kind: "projectAdmins",
      projectName: summary.projectName,
    });
  }
  for (const restriction of summary.restrictions) {
    if (restriction.type === "admins_only") {
      blocks.push({
        kind: "adminsOnly",
        title: restriction.title,
        isFolder: restriction.isFolder,
      });
    } else {
      blocks.push({
        kind: "groups",
        title: restriction.title,
        isFolder: restriction.isFolder,
        groups: restriction.groups,
      });
    }
  }
  if (blocks.length === 0) {
    return { tone: "open", blocks: [{ kind: "fullyOpen" }] };
  }
  return { tone: "restricted", blocks };
}
