/**
 * Extracts text from the given ProseMirror document up to the character limit
 * @param body ProseMirror document json
 * @param charLimit Character limit
 * @returns string
 */
export function collectText(body: any, charLimit = 32) {
  let text = "";
  if (body.text) {
    text += body.text + " ";
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

export function collectQuestion(body: any, charLimit = 24) {
  let text = "";
  if (body.text) {
    text += body.text + " ";
  }
  if (body.content && body.content.length) {
    for (const node of body.content) {
      if (text.length > charLimit) {
        return text;
      }
      if (node.type === "question") {
        text += collectText(node);
      }
    }
  }
  return text;
}

export function collectHeaders(body: any, charLimit = 24) {
  let text = "";
  if (body.text) {
    text += body.text + " ";
  }
  if (body.content && body.content.length) {
    for (const node of body.content) {
      if (text.length > charLimit) {
        return text;
      }
      if (node.type === "heading") {
        text += collectText(node);
      }
    }
  }
  return text;
}
