/** Effective access class after classifying a tile UUID against an ACL doc. */
export type AclClass = "public" | "admins_only" | "group";

/** One deduplicated rule stored in ProjectAclDoc.rules. */
export type ProtectedAclEntry = {
  t: "admins_only" | "group";
  /** Group ids when t === "group" */
  g?: number[];
};

/**
 * Per-project access-control document stored at
 * `acl/{ns}/projects/{slug}.json` in the tiles R2 bucket.
 */
export type ProjectAclDoc = {
  /** Version stamp (ms). Higher values win if concurrent writes race. */
  v: number;
  /** Canonical project slug; compared to token projectSlug. */
  slug: string;
  /** Tile UUIDs anyone may fetch without a token (sorted for binary search). */
  public: string[];
  /** Deduplicated ACL rules referenced by index from `protected`. */
  rules: ProtectedAclEntry[];
  /**
   * Tile UUID → indexes in `rules`. Every referenced rule must allow the
   * request. This models the leaf item's ACL plus all protected ancestors.
   */
  protected: Record<string, number[]>;
};

/** Claims expected on a SeaSketch map-access JWT. */
export type MapAccessClaims = {
  type: "map-access";
  projectId: number;
  projectSlug: string;
  userId: number;
  role: "admin" | "user";
  groups: number[];
  isSuperuser?: boolean;
  iat?: number;
  exp?: number;
  iss?: string;
};

/** Result of loading a ProjectAclDoc and classifying one UUID. */
export type AclLookupResult = {
  class: AclClass;
  rules: ProtectedAclEntry[];
  doc: ProjectAclDoc | null;
  etag: string | null;
  fromCache: boolean;
};

/** Outcome of authorizeAccess for logging and HTTP status mapping. */
export type AuthDecision = {
  allowed: boolean;
  status: 200 | 401 | 403;
  reason: string;
  aclClass: AclClass;
  hadToken: boolean;
  role: string | null;
  groups: number[];
  aclVersion: number | null;
};
