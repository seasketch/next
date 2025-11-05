import { DOMSerializer, Node } from "prosemirror-model";
import { formElements } from "../../editor/config";

/**
 * Converts a Prosemirror JSON document to HTML string
 * @param body - The Prosemirror JSON document
 * @param isFooter - Whether this is a footer body (uses footer schema)
 * @returns HTML string
 */
export function prosemirrorToHtml(body: any, isFooter?: boolean): string {
  if (!body) return "";

  try {
    const schema = isFooter
      ? formElements.reportCardFooter.schema
      : formElements.reportCardBody.schema;
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
