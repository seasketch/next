import { DOMSerializer, Node } from "prosemirror-model";
// @ts-ignore - compatibility shim path
import { createReportCardSchema } from "./createReportCardSchema";

/**
 * Converts a Prosemirror JSON document to HTML string
 * @param body - The Prosemirror JSON document
 * @returns HTML string
 */
export function prosemirrorToHtml(body: any): string {
  if (!body) return "";

  try {
    const schema = createReportCardSchema();
    const serializer = DOMSerializer.fromSchema(schema);
    const node = Node.fromJSON(schema, body);
    const fragment = serializer.serializeFragment(node.content);

    // Convert the DOM fragment to HTML string
    const div = document.createElement("div");
    div.appendChild(fragment);
    return div.innerHTML;
  } catch (error) {
    console.error("Error converting Prosemirror to HTML:", error);
    return "";
  }
}
