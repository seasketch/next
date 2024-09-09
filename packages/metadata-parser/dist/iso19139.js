"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iso19139ToMarkdown = iso19139ToMarkdown;
exports.getAttribution = getAttribution;
var parseContact = function (contact) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    var contactInfo = (_b = (_a = contact["gmd:contactInfo"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:CI_Contact"]) === null || _b === void 0 ? void 0 : _b[0];
    return {
        name: ((_d = (_c = contact["gmd:individualName"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0]) || "",
        organization: ((_f = (_e = contact["gmd:organisationName"]) === null || _e === void 0 ? void 0 : _e[0]["gco:CharacterString"]) === null || _f === void 0 ? void 0 : _f[0]) || "",
        position: ((_h = (_g = contact["gmd:positionName"]) === null || _g === void 0 ? void 0 : _g[0]["gco:CharacterString"]) === null || _h === void 0 ? void 0 : _h[0]) || "",
        phone: ((_l = (_k = (_j = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:phone"]) === null || _j === void 0 ? void 0 : _j[0]["gmd:CI_Telephone"]) === null || _k === void 0 ? void 0 : _k[0]["gmd:voice"]) === null || _l === void 0 ? void 0 : _l.map(function (p) { var _a; return (_a = p["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
        address: ((_p = (_o = (_m = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _m === void 0 ? void 0 : _m[0]["gmd:CI_Address"]) === null || _o === void 0 ? void 0 : _o[0]["gmd:deliveryPoint"]) === null || _p === void 0 ? void 0 : _p.map(function (p) { var _a; return (_a = p["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
        city: ((_t = (_s = (_r = (_q = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _q === void 0 ? void 0 : _q[0]["gmd:CI_Address"]) === null || _r === void 0 ? void 0 : _r[0]["gmd:city"]) === null || _s === void 0 ? void 0 : _s[0]["gco:CharacterString"]) === null || _t === void 0 ? void 0 : _t[0]) || "",
        postalCode: ((_x = (_w = (_v = (_u = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _u === void 0 ? void 0 : _u[0]["gmd:CI_Address"]) === null || _v === void 0 ? void 0 : _v[0]["gmd:postalCode"]) === null || _w === void 0 ? void 0 : _w[0]["gco:CharacterString"]) === null || _x === void 0 ? void 0 : _x[0]) || "",
        country: ((_1 = (_0 = (_z = (_y = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _y === void 0 ? void 0 : _y[0]["gmd:CI_Address"]) === null || _z === void 0 ? void 0 : _z[0]["gmd:country"]) === null || _0 === void 0 ? void 0 : _0[0]["gco:CharacterString"]) === null || _1 === void 0 ? void 0 : _1[0]) || "",
        email: ((_4 = (_3 = (_2 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo["gmd:address"]) === null || _2 === void 0 ? void 0 : _2[0]["gmd:CI_Address"]) === null || _3 === void 0 ? void 0 : _3[0]["gmd:electronicMailAddress"]) === null || _4 === void 0 ? void 0 : _4.map(function (e) { var _a; return (_a = e["gco:CharacterString"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "",
    };
};
var parseConstraints = function (constraints) {
    var _a, _b, _c;
    var useLimitations = ((_a = constraints["gmd:useLimitation"]) === null || _a === void 0 ? void 0 : _a.map(function (limitation) { return limitation["gco:CharacterString"][0]; }).join("; ")) || "";
    var accessConstraints = ((_b = constraints["gmd:accessConstraints"]) === null || _b === void 0 ? void 0 : _b.map(function (constraint) { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    var useConstraints = ((_c = constraints["gmd:useConstraints"]) === null || _c === void 0 ? void 0 : _c.map(function (constraint) { var _a, _b, _c; return (_c = (_b = (_a = constraint["gmd:MD_RestrictionCode"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$"]) === null || _c === void 0 ? void 0 : _c["codeListValue"]; }).join(", ")) || "";
    var constraintsSummary = "";
    if (useLimitations) {
        constraintsSummary += "- **Use Limitations:** ".concat(useLimitations, "\n");
    }
    if (accessConstraints) {
        constraintsSummary += "- **Access Constraints:** ".concat(accessConstraints, "\n");
    }
    if (useConstraints) {
        constraintsSummary += "- **Use Constraints:** ".concat(useConstraints, "\n");
    }
    return constraintsSummary;
};
var parseTopicCategories = function (categories) {
    var topicCategories = (categories === null || categories === void 0 ? void 0 : categories.map(function (category) { var _a; return (_a = category["gmd:MD_TopicCategoryCode"]) === null || _a === void 0 ? void 0 : _a[0]; }).join(", ")) || "";
    return topicCategories ? "\n**Topic Categories:** ".concat(topicCategories, "\n") : "";
};
var parseDataQuality = function (dataQualityInfo) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var lineage = ((_d = (_c = (_b = (_a = dataQualityInfo["gmd:lineage"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:LI_Lineage"]) === null || _b === void 0 ? void 0 : _b[0]["gmd:statement"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0]) || "";
    var report = (_e = dataQualityInfo["gmd:report"]) === null || _e === void 0 ? void 0 : _e[0];
    var dataQuality = "";
    if (lineage) {
        dataQuality += "\n**Lineage:** ".concat(lineage, "\n");
    }
    if (report) {
        var explanation = ((_h = (_g = (_f = report["gmd:DQ_Element"]) === null || _f === void 0 ? void 0 : _f[0]["gmd:measureDescription"]) === null || _g === void 0 ? void 0 : _g[0]["gco:CharacterString"]) === null || _h === void 0 ? void 0 : _h[0]) || "";
        if (explanation) {
            dataQuality += "\n**Quality Report:** ".concat(explanation, "\n");
        }
    }
    return dataQuality ? "## Data Quality\n".concat(dataQuality) : "";
};
function iso19139ToMarkdown(metadata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    if ("gmd:MD_Metadata" in metadata) {
        metadata = metadata["gmd:MD_Metadata"];
    }
    var md = [];
    // Title
    var title = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:citation"][0]["gmd:CI_Citation"][0]["gmd:title"][0]["gco:CharacterString"][0];
    md.push("# ".concat(title));
    // Abstract
    var abstract = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:abstract"][0]["gco:CharacterString"][0];
    md.push("\n**Abstract:** ".concat(abstract, "\n"));
    // Keywords
    var keywords = (_b = (_a = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:descriptiveKeywords"]) === null || _a === void 0 ? void 0 : _a[0]["gmd:MD_Keywords"][0]["gmd:keyword"]) === null || _b === void 0 ? void 0 : _b.map(function (kw) { return kw["gco:CharacterString"][0]; }).join(", ");
    if (keywords) {
        md.push("\n**Keywords:** ".concat(keywords, "\n"));
    }
    // Topic Categories
    var topicCategories = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:topicCategory"];
    if (topicCategories) {
        md.push(parseTopicCategories(topicCategories));
    }
    // Temporal Information
    var temporalExtent = (_h = (_g = (_f = (_e = (_d = (_c = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:extent"]) === null || _c === void 0 ? void 0 : _c[0]["gmd:EX_Extent"]) === null || _d === void 0 ? void 0 : _d[0]["gmd:temporalElement"]) === null || _e === void 0 ? void 0 : _e[0]["gmd:EX_TemporalExtent"]) === null || _f === void 0 ? void 0 : _f[0]["gmd:extent"]) === null || _g === void 0 ? void 0 : _g[0]["gml:TimePeriod"]) === null || _h === void 0 ? void 0 : _h[0];
    if (temporalExtent) {
        var begin = (_j = temporalExtent["gml:beginPosition"]) === null || _j === void 0 ? void 0 : _j[0];
        var end = (_k = temporalExtent["gml:endPosition"]) === null || _k === void 0 ? void 0 : _k[0];
        md.push("\n**Temporal Coverage:**\n- **Start Date:** ".concat(begin, "\n- **End Date:** ").concat(end, "\n"));
    }
    // Spatial Extent (Bounding Box)
    var boundingBox = (_p = (_o = (_m = (_l = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:extent"]) === null || _l === void 0 ? void 0 : _l[0]["gmd:EX_Extent"]) === null || _m === void 0 ? void 0 : _m[0]["gmd:geographicElement"]) === null || _o === void 0 ? void 0 : _o[0]["gmd:EX_GeographicBoundingBox"]) === null || _p === void 0 ? void 0 : _p[0];
    if (boundingBox) {
        var west = (_q = boundingBox["gmd:westBoundLongitude"]) === null || _q === void 0 ? void 0 : _q[0]["gco:Decimal"][0];
        var east = (_r = boundingBox["gmd:eastBoundLongitude"]) === null || _r === void 0 ? void 0 : _r[0]["gco:Decimal"][0];
        var south = (_s = boundingBox["gmd:southBoundLatitude"]) === null || _s === void 0 ? void 0 : _s[0]["gco:Decimal"][0];
        var north = (_t = boundingBox["gmd:northBoundLatitude"]) === null || _t === void 0 ? void 0 : _t[0]["gco:Decimal"][0];
        md.push("\n**Spatial Extent (Bounding Box):**\n- **West:** ".concat(west, "\n- **East:** ").concat(east, "\n- **South:** ").concat(south, "\n- **North:** ").concat(north, "\n"));
    }
    // Data Quality Information (including Lineage)
    var dataQualityInfo = (_v = (_u = metadata["gmd:dataQualityInfo"]) === null || _u === void 0 ? void 0 : _u[0]["gmd:DQ_DataQuality"]) === null || _v === void 0 ? void 0 : _v[0];
    if (dataQualityInfo) {
        var dataQualityMarkdown = parseDataQuality(dataQualityInfo);
        if (dataQualityMarkdown) {
            md.push(dataQualityMarkdown);
        }
    }
    // Contact Information
    var contact = metadata["gmd:contact"][0]["gmd:CI_ResponsibleParty"][0];
    var contactInfo = parseContact(contact);
    md.push("## Contact Information\n");
    md.push("- **Name:** ".concat(contactInfo.name));
    md.push("- **Organization:** ".concat(contactInfo.organization));
    md.push("- **Position:** ".concat(contactInfo.position));
    md.push("- **Phone:** ".concat(contactInfo.phone));
    md.push("- **Address:** ".concat(contactInfo.address));
    md.push("- **City:** ".concat(contactInfo.city));
    md.push("- **Postal Code:** ".concat(contactInfo.postalCode));
    md.push("- **Country:** ".concat(contactInfo.country));
    md.push("- **Email:** ".concat(contactInfo.email));
    // Resource Constraints
    var resourceConstraints = metadata["gmd:identificationInfo"][0]["gmd:MD_DataIdentification"][0]["gmd:resourceConstraints"];
    if (resourceConstraints) {
        var constraintsMarkdown = resourceConstraints
            .map(function (constraint) {
            var _a, _b, _c;
            return parseConstraints(((_a = constraint["gmd:MD_LegalConstraints"]) === null || _a === void 0 ? void 0 : _a[0]) ||
                ((_b = constraint["gmd:MD_SecurityConstraints"]) === null || _b === void 0 ? void 0 : _b[0]) ||
                ((_c = constraint["gmd:MD_Constraints"]) === null || _c === void 0 ? void 0 : _c[0]));
        })
            .join("\n");
        if (constraintsMarkdown) {
            md.push("\n## Resource Constraints\n".concat(constraintsMarkdown));
        }
    }
    return md.join("\n");
}
// Get attribution from ISO 19139 metadata
function getAttribution(metadata) {
    var _a, _b, _c, _d, _e, _f;
    if ("gmd:MD_Metadata" in metadata) {
        metadata = metadata["gmd:MD_Metadata"];
    }
    var contact = (_a = metadata === null || metadata === void 0 ? void 0 : metadata["gmd:contact"]) === null || _a === void 0 ? void 0 : _a[0];
    var responsibleParty = (_b = contact === null || contact === void 0 ? void 0 : contact["gmd:CI_ResponsibleParty"]) === null || _b === void 0 ? void 0 : _b[0];
    // Try to retrieve the responsible organization
    var organization = (_d = (_c = responsibleParty["gmd:organisationName"]) === null || _c === void 0 ? void 0 : _c[0]["gco:CharacterString"]) === null || _d === void 0 ? void 0 : _d[0];
    if (organization) {
        return organization;
    }
    // Fallback to other contact individual info if available
    var individual = (_f = (_e = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty["gmd:individualName"]) === null || _e === void 0 ? void 0 : _e[0]["gco:CharacterString"]) === null || _f === void 0 ? void 0 : _f[0];
    return individual || null;
}
