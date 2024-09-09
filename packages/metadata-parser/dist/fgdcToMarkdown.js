"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fgdcToMarkdown = fgdcToMarkdown;
exports.getAttribution = getAttribution;
function fgdcToMarkdown(metadata) {
    var _a, _b, _c, _d, _e;
    var md = [];
    // Helper function to safely access arrays
    var getFirst = function (value) {
        return Array.isArray(value) && value.length > 0 ? value[0] : "";
    };
    // Title
    var idinfo = getFirst((_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo);
    var citation = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.citation);
    var citeinfo = getFirst(citation === null || citation === void 0 ? void 0 : citation.citeinfo);
    var title = getFirst(citeinfo === null || citeinfo === void 0 ? void 0 : citeinfo.title);
    md.push("# ".concat(title || "Untitled"));
    // Abstract
    var descript = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.descript);
    var abstract = getFirst(descript === null || descript === void 0 ? void 0 : descript.abstract);
    if (abstract) {
        md.push("\n**Abstract:** ".concat(abstract.split("Attribute Fields:")[0], "\n"));
    }
    // Purpose
    var purpose = getFirst(descript === null || descript === void 0 ? void 0 : descript.purpose);
    if (purpose) {
        md.push("\n**Purpose:** ".concat(purpose, "\n"));
    }
    // Keywords
    var keywords = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.keywords);
    var theme = getFirst(keywords === null || keywords === void 0 ? void 0 : keywords.theme);
    var themeKeywords = theme === null || theme === void 0 ? void 0 : theme.themekey.filter(Boolean).join(", ");
    if (themeKeywords) {
        md.push("\n**Keywords:** ".concat(themeKeywords, "\n"));
    }
    // Use Constraints (added section)
    var useConstraints = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.useconst);
    if (useConstraints) {
        md.push("\n**Use Constraints:** ".concat(useConstraints.split("Downloaded data filename:")[0], "\n"));
    }
    // Temporal Coverage
    var timeperd = getFirst(idinfo === null || idinfo === void 0 ? void 0 : idinfo.timeperd);
    var timeinfo = getFirst(timeperd === null || timeperd === void 0 ? void 0 : timeperd.timeinfo);
    var rngdates = getFirst(timeinfo === null || timeinfo === void 0 ? void 0 : timeinfo.rngdates);
    var beginDate = getFirst(rngdates === null || rngdates === void 0 ? void 0 : rngdates.begdate);
    var endDate = getFirst(rngdates === null || rngdates === void 0 ? void 0 : rngdates.enddate);
    if (beginDate || endDate) {
        md.push("\n**Temporal Coverage:**");
        if (beginDate)
            md.push("\n- **Start Date:** ".concat(beginDate));
        if (endDate)
            md.push("\n- **End Date:** ".concat(endDate));
        md.push("\n");
    }
    // Spatial Extent (Bounding Box)
    var spdom = getFirst((_b = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _b === void 0 ? void 0 : _b.spdom);
    var bounding = getFirst(spdom === null || spdom === void 0 ? void 0 : spdom.bounding);
    var west = getFirst(bounding === null || bounding === void 0 ? void 0 : bounding.westbc);
    var east = getFirst(bounding === null || bounding === void 0 ? void 0 : bounding.eastbc);
    var north = getFirst(bounding === null || bounding === void 0 ? void 0 : bounding.northbc);
    var south = getFirst(bounding === null || bounding === void 0 ? void 0 : bounding.southbc);
    if (west || east || north || south) {
        md.push("\n**Spatial Extent (Bounding Box):**");
        if (west)
            md.push("\n- **West:** ".concat(west));
        if (east)
            md.push("\n- **East:** ".concat(east));
        if (north)
            md.push("\n- **North:** ".concat(north));
        if (south)
            md.push("\n- **South:** ".concat(south));
        md.push("\n");
    }
    // Attribute Information (Table)
    var eainfo = getFirst((_c = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _c === void 0 ? void 0 : _c.eainfo);
    var detailed = ((_d = eainfo === null || eainfo === void 0 ? void 0 : eainfo.detailed) === null || _d === void 0 ? void 0 : _d[0]) || {};
    var attributes = (detailed === null || detailed === void 0 ? void 0 : detailed.attr) || [];
    if (attributes.length > 0) {
        md.push("\n## Attribute Information\n");
        md.push("| Attribute Label | Definition | Domain |\n|-----------------|-------------|--------|\n");
        attributes.forEach(function (attr) {
            var _a, _b;
            var label = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrlabl) || "Unknown";
            var definition = getFirst(attr === null || attr === void 0 ? void 0 : attr.attrdef) || "";
            // Enhanced Domain Parsing
            var domain = "";
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
            md.push("| ".concat(label, " | ").concat(definition, " | ").concat(domain, " |\n"));
        });
    }
    // Contact Information (Enhanced Parsing without placeholders)
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
        md.push("\n## Contact Information\n");
        if (contactOrg)
            md.push("- **Organization:** ".concat(contactOrg, "\n"));
        if (contactPerson)
            md.push("- **Contact Person:** ".concat(contactPerson, "\n"));
        if (contactPhone)
            md.push("- **Phone:** ".concat(contactPhone, "\n"));
        if (contactEmail)
            md.push("- **Email:** ".concat(contactEmail, "\n"));
        if (contactAddress)
            md.push("- **Address:** ".concat(contactAddress, "\n"));
    }
    return md.join("");
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
    return contactOrg || null;
}
