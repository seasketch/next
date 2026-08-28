import { resolveFluent } from "./locale";
import { markdownToProseMirror } from "./markdownToProseMirror";
import { ProseMirrorMark, ProseMirrorNode } from "./proseMirrorTypes";
import { CkanDisplayConfig, CkanMetadataField } from "./types";

export type { ProseMirrorMark, ProseMirrorNode } from "./proseMirrorTypes";

function text(value: string, marks?: ProseMirrorMark[]): ProseMirrorNode {
  return marks && marks.length > 0
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

function paragraph(content: ProseMirrorNode[] = []): ProseMirrorNode {
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

function heading(level: number, value: string): ProseMirrorNode {
  return {
    type: "heading",
    attrs: { level },
    content: [text(value)],
  };
}

function listItem(content: ProseMirrorNode[]): ProseMirrorNode {
  return { type: "list_item", content };
}

function bulletList(items: ProseMirrorNode[]): ProseMirrorNode {
  return { type: "bullet_list", content: items };
}

function labeledItem(label: string, value: string): ProseMirrorNode {
  return listItem([
    paragraph([
      text(`${label}: `, [{ type: "strong" }]),
      text(value),
    ]),
  ]);
}

function labeledListItem(
  label: string,
  values: string[]
): ProseMirrorNode {
  return listItem([
    paragraph([text(`${label}:`, [{ type: "strong" }])]),
    bulletList(values.map((value) => listItem([paragraph([text(value)])]))),
  ]);
}

function linkedText(label: string, href: string): ProseMirrorNode[] {
  return [
    text(label, [{ type: "link", attrs: { href } }]),
  ];
}

function defaultIncluded(field: CkanMetadataField): boolean {
  return field.recommended && !field.technical && field.id !== "resources";
}

export function applyDisplayConfig(
  fields: CkanMetadataField[],
  config?: CkanDisplayConfig | null
): CkanMetadataField[] {
  if (!config?.fields || config.fields.length === 0) {
    return fields.filter(defaultIncluded);
  }
  const byId = new Map(fields.map((field) => [field.id, field]));
  const selected: CkanMetadataField[] = [];
  for (const entry of config.fields) {
    if (!entry.included) {
      continue;
    }
    const field = byId.get(entry.id);
    if (!field) {
      continue;
    }
    selected.push(
      entry.label && entry.label.trim().length > 0
        ? { ...field, label: entry.label }
        : field
    );
  }
  return selected;
}

function resourceNodes(
  resources: unknown,
  lang?: string
): ProseMirrorNode[] {
  if (!Array.isArray(resources) || resources.length === 0) {
    return [];
  }
  const items: ProseMirrorNode[] = [];
  for (const resource of resources) {
    if (!resource || typeof resource !== "object") {
      continue;
    }
    const record = resource as Record<string, unknown>;
    const nameTranslated = record.name_translated;
    let name: string | undefined;
    if (nameTranslated && typeof nameTranslated === "object") {
      const dict = nameTranslated as Record<string, string>;
      const requested = (lang ?? "en").toLowerCase();
      name =
        dict[requested] ||
        dict.en ||
        Object.values(dict).find((value) => typeof value === "string");
    }
    if (!name && typeof record.name === "string") {
      name = record.name;
    }
    const url = typeof record.url === "string" ? record.url : undefined;
    const format = typeof record.format === "string" ? record.format : undefined;
    const label = [name, format].filter(Boolean).join(" · ");
    if (!label && !url) {
      continue;
    }
    items.push(
      listItem([
        paragraph(
          url
            ? linkedText(label || url, url)
            : [text(label || "Resource")]
        ),
      ])
    );
  }
  if (items.length === 0) {
    return [];
  }
  return [bulletList(items)];
}

export interface ToProseMirrorOptions {
  title?: string;
  lang?: string;
  resources?: unknown;
}

export function ckanFieldsToProseMirror(
  fields: CkanMetadataField[],
  config?: CkanDisplayConfig | null,
  options: ToProseMirrorOptions = {}
): ProseMirrorNode {
  const selected = applyDisplayConfig(fields, config);
  const content: ProseMirrorNode[] = [];

  if (options.title && options.title.trim().length > 0) {
    content.push(heading(1, options.title.trim()));
  }

  const description = selected.find((field) => field.id === "notes");
  const rest = selected.filter((field) => field.id !== "notes");

  if (description) {
    const markdown =
      typeof description.value === "string"
        ? description.value
        : typeof description.displayValue === "string"
        ? description.displayValue
        : "";
    const blocks = markdownToProseMirror(markdown);
    if (blocks.length > 0) {
      content.push(...blocks);
    } else if (markdown) {
      content.push(paragraph([text(markdown)]));
    }
  }

  const scalarItems: ProseMirrorNode[] = [];
  const extraBlocks: ProseMirrorNode[] = [];

  for (const field of rest) {
    if (field.id === "resources") {
      continue;
    }
    if (Array.isArray(field.displayValue) && field.displayValue.length > 0) {
      extraBlocks.push(labeledListItem(field.label, field.displayValue));
      continue;
    }
    if (typeof field.displayValue === "string" && field.displayValue.length > 0) {
      if (field.type === "url" && typeof (field.value as { url?: unknown })?.url === "string") {
        scalarItems.push(
          listItem([
            paragraph([
              text(`${field.label}: `, [{ type: "strong" }]),
              ...linkedText(
                field.displayValue,
                (field.value as { url: string }).url
              ),
            ]),
          ])
        );
      } else if (field.type === "markdown") {
        extraBlocks.push(heading(3, field.label));
        extraBlocks.push(...markdownToProseMirror(field.displayValue));
      } else {
        scalarItems.push(labeledItem(field.label, field.displayValue));
      }
    }
  }

  if (scalarItems.length > 0) {
    content.push(bulletList(scalarItems));
  }
  if (extraBlocks.length > 0) {
    if (extraBlocks.every((node) => node.type === "list_item")) {
      content.push(bulletList(extraBlocks));
    } else {
      const listItems = extraBlocks.filter((node) => node.type === "list_item");
      const others = extraBlocks.filter((node) => node.type !== "list_item");
      if (listItems.length > 0) {
        content.push(bulletList(listItems));
      }
      content.push(...others);
    }
  }

  const includeResources =
    config?.includeResources === true ||
    config?.fields?.some((field) => field.id === "resources" && field.included);
  if (includeResources && options.resources) {
    const nodes = resourceNodes(options.resources, options.lang);
    if (nodes.length > 0) {
      content.push(heading(3, "Resources"));
      content.push(...nodes);
    }
  }

  if (content.length === 0) {
    content.push(paragraph());
  }

  return { type: "doc", content };
}

export function packageTitle(
  pkg: Record<string, unknown> | undefined,
  lang?: string
): string | undefined {
  if (!pkg) {
    return undefined;
  }
  const resolved = resolveFluent(pkg.title_translated, lang);
  if (typeof resolved === "string" && resolved.trim().length > 0) {
    return resolved;
  }
  return typeof pkg.title === "string" ? pkg.title : undefined;
}
