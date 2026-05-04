import { Node as PMNode } from "prosemirror-model";
import { layerCommentSchema } from "./layerCommentSchema";

export function isLayerCommentDocEmpty(
  doc: Record<string, unknown> | undefined
): boolean {
  if (!doc) {
    return true;
  }
  try {
    const n = PMNode.fromJSON(layerCommentSchema, doc);
    return n.textContent.trim().length === 0;
  } catch {
    return true;
  }
}
