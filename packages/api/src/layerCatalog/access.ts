export type LayerAccessList = {
  type: string;
  /** True when the caller belongs to at least one group on this list. */
  member: boolean;
};

/**
 * A caller can read a layer when they are a project admin, or when every
 * access list on the layer's path allows them. Group lists allow members of
 * any listed group. `admins_only` allows only project admins.
 */
export function passesLayerAccess(args: {
  lists: LayerAccessList[];
  isProjectAdmin: boolean;
}): boolean {
  if (args.isProjectAdmin) {
    return true;
  }
  return args.lists.every((list) => {
    if (list.type === "public") {
      return true;
    }
    if (list.type === "group") {
      return list.member;
    }
    return false;
  });
}
