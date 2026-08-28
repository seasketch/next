import MarkdownIt from "markdown-it";
import { ProseMirrorMark, ProseMirrorNode } from "./proseMirrorTypes";

interface MarkdownToken {
  type: string;
  tag: string;
  content: string;
  children: MarkdownToken[] | null;
  attrGet: (name: string) => string | null;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

function textNode(text: string, marks?: ProseMirrorMark[]): ProseMirrorNode {
  return marks && marks.length > 0
    ? { type: "text", text, marks }
    : { type: "text", text };
}

function paragraph(content: ProseMirrorNode[] = []): ProseMirrorNode {
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

function inlineToNodes(
  tokens: MarkdownToken[],
  inheritedMarks: ProseMirrorMark[] = []
): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "text") {
      if (token.content) {
        nodes.push(textNode(token.content, inheritedMarks));
      }
      i += 1;
      continue;
    }
    if (token.type === "code_inline") {
      nodes.push(
        textNode(token.content, [
          ...inheritedMarks,
          { type: "code" },
        ])
      );
      i += 1;
      continue;
    }
    if (token.type === "softbreak" || token.type === "hardbreak") {
      nodes.push({ type: "hard_break" });
      i += 1;
      continue;
    }
    if (token.type === "em_open") {
      const close = findClose(tokens, i, "em_close");
      nodes.push(
        ...inlineToNodes(tokens.slice(i + 1, close), [
          ...inheritedMarks,
          { type: "em" },
        ])
      );
      i = close + 1;
      continue;
    }
    if (token.type === "strong_open") {
      const close = findClose(tokens, i, "strong_close");
      nodes.push(
        ...inlineToNodes(tokens.slice(i + 1, close), [
          ...inheritedMarks,
          { type: "strong" },
        ])
      );
      i = close + 1;
      continue;
    }
    if (token.type === "link_open") {
      const href = token.attrGet("href") || "";
      const title = token.attrGet("title") || undefined;
      const close = findClose(tokens, i, "link_close");
      const mark: ProseMirrorMark = {
        type: "link",
        attrs: title ? { href, title } : { href },
      };
      nodes.push(
        ...inlineToNodes(tokens.slice(i + 1, close), [
          ...inheritedMarks,
          mark,
        ])
      );
      i = close + 1;
      continue;
    }
    if (token.children && token.children.length > 0) {
      nodes.push(...inlineToNodes(token.children, inheritedMarks));
    } else if (token.content) {
      nodes.push(textNode(token.content, inheritedMarks));
    }
    i += 1;
  }
  return nodes;
}

function findClose(tokens: MarkdownToken[], start: number, type: string): number {
  let depth = 0;
  for (let i = start + 1; i < tokens.length; i += 1) {
    if (tokens[i].type === tokens[start].type) {
      depth += 1;
    } else if (tokens[i].type === type) {
      if (depth === 0) {
        return i;
      }
      depth -= 1;
    }
  }
  return tokens.length;
}

function consumeList(
  tokens: MarkdownToken[],
  start: number
): { node: ProseMirrorNode; next: number } {
  const open = tokens[start];
  const listType = open.type === "bullet_list_open" ? "bullet_list" : "ordered_list";
  const closeType =
    open.type === "bullet_list_open" ? "bullet_list_close" : "ordered_list_close";
  const items: ProseMirrorNode[] = [];
  let i = start + 1;
  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === "list_item_open") {
      const { nodes, next } = consumeListItem(tokens, i);
      items.push({
        type: "list_item",
        content: nodes.length > 0 ? nodes : [paragraph()],
      });
      i = next;
    } else {
      i += 1;
    }
  }
  return {
    node: { type: listType, content: items },
    next: i + 1,
  };
}

function consumeListItem(
  tokens: MarkdownToken[],
  start: number
): { nodes: ProseMirrorNode[]; next: number } {
  const nodes: ProseMirrorNode[] = [];
  let i = start + 1;
  while (i < tokens.length && tokens[i].type !== "list_item_close") {
    if (
      tokens[i].type === "bullet_list_open" ||
      tokens[i].type === "ordered_list_open"
    ) {
      const nested = consumeList(tokens, i);
      nodes.push(nested.node);
      i = nested.next;
      continue;
    }
    const block = consumeBlock(tokens, i);
    if (block.node) {
      nodes.push(block.node);
    }
    i = block.next;
  }
  return { nodes, next: i + 1 };
}

function consumeBlock(
  tokens: MarkdownToken[],
  start: number
): { node: ProseMirrorNode | null; next: number } {
  const token = tokens[start];
  if (!token) {
    return { node: null, next: start };
  }
  if (token.type === "paragraph_open") {
    const inline = tokens[start + 1];
    const content =
      inline && inline.type === "inline" && inline.children
        ? inlineToNodes(inline.children)
        : [];
    return { node: paragraph(content), next: start + 3 };
  }
  if (token.type === "heading_open") {
    const level = Number(token.tag.replace("h", "")) || 1;
    const inline = tokens[start + 1];
    const content =
      inline && inline.type === "inline" && inline.children
        ? inlineToNodes(inline.children)
        : [];
    return {
      node: {
        type: "heading",
        attrs: { level: Math.min(Math.max(level, 1), 6) },
        content,
      },
      next: start + 3,
    };
  }
  if (token.type === "blockquote_open") {
    const inner: ProseMirrorNode[] = [];
    let i = start + 1;
    while (i < tokens.length && tokens[i].type !== "blockquote_close") {
      const block = consumeBlock(tokens, i);
      if (block.node) {
        inner.push(block.node);
      }
      i = block.next;
    }
    return {
      node: {
        type: "blockquote",
        content: inner.length > 0 ? inner : [paragraph()],
      },
      next: i + 1,
    };
  }
  if (token.type === "code_block" || token.type === "fence") {
    return {
      node: {
        type: "code_block",
        content: token.content
          ? [{ type: "text", text: token.content.replace(/\n$/, "") }]
          : [],
      },
      next: start + 1,
    };
  }
  if (
    token.type === "bullet_list_open" ||
    token.type === "ordered_list_open"
  ) {
    return consumeList(tokens, start);
  }
  if (token.type === "hr") {
    return { node: { type: "horizontal_rule" }, next: start + 1 };
  }
  if (token.type === "inline" && token.children) {
    return { node: paragraph(inlineToNodes(token.children)), next: start + 1 };
  }
  return { node: null, next: start + 1 };
}

export function markdownToProseMirror(markdown: string): ProseMirrorNode[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }
  const tokens = md.parse(markdown, {}) as MarkdownToken[];
  const nodes: ProseMirrorNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const block = consumeBlock(tokens, i);
    if (block.node) {
      nodes.push(block.node);
    }
    if (block.next <= i) {
      i += 1;
    } else {
      i = block.next;
    }
  }
  return nodes;
}
