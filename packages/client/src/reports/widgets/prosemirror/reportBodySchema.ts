import { Schema, Node, NodeSpec } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { detailsNodes } from "./details";
import { baseSchema } from "../../../editor/config";

export type ImageLayout = "center" | "left" | "right" | "full";

// Base marks: ensure links open in a new tab
const baseMarks = baseSchema.spec.marks.update("link", {
  ...baseSchema.spec.marks.get("link"),
  toDOM: (node) => {
    let { href, title } = node.attrs;
    return ["a", { href, title, target: "_blank" }, 0];
  },
});

// Metric node specs (inline and block) used by report widgets
const metricSpec: NodeSpec = {
  attrs: {
    metrics: { default: [] },
    type: { default: "InlineMetric" },
    componentSettings: { default: {} },
  },
  inline: true,
  group: "inline",
  draggable: true,
  parseDOM: [
    {
      tag: "span[data-report-react-node='metric']",
      getAttrs: (dom: string | HTMLElement) => {
        if (typeof dom === "string") {
          return {
            metrics: [],
            type: "InlineMetric",
            componentSettings: {},
          };
        }
        const metricsAttr = (dom as HTMLElement).getAttribute("data-metrics");
        const componentType =
          (dom as HTMLElement).getAttribute("data-component-type") ||
          "InlineMetric";
        const componentSettingsAttr = (dom as HTMLElement).getAttribute(
          "data-component-settings"
        );
        return {
          metrics: metricsAttr ? JSON.parse(metricsAttr) : [],
          type: componentType,
          componentSettings: componentSettingsAttr
            ? JSON.parse(componentSettingsAttr)
            : {},
        };
      },
    },
  ],
  toDOM: (node: Node) => {
    const { metrics, type, componentSettings } = node.attrs;
    return [
      "span",
      {
        "data-report-react-node": "metric",
        "data-component-type": type || "InlineMetric",
        "data-metrics": JSON.stringify(metrics || []),
        "data-component-settings": JSON.stringify(componentSettings || {}),
      },
      `{${metrics?.[0]?.type || "metric"}}`,
    ];
  },
};

const blockMetricSpec: NodeSpec = {
  ...metricSpec,
  group: "block",
  draggable: true,
  inline: false,
  parseDOM: [
    {
      tag: "div[data-report-react-node='blockMetric']",
      getAttrs: (dom: string | HTMLElement) => {
        if (typeof dom === "string") {
          return {
            metrics: [],
            type: "InlineMetric",
            componentSettings: {},
          };
        }
        const metricsAttr = (dom as HTMLElement).getAttribute("data-metrics");
        const componentType =
          (dom as HTMLElement).getAttribute("data-component-type") ||
          "InlineMetric";
        const componentSettingsAttr = (dom as HTMLElement).getAttribute(
          "data-component-settings"
        );
        return {
          metrics: metricsAttr ? JSON.parse(metricsAttr) : [],
          type: componentType,
          componentSettings: componentSettingsAttr
            ? JSON.parse(componentSettingsAttr)
            : {},
        };
      },
    },
  ],
  toDOM: (node: Node) => {
    const { metrics, type, componentSettings } = node.attrs;
    return [
      "div",
      {
        "data-report-react-node": "blockMetric",
        "data-component-type": type || "InlineMetric",
        "data-metrics": JSON.stringify(metrics || []),
        "data-component-settings": JSON.stringify(componentSettings || {}),
      },
      `{${metrics?.[0]?.type || "blockMetric"}}`,
    ];
  },
};

// Start from base schema and add report title node and heading tweaks
const reportTitleNode: NodeSpec = {
  content: "text*",
  group: "block",
  defining: true,
  marks: "",
  parseDOM: [{ tag: "h1[data-report-title]" }],
  toDOM: function () {
    return ["h1", { "data-report-title": "yes" }, 0];
  },
};

const reportNodes = addListNodes(
  baseSchema.spec.nodes
    .append({ reportTitle: reportTitleNode })
    .update("heading", {
      attrs: { level: { default: 2 } },
      content: "inline*",
      group: "block",
      defining: true,
      isReporting: true,
      parseDOM: [
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
      ],
      toDOM: (node: Node) => {
        const level = node.attrs.level === 3 ? 3 : 2;
        return ["h" + level, 0];
      },
    })
    .update("doc", { content: "reportTitle block*" }),
  "paragraph block*",
  "block"
);

const reportImageSpec: NodeSpec = {
  attrs: {
    src: {},
    alt: { default: "" },
    title: { default: null },
    layout: { default: "center" as ImageLayout },
    width: { default: null },
  },
  group: "block",
  draggable: true,
  selectable: true,
  atom: true,
  parseDOM: [
    {
      tag: "div[data-report-image]",
      getAttrs(dom: string | HTMLElement) {
        if (typeof dom === "string") return {};
        const img = (dom as HTMLElement).querySelector("img");
        return {
          src: img?.getAttribute("src") || "",
          alt: img?.getAttribute("alt") || "",
          title: img?.getAttribute("title") || null,
          layout:
            (dom as HTMLElement).getAttribute("data-layout") || "center",
          width: (dom as HTMLElement).getAttribute("data-width") || null,
        };
      },
    },
    {
      tag: "img[src]",
      getAttrs(dom: string | HTMLElement) {
        if (typeof dom === "string") return {};
        return {
          src: (dom as HTMLElement).getAttribute("src"),
          alt: (dom as HTMLElement).getAttribute("alt") || "",
          title: (dom as HTMLElement).getAttribute("title") || null,
        };
      },
    },
  ],
  toDOM(node: Node) {
    const { src, alt, title, layout, width } = node.attrs;
    const imgAttrs: Record<string, string> = {
      src,
      style: "max-width: 100%; height: auto; display: block;",
    };
    if (alt) imgAttrs.alt = alt;
    if (title) imgAttrs.title = title;

    const divStyles: string[] = [];
    switch (layout) {
      case "left":
        divStyles.push(
          "float: left",
          "margin-right: 1em",
          "margin-bottom: 0.5em",
          "clear: left"
        );
        break;
      case "right":
        divStyles.push(
          "float: right",
          "margin-left: 1em",
          "margin-bottom: 0.5em",
          "clear: right"
        );
        break;
      case "full":
        divStyles.push("width: 100%");
        break;
      case "center":
      default:
        divStyles.push("margin-left: auto", "margin-right: auto");
        break;
    }
    if (width) {
      // eslint-disable-next-line i18next/no-literal-string
      divStyles.push(`width: ${width}%`);
    }

    return [
      "div",
      {
        "data-report-image": "true",
        "data-layout": layout || "center",
        "data-width": width || "",
        style: divStyles.join("; "),
      },
      ["img", imgAttrs],
    ];
  },
};

// Results paragraph - a paragraph with special styling for calculated results
const resultsParagraphSpec: NodeSpec = {
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p.results-paragraph" }],
  toDOM() {
    return ["p", { class: "results-paragraph" }, 0];
  },
};

// Add metrics and details/summary nodes
const { details, summary } = detailsNodes();

const nodes = reportNodes
  .update("image", reportImageSpec)
  .append({
    metric: metricSpec,
    blockMetric: blockMetricSpec,
    details,
    summary,
    resultsParagraph: resultsParagraphSpec,
  });

export const reportBodySchema = new Schema({
  nodes,
  marks: baseMarks,
});

// Backwards compatibility helper
export function createReportCardSchema(): Schema {
  return reportBodySchema;
}

/**
 * Migrate legacy inline image nodes to block-level. Before the image node
 * was changed to a block node, pasted images ended up inside paragraphs.
 * This function lifts them out so Node.fromJSON can parse the document.
 */
export function migrateInlineImagesToBlock(doc: any): any {
  if (!doc || !Array.isArray(doc.content)) return doc;
  const newContent: any[] = [];
  for (const block of doc.content) {
    if (
      (block.type === "paragraph" || block.type === "resultsParagraph") &&
      Array.isArray(block.content)
    ) {
      const hasImage = block.content.some((c: any) => c.type === "image");
      if (hasImage) {
        let textRun: any[] = [];
        for (const child of block.content) {
          if (child.type === "image") {
            if (textRun.length > 0) {
              newContent.push({ type: block.type, content: textRun });
              textRun = [];
            }
            newContent.push({
              type: "image",
              attrs: {
                src: child.attrs?.src || "",
                alt: child.attrs?.alt || "",
                title: child.attrs?.title || null,
                layout: child.attrs?.layout || "center",
                width: child.attrs?.width || null,
              },
            });
          } else {
            textRun.push(child);
          }
        }
        if (textRun.length > 0) {
          newContent.push({ type: block.type, content: textRun });
        }
        continue;
      }
    }
    if (Array.isArray(block.content)) {
      newContent.push(migrateInlineImagesToBlock(block));
    } else {
      newContent.push(block);
    }
  }
  return { ...doc, content: newContent };
}

type PMJSONNode = {
  type?: string;
  attrs?: Record<string, any>;
  content?: PMJSONNode[];
};

/**
 * Walk a ProseMirror JSON document and clear the `open` attribute on details nodes.
 * Accepts the JSON form (not a ProseMirror Node instance), mutates in place for simplicity.
 */
export function setCollapsibleBlocksClosed(doc: PMJSONNode): PMJSONNode {
  if (doc.type === "details") {
    if (!doc.attrs) {
      doc.attrs = {};
    }
    doc.attrs.open = false;
  }
  if (Array.isArray(doc.content)) {
    for (const child of doc.content) {
      setCollapsibleBlocksClosed(child);
    }
  }
  return doc;
}
