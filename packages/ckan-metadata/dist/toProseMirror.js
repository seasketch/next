"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDisplayConfig = applyDisplayConfig;
exports.ckanFieldsToProseMirror = ckanFieldsToProseMirror;
exports.packageTitle = packageTitle;
const locale_1 = require("./locale");
const markdownToProseMirror_1 = require("./markdownToProseMirror");
function text(value, marks) {
    return marks && marks.length > 0
        ? { type: "text", text: value, marks }
        : { type: "text", text: value };
}
function paragraph(content = []) {
    return content.length > 0
        ? { type: "paragraph", content }
        : { type: "paragraph" };
}
function heading(level, value) {
    return {
        type: "heading",
        attrs: { level },
        content: [text(value)],
    };
}
function listItem(content) {
    return { type: "list_item", content };
}
function bulletList(items) {
    return { type: "bullet_list", content: items };
}
function labeledItem(label, value) {
    return listItem([
        paragraph([
            text(`${label}: `, [{ type: "strong" }]),
            text(value),
        ]),
    ]);
}
function labeledListItem(label, values) {
    return listItem([
        paragraph([text(`${label}:`, [{ type: "strong" }])]),
        bulletList(values.map((value) => listItem([paragraph([text(value)])]))),
    ]);
}
function linkedText(label, href) {
    return [
        text(label, [{ type: "link", attrs: { href } }]),
    ];
}
function defaultIncluded(field) {
    return field.recommended && !field.technical && field.id !== "resources";
}
function applyDisplayConfig(fields, config) {
    if (!config?.fields || config.fields.length === 0) {
        return fields.filter(defaultIncluded);
    }
    const byId = new Map(fields.map((field) => [field.id, field]));
    const selected = [];
    for (const entry of config.fields) {
        if (!entry.included) {
            continue;
        }
        const field = byId.get(entry.id);
        if (!field) {
            continue;
        }
        selected.push(entry.label && entry.label.trim().length > 0
            ? { ...field, label: entry.label }
            : field);
    }
    return selected;
}
function resourceNodes(resources, lang) {
    if (!Array.isArray(resources) || resources.length === 0) {
        return [];
    }
    const items = [];
    for (const resource of resources) {
        if (!resource || typeof resource !== "object") {
            continue;
        }
        const record = resource;
        const nameTranslated = record.name_translated;
        let name;
        if (nameTranslated && typeof nameTranslated === "object") {
            const dict = nameTranslated;
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
        items.push(listItem([
            paragraph(url
                ? linkedText(label || url, url)
                : [text(label || "Resource")]),
        ]));
    }
    if (items.length === 0) {
        return [];
    }
    return [bulletList(items)];
}
function ckanFieldsToProseMirror(fields, config, options = {}) {
    const selected = applyDisplayConfig(fields, config);
    const content = [];
    if (options.title && options.title.trim().length > 0) {
        content.push(heading(1, options.title.trim()));
    }
    const description = selected.find((field) => field.id === "notes");
    const rest = selected.filter((field) => field.id !== "notes");
    if (description) {
        const markdown = typeof description.value === "string"
            ? description.value
            : typeof description.displayValue === "string"
                ? description.displayValue
                : "";
        const blocks = (0, markdownToProseMirror_1.markdownToProseMirror)(markdown);
        if (blocks.length > 0) {
            content.push(...blocks);
        }
        else if (markdown) {
            content.push(paragraph([text(markdown)]));
        }
    }
    const scalarItems = [];
    const extraBlocks = [];
    for (const field of rest) {
        if (field.id === "resources") {
            continue;
        }
        if (Array.isArray(field.displayValue) && field.displayValue.length > 0) {
            extraBlocks.push(labeledListItem(field.label, field.displayValue));
            continue;
        }
        if (typeof field.displayValue === "string" && field.displayValue.length > 0) {
            if (field.type === "url" && typeof field.value?.url === "string") {
                scalarItems.push(listItem([
                    paragraph([
                        text(`${field.label}: `, [{ type: "strong" }]),
                        ...linkedText(field.displayValue, field.value.url),
                    ]),
                ]));
            }
            else if (field.type === "markdown") {
                extraBlocks.push(heading(3, field.label));
                extraBlocks.push(...(0, markdownToProseMirror_1.markdownToProseMirror)(field.displayValue));
            }
            else {
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
        }
        else {
            const listItems = extraBlocks.filter((node) => node.type === "list_item");
            const others = extraBlocks.filter((node) => node.type !== "list_item");
            if (listItems.length > 0) {
                content.push(bulletList(listItems));
            }
            content.push(...others);
        }
    }
    const includeResources = config?.includeResources === true ||
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
function packageTitle(pkg, lang) {
    if (!pkg) {
        return undefined;
    }
    const resolved = (0, locale_1.resolveFluent)(pkg.title_translated, lang);
    if (typeof resolved === "string" && resolved.trim().length > 0) {
        return resolved;
    }
    return typeof pkg.title === "string" ? pkg.title : undefined;
}
//# sourceMappingURL=toProseMirror.js.map