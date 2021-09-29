import { defaultMarkdownParser } from "prosemirror-markdown";
export default function fromMarkdown(md: string) {
  return defaultMarkdownParser.parse(md).toJSON();
}
