import { DOMSerializer, Node } from "prosemirror-model";
import { createReportCardSchema } from "./createReportCardSchema";
import { MetricResolver } from "./resolveMetric";

/**
 * Converts a Prosemirror JSON document to HTML string
 * @param body - The Prosemirror JSON document
 * @param isFooter - Whether this is a footer body (uses footer schema)
 * @param metricResolver - Optional resolver for metric values
 * @returns HTML string
 */
export function prosemirrorToHtml(
  body: any,
  isFooter?: boolean,
  metricResolver?: MetricResolver
): string {
  if (!body) return "";

  try {
    const schema = createReportCardSchema(isFooter ?? false, metricResolver);
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
