export type MetadataFormat = "json" | "html" | "txt" | "md";

type Mark = { type?: string; attrs?: { href?: string; title?: string | null } };
type PmNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: PmNode[];
};

export function parseMetadataFormat(value: unknown): MetadataFormat | null {
  const format = typeof value === "string" && value ? value.toLowerCase() : "json";
  if (format === "markdown") {
    return "md";
  }
  if (format === "json" || format === "html" || format === "txt" || format === "md") {
    return format;
  }
  return null;
}

export function renderMetadata(document: unknown, format: MetadataFormat): string {
  const doc = asNode(document);
  if (format === "json") {
    return JSON.stringify(doc ?? document);
  }
  if (!doc) {
    return "";
  }
  if (format === "html") {
    const body = renderHtml(doc);
    return `<!DOCTYPE html>\n<meta charset="utf-8">\n<article>\n${body}\n</article>\n`;
  }
  if (format === "md") {
    return renderMarkdown(doc).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  return renderText(doc).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function asNode(value: unknown): PmNode | null {
  if (typeof value === "string") {
    try {
      return asNode(JSON.parse(value));
    } catch {
      return { type: "paragraph", content: [{ type: "text", text: value }] };
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as PmNode;
  }
  return null;
}

function renderHtml(node: PmNode): string {
  const children = (node.content || []).map(renderHtml).join("");
  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p>${children}</p>\n`;
    case "heading":
      return `<h${headingLevel(node)}>${children}</h${headingLevel(node)}>\n`;
    case "blockquote":
      return `<blockquote>${children}</blockquote>\n`;
    case "code_block":
      return `<pre><code>${escapeHtml(textOf(node))}</code></pre>\n`;
    case "bullet_list":
      return `<ul>\n${children}</ul>\n`;
    case "ordered_list":
      return `<ol>\n${children}</ol>\n`;
    case "list_item":
      return `<li>${children}</li>\n`;
    case "horizontal_rule":
      return "<hr>\n";
    case "hard_break":
      return "<br>\n";
    case "image":
      return `<img src="${escapeHtml(stringAttr(node, "src"))}" alt="${escapeHtml(
        stringAttr(node, "alt")
      )}">`;
    case "table":
      return `<table>\n${children}</table>\n`;
    case "table_row":
      return `<tr>${children}</tr>\n`;
    case "table_header":
      return `<th>${children}</th>`;
    case "table_cell":
      return `<td>${children}</td>`;
    case "text":
      return applyHtmlMarks(node.text || "", node.marks || []);
    default:
      return children;
  }
}

function renderText(node: PmNode): string {
  switch (node.type) {
    case "doc":
      return blocks(node, renderText);
    case "paragraph":
    case "heading":
    case "blockquote":
      return `${inlineText(node)}\n\n`;
    case "code_block":
      return `${textOf(node)}\n\n`;
    case "bullet_list":
    case "ordered_list":
      return `${(node.content || [])
        .map((item, index) => {
          const body = inlineText(item).trim();
          const marker = node.type === "ordered_list" ? `${index + 1}. ` : "- ";
          return `${marker}${body}`;
        })
        .join("\n")}\n\n`;
    case "list_item":
      return inlineText(node);
    case "horizontal_rule":
      return "\n";
    case "hard_break":
      return "\n";
    case "image":
      return stringAttr(node, "alt") || stringAttr(node, "src");
    case "text":
      return textWithLink(node.text || "", node.marks || []);
    default:
      return blocks(node, renderText);
  }
}

function renderMarkdown(node: PmNode): string {
  switch (node.type) {
    case "doc":
      return blocks(node, renderMarkdown);
    case "paragraph":
      return `${inlineMarkdown(node)}\n\n`;
    case "heading":
      return `${"#".repeat(headingLevel(node))} ${inlineMarkdown(node)}\n\n`;
    case "blockquote":
      return `${inlineMarkdown(node)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    case "code_block":
      return "```\n" + textOf(node) + "\n```\n\n";
    case "bullet_list":
    case "ordered_list":
      return `${(node.content || [])
        .map((item, index) => {
          const body = inlineMarkdown(item).trim();
          const marker = node.type === "ordered_list" ? `${index + 1}. ` : "- ";
          return `${marker}${body}`;
        })
        .join("\n")}\n\n`;
    case "list_item":
      return inlineMarkdown(node);
    case "horizontal_rule":
      return "---\n\n";
    case "hard_break":
      return "  \n";
    case "image": {
      const src = stringAttr(node, "src");
      const alt = stringAttr(node, "alt");
      return src ? `![${alt}](${src})` : alt;
    }
    case "table":
      return renderMarkdownTable(node);
    case "text":
      return applyMarkdownMarks(node.text || "", node.marks || []);
    default:
      return blocks(node, renderMarkdown);
  }
}

function renderMarkdownTable(node: PmNode): string {
  const rows = (node.content || []).filter((row) => row.type === "table_row");
  if (rows.length === 0) {
    return "";
  }
  const cells = rows.map((row) =>
    (row.content || []).map((cell) => inlineMarkdown(cell).replace(/\|/g, "\\|").trim())
  );
  const width = Math.max(...cells.map((row) => row.length));
  const padded = cells.map((row) => {
    const copy = row.slice();
    while (copy.length < width) {
      copy.push("");
    }
    return `| ${copy.join(" | ")} |`;
  });
  const rule = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return `${padded[0]}\n${rule}\n${padded.slice(1).join("\n")}\n\n`;
}

function blocks(node: PmNode, render: (node: PmNode) => string): string {
  return (node.content || []).map(render).join("");
}

function inlineText(node: PmNode): string {
  if (node.type === "text") {
    return textWithLink(node.text || "", node.marks || []);
  }
  if (node.type === "hard_break") {
    return "\n";
  }
  if (node.type === "image") {
    return stringAttr(node, "alt") || stringAttr(node, "src");
  }
  return (node.content || []).map(inlineText).join("");
}

function inlineMarkdown(node: PmNode): string {
  if (node.type === "text") {
    return applyMarkdownMarks(node.text || "", node.marks || []);
  }
  if (node.type === "hard_break") {
    return "  \n";
  }
  if (node.type === "image") {
    const src = stringAttr(node, "src");
    const alt = stringAttr(node, "alt");
    return src ? `![${alt}](${src})` : alt;
  }
  return (node.content || []).map(inlineMarkdown).join("");
}

function textWithLink(text: string, marks: Mark[]): string {
  const link = marks.find((mark) => mark.type === "link" && mark.attrs?.href);
  if (!link?.attrs?.href || link.attrs.href === text) {
    return text;
  }
  return `${text} (${link.attrs.href})`;
}

function applyHtmlMarks(text: string, marks: Mark[]): string {
  let html = escapeHtml(text);
  for (const mark of marks) {
    if (mark.type === "strong") {
      html = `<strong>${html}</strong>`;
    } else if (mark.type === "em") {
      html = `<em>${html}</em>`;
    } else if (mark.type === "code") {
      html = `<code>${html}</code>`;
    } else if (mark.type === "link" && mark.attrs?.href) {
      html = `<a href="${escapeHtml(mark.attrs.href)}">${html}</a>`;
    }
  }
  return html;
}

function applyMarkdownMarks(text: string, marks: Mark[]): string {
  let rendered = text.replace(/([\\`*_{}\[\]()#+\-.!|])/g, "\\$1");
  for (const mark of marks) {
    if (mark.type === "code") {
      rendered = "`" + text.replace(/`/g, "\\`") + "`";
    } else if (mark.type === "strong") {
      rendered = `**${rendered}**`;
    } else if (mark.type === "em") {
      rendered = `*${rendered}*`;
    } else if (mark.type === "link" && mark.attrs?.href) {
      rendered = `[${rendered}](${mark.attrs.href})`;
    }
  }
  return rendered;
}

function textOf(node: PmNode): string {
  if (node.type === "text") {
    return node.text || "";
  }
  return (node.content || []).map(textOf).join("");
}

function headingLevel(node: PmNode): number {
  const level = node.attrs?.level;
  if (typeof level === "number" && level >= 1 && level <= 6) {
    return level;
  }
  return 1;
}

function stringAttr(node: PmNode, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
