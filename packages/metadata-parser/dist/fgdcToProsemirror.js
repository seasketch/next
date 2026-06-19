"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fgdcToProseMirror = fgdcToProseMirror;
exports.getAttribution = getAttribution;
const createParagraphNode_1 = require("./createParagraphNode");
// Helper function to safely access arrays
const getFirst = (value) => Array.isArray(value) && value.length > 0 ? value[0] : "";
// Function to create a text node
function createTextNode(content) {
    if (content === "") {
        content = "     ";
    }
    return {
        type: "text",
        text: content,
    };
}
// Function to create a heading node
function createHeadingNode(content, level) {
    return {
        type: "heading",
        attrs: { level },
        content: content,
    };
}
// Function to create a table cell node
function createTableCellNode(content) {
    return {
        type: "table_cell",
        content: [(0, createParagraphNode_1.createParagraphNode)(content)],
    };
}
// Function to create a table row node
function createTableRowNode(cells) {
    return {
        type: "table_row",
        content: cells,
    };
}
// Function to create a table node
function createTableNode(rows) {
    return {
        type: "table",
        content: rows,
    };
}
// Function to create a bullet list node
function createBulletListNode(items) {
    return {
        type: "bullet_list",
        content: items,
    };
}
// Function to create list item node
function createListItemNode(content) {
    return {
        type: "list_item",
        content: [(0, createParagraphNode_1.createParagraphNode)(content)],
    };
}
// Main function to generate ProseMirror nodes from Esri metadata
function fgdcToProseMirror(metadata) {
    var _a, _b, _c, _d, _e;
    const doc = { type: "doc", content: [] };
    // Title
    const idinfo = getFirst((_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo);
    const citation = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.citation);
    const citeinfo = getFirst(citation === null || citation === void 0 ? void 0 : citation.citeinfo);
    const title = getFirst(citeinfo === null || citeinfo === void 0 ? void 0 : citeinfo.title);
    // if (title) {
    //   doc.content.push(createHeadingNode([createTextNode(title)], 1));
    // }
    // Abstract
    const descript = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.descript);
    const abstract = getFirst(descript === null || descript === void 0 ? void 0 : descript.abstract);
    if (abstract) {
        doc.content.push(createHeadingNode([createTextNode("Abstract")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([
            createTextNode(abstract.split("Attribute Fields:")[0]),
        ]));
    }
    // Purpose
    const purpose = getFirst(descript === null || descript === void 0 ? void 0 : descript.purpose);
    if (purpose) {
        doc.content.push(createHeadingNode([createTextNode("Purpose")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(purpose)]));
    }
    // Keywords
    const keywords = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.keywords);
    const theme = getFirst(keywords === null || keywords === void 0 ? void 0 : keywords.theme);
    const themeKeywords = (_b = theme === null || theme === void 0 ? void 0 : theme.themekey) === null || _b === void 0 ? void 0 : _b.filter(Boolean).join(", ");
    if (themeKeywords) {
        doc.content.push(createHeadingNode([createTextNode("Keywords")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(themeKeywords)]));
    }
    // Use Constraints
    const useConstraints = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.useconst);
    if (useConstraints) {
        doc.content.push(createHeadingNode([createTextNode("Use Constraints")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([
            createTextNode(useConstraints.split("Downloaded data filename:")[0]),
        ]));
    }
    // Attribute Information (Table using ProseMirror Table Schema)
    const eainfo = getFirst((_c = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _c === void 0 ? void 0 : _c.eainfo);
    const detailed = ((_d = eainfo === null || eainfo === void 0 ? void 0 : eainfo.detailed) === null || _d === void 0 ? void 0 : _d[0]) || {};
    const attributes = (detailed === null || detailed === void 0 ? void 0 : detailed.attr) || [];
    if (attributes.length > 0) {
        doc.content.push(createHeadingNode([createTextNode("Attribute Information")], 2));
        const tableRows = [];
        // Create header row
        const headerRow = createTableRowNode([
            createTableCellNode([createTextNode("Attribute Label")]),
            createTableCellNode([createTextNode("Definition")]),
            createTableCellNode([createTextNode("Domain")]),
        ]);
        tableRows.push(headerRow);
        // Create data rows
        attributes.forEach((attr) => {
            var _a, _b;
            const label = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrlabl) || "Unknown";
            const definition = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdef);
            let domain = "  ";
            const attrdomv = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdomv);
            if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom) {
                domain = getFirst(attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom);
            }
            else if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) {
                const rdommin = getFirst((_a = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _a === void 0 ? void 0 : _a.rdommin);
                const rdommax = getFirst((_b = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _b === void 0 ? void 0 : _b.rdommax);
                if (rdommin && rdommax) {
                    domain = `${rdommin} to ${rdommax}`;
                }
                else if (rdommin || rdommax) {
                    domain = `Value: ${rdommin || rdommax}`;
                }
            }
            const dataRow = createTableRowNode([
                createTableCellNode([createTextNode(label)]),
                createTableCellNode([createTextNode(definition || "  ")]),
                createTableCellNode([createTextNode(domain)]),
            ]);
            tableRows.push(dataRow);
        });
        const tableNode = createTableNode(tableRows);
        doc.content.push(tableNode);
    }
    // Contact Information
    const metainfo = getFirst((_e = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _e === void 0 ? void 0 : _e.metainfo);
    const metc = getFirst(metainfo === null || metainfo === void 0 ? void 0 : metainfo.metc);
    const cntinfo = getFirst(metc === null || metc === void 0 ? void 0 : metc.cntinfo);
    const cntorgp = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntorgp);
    const contactOrg = getFirst(cntorgp === null || cntorgp === void 0 ? void 0 : cntorgp.cntorg);
    const contactPerson = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntper);
    const contactPhone = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntvoice);
    const contactEmail = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntemail);
    const cntaddr = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntaddr);
    const contactAddress = getFirst(cntaddr === null || cntaddr === void 0 ? void 0 : cntaddr.address);
    if (contactOrg ||
        contactPerson ||
        contactPhone ||
        contactEmail ||
        contactAddress) {
        const contactInfoContent = [];
        doc.content.push(createHeadingNode([createTextNode("Contact Information")], 2));
        if (contactOrg)
            contactInfoContent.push(createListItemNode([createTextNode(`Organization: ${contactOrg}`)]));
        if (contactPerson)
            contactInfoContent.push(createListItemNode([createTextNode(`Contact Person: ${contactPerson}`)]));
        if (contactPhone)
            contactInfoContent.push(createListItemNode([createTextNode(`Phone: ${contactPhone}`)]));
        if (contactEmail)
            contactInfoContent.push(createListItemNode([createTextNode(`Email: ${contactEmail}`)]));
        if (contactAddress)
            contactInfoContent.push(createListItemNode([createTextNode(`Address: ${contactAddress}`)]));
        doc.content.push(createBulletListNode(contactInfoContent));
    }
    const attribution = getAttribution(metadata);
    return {
        title,
        doc,
        attribution,
        type: "FGDC",
    };
}
function getAttribution(metadata) {
    var _a, _b;
    const getFirst = (value) => Array.isArray(value) && value.length > 0 ? value[0] : "";
    // Try to retrieve the organization from the citation info
    const idinfo = getFirst((_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo);
    const citation = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.citation);
    const citeinfo = getFirst(citation === null || citation === void 0 ? void 0 : citation.citeinfo);
    const organization = getFirst(citeinfo === null || citeinfo === void 0 ? void 0 : citeinfo.origin);
    if (organization) {
        return organization;
    }
    // Fallback to contact organization if citation doesn't have origin
    const metainfo = getFirst((_b = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _b === void 0 ? void 0 : _b.metainfo);
    const metc = getFirst(metainfo === null || metainfo === void 0 ? void 0 : metainfo.metc);
    const cntinfo = getFirst(metc === null || metc === void 0 ? void 0 : metc.cntinfo);
    const cntorgp = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntorgp);
    const contactOrg = getFirst(cntorgp === null || cntorgp === void 0 ? void 0 : cntorgp.cntorg);
    return contactOrg || undefined;
}
//# sourceMappingURL=fgdcToProsemirror.js.map