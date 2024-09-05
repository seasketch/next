export function fgdcToMarkdown(metadata: any): string {
  const md: string[] = [];

  // Helper function to safely access arrays
  const getFirst = (value: any) =>
    Array.isArray(value) && value.length > 0 ? value[0] : "";

  // Title
  const idinfo = getFirst(metadata?.metadata?.idinfo);
  const citation = getFirst(idinfo?.citation);
  const citeinfo = getFirst(citation?.citeinfo);
  const title = getFirst(citeinfo?.title);
  md.push(`# ${title || "Untitled"}`);

  // Abstract
  const descript = getFirst(idinfo?.descript);
  const abstract = getFirst(descript?.abstract);
  if (abstract) {
    md.push(`\n**Abstract:** ${abstract.split("Attribute Fields:")[0]}\n`);
  }

  // Purpose
  const purpose = getFirst(descript?.purpose);
  if (purpose) {
    md.push(`\n**Purpose:** ${purpose}\n`);
  }

  // Keywords
  const keywords = getFirst(idinfo?.keywords);
  const theme = getFirst(keywords?.theme);
  const themeKeywords = theme?.themekey.filter(Boolean).join(", ");
  if (themeKeywords) {
    md.push(`\n**Keywords:** ${themeKeywords}\n`);
  }

  // Use Constraints (added section)
  const useConstraints = getFirst(idinfo?.useconst);
  if (useConstraints) {
    md.push(
      `\n**Use Constraints:** ${
        useConstraints.split("Downloaded data filename:")[0]
      }\n`
    );
  }

  // Temporal Coverage
  const timeperd = getFirst(idinfo?.timeperd);
  const timeinfo = getFirst(timeperd?.timeinfo);
  const rngdates = getFirst(timeinfo?.rngdates);
  const beginDate = getFirst(rngdates?.begdate);
  const endDate = getFirst(rngdates?.enddate);
  if (beginDate || endDate) {
    md.push(`\n**Temporal Coverage:**`);
    if (beginDate) md.push(`\n- **Start Date:** ${beginDate}`);
    if (endDate) md.push(`\n- **End Date:** ${endDate}`);
    md.push("\n");
  }

  // Spatial Extent (Bounding Box)
  const spdom = getFirst(metadata?.metadata?.spdom);
  const bounding = getFirst(spdom?.bounding);
  const west = getFirst(bounding?.westbc);
  const east = getFirst(bounding?.eastbc);
  const north = getFirst(bounding?.northbc);
  const south = getFirst(bounding?.southbc);
  if (west || east || north || south) {
    md.push(`\n**Spatial Extent (Bounding Box):**`);
    if (west) md.push(`\n- **West:** ${west}`);
    if (east) md.push(`\n- **East:** ${east}`);
    if (north) md.push(`\n- **North:** ${north}`);
    if (south) md.push(`\n- **South:** ${south}`);
    md.push("\n");
  }

  // Attribute Information (Table)
  const eainfo = getFirst(metadata?.metadata?.eainfo);
  const detailed = eainfo?.detailed?.[0] || {};
  const attributes = detailed?.attr || [];
  if (attributes.length > 0) {
    md.push(`\n## Attribute Information\n`);
    md.push(
      "| Attribute Label | Definition | Domain |\n|-----------------|-------------|--------|\n"
    );
    attributes.forEach((attr: any) => {
      const label = getFirst(attr?.attrlabl) || "Unknown";
      const definition = getFirst(attr?.attrdef) || "";

      // Enhanced Domain Parsing
      let domain = "";
      const attrdomv = getFirst(attr?.attrdomv);
      if (attrdomv?.udom) {
        domain = getFirst(attrdomv?.udom);
      } else if (attrdomv?.rdom) {
        const rdommin = getFirst(attrdomv?.rdom?.rdommin);
        const rdommax = getFirst(attrdomv?.rdom?.rdommax);
        if (rdommin && rdommax) {
          domain = `${rdommin} to ${rdommax}`;
        } else if (rdommin || rdommax) {
          domain = `Value: ${rdommin || rdommax}`;
        }
      }

      md.push(`| ${label} | ${definition} | ${domain} |\n`);
    });
  }

  // Contact Information (Enhanced Parsing without placeholders)
  const metainfo = getFirst(metadata?.metadata?.metainfo);
  const metc = getFirst(metainfo?.metc);
  const cntinfo = getFirst(metc?.cntinfo);
  const cntorgp = getFirst(cntinfo?.cntorgp);
  const contactOrg = getFirst(cntorgp?.cntorg);
  const contactPerson = getFirst(cntinfo?.cntper);
  const contactPhone = getFirst(cntinfo?.cntvoice);
  const contactEmail = getFirst(cntinfo?.cntemail);
  const cntaddr = getFirst(cntinfo?.cntaddr);
  const contactAddress = getFirst(cntaddr?.address);

  if (
    contactOrg ||
    contactPerson ||
    contactPhone ||
    contactEmail ||
    contactAddress
  ) {
    md.push(`\n## Contact Information\n`);
    if (contactOrg) md.push(`- **Organization:** ${contactOrg}\n`);
    if (contactPerson) md.push(`- **Contact Person:** ${contactPerson}\n`);
    if (contactPhone) md.push(`- **Phone:** ${contactPhone}\n`);
    if (contactEmail) md.push(`- **Email:** ${contactEmail}\n`);
    if (contactAddress) md.push(`- **Address:** ${contactAddress}\n`);
  }

  return md.join("");
}

export function getAttribution(metadata: any): string {
  const getFirst = (value: any) =>
    Array.isArray(value) && value.length > 0 ? value[0] : "";

  // Try to retrieve the organization from the citation info
  const idinfo = getFirst(metadata?.metadata?.idinfo);
  const citation = getFirst(idinfo?.citation);
  const citeinfo = getFirst(citation?.citeinfo);
  const organization = getFirst(citeinfo?.origin);
  if (organization) {
    return organization;
  }

  // Fallback to contact organization if citation doesn't have origin
  const metainfo = getFirst(metadata?.metadata?.metainfo);
  const metc = getFirst(metainfo?.metc);
  const cntinfo = getFirst(metc?.cntinfo);
  const cntorgp = getFirst(cntinfo?.cntorgp);
  const contactOrg = getFirst(cntorgp?.cntorg);
  return contactOrg || null;
}
