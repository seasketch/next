import { makeWrapResolversPlugin, gql } from "graphile-utils";
import slugify from "slugify";

/**
 * Wraps value of FormElement.exportId. If null, a stable value will be
 * generated from the contents of FormElement.body, or as a last result from
 * FormElement.id
 */
const ExportIdPlugin = makeWrapResolversPlugin({
  FormElement: {
    exportId: {
      requires: {
        siblingColumns: [
          { column: "id", alias: "$id" },
          { column: "body", alias: "$body" },
        ],
      },
      async resolve(resolver, formElement, args, context, _resolveInfo) {
        // @ts-ignore
        const exportId = await resolver();
        return createExportId(formElement.$id, formElement.$body, exportId);
      },
    },
  },
});

/**
 * Returns a useable stable identifier for the FormElement if a exportId is not
 * specified. Will attempt to extract text from the begining of
 * FormElement.body, if available. Otherwise returns form_element_{id}.
 *
 * @param id FormElement ID
 * @param body ProseMirror document from which text can be extracted to create an exportId
 * @param exportId The admin-defined exportId, if defined
 * @returns
 */
export function createExportId(id: number, body: any, exportId?: string) {
  if (exportId) {
    return exportId;
  } else if (!body) {
    return `form_element_${id}`;
  } else {
    const text = collectText(body);
    if (text.length < 2) {
      return `form_element_${id}`;
    } else {
      return slugify(text.toLowerCase(), "_").slice(0, 32);
    }
  }
}

/**
 * Extracts text from the given ProseMirror document up to the character limit
 * @param body ProseMirror document json
 * @param charLimit Character limit
 * @returns string
 */
function collectText(body: any, charLimit = 32) {
  let text = "";
  if (body.text) {
    text += body.text;
  }
  if (body.content && body.content.length) {
    for (const node of body.content) {
      if (text.length > charLimit) {
        return text;
      }
      text += collectText(node);
    }
  }
  return text;
}

export default ExportIdPlugin;
