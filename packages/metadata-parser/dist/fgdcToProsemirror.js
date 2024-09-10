"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fgdcToProseMirror = fgdcToProseMirror;
exports.getAttribution = getAttribution;
var createParagraphNode_1 = require("./createParagraphNode");
// Helper function to safely access arrays
var getFirst = function (value) {
    return Array.isArray(value) && value.length > 0 ? value[0] : "";
};
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
        attrs: { level: level },
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
    var doc = { type: "doc", content: [] };
    // Title
    var idinfo = getFirst((_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo);
    var citation = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.citation);
    var citeinfo = getFirst(citation === null || citation === void 0 ? void 0 : citation.citeinfo);
    var title = getFirst(citeinfo === null || citeinfo === void 0 ? void 0 : citeinfo.title);
    // if (title) {
    //   doc.content.push(createHeadingNode([createTextNode(title)], 1));
    // }
    // Abstract
    var descript = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.descript);
    var abstract = getFirst(descript === null || descript === void 0 ? void 0 : descript.abstract);
    if (abstract) {
        doc.content.push(createHeadingNode([createTextNode("Abstract")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([
            createTextNode(abstract.split("Attribute Fields:")[0]),
        ]));
    }
    // Purpose
    var purpose = getFirst(descript === null || descript === void 0 ? void 0 : descript.purpose);
    if (purpose) {
        doc.content.push(createHeadingNode([createTextNode("Purpose")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(purpose)]));
    }
    // Keywords
    var keywords = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.keywords);
    var theme = getFirst(keywords === null || keywords === void 0 ? void 0 : keywords.theme);
    var themeKeywords = (_b = theme === null || theme === void 0 ? void 0 : theme.themekey) === null || _b === void 0 ? void 0 : _b.filter(Boolean).join(", ");
    if (themeKeywords) {
        doc.content.push(createHeadingNode([createTextNode("Keywords")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(themeKeywords)]));
    }
    // Use Constraints
    var useConstraints = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.useconst);
    if (useConstraints) {
        doc.content.push(createHeadingNode([createTextNode("Use Constraints")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([
            createTextNode(useConstraints.split("Downloaded data filename:")[0]),
        ]));
    }
    // Attribute Information (Table using ProseMirror Table Schema)
    var eainfo = getFirst((_c = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _c === void 0 ? void 0 : _c.eainfo);
    var detailed = ((_d = eainfo === null || eainfo === void 0 ? void 0 : eainfo.detailed) === null || _d === void 0 ? void 0 : _d[0]) || {};
    var attributes = (detailed === null || detailed === void 0 ? void 0 : detailed.attr) || [];
    if (attributes.length > 0) {
        doc.content.push(createHeadingNode([createTextNode("Attribute Information")], 2));
        var tableRows_1 = [];
        // Create header row
        var headerRow = createTableRowNode([
            createTableCellNode([createTextNode("Attribute Label")]),
            createTableCellNode([createTextNode("Definition")]),
            createTableCellNode([createTextNode("Domain")]),
        ]);
        tableRows_1.push(headerRow);
        // Create data rows
        attributes.forEach(function (attr) {
            var _a, _b;
            var label = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrlabl) || "Unknown";
            var definition = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdef);
            var domain = "  ";
            var attrdomv = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdomv);
            if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom) {
                domain = getFirst(attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom);
            }
            else if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) {
                var rdommin = getFirst((_a = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _a === void 0 ? void 0 : _a.rdommin);
                var rdommax = getFirst((_b = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _b === void 0 ? void 0 : _b.rdommax);
                if (rdommin && rdommax) {
                    domain = "".concat(rdommin, " to ").concat(rdommax);
                }
                else if (rdommin || rdommax) {
                    domain = "Value: ".concat(rdommin || rdommax);
                }
            }
            var dataRow = createTableRowNode([
                createTableCellNode([createTextNode(label)]),
                createTableCellNode([createTextNode(definition || "  ")]),
                createTableCellNode([createTextNode(domain)]),
            ]);
            tableRows_1.push(dataRow);
        });
        var tableNode = createTableNode(tableRows_1);
        doc.content.push(tableNode);
    }
    // Contact Information
    var metainfo = getFirst((_e = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _e === void 0 ? void 0 : _e.metainfo);
    var metc = getFirst(metainfo === null || metainfo === void 0 ? void 0 : metainfo.metc);
    var cntinfo = getFirst(metc === null || metc === void 0 ? void 0 : metc.cntinfo);
    var cntorgp = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntorgp);
    var contactOrg = getFirst(cntorgp === null || cntorgp === void 0 ? void 0 : cntorgp.cntorg);
    var contactPerson = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntper);
    var contactPhone = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntvoice);
    var contactEmail = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntemail);
    var cntaddr = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntaddr);
    var contactAddress = getFirst(cntaddr === null || cntaddr === void 0 ? void 0 : cntaddr.address);
    if (contactOrg ||
        contactPerson ||
        contactPhone ||
        contactEmail ||
        contactAddress) {
        var contactInfoContent = [];
        doc.content.push(createHeadingNode([createTextNode("Contact Information")], 2));
        if (contactOrg)
            contactInfoContent.push(createListItemNode([createTextNode("Organization: ".concat(contactOrg))]));
        if (contactPerson)
            contactInfoContent.push(createListItemNode([createTextNode("Contact Person: ".concat(contactPerson))]));
        if (contactPhone)
            contactInfoContent.push(createListItemNode([createTextNode("Phone: ".concat(contactPhone))]));
        if (contactEmail)
            contactInfoContent.push(createListItemNode([createTextNode("Email: ".concat(contactEmail))]));
        if (contactAddress)
            contactInfoContent.push(createListItemNode([createTextNode("Address: ".concat(contactAddress))]));
        doc.content.push(createBulletListNode(contactInfoContent));
    }
    var attribution = getAttribution(metadata);
    return {
        title: title,
        doc: doc,
        attribution: attribution,
        type: "FGDC",
    };
}
function getAttribution(metadata) {
    var _a, _b;
    var getFirst = function (value) {
        return Array.isArray(value) && value.length > 0 ? value[0] : "";
    };
    // Try to retrieve the organization from the citation info
    var idinfo = getFirst((_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo);
    var citation = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.citation);
    var citeinfo = getFirst(citation === null || citation === void 0 ? void 0 : citation.citeinfo);
    var organization = getFirst(citeinfo === null || citeinfo === void 0 ? void 0 : citeinfo.origin);
    if (organization) {
        return organization;
    }
    // Fallback to contact organization if citation doesn't have origin
    var metainfo = getFirst((_b = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _b === void 0 ? void 0 : _b.metainfo);
    var metc = getFirst(metainfo === null || metainfo === void 0 ? void 0 : metainfo.metc);
    var cntinfo = getFirst(metc === null || metc === void 0 ? void 0 : metc.cntinfo);
    var cntorgp = getFirst(cntinfo === null || cntinfo === void 0 ? void 0 : cntinfo.cntorgp);
    var contactOrg = getFirst(cntorgp === null || cntorgp === void 0 ? void 0 : cntorgp.cntorg);
    return contactOrg || undefined;
}
