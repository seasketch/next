import { defaultMarkdownParser } from "prosemirror-markdown";
import { Node } from "prosemirror-model";
export default function fromMarkdown(md: string) {
  return defaultMarkdownParser.parse(md).toJSON();
}

type NodeType = {
  type: string;
  attrs?: { [key: string]: any };
  content?: NodeType[];
};

export function questionBodyFromMarkdown(md: string) {
  const json = defaultMarkdownParser.parse(md).toJSON();
  const visit = (node: NodeType) => {
    for (const child of node.content || []) {
      visit(child);
    }
    if (node.type === "heading" && node.attrs?.level === 1) {
      node.attrs = {};
      node.type = "question";
    }
  };
  visit(json as NodeType);
  return json;
}
