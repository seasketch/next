export function esriToMarkdown(metadata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37;
    const md = [];
    // Title
    const title = ((_e = (_d = (_c = (_b = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo) === null || _b === void 0 ? void 0 : _b.citation) === null || _c === void 0 ? void 0 : _c.citeinfo) === null || _d === void 0 ? void 0 : _d.title) === null || _e === void 0 ? void 0 : _e[0]) || "Untitled";
    md.push(`# ${title}`);
    // Abstract
    const abstract = (_j = (_h = (_g = (_f = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _f === void 0 ? void 0 : _f.idinfo) === null || _g === void 0 ? void 0 : _g.descript) === null || _h === void 0 ? void 0 : _h.abstract) === null || _j === void 0 ? void 0 : _j[0];
    if (abstract) {
        md.push(`\n**Abstract:** ${abstract}\n`);
    }
    // Purpose
    const purpose = (_o = (_m = (_l = (_k = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _k === void 0 ? void 0 : _k.idinfo) === null || _l === void 0 ? void 0 : _l.descript) === null || _m === void 0 ? void 0 : _m.purpose) === null || _o === void 0 ? void 0 : _o[0];
    if (purpose) {
        md.push(`\n**Purpose:** ${purpose}\n`);
    }
    // Keywords
    const themeKeywords = (_v = (_u = (_t = (_s = (_r = (_q = (_p = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _p === void 0 ? void 0 : _p.idinfo) === null || _q === void 0 ? void 0 : _q.keywords) === null || _r === void 0 ? void 0 : _r.theme) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.themekey) === null || _u === void 0 ? void 0 : _u.map((key) => key)) === null || _v === void 0 ? void 0 : _v.join(", ");
    if (themeKeywords) {
        md.push(`\n**Keywords:** ${themeKeywords}\n`);
    }
    // Temporal Coverage
    const beginDate = (_1 = (_0 = (_z = (_y = (_x = (_w = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _w === void 0 ? void 0 : _w.idinfo) === null || _x === void 0 ? void 0 : _x.timeperd) === null || _y === void 0 ? void 0 : _y.timeinfo) === null || _z === void 0 ? void 0 : _z.rngdates) === null || _0 === void 0 ? void 0 : _0.begdate) === null || _1 === void 0 ? void 0 : _1[0];
    const endDate = (_7 = (_6 = (_5 = (_4 = (_3 = (_2 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _2 === void 0 ? void 0 : _2.idinfo) === null || _3 === void 0 ? void 0 : _3.timeperd) === null || _4 === void 0 ? void 0 : _4.timeinfo) === null || _5 === void 0 ? void 0 : _5.rngdates) === null || _6 === void 0 ? void 0 : _6.enddate) === null || _7 === void 0 ? void 0 : _7[0];
    if (beginDate || endDate) {
        md.push(`\n**Temporal Coverage:**`);
        if (beginDate)
            md.push(`\n- **Start Date:** ${beginDate}`);
        if (endDate)
            md.push(`\n- **End Date:** ${endDate}`);
        md.push("\n");
    }
    // Spatial Extent (Bounding Box)
    const west = (_11 = (_10 = (_9 = (_8 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _8 === void 0 ? void 0 : _8.spdom) === null || _9 === void 0 ? void 0 : _9.bounding) === null || _10 === void 0 ? void 0 : _10.westbc) === null || _11 === void 0 ? void 0 : _11[0];
    const east = (_15 = (_14 = (_13 = (_12 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _12 === void 0 ? void 0 : _12.spdom) === null || _13 === void 0 ? void 0 : _13.bounding) === null || _14 === void 0 ? void 0 : _14.eastbc) === null || _15 === void 0 ? void 0 : _15[0];
    const north = (_19 = (_18 = (_17 = (_16 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _16 === void 0 ? void 0 : _16.spdom) === null || _17 === void 0 ? void 0 : _17.bounding) === null || _18 === void 0 ? void 0 : _18.northbc) === null || _19 === void 0 ? void 0 : _19[0];
    const south = (_23 = (_22 = (_21 = (_20 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _20 === void 0 ? void 0 : _20.spdom) === null || _21 === void 0 ? void 0 : _21.bounding) === null || _22 === void 0 ? void 0 : _22.southbc) === null || _23 === void 0 ? void 0 : _23[0];
    if (west || east || north || south) {
        md.push(`\n**Spatial Extent (Bounding Box):**`);
        if (west)
            md.push(`\n- **West:** ${west}`);
        if (east)
            md.push(`\n- **East:** ${east}`);
        if (north)
            md.push(`\n- **North:** ${north}`);
        if (south)
            md.push(`\n- **South:** ${south}`);
        md.push("\n");
    }
    // Attribute Information (Table)
    const attributes = ((_26 = (_25 = (_24 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _24 === void 0 ? void 0 : _24.eainfo) === null || _25 === void 0 ? void 0 : _25.detailed) === null || _26 === void 0 ? void 0 : _26.attr) || [];
    if (attributes.length > 0) {
        md.push(`\n## Attribute Information\n`);
        md.push("| Attribute Label | Definition | Domain |\n|-----------------|-------------|--------|\n");
        attributes.forEach((attr) => {
            var _a, _b, _c, _d;
            const label = ((_a = attr === null || attr === void 0 ? void 0 : attr.attrlabl) === null || _a === void 0 ? void 0 : _a[0]) || "Unknown";
            const definition = ((_b = attr === null || attr === void 0 ? void 0 : attr.attrdef) === null || _b === void 0 ? void 0 : _b[0]) || "No definition";
            const domain = ((_d = (_c = attr === null || attr === void 0 ? void 0 : attr.attrdomv) === null || _c === void 0 ? void 0 : _c.udom) === null || _d === void 0 ? void 0 : _d[0]) || "No domain";
            md.push(`| ${label} | ${definition} | ${domain} |\n`);
        });
    }
    // Contact Information (Enhanced Parsing without placeholders)
    const contactInfo = ((_29 = (_28 = (_27 = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _27 === void 0 ? void 0 : _27.metainfo) === null || _28 === void 0 ? void 0 : _28.metc) === null || _29 === void 0 ? void 0 : _29.cntinfo) || {};
    const contactOrg = (_31 = (_30 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.cntorgp) === null || _30 === void 0 ? void 0 : _30.cntorg) === null || _31 === void 0 ? void 0 : _31[0];
    const contactPerson = (_32 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.cntper) === null || _32 === void 0 ? void 0 : _32[0];
    const contactPhone = (_33 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.cntvoice) === null || _33 === void 0 ? void 0 : _33[0];
    const contactEmail = (_34 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.cntemail) === null || _34 === void 0 ? void 0 : _34[0];
    const contactAddress = (_37 = (_36 = (_35 = contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.cntaddr) === null || _35 === void 0 ? void 0 : _35[0]) === null || _36 === void 0 ? void 0 : _36.address) === null || _37 === void 0 ? void 0 : _37[0];
    if (contactOrg ||
        contactPerson ||
        contactPhone ||
        contactEmail ||
        contactAddress) {
        md.push(`\n## Contact Information\n`);
        if (contactOrg)
            md.push(`- **Organization:** ${contactOrg}\n`);
        if (contactPerson)
            md.push(`- **Contact Person:** ${contactPerson}\n`);
        if (contactPhone)
            md.push(`- **Phone:** ${contactPhone}\n`);
        if (contactEmail)
            md.push(`- **Email:** ${contactEmail}\n`);
        if (contactAddress)
            md.push(`- **Address:** ${contactAddress}\n`);
    }
    return md.join("");
}
// Get attribution from Esri metadata
export function getAttribution(metadata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    // Try to retrieve the organization from the citation info
    const organization = (_e = (_d = (_c = (_b = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a.idinfo) === null || _b === void 0 ? void 0 : _b.citation) === null || _c === void 0 ? void 0 : _c.citeinfo) === null || _d === void 0 ? void 0 : _d.origin) === null || _e === void 0 ? void 0 : _e[0];
    if (organization) {
        return organization;
    }
    // Fallback to contact organization if citation doesn't have origin
    const contactOrg = (_l = (_k = (_j = (_h = (_g = (_f = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _f === void 0 ? void 0 : _f.metainfo) === null || _g === void 0 ? void 0 : _g.metc) === null || _h === void 0 ? void 0 : _h.cntinfo) === null || _j === void 0 ? void 0 : _j.cntorgp) === null || _k === void 0 ? void 0 : _k.cntorg) === null || _l === void 0 ? void 0 : _l[0];
    return contactOrg || null;
}
