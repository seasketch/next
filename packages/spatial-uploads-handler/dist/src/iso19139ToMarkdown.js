"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iso19139ToMarkdown = void 0;
const fs_1 = require("fs");
const xml2js_1 = require("xml2js");
const parseContact = (contact) => {
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
};
const parseConstraints = (constraints) => {
    var _a, _b, _c;
    const useLimitations = ((_a = constraints["gmd:useLimitation"]) === null || _a === void 0 ? void 0 : _a.map((limitation) => limitation["gco:CharacterString"][0]).join("; ")) || "";
    const accessConstraints = ((_b = constraints["gmd:accessConstraints"]) === null || _b === void 0 ? void 0 : _b.map((constraint) => { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    const useConstraints = ((_c = constraints["gmd:useConstraints"]) === null || _c === void 0 ? void 0 : _c.map((constraint) => { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    let constraintsSummary = "";
    if (useLimitations) {
        constraintsSummary += `- **Use Limitations:** ${useLimitations}\n`;
    }
    if (accessConstraints) {
        constraintsSummary += `- **Access Constraints:** ${accessConstraints}\n`;
    }
    if (useConstraints) {
        constraintsSummary += `- **Use Constraints:** ${useConstraints}\n`;
    }
    return constraintsSummary;
};
const parseTopicCategories = (categories) => {
    const topicCategories = (categories === null || categories === void 0 ? void 0 : categories.map((category) => { var _a; return (_a = category["gmd:MD_TopicCategoryCode"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "";
    return topicCategories ? `\n**Topic Categories:** ${topicCategories}\n` : "";
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
const generateMarkdown = (metadata) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    const md = [];
    // Title
    const title = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:citation"][0]["gmd:CI_Citation"][0]["gmd:title"][0]["gco:CharacterString"][0];
    md.push(`# ${title}`);
    // Abstract
    const abstract = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:abstract"][0]["gco:CharacterString"][0];
    md.push(`\n**Abstract:** ${abstract}\n`);
    // Keywords
    const keywords = (_b = (_a = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:descriptiveKeywords"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:MD_Keywords"][0]["gmd:keyword"]) === null || _b === void 0 ? void 0 : _b.map((kw) => kw["gco:CharacterString"][0]).join(", ");
    if (keywords) {
        md.push(`\n**Keywords:** ${keywords}\n`);
    }
    // Topic Categories
    const topicCategories = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:topicCategory"];
    if (topicCategories) {
        md.push(parseTopicCategories(topicCategories));
    }
    // Temporal Information
    const temporalExtent = (_h = (_g = (_f = (_e = (_d = (_c = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:extent"]) === null || _c === void 0 ? void 0 : _c[0]["gmd:EX_Extent"]) === null || _d === void 0 ? void 0 : _d[0]["gmd:temporalElement"]) === null || _e === void 0 ? void 0 : _e[0]["gmd:EX_TemporalExtent"]) === null || _f === void 0 ? void 0 : _f[0]["gmd:extent"]) === null || _g === void 0 ? void 0 : _g[0]["gml:TimePeriod"]) === null || _h === void 0 ? void 0 : _h[0];
    if (temporalExtent) {
        const begin = (_j = temporalExtent["gml:beginPosition"]) === null || _j === void 0 ? void 0 : _j[0];
        const end = (_k = temporalExtent["gml:endPosition"]) === null || _k === void 0 ? void 0 : _k[0];
        md.push(`\n**Temporal Coverage:**\n- **Start Date:** ${begin}\n- **End Date:** ${end}\n`);
    }
    // Spatial Extent (Bounding Box)
    const boundingBox = (_p = (_o = (_m = (_l = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:extent"]) === null || _l === void 0 ? void 0 : _l[0]["gmd:EX_Extent"]) === null || _m === void 0 ? void 0 : _m[0]["gmd:geographicElement"]) === null || _o === void 0 ? void 0 : _o[0]["gmd:EX_GeographicBoundingBox"]) === null || _p === void 0 ? void 0 : _p[0];
    if (boundingBox) {
        const west = (_q = boundingBox["gmd:westBoundLongitude"]) === null || _q === void 0 ? void 0 : _q[0]["gco:Decimal"][0];
        const east = (_r = boundingBox["gmd:eastBoundLongitude"]) === null || _r === void 0 ? void 0 : _r[0]["gco:Decimal"][0];
        const south = (_s = boundingBox["gmd:southBoundLatitude"]) === null || _s === void 0 ? void 0 : _s[0]["gco:Decimal"][0];
        const north = (_t = boundingBox["gmd:northBoundLatitude"]) === null || _t === void 0 ? void 0 : _t[0]["gco:Decimal"][0];
        md.push(`\n**Spatial Extent (Bounding Box):**\n- **West:** ${west}\n- **East:** ${east}\n- **South:** ${south}\n- **North:** ${north}\n`);
    }
    // Data Quality Information (including Lineage)
    const dataQualityInfo = (_v = (_u = metadata["gmd:dataQualityInfo"]) === null || _u === void 0 ? void 0 : _u[0]["gmd:DQ_DataQuality"]) === null || _v === void 0 ? void 0 : _v[0];
    if (dataQualityInfo) {
        const dataQualityMarkdown = parseDataQuality(dataQualityInfo);
        if (dataQualityMarkdown) {
            md.push(dataQualityMarkdown);
        }
    }
    // Contact Information
    const contact = metadata["gmd:contact"][0]["gmd:CI_ResponsibleParty"][0];
    const contactInfo = parseContact(contact);
    md.push(`## Contact Information\n`);
    md.push(`- **Name:** ${contactInfo.name}`);
    md.push(`- **Organization:** ${contactInfo.organization}`);
    md.push(`- **Position:** ${contactInfo.position}`);
    md.push(`- **Phone:** ${contactInfo.phone}`);
    md.push(`- **Address:** ${contactInfo.address}`);
    md.push(`- **City:** ${contactInfo.city}`);
    md.push(`- **Postal Code:** ${contactInfo.postalCode}`);
    md.push(`- **Country:** ${contactInfo.country}`);
    md.push(`- **Email:** ${contactInfo.email}`);
    // Resource Constraints
    const resourceConstraints = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:resourceConstraints"];
    if (resourceConstraints) {
        const constraintsMarkdown = resourceConstraints
            .map((constraint) => {
            var _a, _b, _c;
            return parseConstraints(((_a = constraint["gmd:MD_LegalConstraints"]) === null || _a === void 0 ? void 0 : _a[0]) ||
                ((_b = constraint["gmd:MD_SecurityConstraints"]) === null || _b === void 0 ? void 0 : _b[0]) ||
                ((_c = constraint["gmd:MD_Constraints"]) === null || _c === void 0 ? void 0 : _c[0]));
        })
            .join("\n");
        if (constraintsMarkdown) {
            md.push(`\n## Resource Constraints\n${constraintsMarkdown}`);
        }
    }
    return md.join("\n");
};
const isIso19139Metadata = (xml) => {
    return xml && xml["gmd:MD_Metadata"];
};
/**
 *
 * @param xmlFilePath
 * @returns
 */
const iso19139ToMarkdown = async (xmlFilePath) => {
    try {
        const xml = (0, fs_1.readFileSync)(xmlFilePath, "utf-8");
        const result = await (0, xml2js_1.parseStringPromise)(xml);
        const metadata = result["gmd:MD_Metadata"];
        if (!isIso19139Metadata(result)) {
            throw new Error("The provided file is not a valid ISO 19139 metadata file.");
        }
        const markdown = generateMarkdown(metadata);
        return markdown;
    }
    catch (error) {
        throw new Error(`Error processing XML: ${error.message}`);
    }
};
exports.iso19139ToMarkdown = iso19139ToMarkdown;
