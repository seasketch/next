"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iso19139ToProseMirror = iso19139ToProseMirror;
exports.getAttribution = getAttribution;
const createParagraphNode_1 = require("./createParagraphNode");
// Helper function to safely access arrays
const getFirst = (value) => Array.isArray(value) && value.length > 0 ? value[0] : "";
// Function to create a text node
function createTextNode(content) {
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
const parseTopicCategories = (categories) => {
    const topicCategories = (categories === null || categories === void 0 ? void 0 : categories.map((category) => { var _a; return (_a = category["gmd:MD_TopicCategoryCode"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "";
    return topicCategories;
};
const parseDataQuality = (dataQualityInfo) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const lineage = ((_d = (_c = (_b = (_a = dataQualityInfo["gmd:lineage"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:LI_Lineage"]) === null || _b === void 0 ? void 0 : _b[0]["gmd:statement"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0]) || "";
    const report = (_e = dataQualityInfo["gmd:report"]) === null || _e === void 0 ? void 0 : _e[0];
    let dataQuality = "";
    if (lineage) {
        dataQuality += `\n**Lineage:** ${lineage}\n`;
    }
    if (report) {
        const explanation = ((_h = (_g = (_f = report["gmd:DQ_Element"]) === null || _f === void 0 ? void 0 : _f[0]["gmd:measureDescription"]) === null || _g === void 0 ? void 0 : _g[0]["gco:CharacterString"]) === null || _h === void 0 ? void 0 : _h[0]) || "";
        if (explanation) {
            dataQuality += `\n**Quality Report:** ${explanation}\n`;
        }
    }
    return dataQuality ? `## Data Quality\n${dataQuality}` : "";
};
function parseSpatialBounds(extent) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const bbox = (_b = (_a = extent === null || extent === void 0 ? void 0 : extent["gmd:geographicElement"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:EX_GeographicBoundingBox"]) === null || _b === void 0 ? void 0 : _b[0];
    if (!bbox)
        return "";
    const westBound = (_d = (_c = bbox["gmd:westBoundLongitude"]) === null || _c === void 0 ? void 0 : _c[0]["gco:Decimal"]) === null || _d === void 0 ? void 0 : _d[0];
    const eastBound = (_f = (_e = bbox["gmd:eastBoundLongitude"]) === null || _e === void 0 ? void 0 : _e[0]["gco:Decimal"]) === null || _f === void 0 ? void 0 : _f[0];
    const southBound = (_h = (_g = bbox["gmd:southBoundLatitude"]) === null || _g === void 0 ? void 0 : _g[0]["gco:Decimal"]) === null || _h === void 0 ? void 0 : _h[0];
    const northBound = (_k = (_j = bbox["gmd:northBoundLatitude"]) === null || _j === void 0 ? void 0 : _j[0]["gco:Decimal"]) === null || _k === void 0 ? void 0 : _k[0];
    if (westBound && eastBound && southBound && northBound) {
        return {
            westBound,
            eastBound,
            southBound,
            northBound,
        };
    }
    return null;
}
// Main function to generate ProseMirror nodes from ISO 19139 metadata
function iso19139ToProseMirror(metadata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    if ("gmd:MD_Metadata" in metadata) {
        metadata = metadata["gmd:MD_Metadata"];
    }
    const doc = { type: "doc", content: [] };
    // Title
    const title = getFirst(metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:citation"][0]["gmd:CI_Citation"][0]["gmd:title"][0]["gco:CharacterString"]);
    // if (title) {
    //   doc.content.push(createHeadingNode([createTextNode(title)], 1));
    // }
    // Abstract
    const abstract = getFirst(metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:abstract"][0]["gco:CharacterString"]);
    if (abstract) {
        doc.content.push(createHeadingNode([createTextNode("Abstract")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(abstract)]));
    }
    // Keywords
    const keywords = (_b = (_a = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:descriptiveKeywords"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:MD_Keywords"][0]["gmd:keyword"]) === null || _b === void 0 ? void 0 : _b.map((kw) => kw["gco:CharacterString"][0]).join(", ");
    if (keywords) {
        doc.content.push(createHeadingNode([createTextNode("Keywords")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(keywords)]));
    }
    const topicCategories = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:topicCategory"];
    if (topicCategories) {
        doc.content.push(createHeadingNode([createTextNode("Topic Categories")], 2));
        doc.content.push((0, createParagraphNode_1.createParagraphNode)([
            createTextNode(parseTopicCategories(topicCategories)),
        ]));
    }
    // Use Constraints
    const resourceConstraints = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:resourceConstraints"];
    if (resourceConstraints) {
        const useConstraints = resourceConstraints
            .map((constraint) => {
            var _a, _b, _c;
            return parseConstraints(((_a = constraint["gmd:MD_LegalConstraints"]) === null || _a === void 0 ? void 0 : _a[0]) ||
                ((_b = constraint["gmd:MD_SecurityConstraints"]) === null || _b === void 0 ? void 0 : _b[0]) ||
                ((_c = constraint["gmd:MD_Constraints"]) === null || _c === void 0 ? void 0 : _c[0]));
        })
            .join("\n");
        if (useConstraints) {
            doc.content.push(createHeadingNode([createTextNode("Use Constraints")], 2));
            doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(useConstraints)]));
        }
    }
    const dataQualityInfo = (_d = (_c = metadata["gmd:dataQualityInfo"]) === null || _c === void 0 ? void 0 : _c[0]["gmd:DQ_DataQuality"]) === null || _d === void 0 ? void 0 : _d[0];
    if (dataQualityInfo) {
        const lineage = ((_h = (_g = (_f = (_e = dataQualityInfo["gmd:lineage"]) === null || _e === void 0 ? void 0 : _e[0]["gmd:LI_Lineage"]) === null || _f === void 0 ? void 0 : _f[0]["gmd:statement"]) === null || _g === void 0 ? void 0 : _g[0]["gco:CharacterString"]) === null || _h === void 0 ? void 0 : _h[0]) || "";
        const report = (_j = dataQualityInfo["gmd:report"]) === null || _j === void 0 ? void 0 : _j[0];
        if (lineage || report) {
            doc.content.push(createHeadingNode([createTextNode("Data Quality")], 2));
            if (lineage) {
                doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(lineage)]));
            }
            if (report) {
                const explanation = ((_m = (_l = (_k = report["gmd:DQ_Element"]) === null || _k === void 0 ? void 0 : _k[0]["gmd:measureDescription"]) === null || _l === void 0 ? void 0 : _l[0]["gco:CharacterString"]) === null || _m === void 0 ? void 0 : _m[0]) || "";
                if (explanation) {
                    doc.content.push((0, createParagraphNode_1.createParagraphNode)([createTextNode(explanation)]));
                }
            }
        }
    }
    // Attribute Information (Table using ProseMirror Table Schema)
    const eainfo = getFirst((_o = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _o === void 0 ? void 0 : _o.eainfo);
    const detailed = ((_p = eainfo === null || eainfo === void 0 ? void 0 : eainfo.detailed) === null || _p === void 0 ? void 0 : _p[0]) || {};
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
            const definition = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdef) || "No definition";
            let domain = "No domain";
            const attrdomv = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdomv);
            if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom) {
                domain = getFirst(attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.udom);
            }
            else if (attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) {
                const rdommin = getFirst((_a = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _a === void 0 ? void 0 : _a.rdommin);
                const rdommax = getFirst((_b = attrdomv === null || attrdomv === void 0 ? void 0 : attrdomv.rdom) === null || _b === void 0 ? void 0 : _b.rdommax);
                if (rdommin && rdommax) {
                    domain = `Range: ${rdommin} to ${rdommax}`;
                }
                else if (rdommin || rdommax) {
                    domain = `Value: ${rdommin || rdommax}`;
                }
            }
            const dataRow = createTableRowNode([
                createTableCellNode([createTextNode(label)]),
                createTableCellNode([createTextNode(definition)]),
                createTableCellNode([createTextNode(domain)]),
            ]);
            tableRows.push(dataRow);
        });
        const tableNode = createTableNode(tableRows);
        doc.content.push(tableNode);
    }
    // Contact Information
    const contact = metadata["gmd:contact"][0]["gmd:CI_ResponsibleParty"][0];
    const contactInfo = parseContact(contact);
    const contactInfoContent = [];
    doc.content.push(createHeadingNode([createTextNode("Contact Information")], 2));
    if (contactInfo.name)
        contactInfoContent.push(createListItemNode([createTextNode(`Name: ${contactInfo.name}`)]));
    if (contactInfo.organization)
        contactInfoContent.push(createListItemNode([
            createTextNode(`Organization: ${contactInfo.organization}`),
        ]));
    if (contactInfo.position)
        contactInfoContent.push(createListItemNode([createTextNode(`Position: ${contactInfo.position}`)]));
    if (contactInfo.phone)
        contactInfoContent.push(createListItemNode([createTextNode(`Phone: ${contactInfo.phone}`)]));
    if (contactInfo.address)
        contactInfoContent.push(createListItemNode([createTextNode(`Address: ${contactInfo.address}`)]));
    if (contactInfo.city)
        contactInfoContent.push(createListItemNode([createTextNode(`City: ${contactInfo.city}`)]));
    if (contactInfo.postalCode)
        contactInfoContent.push(createListItemNode([
            createTextNode(`Postal Code: ${contactInfo.postalCode}`),
        ]));
    if (contactInfo.country)
        contactInfoContent.push(createListItemNode([createTextNode(`Country: ${contactInfo.country}`)]));
    if (contactInfo.email)
        contactInfoContent.push(createListItemNode([createTextNode(`Email: ${contactInfo.email}`)]));
    doc.content.push(createBulletListNode(contactInfoContent));
    const spatialBounds = parseSpatialBounds((_v = (_u = (_t = (_s = (_r = (_q = metadata["gmd:identificationInfo"]) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r["gmd:MD_DataIdentification"]) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t["gmd:extent"]) === null || _u === void 0 ? void 0 : _u[0]["gmd:EX_Extent"]) === null || _v === void 0 ? void 0 : _v[0]);
    if (spatialBounds) {
        doc.content.push(createHeadingNode([createTextNode("Spatial Extent")], 2));
        doc.content.push(createBulletListNode([
            createListItemNode([
                createTextNode(`North: ${spatialBounds.northBound}`),
            ]),
            createListItemNode([
                createTextNode(`East: ${spatialBounds.eastBound}`),
            ]),
            createListItemNode([
                createTextNode(`South: ${spatialBounds.southBound}`),
            ]),
            createListItemNode([
                createTextNode(`West: ${spatialBounds.westBound}`),
            ]),
        ]));
    }
    return {
        title,
        doc,
        attribution: getAttribution(metadata),
        type: "ISO19139",
    };
}
// Get attribution from ISO 19139 metadata
function getAttribution(metadata) {
    var _a, _b, _c, _d, _e, _f;
    if ("gmd:MD_Metadata" in metadata) {
        metadata = metadata["gmd:MD_Metadata"];
    }
    const contact = (_a = metadata === null || metadata === void 0 ? void 0 : metadata["gmd:contact"]) === null || _a === void 0 ? void 0 : _a[0];
    const responsibleParty = (_b = contact === null || contact === void 0 ? void 0 : contact["gmd:CI_ResponsibleParty"]) === null || _b === void 0 ? void 0 : _b[0];
    // Try to retrieve the responsible organization
    const organization = (_d = (_c = responsibleParty["gmd:organisationName"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0];
    if (organization) {
        return organization;
    }
    // Fallback to other contact individual info if available
    const individual = (_f = (_e = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty["gmd:individualName"]) === null || _e === void 0 ? void 0 : _e[0]["gco:CharacterString"]) === null || _f === void 0 ? void 0 : _f[0];
    return individual || undefined;
}
// Helper functions for parsing contact and constraints
function parseContact(contact) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    const contactInfo = (_b = (_a = contact["gmd:contactInfo"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:CI_Contact"]) === null || _b === void 0 ? void 0 : _b[0];
    return {
        name: ((_d = (_c = contact["gmd:individualName"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0]) || "",
        organization: ((_f = (_e = contact["gmd:organisationName"]) === null || _e === void 0 ? void 0 : _e[0]["gco:CharacterString"]) === null || _f === void 0 ? void 0 : _f[0]) || "",
        position: ((_h = (_g = contact["gmd:positionName"]) === null || _g === void 0 ? void 0 : _g[0]["gco:CharacterString"]) === null || _h === void 0 ? void 0 : _h[0]) || "",
        phone: ((_l = (_k = (_j = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:phone"]) === null || _j === void 0 ? void 0 : _j[0]["gmd:CI_Telephone"]) === null || _k === void 0 ? void 0 : _k[0]["gmd:voice"]) === null || _l === void 0 ? void 0 : _l.map((p) => { var _a; return (_a = p["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
        address: ((_p = (_o = (_m = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _m === void 0 ? void 0 : _m[0]["gmd:CI_Address"]) === null || _o === void 0 ? void 0 : _o[0]["gmd:deliveryPoint"]) === null || _p === void 0 ? void 0 : _p.map((p) => { var _a; return (_a = p["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
        city: ((_t = (_s = (_r = (_q = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _q === void 0 ? void 0 : _q[0]["gmd:CI_Address"]) === null || _r === void 0 ? void 0 : _r[0]["gmd:city"]) === null || _s === void 0 ? void 0 : _s[0]["gco:CharacterString"]) === null || _t === void 0 ? void 0 : _t[0]) || "",
        postalCode: ((_x = (_w = (_v = (_u = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _u === void 0 ? void 0 : _u[0]["gmd:CI_Address"]) === null || _v === void 0 ? void 0 : _v[0]["gmd:postalCode"]) === null || _w === void 0 ? void 0 : _w[0]["gco:CharacterString"]) === null || _x === void 0 ? void 0 : _x[0]) || "",
        country: ((_1 = (_0 = (_z = (_y = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _y === void 0 ? void 0 : _y[0]["gmd:CI_Address"]) === null || _z === void 0 ? void 0 : _z[0]["gmd:country"]) === null || _0 === void 0 ? void 0 : _0[0]["gco:CharacterString"]) === null || _1 === void 0 ? void 0 : _1[0]) || "",
        email: ((_4 = (_3 = (_2 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _2 === void 0 ? void 0 : _2[0]["gmd:CI_Address"]) === null || _3 === void 0 ? void 0 : _3[0]["gmd:electronicMailAddress"]) === null || _4 === void 0 ? void 0 : _4.map((e) => { var _a; return (_a = e["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
    };
}
function parseConstraints(constraints) {
    var _a, _b, _c;
    const useLimitations = ((_a = constraints["gmd:useLimitation"]) === null || _a === void 0 ? void 0 : _a.map((limitation) => limitation["gco:CharacterString"][0]).join("; ")) || "";
    const accessConstraints = ((_b = constraints["gmd:accessConstraints"]) === null || _b === void 0 ? void 0 : _b.map((constraint) => { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    const useConstraints = ((_c = constraints["gmd:useConstraints"]) === null || _c === void 0 ? void 0 : _c.map((constraint) => { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    let constraintsSummary = "";
    if (useLimitations) {
        constraintsSummary += `Use Limitations: ${useLimitations}\n`;
    }
    if (accessConstraints) {
        constraintsSummary += `Access Constraints: ${accessConstraints}\n`;
    }
    if (useConstraints) {
        constraintsSummary += `Use Constraints: ${useConstraints}\n`;
    }
    return constraintsSummary;
}
//# sourceMappingURL=iso19139ToProseMirror.js.map