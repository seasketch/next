import { ResolvableLayerCommentCardFragment } from "../../../generated/graphql";

export type CommentThread = {
  root: ResolvableLayerCommentCardFragment;
  replies: ResolvableLayerCommentCardFragment[];
};

/**
 * Groups flat comment rows into threads (root + nested replies in chronological order).
 */
export function buildCommentThreads(
  nodes: ResolvableLayerCommentCardFragment[]
): CommentThread[] {
  const childMap = new Map<number, ResolvableLayerCommentCardFragment[]>();
  for (const n of nodes) {
    const p = n.parentCommentId;
    if (p == null) {
      continue;
    }
    if (!childMap.has(p)) {
      childMap.set(p, []);
    }
    childMap.get(p)!.push(n);
  }
  for (const arr of childMap.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  function collectReplies(parentId: number): ResolvableLayerCommentCardFragment[] {
    const direct = childMap.get(parentId);
    if (!direct?.length) {
      return [];
    }
    const out: ResolvableLayerCommentCardFragment[] = [];
    for (const c of direct) {
      out.push(c);
      out.push(...collectReplies(c.id));
    }
    return out;
  }

  const roots = nodes.filter((n) => n.parentCommentId == null);
  roots.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return roots.map((root) => ({
    root,
    replies: collectReplies(root.id),
  }));
}

export function findThreadContainingComment(
  threads: CommentThread[],
  commentId: number
): CommentThread | undefined {
  for (const th of threads) {
    if (th.root.id === commentId) {
      return th;
    }
    if (th.replies.some((r) => r.id === commentId)) {
      return th;
    }
  }
  return undefined;
}
