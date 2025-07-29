import { DOMSerializer, Node } from "prosemirror-model";
import { formElements } from "../../editor/config";

/**
 * Converts a Prosemirror JSON document to HTML string
 * @param body - The Prosemirror JSON document
 * @returns HTML string
 */
export function prosemirrorToHtml(body: any): string {
  if (!body) return "";

  try {
    const serializer = DOMSerializer.fromSchema(
      formElements.reportCardBody.schema
    );
    const node = Node.fromJSON(formElements.reportCardBody.schema, body);
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
